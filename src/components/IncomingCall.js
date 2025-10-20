import React, { useState, useEffect } from 'react';
import { PhoneIcon, XMarkIcon, VideoCameraIcon } from '@heroicons/react/24/solid';

const IncomingCall = ({ callerName, callerPhotoURL, callType, onAccept, onReject }) => {
  const [isRinging, setIsRinging] = useState(true);

  useEffect(() => {
    // Visual ringing animation
    const ringInterval = setInterval(() => {
      setIsRinging(prev => !prev);
    }, 1000);

    // Vibrate phone (if supported and user has interacted)
    let vibratePattern = null;
    if ('vibrate' in navigator) {
      vibratePattern = setInterval(() => {
        try {
          navigator.vibrate([200, 100, 200]); // vibrate-pause-vibrate pattern
        } catch (error) {
          // Silently ignore if vibration is blocked
        }
      }, 1000);
    }
    
    // Cleanup function
    return () => {
      clearInterval(ringInterval);
      if (vibratePattern) {
        clearInterval(vibratePattern);
        try {
          navigator.vibrate(0); // Stop vibration
        } catch (error) {
          // Silently ignore
        }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-gray-200 dark:border-gray-700">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className={`w-24 h-24 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-blue-500/30 mb-4 ${isRinging ? 'animate-pulse' : ''}`}>
            {callerPhotoURL ? (
              <img 
                src={callerPhotoURL} 
                alt={callerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-4xl font-bold text-white">
                  {callerName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {callerName}
          </h2>
          <div className="flex items-center justify-center space-x-2">
            {callType === 'video' ? (
              <>
                <VideoCameraIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-600 dark:text-gray-400">Video Call</span>
              </>
            ) : (
              <>
                <PhoneIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-600 dark:text-gray-400">Voice Call</span>
              </>
            )}
          </div>
        </div>

        {/* Call Actions */}
        <div className="flex items-center justify-center space-x-6">
          {/* Reject Button */}
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg"
          >
            <XMarkIcon className="h-8 w-8 text-white" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg animate-pulse"
          >
            <PhoneIcon className="h-8 w-8 text-white" />
          </button>
        </div>

        {/* Ringing Indicator */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            {isRinging ? '🔔' : ' '} Incoming call...
          </p>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
