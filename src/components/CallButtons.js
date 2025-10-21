import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ref, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { PhoneIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const CallButtons = () => {
  const { user, partner } = useAuth();
  const [isInitiating, setIsInitiating] = useState(false);
  
  console.log('🔘 CallButtons rendered:', { 
    hasUser: !!user, 
    hasPartner: !!partner, 
    partnerUid: partner?.uid,
    userName: user?.displayName || user?.email 
  });

  const initiateCall = async (callType) => {
    console.log('🎯 Call button clicked!', { callType, hasPartner: !!partner?.uid, hasUser: !!user?.uid });
    
    if (!partner?.uid || !user?.uid) {
      console.error('❌ No partner or user:', { partner: partner?.uid, user: user?.uid });
      toast.error('Partner not connected');
      return;
    }

    if (isInitiating) {
      console.log('⏳ Already initiating a call...');
      return;
    }

    console.log('📞 Starting call initiation...');
    
    try {
      setIsInitiating(true);

      // CRITICAL: Request microphone permission BEFORE creating call
      // This satisfies browser autoplay policy and enables audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: callType === 'video' 
        });
        // Stop the test stream - ZegoCloud will create its own
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Microphone/camera permission granted');
      } catch (err) {
        console.error('❌ Media permission denied:', err);
        toast.error('Microphone access required for calls');
        setIsInitiating(false);
        return;
      }

      // Generate unique room ID
      const roomID = `room_${user.uid}_${partner.uid}_${Date.now()}`;
      const userName = user.displayName || user.email?.split('@')[0] || 'User';
      
      console.log('📝 Creating call data:', { roomID, userName, callType });

      // Create call data for partner
      console.log('💾 Writing to Firebase: calls/' + partner.uid);
      await set(ref(rtdb, `calls/${partner.uid}`), {
        callerId: user.uid,
        callerName: userName,
        callType: callType,
        roomID: roomID,
        status: 'ringing',
        timestamp: Date.now(),
      });
      console.log('✅ Partner call data created');

      // Create call data for self (to track call state)
      console.log('💾 Writing to Firebase: calls/' + user.uid);
      await set(ref(rtdb, `calls/${user.uid}`), {
        calleeId: partner.uid,
        calleeName: partner.displayName || partner.email?.split('@')[0] || 'Partner',
        callType: callType,
        roomID: roomID,
        status: 'calling',
        timestamp: Date.now(),
      });
      console.log('✅ Self call data created');

      console.log('🎉 Call initiated successfully!');
      toast.success(`${callType === 'video' ? 'Video' : 'Audio'} call initiated`);
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      console.error('Error details:', { message: error.message, code: error.code, stack: error.stack });
      toast.error('Failed to initiate call: ' + error.message);
    } finally {
      console.log('🔄 Resetting isInitiating state');
      setIsInitiating(false);
    }
  };

  if (!partner?.uid) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Audio Call Button */}
      <button
        onClick={() => initiateCall('audio')}
        disabled={isInitiating}
        className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Audio Call"
      >
        <PhoneIcon className="h-5 w-5" />
      </button>

      {/* Video Call Button */}
      <button
        onClick={() => initiateCall('video')}
        disabled={isInitiating}
        className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Video Call"
      >
        <VideoCameraIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default CallButtons;
