import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, onValue, update, remove } from 'firebase/database';
import { rtdb } from '../firebase/config';
import ZegoVideoCall from './ZegoVideoCall';
import ZegoAudioCall from './ZegoAudioCall';
import { PhoneIcon, PhoneXMarkIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const CallManager = () => {
  const { user, partner } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isRinging, setIsRinging] = useState(false);

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.uid) return;

    const callRef = ref(rtdb, `calls/${user.uid}`);
    const unsubscribe = onValue(callRef, (snapshot) => {
      const callData = snapshot.val();
      
      if (callData && callData.status === 'ringing') {
        console.log('📞 Incoming call:', callData);
        setIncomingCall(callData);
        setIsRinging(true);
        
        // Play ringtone
        try {
          const audio = new Audio('/notification.mp3');
          audio.loop = true;
          audio.play().catch(err => console.log('Audio play error:', err));
          
          // Store audio instance to stop later
          window.ringtoneAudio = audio;
        } catch (error) {
          console.error('Ringtone error:', error);
        }
      } else {
        setIncomingCall(null);
        setIsRinging(false);
        
        // Stop ringtone
        if (window.ringtoneAudio) {
          window.ringtoneAudio.pause();
          window.ringtoneAudio = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (window.ringtoneAudio) {
        window.ringtoneAudio.pause();
        window.ringtoneAudio = null;
      }
    };
  }, [user?.uid]);

  const handleAcceptCall = async () => {
    if (!incomingCall || !user?.uid) return;

    try {
      // Stop ringtone
      if (window.ringtoneAudio) {
        window.ringtoneAudio.pause();
        window.ringtoneAudio = null;
      }

      // IMPORTANT: Request microphone permission BEFORE joining
      // This satisfies browser autoplay policy and enables audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: incomingCall.callType === 'video' 
        });
        // Stop the test stream - ZegoCloud will create its own
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Microphone permission granted');
      } catch (err) {
        console.error('❌ Microphone permission denied:', err);
        toast.error('Microphone access required for calls');
        return;
      }

      // Update call status
      await update(ref(rtdb, `calls/${user.uid}`), {
        status: 'active',
        acceptedAt: Date.now(),
      });

      // Also update caller's call status
      await update(ref(rtdb, `calls/${incomingCall.callerId}`), {
        status: 'active',
        acceptedAt: Date.now(),
      });

      // Set active call
      setActiveCall({
        roomID: incomingCall.roomID,
        callType: incomingCall.callType,
        partnerID: incomingCall.callerId,
        partnerName: incomingCall.callerName,
      });

      setIncomingCall(null);
      setIsRinging(false);
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to accept call');
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall || !user?.uid) return;

    try {
      // Stop ringtone
      if (window.ringtoneAudio) {
        window.ringtoneAudio.pause();
        window.ringtoneAudio = null;
      }

      // Remove call data
      await remove(ref(rtdb, `calls/${user.uid}`));
      await remove(ref(rtdb, `calls/${incomingCall.callerId}`));

      setIncomingCall(null);
      setIsRinging(false);

      toast('Call declined', { icon: '📞' });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const handleEndCall = async () => {
    if (!user?.uid) return;

    try {
      // Remove call data
      await remove(ref(rtdb, `calls/${user.uid}`));
      
      if (activeCall?.partnerID) {
        await remove(ref(rtdb, `calls/${activeCall.partnerID}`));
      }

      setActiveCall(null);
      toast.success('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // Render active call
  if (activeCall) {
    const userName = user?.displayName || user?.email?.split('@')[0] || 'User';
    const userID = user?.uid || 'unknown';

    if (activeCall.callType === 'video') {
      return (
        <ZegoVideoCall
          roomID={activeCall.roomID}
          userID={userID}
          userName={userName}
          partnerName={activeCall.partnerName}
          onCallEnd={handleEndCall}
        />
      );
    } else {
      return (
        <ZegoAudioCall
          roomID={activeCall.roomID}
          userID={userID}
          userName={userName}
          partnerName={activeCall.partnerName}
          onCallEnd={handleEndCall}
        />
      );
    }
  }

  // Render incoming call notification
  if (isRinging && incomingCall) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        style={{
          paddingTop: 'calc(var(--safe-area-inset-top) + 1.5rem)',
          paddingBottom: 'calc(var(--safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-bounce-in">
          {/* Call Type Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                {incomingCall.callType === 'video' ? (
                  <VideoCameraIcon className="h-10 w-10 text-white" />
                ) : (
                  <PhoneIcon className="h-10 w-10 text-white animate-bounce" />
                )}
              </div>
            </div>
          </div>

          {/* Caller Info */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {incomingCall.callerName}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Incoming {incomingCall.callType} call
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {/* Decline */}
            <button
              onClick={handleRejectCall}
              className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            >
              <PhoneXMarkIcon className="h-6 w-6" />
              Decline
            </button>

            {/* Accept */}
            <button
              onClick={handleAcceptCall}
              className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            >
              {incomingCall.callType === 'video' ? (
                <VideoCameraIcon className="h-6 w-6" />
              ) : (
                <PhoneIcon className="h-6 w-6" />
              )}
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CallManager;
