import React, { useEffect } from 'react';
import {
  PhoneIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/solid';

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
  const localPiPVideoRef = React.useRef(null);
  const callingDisplayVideoRef = React.useRef(null);
  const [hasLocalPreview, setHasLocalPreview] = React.useState(false);

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

  // Keep PiP preview in sync with local stream
  useEffect(() => {
    const sourceEl = localVideoRef?.current;
    const pipEl = localPiPVideoRef.current;
    
    // Sync local stream to PiP preview
    
    if (!sourceEl || !pipEl) {
      return;
    }

    const syncStream = () => {
      if (sourceEl.srcObject && pipEl.srcObject !== sourceEl.srcObject) {
        pipEl.srcObject = sourceEl.srcObject;
        pipEl.muted = true;
        pipEl.play().catch(() => {});
        setHasLocalPreview(true);
      }
    };

    // Immediate sync
    syncStream();
    
    // Set up listeners for future updates
    sourceEl.addEventListener('loadedmetadata', syncStream);
    sourceEl.addEventListener('play', syncStream);

    // Polling fallback to ensure sync happens
    const syncInterval = setInterval(syncStream, 500);

    return () => {
      sourceEl.removeEventListener('loadedmetadata', syncStream);
      sourceEl.removeEventListener('play', syncStream);
      clearInterval(syncInterval);
    };
  }, [localVideoRef, callStatus]);

  // Ensure remote media (audio/video) actually plays once call is active (mobile autoplay guard)
  useEffect(() => {
    if (callStatus !== 'active') return;

    const mediaEl = remoteVideoRef?.current;
    if (!mediaEl) return;

    let isCleaningUp = false;

    const enableRemoteTracks = () => {
      const stream = mediaEl.srcObject;
      if (!stream) return;
      stream.getAudioTracks()?.forEach((track) => {
        if (!track.enabled) {
          track.enabled = true;
          console.log('🔊 Re-enabled remote audio track:', track.id);
        }
      });
    };

    const attemptPlayback = (reason) => {
      if (!mediaEl.srcObject) {
        console.log('⏳ Remote media srcObject not ready - will retry');
        return;
      }

      mediaEl.muted = false;
      mediaEl.defaultMuted = false;
      mediaEl.volume = 1.0;

      const promise = mediaEl.play();
      if (promise && typeof promise.then === 'function') {
        promise
          .then(() => console.log(`▶️ Remote media playing (${reason})`))
          .catch((err) => console.warn(`⚠️ Remote media play blocked (${reason}):`, err));
      }
    };

    // Resume shared AudioContext on iOS if needed
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        window.__choiceAudioCtx = window.__choiceAudioCtx || new AudioCtx();
        if (window.__choiceAudioCtx.state === 'suspended') {
          window.__choiceAudioCtx.resume().catch((err) => console.warn('⚠️ AudioContext resume failed:', err));
        }
      }
    } catch (err) {
      console.warn('⚠️ Unable to resume AudioContext:', err);
    }

    enableRemoteTracks();
    attemptPlayback('initial');

    const handleInteraction = () => {
      if (isCleaningUp) return;
      enableRemoteTracks();
      attemptPlayback('user-interaction');
    };

    const interactionEvents = ['touchend', 'pointerup', 'click'];
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, handleInteraction, { passive: true });
    });

    const retryInterval = setInterval(() => {
      if (isCleaningUp) return;
      enableRemoteTracks();
      attemptPlayback('interval');
    }, 2000);

    return () => {
      isCleaningUp = true;
      clearInterval(retryInterval);
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, handleInteraction, { passive: true });
      });
    };
  }, [callStatus, remoteVideoRef]);

  // Ensure local video plays when ref is available
  useEffect(() => {
    if (localVideoRef?.current && localVideoRef.current.srcObject) {
      localVideoRef.current.play().catch(() => {});
      setHasLocalPreview(true);
    }
  }, [localVideoRef, callStatus]);

  // Poll local preview state to keep overlay accurate
  useEffect(() => {
    const updatePreviewState = () => {
      const stream = localVideoRef?.current?.srcObject;
      const hasPreview = !!stream && stream.getVideoTracks().some(track => track.readyState === 'live' && track.enabled);
      setHasLocalPreview(prev => prev === hasPreview ? prev : hasPreview);
    };

    updatePreviewState();
    const interval = setInterval(updatePreviewState, 500);
    return () => clearInterval(interval);
  }, [localVideoRef, callStatus]);

  // Sync calling display video with local stream
  useEffect(() => {
    const sourceEl = localVideoRef?.current;
    const displayEl = callingDisplayVideoRef.current;
    
    if (!sourceEl || !displayEl || callStatus === 'active') {
      return;
    }

    const syncCallingDisplay = () => {
      if (sourceEl.srcObject && displayEl.srcObject !== sourceEl.srcObject) {
        displayEl.srcObject = sourceEl.srcObject;
        displayEl.muted = true;
        displayEl.play().catch(() => {});
      }
    };

    // Immediate sync
    syncCallingDisplay();
    
    // Polling to ensure sync happens
    const syncInterval = setInterval(syncCallingDisplay, 500);

    return () => {
      clearInterval(syncInterval);
    };
  }, [localVideoRef, callStatus]);



  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header with Partner Info - Always visible */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Partner Profile Picture */}
          <div className="relative">
            <img
              src={partnerPhotoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(partnerName)}
              alt={partnerName}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/20"
            />
            {callStatus === 'active' && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
            )}
          </div>
          
          {/* Partner Name and Status */}
          <div className="flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-white">{partnerName}</h2>
            <p className="text-sm sm:text-base text-gray-300">
              {callStatus === 'calling' && '☎️ Calling...'}
              {callStatus === 'ringing' && '📞 Ringing...'}
              {callStatus === 'active' && `🟢 ${formatDuration(callDuration)}`}
            </p>
          </div>
        </div>
      </div>

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
                    e.target.muted = false;
                    e.target.volume = 1.0;
                  }}
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
                  ref={callingDisplayVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Debug: Show if no stream after 2 seconds */}
                {callStatus === 'calling' && !hasLocalPreview && (
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
            <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black pt-24 sm:pt-28">
              {/* Center content */}
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                {/* Large Profile Picture */}
                <div className="w-48 h-48 sm:w-64 sm:h-64 mx-auto rounded-full overflow-hidden shadow-2xl ring-8 ring-white/10 mb-8">
                  {partnerPhotoURL ? (
                    <img 
                      src={partnerPhotoURL} 
                      alt={partnerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-7xl sm:text-9xl text-white font-bold">
                        {partnerName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
                
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
                e.target.muted = false;
                e.target.volume = 1.0;
                e.target.play().catch(() => {});
              }}
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

      </div>

      {/* Persistent hidden video element - ALWAYS maintains localVideoRef throughout call lifecycle */}
      {callType === 'video' && callStatus !== 'idle' && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />
      )}

      {/* Local Video (Picture in Picture) - Show during all video call states */}
      {callType === 'video' && callStatus !== 'idle' && (
        <div className="absolute top-20 right-4 w-36 h-48 sm:w-40 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-gray-800 z-20">
          <video
            ref={localPiPVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {!hasLocalPreview && (
            <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center text-white text-xs tracking-wide">
              Camera preview unavailable
            </div>
          )}
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
            onClick={onEndCall}
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
    </div>
  );
};

export default VideoCall;
