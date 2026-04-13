import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, set, push, remove, update, query, orderByChild, equalTo, get } from 'firebase/database';
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
  const callEpochRef = useRef(null);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pendingCallType, setPendingCallType] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null); // { callId, data }

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webRTCConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const callerCandidatesQueueRef = useRef([]);
  const recipientCandidatesQueueRef = useRef([]);
  const qualityCheckIntervalRef = useRef(null);
  const reconnectionAttemptRef = useRef(0);
  const reconnectionTimeoutRef = useRef(null);
  const MAX_RECONNECTION_ATTEMPTS = 3;
  const isEndingCallRef = useRef(false);
  const isRejectingCallRef = useRef(false);
  const callInitializingRef = useRef(false);
  const lastCallIdRef = useRef(null);
  const hasShownConnectedToastRef = useRef(false);
  const hasShownEndToastRef = useRef(false);

  // Initialize WebRTC connection (attemptReconnection defined later)
  const initializeConnection = useCallback(() => {
    if (!webRTCConnectionRef.current) {
      webRTCConnectionRef.current = new WebRTCConnection(
        localVideoRef,
        remoteVideoRef,
        (state) => {
          console.log('Connection state changed:', state);
          
          if (state === 'connected') {
            setConnectionQuality('good');
            // Reset reconnection attempts on successful connection
            reconnectionAttemptRef.current = 0;
            if (reconnectionTimeoutRef.current) {
              clearTimeout(reconnectionTimeoutRef.current);
              reconnectionTimeoutRef.current = null;
            }
            
            // Notify user if this was a reconnection
            if (callStatus === 'active' && connectionQuality === 'poor') {
              toast.success('Connection restored!', { duration: 2000 });
            }
          } else if (state === 'connecting') {
            setConnectionQuality('fair');
          } else if (state === 'disconnected') {
            console.log('Connection disconnected, may reconnect automatically');
            setConnectionQuality('poor');
            
            // Only attempt reconnection if call is active
            // Note: attemptReconnection is called inline to avoid dependency issues
            if (callStatus === 'active' && reconnectionAttemptRef.current < MAX_RECONNECTION_ATTEMPTS) {
              reconnectionAttemptRef.current += 1;
              console.log(`Reconnection attempt ${reconnectionAttemptRef.current}/${MAX_RECONNECTION_ATTEMPTS}`);
              
              toast(
                `Connection lost. Reconnecting... (${reconnectionAttemptRef.current}/${MAX_RECONNECTION_ATTEMPTS})`,
                { icon: '🔄', duration: 3000 }
              );

              const delay = reconnectionAttemptRef.current * 2000;
              reconnectionTimeoutRef.current = setTimeout(() => {
                console.log('Waiting for ICE to renegotiate...');
              }, delay);
            } else if (callStatus === 'active' && reconnectionAttemptRef.current >= MAX_RECONNECTION_ATTEMPTS) {
              console.log('Max reconnection attempts reached');
              toast.error('Connection lost. Call will end.', { duration: 4000 });
              // Use setTimeout to break out of this callback
              setTimeout(() => {
                // Will be handled by cleanup
                setCallStatus('idle');
              }, 2000);
            }
          } else if (state === 'failed') {
            console.log('Connection failed - call status:', callStatus);
            setConnectionQuality('poor');
            
            // Don't end call immediately if we're still in 'calling' state (initial connection)
            // Give it time to establish connection
            if (callStatus === 'calling') {
              console.log('⏳ Still establishing initial connection, not ending call yet');
              return;
            }
            
            // Attempt reconnection for failed state (inline to avoid dependency)
            if (callStatus === 'active' && reconnectionAttemptRef.current < MAX_RECONNECTION_ATTEMPTS) {
              reconnectionAttemptRef.current += 1;
              console.log(`Reconnection attempt ${reconnectionAttemptRef.current}/${MAX_RECONNECTION_ATTEMPTS}`);
              
              toast(
                `Connection lost. Reconnecting... (${reconnectionAttemptRef.current}/${MAX_RECONNECTION_ATTEMPTS})`,
                { icon: '🔄', duration: 3000 }
              );

              const delay = reconnectionAttemptRef.current * 2000;
              reconnectionTimeoutRef.current = setTimeout(() => {
                console.log('Waiting for ICE to renegotiate...');
              }, delay);
            } else if (callStatus === 'active' && reconnectionAttemptRef.current >= MAX_RECONNECTION_ATTEMPTS) {
              console.log('Max reconnection attempts reached');
              toast.error('Connection lost. Call will end.', { duration: 4000 });
              setTimeout(() => {
                setCallStatus('idle');
              }, 2000);
            }
          }
        }
      );
    }
    return webRTCConnectionRef.current;
  }, [callStatus, connectionQuality, MAX_RECONNECTION_ATTEMPTS]);

  // Start call timer — uses a shared epoch so both partners show the same time
  const startCallTimer = useCallback((epoch) => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callEpochRef.current = epoch || Date.now();
    const tick = () => {
      setCallDuration(Math.floor((Date.now() - callEpochRef.current) / 1000));
    };
    tick(); // immediate first tick
    callTimerRef.current = setInterval(tick, 1000);
  }, []);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  // Start network quality monitoring
  const startQualityMonitoring = useCallback(() => {
    if (qualityCheckIntervalRef.current) return;

    qualityCheckIntervalRef.current = setInterval(async () => {
      if (!webRTCConnectionRef.current?.peerConnection) return;

      try {
        const stats = await webRTCConnectionRef.current.getConnectionStats();
        
        if (!stats) return;

        // Check packet loss
        const packetsLost = stats.packetsLost || 0;
        const jitter = stats.jitter || 0;
        
        // Determine quality based on metrics
        // Packet loss thresholds: < 1% = excellent, 1-3% = good, 3-5% = fair, > 5% = poor
        let quality = 'good';
        let shouldWarn = false;
        
        if (packetsLost > 100 || jitter > 100) {
          quality = 'poor';
          shouldWarn = true;
        } else if (packetsLost > 50 || jitter > 50) {
          quality = 'fair';
        }
        
        setConnectionQuality(quality);
        
        // Warn user only if quality degrades significantly
        if (shouldWarn && connectionQuality !== 'poor') {
          toast('⚠️ Poor connection quality. Video may lag.', {
            duration: 3000,
            icon: '📶'
          });
        }
        
        console.log('Connection stats:', {
          quality,
          packetsLost,
          jitter,
          bytesReceived: stats.bytesReceived
        });
      } catch (error) {
        console.error('Error checking connection stats:', error);
      }
    }, 5000); // Check every 5 seconds
  }, [connectionQuality]);

  // Stop quality monitoring
  const stopQualityMonitoring = useCallback(() => {
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }
  }, []);

  // Listen for incoming calls directed to the current user
  useEffect(() => {
    if (!user?.uid) {
      setIncomingCall(null);
      return undefined;
    }

    const callsQuery = query(ref(rtdb, 'calls'), orderByChild('recipient'), equalTo(user.uid));

    const unsubscribe = onValue(callsQuery, (snapshot) => {
      let foundCall = null;

      snapshot.forEach((childSnapshot) => {
        if (foundCall) return true; // break iteration
        const data = childSnapshot.val();
        if (data && data.status === 'ringing' && data.recipient === user?.uid) {
          foundCall = {
            callId: childSnapshot.key,
            data,
          };
          return true;
        }
        return false;
      });

      if (foundCall) {
        setIncomingCall(foundCall);
        if (callStatus === 'idle') {
          setCallStatus('ringing');
        }
      } else {
        setIncomingCall(null);
        if (callStatus === 'ringing') {
          setCallStatus('idle');
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, callStatus]);

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

    // Prevent duplicate call starts with debounce
    if (callInitializingRef.current) {
      console.log('⚠️ Call initialization already in progress');
      return;
    }
    
    callInitializingRef.current = true;

    // Close permission prompt
    setShowPermissionPrompt(false);
    setPendingCallType(null);

    try {
      setCallType(type);
      setCallStatus('calling');
      
      // Reset toast ref for new call
      hasShownConnectedToastRef.current = false;
      hasShownEndToastRef.current = false;

      // Initialize media
      const connection = initializeConnection();
      const constraints = {
        video: type === 'video',
        audio: true
      };
      
      console.log('Initializing media with constraints:', constraints);
      const stream = await connection.initializeMedia(constraints);
      console.log('Media initialized, stream:', stream, 'tracks:', stream.getTracks());
      
      // Ensure video state is properly set based on call type
      if (type === 'video') {
        console.log('🎥 Video call - ensuring video is enabled');
        setIsVideoEnabled(true);
        // Make sure video tracks are enabled
        stream.getVideoTracks().forEach(track => {
          track.enabled = true;
          console.log(`📹 Video track ${track.id} enabled: ${track.enabled}`);
        });
      } else {
        console.log('🎵 Audio call - disabling video');
        setIsVideoEnabled(false);
      }

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

      // Send background push via Vercel Serverless API to wake up closed app
      try {
        const tokensRef = ref(rtdb, `users/${partner.uid}/fcmTokens`);
        const snapshot = await get(tokensRef);
        if (snapshot.exists()) {
          const tokens = snapshot.val();
          const tokenList = Object.values(tokens).map(t => typeof t === 'string' ? t : t.token);
          
          if (tokenList.length > 0) {
             const payload = {
                title: 'Incoming Call',
                body: `${type === 'video' ? '📹' : '📞'} ${user.displayName} is calling you...`,
                data: {
                  type: 'incoming_call',
                  callId: callId,
                  callType: type,
                  channelName: 'calls'
                }
             };
             
             // Ping our secure Vercel API
             await Promise.all(tokenList.map(token => 
               fetch('/api/send-push', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({ ...payload, token })
               }).catch(err => console.error("Failed to push to API", err))
             ));
             console.log("Successfully pinged /api/send-push for", tokenList.length, "tokens");
          }
        }
      } catch (pushErr) {
        console.error('Error triggering push API:', pushErr);
      }

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
        
        // Ignore transient null data (Firebase sync delay, especially on mobile PWA)
        if (!callData) {
          return;
        }
        
        // Check if call was ended or rejected by the REMOTE party.
        // Do LOCAL-ONLY cleanup — do NOT call endCall() which writes back
        // to Firebase and creates a feedback loop that crashes PWA calls.
        if (callData.status === 'ended' || callData.status === 'rejected') {
          console.log('📞 Caller: Call ended/rejected by remote party');
          unsubscribe();
          
          // Local cleanup only — no Firebase write
          if (webRTCConnectionRef.current) {
            webRTCConnectionRef.current.close();
            webRTCConnectionRef.current = null;
          }
          stopCallTimer();
          stopQualityMonitoring();
          setCallStatus('idle');
          setCurrentCallId(null);
          setCallType(null);
          setIsAudioEnabled(true);
          setIsVideoEnabled(true);
          setConnectionQuality('good');
          hasShownConnectedToastRef.current = false;
          
          if (!hasShownEndToastRef.current) {
            hasShownEndToastRef.current = true;
            toast('Call ended');
          }
          return;
        }
        
        // Process answer if available
        if (callData.answer && connection.peerConnection.signalingState !== 'stable') {
          console.log('📥 Caller: Received answer from recipient');
          await connection.setRemoteAnswer(callData.answer);
          
          // Process queued recipient ICE candidates after answer is set
          recipientCandidatesQueueRef.current.forEach(candidate => {
            connection.addIceCandidate(candidate);
          });
          recipientCandidatesQueueRef.current = [];
        }

        // Transition to active when recipient accepts — use answeredAt as shared timer epoch
        if (callData.status === 'active' && callStatus !== 'active') {
          console.log('✅ Caller: Call accepted! Transitioning to active state');
          setCallStatus('active');
          startCallTimer(callData.answeredAt || Date.now());
          startQualityMonitoring();
          
          // Show toast only once
          if (!hasShownConnectedToastRef.current) {
            hasShownConnectedToastRef.current = true;
            toast.success('Call connected!');
          }
        }
      });

      // Listen for recipient ICE candidates
      const recipientCandidatesRef = ref(rtdb, `calls/${callId}/recipientCandidates`);
      onValue(recipientCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidate = childSnapshot.val();
          
          // Only add candidate if remote description is set
          if (connection.peerConnection.remoteDescription) {
            connection.addIceCandidate(candidate);
          } else {
            // Queue candidate for later processing
            console.log('Queueing recipient ICE candidate (no remote description yet)');
            recipientCandidatesQueueRef.current.push(candidate);
          }
        });
      });

      toast.success(`Calling ${partner.displayName}...`);
    } catch (error) {
      console.error('Error starting call:', error);
      
      // Cleanup on error
      if (webRTCConnectionRef.current) {
        webRTCConnectionRef.current.close();
        webRTCConnectionRef.current = null;
      }
      
      // Display detailed error message
      if (error.details) {
        toast.error(
          <div>
            <div className="font-semibold">{error.message}</div>
            <div className="text-sm mt-1">{error.details}</div>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error(error.message || 'Failed to start call');
      }
      
      setCallStatus('idle');
      setCurrentCallId(null);
    } finally {
      // Reset flag after delay to prevent rapid re-clicks
      setTimeout(() => {
        callInitializingRef.current = false;
      }, 1000);
    }
  }, [user, partner, initializeConnection, startCallTimer, startQualityMonitoring, callStatus]);

  // Answer call
  const answerCall = useCallback(async (callId, callData) => {
    if (!user?.uid || !partner?.uid) return;

    // Prevent duplicate answer attempts with debounce
    if (callInitializingRef.current || lastCallIdRef.current === callId) {
      console.log('⚠️ Call already being processed');
      return;
    }
    
    callInitializingRef.current = true;
    lastCallIdRef.current = callId;

    console.log('🎯 answerCall started:', { 
      callId, 
      callType: callData.type,
      userAgent: navigator.userAgent,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });

    try {
      setCurrentCallId(callId);
      setCallType(callData.type);
      // Don't set to 'active' yet - wait until media is ready

      // Reset refs for new call
      hasShownConnectedToastRef.current = false;
      hasShownEndToastRef.current = false;

      // Initialize media FIRST
      console.log('📱 Step 1: Initializing WebRTC connection...');
      const connection = initializeConnection();
      console.log('✅ WebRTC connection initialized');
      
      const constraints = {
        video: callData.type === 'video',
        audio: true
      };
      
      console.log('🎬 Step 2: Initializing media with constraints:', constraints);
      const stream = await connection.initializeMedia(constraints);
      console.log('✅ Step 2 Complete: Media initialized successfully', {
        streamId: stream.id,
        tracks: stream.getTracks().map(t => ({ 
          id: t.id, 
          kind: t.kind, 
          enabled: t.enabled, 
          readyState: t.readyState 
        }))
      });
      
      // Ensure video state is properly set based on call type
      if (callData.type === 'video') {
        console.log('🎥 Step 3: Answering video call - ensuring video is enabled');
        setIsVideoEnabled(true);
        // Make sure video tracks are enabled
        stream.getVideoTracks().forEach(track => {
          track.enabled = true;
          console.log(`📹 Video track ${track.id} enabled: ${track.enabled}`);
        });
      } else {
        console.log('🎵 Step 3: Answering audio call - disabling video');
        setIsVideoEnabled(false);
      }

      console.log('📡 Step 4: Setting remote offer...');
      // Set remote offer first
      await connection.setRemoteOffer(callData.offer);
      console.log('✅ Step 4 Complete: Remote offer set successfully');
      
      // Process queued caller ICE candidates after offer is set
      console.log(`🧊 Step 5: Processing ${callerCandidatesQueueRef.current.length} queued caller candidates`);
      callerCandidatesQueueRef.current.forEach(candidate => {
        connection.addIceCandidate(candidate);
      });
      callerCandidatesQueueRef.current = [];
      console.log('✅ Step 5 Complete: ICE candidates processed');
      
      console.log('📝 Step 6: Creating answer...');
      // Create answer
      const answer = await connection.createAnswer();
      console.log('✅ Step 6 Complete: Answer created successfully', {
        type: answer.type,
        sdpLength: answer.sdp?.length || 0
      });
      
      console.log('⏱️ Step 7: Waiting for ICE gathering...');
      // Small delay to ensure ICE candidates are gathered
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Step 7 Complete: ICE gathering delay finished');
      
      const callRef = ref(rtdb, `calls/${callId}`);
      console.log('📤 Step 8: Updating Firebase with answer...');
      try {
        await update(callRef, {
          answer,
          status: 'active',
          answeredAt: Date.now()
        });
        console.log('✅ Step 8 Complete: Call status updated to active in Firebase');
      } catch (fbError) {
        console.error('❌ Step 8 Failed: Firebase update error:', fbError);
        throw new Error(`Firebase error: ${fbError.message}`);
      }

      // NOW set local status to active
      setCallStatus('active');

      // Start call timer using our own answeredAt as epoch (synced with caller via Firebase)
      startCallTimer(Date.now());
      startQualityMonitoring();

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
          
          // Only add candidate if remote description is set
          if (connection.peerConnection.remoteDescription) {
            connection.addIceCandidate(candidate);
          } else {
            // Queue candidate for later processing
            console.log('Queueing caller ICE candidate (no remote description yet)');
            callerCandidatesQueueRef.current.push(candidate);
          }
        });
      });

      // Listen for call status changes (if caller ends call)
      const callStatusRef = ref(rtdb, `calls/${callId}`);
      const callStatusUnsubscribe = onValue(callStatusRef, (snapshot) => {
        const callData = snapshot.val();
        
        // Ignore transient null data (mobile PWA Firebase sync delay)
        if (!callData) return;
        
        // Only end call if explicitly ended/rejected
        if (callData.status === 'ended' || callData.status === 'rejected') {
          console.log('📞 Receiver: Call ended by remote party');
          callStatusUnsubscribe();
          
          // Local cleanup only — no Firebase write
          if (webRTCConnectionRef.current) {
            webRTCConnectionRef.current.close();
            webRTCConnectionRef.current = null;
          }
          stopCallTimer();
          stopQualityMonitoring();
          setCallStatus('idle');
          setCurrentCallId(null);
          setCallType(null);
          setIsAudioEnabled(true);
          setIsVideoEnabled(true);
          setConnectionQuality('good');
          hasShownConnectedToastRef.current = false;
          
          if (!hasShownEndToastRef.current) {
            hasShownEndToastRef.current = true;
            toast('Call ended');
          }
        }
      });

      console.log('🎉 Call answered successfully - all steps completed');
      // Toast already shown on caller side when status becomes 'active'
    } catch (error) {
      console.error('❌ answerCall FAILED:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        details: error.details,
        constraints: error.constraints,
        originalError: error.originalError
      });
      
      // Cleanup on error
      console.log('🧹 Cleaning up after answerCall error...');
      if (webRTCConnectionRef.current) {
        webRTCConnectionRef.current.close();
        webRTCConnectionRef.current = null;
        console.log('✅ WebRTC connection closed');
      }
      
      // Display detailed error message
      if (error.details) {
        toast.error(
          <div>
            <div className="font-semibold">{error.message}</div>
            <div className="text-sm mt-1">{error.details}</div>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error(`Failed to answer call: ${error.message}`, { duration: 6000 });
      }
      
      stopCallTimer();
      setCallStatus('idle');
      setCurrentCallId(null);
      lastCallIdRef.current = null;
      hasShownConnectedToastRef.current = false; // Reset for next call
      console.log('✅ Cleanup completed after answerCall error');
    } finally {
      // Reset flag after delay
      setTimeout(() => {
        callInitializingRef.current = false;
        console.log('🔄 callInitializingRef reset to false');
      }, 1000);
    }
  }, [user, partner, initializeConnection, startCallTimer, stopCallTimer, startQualityMonitoring]);

  // Reject call
  const rejectCall = useCallback(async (callId) => {
    if (!callId) return;

    // Prevent duplicate calls
    if (isRejectingCallRef.current) {
      console.log('⚠️ rejectCall already in progress, skipping duplicate call');
      return;
    }
    
    isRejectingCallRef.current = true;

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
      setIncomingCall(null);
      toast('Call rejected');
    } catch (error) {
      console.error('Error rejecting call:', error);
    } finally {
      // Reset flag for future calls
      isRejectingCallRef.current = false;
    }
  }, [user]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall?.callId || !incomingCall?.data) {
      return;
    }

    try {
      await answerCall(incomingCall.callId, incomingCall.data);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting incoming call:', error);
      toast.error('Unable to connect call');
    }
  }, [incomingCall, answerCall]);

  const declineIncomingCall = useCallback(async () => {
    if (!incomingCall?.callId) {
      return;
    }

    try {
      await rejectCall(incomingCall.callId);
    } catch (error) {
      console.error('Error rejecting incoming call:', error);
    } finally {
      setIncomingCall(null);
    }
  }, [incomingCall, rejectCall]);

  // End call
  const endCall = useCallback(async () => {
    console.log('🔴 endCall function called! Current state:', { currentCallId, callStatus, callType });
    
    // Prevent duplicate calls
    if (isEndingCallRef.current) {
      console.log('⚠️ endCall already in progress, skipping duplicate call');
      return;
    }
    
    isEndingCallRef.current = true;
    
    try {
      if (currentCallId) {
        console.log('🔴 Updating call status to ended in Firebase...');
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
      stopQualityMonitoring();
      
      // Clear reconnection timeout
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
        reconnectionTimeoutRef.current = null;
      }
      reconnectionAttemptRef.current = 0;
      
      setCallStatus('idle');
      setCurrentCallId(null);
      setCallType(null);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      setConnectionQuality('good');
      iceCandidatesQueueRef.current = [];
      callerCandidatesQueueRef.current = [];
      recipientCandidatesQueueRef.current = [];
      hasShownConnectedToastRef.current = false; // Reset for next call

      toast('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      // Reset flag so future calls can end
      isEndingCallRef.current = false;
    }
  }, [currentCallId, stopCallTimer, stopQualityMonitoring, user, partner]);

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
      console.log(`🎥 Video toggle clicked: ${isVideoEnabled} -> ${newState}`);
      webRTCConnectionRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    } else {
      console.warn('⚠️ No WebRTC connection available for video toggle');
    }
  }, [isVideoEnabled]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newState = !isSpeakerOn;
    setIsSpeakerOn(newState);
    if (remoteVideoRef.current && typeof remoteVideoRef.current.setSinkId === 'function') {
      const targetId = newState ? 'speaker' : 'default';
      remoteVideoRef.current.setSinkId(targetId)
        .then(() => {
          toast.success(newState ? '🔊 Speaker ON' : '📱 Earpiece', { duration: 1500 });
        })
        .catch(err => {
          console.error('Error switching audio output:', err);
          setIsSpeakerOn(!newState);
        });
    } else {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = newState ? 1 : 0.4;
      }
      toast.success(newState ? '🔊 Speaker ON' : '📱 Earpiece', { duration: 1500 });
    }
  }, [isSpeakerOn]);

  // Apply pending remote stream when video element becomes available
  useEffect(() => {
    if (callStatus === 'active' && webRTCConnectionRef.current && remoteVideoRef.current) {
      const applied = webRTCConnectionRef.current.applyPendingRemoteStream();
      if (applied) {
        console.log('✅ Applied pending remote stream after video element rendered');
      }
    }
  }, [callStatus, remoteVideoRef]);

  // Apply pending local stream when video element becomes available
  useEffect(() => {
    if (callStatus !== 'idle' && webRTCConnectionRef.current) {
      // For audio calls, apply immediately (no video ref needed)
      // For video calls, wait for localVideoRef.current
      if (callType === 'audio' || localVideoRef.current) {
        const applied = webRTCConnectionRef.current.applyPendingLocalStream(callType);
        if (applied) {
          console.log('✅ Applied pending local stream after video element rendered');
        }
      }
    }
  }, [callStatus, callType, localVideoRef]);

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
      stopQualityMonitoring();
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
  }, [stopCallTimer, stopQualityMonitoring, currentCallId]);

  return {
    callStatus,
    callType,
    currentCallId,
    isAudioEnabled,
    isVideoEnabled,
    isSpeakerOn,
    callDuration,
    connectionQuality,
    incomingCall,
    localVideoRef,
    remoteVideoRef,
    showPermissionPrompt,
    pendingCallType,
    requestCall,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    acceptIncomingCall,
    declineIncomingCall,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
    cancelPermissionPrompt: () => {
      setShowPermissionPrompt(false);
      setPendingCallType(null);
    }
  };
};
