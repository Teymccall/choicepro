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
  connectionQuality,
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

  // Check if remote video has stream
  const [hasRemoteStream, setHasRemoteStream] = React.useState(false);

  useEffect(() => {
    if (remoteVideoRef?.current) {
      const checkStream = () => {
        const hasStream = remoteVideoRef.current?.srcObject && 
                         remoteVideoRef.current?.srcObject.getTracks().length > 0;
        setHasRemoteStream(hasStream);
      };
      
      checkStream();
      const interval = setInterval(checkStream, 500);
      return () => clearInterval(interval);
    }
  }, [remoteVideoRef]);

  // Ensure local video plays when ref is available
  useEffect(() => {
    if (localVideoRef?.current && localVideoRef.current.srcObject) {
      console.log('Local video ref ready, attempting to play');
      localVideoRef.current.play().catch(err => {
        console.error('Error playing local video:', err);
      });
    }
  }, [localVideoRef, callStatus]);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Remote Video (Full Screen) OR Audio Call Display */}
      <div className="relative flex-1 bg-black">
        {callType === 'video' ? (
          <>
            {/* Always show remote video when call is active */}
            {callStatus === 'active' ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    console.log('🎬 Remote video metadata loaded');
                    console.log('📹 Video element srcObject:', e.target.srcObject);
                    console.log('🎵 Tracks:', e.target.srcObject?.getTracks().map(t => ({
                      kind: t.kind,
                      enabled: t.enabled,
                      muted: t.muted,
                      readyState: t.readyState
                    })));
                    console.log('🔇 Video element muted:', e.target.muted);
                    console.log('📢 Video element volume:', e.target.volume);
                    
                    // Ensure audio is enabled
                    e.target.muted = false;
                    e.target.volume = 1.0;
                  }}
                  onPlay={() => {
                    console.log('▶️ Remote video started playing');
                    console.log('🔊 Video volume during play:', remoteVideoRef.current?.volume);
                  }}
                  onError={(e) => console.error('❌ Remote video error:', e)}
                />
                
                {/* Show fallback if no remote stream after 3 seconds */}
                {!hasRemoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-white/20 mb-4">
                        {partnerPhotoURL ? (
                          <img src={partnerPhotoURL} alt={partnerName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-5xl text-white font-bold">
                              {partnerName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-white text-lg">Waiting for video...</p>
                      <p className="text-gray-400 text-sm mt-2">Partner may have camera off</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Local Video Full Screen - Show while calling/ringing (before connection) */
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  onLoadedMetadata={(e) => {
                    console.log('Local video metadata loaded, stream:', e.target.srcObject);
                    // Let the WebRTC class handle play() to avoid conflicts
                  }}
                  onPlay={() => console.log('▶️ Local video started playing')}
                  onError={(e) => console.error('❌ Local video error:', e)}
                />
                {/* Debug: Show if no stream after 2 seconds */}
                {callStatus === 'calling' && !localVideoRef?.current?.srcObject && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 text-white z-30">
                    <div className="text-center p-6">
                      <VideoCameraSlashIcon className="h-16 w-16 mx-auto mb-4" />
                      <p className="text-lg font-semibold mb-2">No camera stream</p>
                      <p className="text-sm">Camera permission may be denied</p>
                      <p className="text-xs mt-2">Check browser permissions or refresh page</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Audio Call - Show Profile Picture */}
            <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
              {/* Top header with partner name */}
              {callStatus === 'active' && (
                <div className="pt-8 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white">{partnerName}</h2>
                </div>
              )}
              
              {/* Center content */}
              <div className="flex-1 flex items-center justify-center">
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
                
                {/* Call Status */}
                {callStatus === 'active' && (
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-2xl font-semibold text-white">{formatDuration(callDuration)}</p>
                  </div>
                )}
                
                {/* Voice Call Label */}
                {callStatus === 'active' && (
                  <div className="flex items-center justify-center space-x-2 px-4 py-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                    <PhoneIcon className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-300">Voice Call</span>
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
            </div>
            
            {/* Hidden audio element for audio calls */}
            <audio
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="hidden"
              onLoadedMetadata={(e) => {
                console.log('🎵 Audio metadata loaded');
                console.log('🔊 Audio srcObject:', e.target.srcObject);
                console.log('🎧 Audio tracks:', e.target.srcObject?.getTracks().map(t => ({
                  kind: t.kind,
                  enabled: t.enabled,
                  muted: t.muted,
                  readyState: t.readyState
                })));
                console.log('🔇 Audio element muted:', e.target.muted);
                console.log('📢 Audio element volume:', e.target.volume);
                
                // Force play for audio calls
                e.target.play().then(() => {
                  console.log('✅ Audio playing successfully');
                }).catch(err => {
                  console.error('❌ Audio play error:', err);
                  // Try unmuting and playing again
                  e.target.muted = false;
                  e.target.volume = 1.0;
                  e.target.play();
                });
              }}
              onPlay={() => console.log('▶️ Audio started playing')}
              onPause={() => console.log('⏸️ Audio paused')}
              onError={(e) => console.error('❌ Audio error:', e)}
              onVolumeChange={(e) => console.log('🔊 Volume changed:', e.target.volume)}
            />
          </>
        )}
        
        {/* Overlay for calling/ringing state */}
        {(callStatus === 'calling' || callStatus === 'ringing') && (
          <div className="absolute inset-0 z-10 flex flex-col bg-gradient-to-b from-gray-900/95 to-gray-900/90">
            {/* Top Section - Name and Call Type */}
            <div className="pt-12 pb-6 text-center">
              <h2 className="text-3xl font-bold text-white mb-3">{partnerName}</h2>
              
              {/* Call type badge at top */}
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
                {callType === 'video' ? (
                  <>
                    <VideoCameraIcon className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Video Call</span>
                  </>
                ) : (
                  <>
                    <PhoneIcon className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-gray-300">Voice Call</span>
                  </>
                )}
              </div>
            </div>

            {/* Center Section - Avatar and Status */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Animated Ringing Circles */}
              <div className="relative w-40 h-40 mb-8">
                {/* Outer ring animation */}
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
                <div className="absolute inset-3 rounded-full bg-purple-500/20 animate-ping" style={{ animationDelay: '0.3s' }}></div>
                
                {/* Center avatar - Profile Picture or Initial */}
                <div className="absolute inset-0 w-40 h-40 rounded-full shadow-2xl overflow-hidden ring-4 ring-white/30">
                  {partnerPhotoURL ? (
                    <img 
                      src={partnerPhotoURL} 
                      alt={partnerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-6xl text-white font-bold">
                        {partnerName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Ringing indicator with animation */}
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                </div>
                <p className="text-xl text-gray-300 font-medium">
                  {callStatus === 'calling' ? 'Ringing...' : 'Incoming call...'}
                </p>
              </div>
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
                  <div className={`w-2 h-2 rounded-full ${
                    connectionQuality === 'good' ? 'bg-green-500 animate-pulse' :
                    connectionQuality === 'fair' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500 animate-pulse'
                  }`}></div>
                  <span className="text-sm text-white">
                    {connectionQuality === 'good' ? 'Connected' :
                     connectionQuality === 'fair' ? 'Connecting...' :
                     'Poor Connection'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture in Picture) - Show during all video call states */}
      {callType === 'video' && callStatus !== 'idle' && (
        <div className="absolute top-20 right-4 w-40 h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-gray-800 z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            onLoadedMetadata={(e) => {
              console.log('📹 PiP local video loaded');
              console.log('🎥 Local srcObject:', e.target.srcObject);
              console.log('🎬 Local tracks:', e.target.srcObject?.getTracks().map(t => ({kind: t.kind, enabled: t.enabled})));
              // Let the WebRTC class handle play() to avoid conflicts
            }}
            onPlay={() => console.log('▶️ PiP local video playing')}
            onError={(e) => console.error('❌ PiP local video error:', e)}
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoCameraSlashIcon className="h-8 w-8 text-white/50" />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent z-30">
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
            onClick={() => {
              console.log('🔴 End call button clicked!');
              onEndCall();
            }}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg z-40"
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
