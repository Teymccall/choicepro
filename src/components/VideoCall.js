import React, { useEffect } from 'react';
import {
  PhoneIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  XMarkIcon,
  VideoCameraSlashIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/solid';
import { PhoneIcon as PhoneOutline, VideoCameraIcon as VideoOutline } from '@heroicons/react/24/outline';

const VideoCall = ({
  localVideoRef,
  remoteVideoRef,
  callStatus,
  callType,
  isAudioEnabled,
  isVideoEnabled,
  isSpeakerOn,
  callDuration,
  partnerName,
  partnerPhotoURL,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onToggleSpeaker
}) => {
  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Remote Video (Full Screen) OR Audio Call Display */}
      <div className="relative flex-1 bg-black">
        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
            onLoadedMetadata={(e) => {
              console.log('Video metadata loaded, attempting play');
              e.target.play().catch(err => console.error('Video play error:', err));
            }}
          />
        ) : (
          /* Audio Call - Show Profile Picture */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
            <div className="text-center">
              {/* Large Profile Picture */}
              <div className="w-48 h-48 mx-auto rounded-full overflow-hidden shadow-2xl ring-8 ring-white/10 mb-8">
                {partnerPhotoURL ? (
                  <img 
                    src={partnerPhotoURL} 
                    alt={partnerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-8xl text-white font-bold">
                      {partnerName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Partner Name */}
              <h2 className="text-4xl font-bold text-white mb-2">{partnerName}</h2>
              
              {/* Call Status */}
              {callStatus === 'active' && (
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-xl text-gray-300">{formatDuration(callDuration)}</p>
                </div>
              )}
              
              {/* Audio Wave Animation */}
              {callStatus === 'active' && isAudioEnabled && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <div className="w-1 h-8 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-12 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-16 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-12 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-8 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Hidden audio element for audio calls */}
        <audio
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="hidden"
          onLoadedMetadata={(e) => {
            console.log('Audio metadata loaded, attempting play');
            e.target.play().catch(err => console.error('Audio play error:', err));
          }}
        />
        
        {/* Overlay for calling/ringing state */}
        {(callStatus === 'calling' || callStatus === 'ringing') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900/80 to-gray-900/60">
            {/* Animated Ringing Circles */}
            <div className="relative w-32 h-32 mb-6">
              {/* Outer ring animation */}
              <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-purple-500/30 animate-ping" style={{ animationDelay: '0.3s' }}></div>
              
              {/* Center avatar - Profile Picture or Initial */}
              <div className="absolute inset-0 w-32 h-32 rounded-full shadow-2xl animate-pulse overflow-hidden ring-4 ring-white/20">
                {partnerPhotoURL ? (
                  <img 
                    src={partnerPhotoURL} 
                    alt={partnerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-5xl text-white font-bold">
                      {partnerName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">{partnerName}</h2>
            
            {/* Ringing indicator with animation */}
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              </div>
              <p className="text-lg text-gray-300 font-semibold">
                {callStatus === 'calling' ? 'Ringing...' : 'Incoming call...'}
              </p>
            </div>
            
            {/* Call type indicator */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
              {callType === 'video' ? (
                <>
                  <VideoOutline className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-gray-300">Video Call</span>
                </>
              ) : (
                <>
                  <PhoneOutline className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-gray-300">Voice Call</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Call Info Overlay */}
        {callStatus === 'active' && (
          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{partnerName}</h3>
                <p className="text-sm text-gray-300">{formatDuration(callDuration)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm text-white">Connected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture in Picture) */}
      {callType === 'video' && (
        <div className="absolute top-20 right-4 w-32 h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoCameraSlashIcon className="h-8 w-8 text-white/50" />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={onToggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
              isAudioEnabled
                ? 'bg-gray-700/80 hover:bg-gray-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="h-6 w-6 text-white" />
            ) : (
              <SpeakerXMarkIcon className="h-6 w-6 text-white" />
            )}
          </button>

          {/* Speaker Button */}
          <button
            onClick={onToggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
              isSpeakerOn
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-700/80 hover:bg-gray-600'
            }`}
            title={isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}
          >
            <SpeakerWaveIcon className="h-6 w-6 text-white" />
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg"
            title="End Call"
          >
            <PhoneIcon className="h-7 w-7 text-white rotate-[135deg]" />
          </button>

          {/* Video Toggle Button */}
          {callType === 'video' && (
            <button
              onClick={onToggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
                isVideoEnabled
                  ? 'bg-gray-700/80 hover:bg-gray-600'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
              title={isVideoEnabled ? 'Camera OFF' : 'Camera ON'}
            >
              {isVideoEnabled ? (
                <VideoCameraIcon className="h-6 w-6 text-white" />
              ) : (
                <VideoCameraSlashIcon className="h-6 w-6 text-white" />
              )}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};

export default VideoCall;
