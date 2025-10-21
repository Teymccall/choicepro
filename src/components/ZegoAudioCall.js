import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZEGO_CONFIG, getCallConfig } from '../config/zegoConfig';

const ZegoAudioCall = ({ roomID, userID, userName, onCallEnd, partnerName }) => {
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
        
        console.log('🎵 Initializing audio call:', { appID, roomID, userID: validUserID, userName });
        
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

        // Get audio call configuration
        const callConfig = getCallConfig('audio');

        // Join the room
        await zp.joinRoom({
          container: containerRef.current,
          ...callConfig,
          onLeaveRoom: () => {
            console.log('🎵 User left audio call');
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
            console.log('✅ Successfully joined audio call room');
          },
          onRoomStateChanged: (reason, errorCode, extendedData) => {
            console.log('📡 Room state changed:', { reason, errorCode, extendedData });
          },
        });

        console.log('✅ ZegoCloud Audio Call initialized and joined');
      } catch (error) {
        console.error('❌ Error initializing audio call:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          appID: ZEGO_CONFIG.appID,
          roomID,
          userID: validUserID
        });
        alert(`Audio call error: ${error.message}`);
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
        {/* ZegoCloud Container - Full UI for audio call */}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default ZegoAudioCall;
