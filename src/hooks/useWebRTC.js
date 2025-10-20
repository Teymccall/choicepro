import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { WebRTCConnection } from '../utils/webRTC';
import { toast } from 'react-hot-toast';

export const useWebRTC = (user, partner) => {
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, active, ended
  const [callType, setCallType] = useState(null); // 'video' | 'audio'
  const [currentCallId, setCurrentCallId] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pendingCallType, setPendingCallType] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webRTCConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

  // Initialize WebRTC connection
  const initializeConnection = useCallback(() => {
    if (!webRTCConnectionRef.current) {
      webRTCConnectionRef.current = new WebRTCConnection(
        localVideoRef,
        remoteVideoRef,
        (state) => {
          console.log('Connection state changed:', state);
          if (state === 'connected') {
            setConnectionQuality('good');
          } else if (state === 'disconnected' || state === 'failed') {
            setConnectionQuality('poor');
          }
        }
      );
    }
    return webRTCConnectionRef.current;
  }, []);

  // Start call timer
  const startCallTimer = useCallback(() => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  // Request to start call (shows permission prompt first)
  const requestCall = useCallback((type = 'audio') => {
    if (!user || !partner) {
      toast.error('Partner not connected');
      return;
    }
    setPendingCallType(type);
    setShowPermissionPrompt(true);
  }, [user, partner]);

  // Start call (after permission prompt)
  const startCall = useCallback(async (type = 'audio') => {
    if (!user || !partner) {
      toast.error('Partner not connected');
      return;
    }

    // Close permission prompt
    setShowPermissionPrompt(false);
    setPendingCallType(null);

    try {
      setCallType(type);
      setCallStatus('calling');

      // Initialize media
      const connection = initializeConnection();
      const constraints = {
        video: type === 'video',
        audio: true
      };
      
      await connection.initializeMedia(constraints);

      // Create call in Firebase
      const callsRef = ref(rtdb, 'calls');
      const newCallRef = push(callsRef);
      const callId = newCallRef.key;
      
      setCurrentCallId(callId);

      await set(newCallRef, {
        caller: user.uid,
        callerName: user.displayName,
        callerPhotoURL: user.photoURL,
        recipient: partner.uid,
        recipientName: partner.displayName,
        type,
        status: 'ringing',
        createdAt: Date.now()
      });

      // Create notification for partner
      const notificationRef = ref(rtdb, `notifications/${partner.uid}/${callId}`);
      await set(notificationRef, {
        type: 'incoming_call',
        callType: type,
        callId: callId,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        message: `${type === 'video' ? '📹' : '📞'} ${user.displayName} is calling you...`,
        timestamp: Date.now(),
        read: false
      });

      // Create offer
      const offer = await connection.createOffer();
      await update(newCallRef, { offer });

      // Listen for ICE candidates
      connection.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = ref(rtdb, `calls/${callId}/callerCandidates`);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      // Listen for answer and call status changes
      const callRef = ref(rtdb, `calls/${callId}`);
      const unsubscribe = onValue(callRef, async (snapshot) => {
        const callData = snapshot.val();
        
        // If call was deleted or doesn't exist, end it
        if (!callData) {
          endCall();
          return;
        }
        
        if (callData?.answer && connection.peerConnection.signalingState !== 'stable') {
          await connection.setRemoteAnswer(callData.answer);
        }

        if (callData?.status === 'active' && callStatus !== 'active') {
          setCallStatus('active');
          startCallTimer();
        }

        if (callData?.status === 'ended' || callData?.status === 'rejected') {
          endCall();
          unsubscribe();
        }
      });

      // Listen for recipient ICE candidates
      const recipientCandidatesRef = ref(rtdb, `calls/${callId}/recipientCandidates`);
      onValue(recipientCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidate = childSnapshot.val();
          connection.addIceCandidate(candidate);
        });
      });

      toast.success(`Calling ${partner.displayName}...`);
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error(error.message || 'Failed to start call');
      setCallStatus('idle');
    }
  }, [user, partner, initializeConnection, startCallTimer, callStatus]);

  // Answer call
  const answerCall = useCallback(async (callId, callData) => {
    if (!user?.uid || !partner?.uid) return;

    try {
      setCurrentCallId(callId);
      setCallType(callData.type);
      setCallStatus('active');

      // Initialize media
      const connection = initializeConnection();
      const constraints = {
        video: callData.type === 'video',
        audio: true
      };
      
      await connection.initializeMedia(constraints);

      // Create answer
      const answer = await connection.createAnswer(callData.offer);
      
      const callRef = ref(rtdb, `calls/${callId}`);
      await update(callRef, {
        answer,
        status: 'active',
        answeredAt: Date.now()
      });

      // Remove incoming call notification
      if (user?.uid) {
        const notificationRef = ref(rtdb, `notifications/${user.uid}/${callId}`);
        remove(notificationRef);
      }

      // Listen for ICE candidates
      connection.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = ref(rtdb, `calls/${callId}/recipientCandidates`);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      // Listen for caller ICE candidates
      const callerCandidatesRef = ref(rtdb, `calls/${callId}/callerCandidates`);
      onValue(callerCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidate = childSnapshot.val();
          connection.addIceCandidate(candidate);
        });
      });

      // Listen for call status changes (if caller ends call)
      const callStatusRef = ref(rtdb, `calls/${callId}`);
      onValue(callStatusRef, (snapshot) => {
        const callData = snapshot.val();
        
        // If call was deleted or ended, close this side too
        if (!callData || callData?.status === 'ended' || callData?.status === 'rejected') {
          // Close connection and reset state
          if (webRTCConnectionRef.current) {
            webRTCConnectionRef.current.close();
            webRTCConnectionRef.current = null;
          }
          stopCallTimer();
          setCallStatus('idle');
          setCurrentCallId(null);
          setCallType(null);
          setIsAudioEnabled(true);
          setIsVideoEnabled(true);
          toast('Call ended');
        }
      });

      startCallTimer();
      toast.success('Call connected');
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error('Failed to answer call');
      // Close connection on error
      if (webRTCConnectionRef.current) {
        webRTCConnectionRef.current.close();
        webRTCConnectionRef.current = null;
      }
      stopCallTimer();
      setCallStatus('idle');
      setCurrentCallId(null);
    }
  }, [user, partner, initializeConnection, startCallTimer, stopCallTimer]);

  // Reject call
  const rejectCall = useCallback(async (callId) => {
    if (!callId) return;

    try {
      const callRef = ref(rtdb, `calls/${callId}`);
      await update(callRef, {
        status: 'rejected',
        endedAt: Date.now()
      });

      // Remove notification
      if (user?.uid) {
        const notificationRef = ref(rtdb, `notifications/${user.uid}/${callId}`);
        remove(notificationRef);
      }

      setCallStatus('idle');
      setCurrentCallId(null);
      toast('Call rejected');
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }, [user]);

  // End call
  const endCall = useCallback(async () => {
    try {
      if (currentCallId) {
        const callRef = ref(rtdb, `calls/${currentCallId}`);
        await update(callRef, {
          status: 'ended',
          endedAt: Date.now()
        });

        // Remove notification for both users
        if (user?.uid) {
          const userNotificationRef = ref(rtdb, `notifications/${user.uid}/${currentCallId}`);
          remove(userNotificationRef);
        }
        if (partner?.uid) {
          const partnerNotificationRef = ref(rtdb, `notifications/${partner.uid}/${currentCallId}`);
          remove(partnerNotificationRef);
        }

        // Clean up after 30 seconds
        setTimeout(() => {
          remove(callRef);
        }, 30000);
      }

      if (webRTCConnectionRef.current) {
        webRTCConnectionRef.current.close();
        webRTCConnectionRef.current = null;
      }

      stopCallTimer();
      setCallStatus('idle');
      setCurrentCallId(null);
      setCallType(null);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      iceCandidatesQueueRef.current = [];

      toast('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [currentCallId, stopCallTimer, user, partner]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (webRTCConnectionRef.current) {
      const newState = !isAudioEnabled;
      webRTCConnectionRef.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  }, [isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (webRTCConnectionRef.current) {
      const newState = !isVideoEnabled;
      webRTCConnectionRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    }
  }, [isVideoEnabled]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newState = !isSpeakerOn;
    setIsSpeakerOn(newState);
    
    // Set audio output (only works on some browsers)
    if (remoteVideoRef.current && remoteVideoRef.current.setSinkId) {
      remoteVideoRef.current.setSinkId(newState ? 'default' : '')
        .then(() => {
          toast.success(newState ? '🔊 Speaker ON' : '📱 Earpiece', { duration: 1500 });
        })
        .catch(err => {
          console.error('Error switching audio output:', err);
        });
    } else {
      // Fallback: adjust volume
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = newState ? 1.0 : 0.7;
      }
      toast.success(newState ? '🔊 Speaker ON' : '📱 Earpiece', { duration: 1500 });
    }
  }, [isSpeakerOn]);

  // Cleanup on unmount or page refresh
  useEffect(() => {
    // Cleanup function when component unmounts
    const cleanup = async () => {
      if (currentCallId) {
        try {
          const callRef = ref(rtdb, `calls/${currentCallId}`);
          await update(callRef, {
            status: 'ended',
            endedAt: Date.now()
          });
        } catch (error) {
          console.error('Error cleaning up call:', error);
        }
      }
      
      if (webRTCConnectionRef.current) {
        webRTCConnectionRef.current.close();
      }
      stopCallTimer();
    };

    // Handle page refresh/close
    const handleBeforeUnload = async () => {
      if (currentCallId) {
        const callRef = ref(rtdb, `calls/${currentCallId}`);
        await update(callRef, {
          status: 'ended',
          endedAt: Date.now()
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanup();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stopCallTimer, currentCallId]);

  return {
    callStatus,
    callType,
    currentCallId,
    isAudioEnabled,
    isVideoEnabled,
    isSpeakerOn,
    callDuration,
    connectionQuality,
    localVideoRef,
    remoteVideoRef,
    showPermissionPrompt,
    pendingCallType,
    requestCall,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
    cancelPermissionPrompt: () => {
      setShowPermissionPrompt(false);
      setPendingCallType(null);
    }
  };
};
