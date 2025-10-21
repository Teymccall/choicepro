import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_CONFIG, getCallConfig } from '../config/zegoConfig';
import { XMarkIcon, PhoneXMarkIcon } from '@heroicons/react/24/solid';

const ZegoVideoCall = ({ roomID, userID, userName, onCallEnd, partnerName }) => {
  const containerRef = useRef(null);
  const zegoInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !roomID || !userID || !userName) return;

    const initCall = async () => {
      // Ensure userID is a valid string (alphanumeric only, max 32 chars)
      const validUserID = String(userID).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
      
      try {
        // Generate Kit Token
        const appID = ZEGO_CONFIG.appID;
        const serverSecret = ZEGO_CONFIG.serverSecret;
        
        console.log('🎥 Initializing video call:', { appID, roomID, userID: validUserID, userName });
        
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomID,
          validUserID,
          userName
        );

        // Create instance
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        // Get video call configuration
        const callConfig = getCallConfig('video');

        // Join the room
        await zp.joinRoom({
          container: containerRef.current,
          ...callConfig,
          onLeaveRoom: () => {
            console.log('📹 User left video call');
            if (onCallEnd) onCallEnd();
          },
          onUserLeave: (users) => {
            console.log('👤 User left:', users);
            // If partner leaves, end call
            if (users && users.length === 0) {
              if (onCallEnd) onCallEnd();
            }
          },
          onJoinRoom: () => {
            console.log('✅ Successfully joined video call room');
          },
          onRoomStateChanged: (reason, errorCode, extendedData) => {
            console.log('📡 Room state changed:', { reason, errorCode, extendedData });
          },
        });

        console.log('✅ ZegoCloud Video Call initialized and joined');
      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          appID: ZEGO_CONFIG.appID,
          roomID,
          userID: validUserID
        });
        alert(`Video call error: ${error.message}`);
      }
    };

    initCall();

    // Cleanup
    return () => {
      if (zegoInstanceRef.current) {
        try {
          zegoInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying Zego instance:', error);
        }
      }
    };
  }, [roomID, userID, userName, onCallEnd]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900">
      {/* Safe Area Wrapper */}
      <div 
        className="h-full w-full"
        style={{
          paddingTop: 'var(--safe-area-inset-top)',
          paddingBottom: 'var(--safe-area-inset-bottom)',
          paddingLeft: 'var(--safe-area-inset-left)',
          paddingRight: 'var(--safe-area-inset-right)',
        }}
      >
        {/* Header with partner name */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent p-4"
          style={{ paddingTop: 'calc(var(--safe-area-inset-top) + 1rem)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {partnerName?.charAt(0).toUpperCase() || 'P'}
                </span>
              </div>
              <div>
                <p className="text-white font-semibold">{partnerName || 'Partner'}</p>
                <p className="text-white/70 text-sm">Video Call</p>
              </div>
            </div>
            <button
              onClick={onCallEnd}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            >
              <PhoneXMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* ZegoCloud Container */}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default ZegoVideoCall;
