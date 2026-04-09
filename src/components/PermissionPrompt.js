import React from 'react';
import { VideoCameraIcon, MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';

const PermissionPrompt = ({ callType, onProceed, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              {callType === 'video' ? (
                <VideoCameraIcon className="h-10 w-10" />
              ) : (
                <MicrophoneIcon className="h-10 w-10" />
              )}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center">
            {callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">
              Choice needs access to your {callType === 'video' ? 'camera and microphone' : 'microphone'} to make calls.
            </p>
          </div>

          {/* Permission Steps */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Click <strong>"Start Call"</strong> below
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Your browser will ask for permission
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Click <strong>"Allow"</strong> to continue
              </p>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 flex items-start space-x-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-700 dark:text-green-300 text-xs">
              <strong>Private & Secure:</strong> Your call is peer-to-peer encrypted. We never record or store your calls.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Start Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionPrompt;
