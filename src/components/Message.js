import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';
import { formatTime } from '../utils/dateUtils';
import { ref, set, update } from 'firebase/database';
import { rtdb } from '../firebase/config';

// Voice Note Player Component
const VoiceNotePlayer = ({ audioUrl, duration, isOwnMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const waveformHeights = useRef([4, 8, 12, 17, 24, 18, 10, 6, 11, 20, 26, 16, 8, 14, 22, 15, 9, 5, 7, 4]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);
  
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Audio playback error:', err);
        setIsPlaying(false);
      });
    }
  };
  
  const formatDuration = (seconds) => {
    const totalSeconds = Math.max(0, Math.round(seconds || 0));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = duration > 0 ? (currentTime / duration) : 0;
  
  return (
    <div className="flex items-center gap-2 min-w-[200px] py-1">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`flex-shrink-0 p-2 rounded-full transition-colors ${
          isOwnMessage
            ? 'bg-white/20 hover:bg-white/30'
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>
      
      {/* Waveform Progress */}
      <div className="flex-1 h-8 flex items-center gap-0.5">
        {waveformHeights.current.map((height, i) => {
          const barProgress = (i / 20);
          const isActive = progress >= barProgress;
          
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                isActive
                  ? isOwnMessage
                    ? 'bg-white'
                    : 'bg-blue-600 dark:bg-blue-500'
                  : isOwnMessage
                    ? 'bg-white/40'
                    : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
      
      {/* Duration */}
      <span className={`text-[11px] whitespace-nowrap ${
        isOwnMessage
          ? 'text-white/70'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        {formatDuration(isPlaying ? currentTime : duration)}
      </span>
    </div>
  );
};

// Disappearing Media Renderer
const DisappearingMediaRenderer = ({ message, topicId, onImageClick, isOwnMessage }) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isViewed, setIsViewed] = useState(!!message.media?.viewedAt);
  const [hasExpired, setHasExpired] = useState(!!message.media?.expired);

  const getExpirationTime = useCallback(() => {
    if (!message.media?.viewedAt || !message.media?.disappearingTimer) return null;
    const viewedTime = typeof message.media.viewedAt === 'number'
      ? message.media.viewedAt
      : new Date(message.media.viewedAt).getTime();
    return viewedTime + (message.media.disappearingTimer * 1000);
  }, [message.media?.viewedAt, message.media?.disappearingTimer]);

  useEffect(() => {
    if (hasExpired) return;
    if (!message.media?.viewedAt) return;

    setIsViewed(true);
    const expirationTime = getExpirationTime();
    if (!expirationTime) return;

    const checkTime = () => {
      const remaining = Math.max(0, expirationTime - Date.now());
      if (remaining <= 0) {
        setHasExpired(true);
        // Just mark as expired — do NOT delete the message
        update(ref(rtdb, `topicChats/${topicId}/${message.id}/media`), {
          expired: true,
          url: null // Remove the actual media URL for safety
        }).catch(console.error);
      } else {
        setTimeLeft(remaining);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [message.media?.viewedAt, hasExpired, topicId, message.id, getExpirationTime]);

  const formatCountdown = (ms) => {
    if (!ms) return '';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatTimerLabel = (secs) => {
    if (!secs) return '';
    if (secs >= 3600) return `${secs / 3600}h`;
    if (secs >= 60) return `${secs / 60}m`;
    return `${secs}s`;
  };

  const timerLabel = formatTimerLabel(message.media?.disappearingTimer);

  // ── EXPIRED: show "viewed" pill — message stays, media gone ───────────────
  if (hasExpired || message.media?.expired) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/30 border border-gray-200/60 dark:border-gray-700/40">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200/80 dark:bg-gray-700/60 flex-shrink-0">
          <PhotoIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 leading-tight">
            {isOwnMessage ? 'Photo' : 'Photo'}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 italic">
            This media has been viewed
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-200/50 dark:bg-gray-700/40 rounded-full px-2 py-0.5 flex-shrink-0">
          <CheckIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">Viewed</span>
        </div>
      </div>
    );
  }

  // ── SENDER SIDE: pill only — image is never shown to sender ──────────────
  if (isOwnMessage) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 -mx-[2px]">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/15 flex-shrink-0">
          <PhotoIcon className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">
            Photo sent
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
            {isViewed
              ? `Expires in ${timeLeft !== null ? formatCountdown(timeLeft) : timerLabel}`
              : `Expires ${timerLabel} after recipient views`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-0.5 flex-shrink-0">
          <ClockIcon className="w-3 h-3 text-blue-500" />
          <span className="text-[10px] font-bold text-blue-500">{timerLabel}</span>
        </div>
      </div>
    );
  }

  // ── RECEIVER SIDE ─────────────────────────────────────────────────────────
  const handleView = async (e) => {
    e.stopPropagation();
    if (!isViewed) {
      try {
        const now = Date.now();
        await update(ref(rtdb, `topicChats/${topicId}/${message.id}/media`), {
          viewedAt: now
        });
        setIsViewed(true);
        // Open image immediately after marking as viewed, passing metadata for auto-close
        onImageClick({
          url: message.media.url,
          disappearingTimer: message.media.disappearingTimer,
          viewedAt: now
        });
      } catch (error) {
        console.error('Error marking disappearing message as viewed:', error);
      }
    } else {
      // Already viewed — open full screen with countdown metadata
      onImageClick({
        url: message.media.url,
        disappearingTimer: message.media.disappearingTimer,
        viewedAt: typeof message.media.viewedAt === 'number'
          ? message.media.viewedAt
          : new Date(message.media.viewedAt).getTime()
      });
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer -mx-[9px] -mt-[6px] relative bg-black/90 aspect-square min-w-[200px] flex items-center justify-center transition-all group"
      onClick={handleView}
    >
      {/* Blurred background only after viewed */}
      {isViewed && (
        message.media?.type?.startsWith('video/') ? (
          <video src={message.media.url} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-40" muted />
        ) : (
          <img src={message.media.url} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-40" />
        )
      )}

      {/* Overlay UI */}
      <div className="z-10 flex flex-col items-center justify-center gap-3 p-4 text-center w-full">
        {!isViewed ? (
          <>
            <div className="p-3 bg-blue-500/20 rounded-full border border-blue-400/40 group-hover:scale-110 transition-transform">
              <PhotoIcon className="w-8 h-8 text-blue-300" />
            </div>
            <p className="text-white font-semibold text-sm drop-shadow">Tap to view</p>
            <div className="flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1">
              <ClockIcon className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-blue-300 text-xs font-bold font-mono">{timerLabel}</span>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-red-500/20 rounded-full border border-red-400/40 animate-pulse">
              <ClockIcon className="w-7 h-7 text-red-300" />
            </div>
            <p className="text-white font-semibold text-sm drop-shadow">Tap to open</p>
            <div className="bg-black/50 rounded-full px-3 py-1">
              <span className="text-red-300 font-mono font-bold text-base">
                {timeLeft !== null ? formatCountdown(timeLeft) : '...'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Message = ({ message, isOwnMessage, user, topicId, onReply, onImageClick, messageRefs, onDelete, onStartEdit }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const timeString = formatTime(message.timestamp);
  const messageRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef(0);
  const swipeThreshold = 50;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const longPressTimeout = useRef(null);
  const [error, setError] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Add time window checks
  const EDIT_TIME_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
  const DELETE_TIME_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

  const isWithinEditWindow = () => {
    if (!message.timestamp) return false;
    const messageTime = typeof message.timestamp === 'number' 
      ? message.timestamp 
      : message.timestamp.toDate?.().getTime() || new Date(message.timestamp).getTime();
    return Date.now() - messageTime <= EDIT_TIME_WINDOW;
  };

  const isWithinDeleteWindow = () => {
    if (!message.timestamp) return false;
    const messageTime = typeof message.timestamp === 'number' 
      ? message.timestamp 
      : message.timestamp.toDate?.().getTime() || new Date(message.timestamp).getTime();
    return Date.now() - messageTime <= DELETE_TIME_WINDOW;
  };


  useEffect(() => {
    if (messageRef.current) {
      messageRefs.current[message.id] = messageRef;
    }
  }, [message.id, messageRefs]);

  useEffect(() => {
    if (showMenu) {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setShowMenu(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);

  const handleReplyClick = (e) => {
    e.stopPropagation();
    if (message.replyTo && messageRefs.current[message.replyTo.id]) {
      const element = messageRefs.current[message.replyTo.id].current;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-primary-50', 'dark:bg-primary-900/20');
        setTimeout(() => {
          element.classList.remove('bg-primary-50', 'dark:bg-primary-900/20');
        }, 1000);
      }
    }
  };



  const handleDelete = async (deleteForEveryone = false) => {
    if (!isWithinDeleteWindow() && deleteForEveryone) {
      setError('Messages can only be deleted for everyone within 1 hour of sending');
      return;
    }
    await onDelete(message.id, deleteForEveryone);
    setShowMenu(false);
  };

  const startEdit = () => {
    onStartEdit(message);
    setShowMenu(false);
  };

  const renderMessageStatus = () => {
    if (!isOwnMessage) return null;
    
    if (message.read) {
      return (
        <div className="flex -space-x-1">
          <CheckIconSolid className="h-3.5 w-3.5 text-[#53bdeb]" />
          <CheckIconSolid className="h-3.5 w-3.5 text-[#53bdeb]" />
        </div>
      );
    } else if (message.delivered) {
      return (
        <div className="flex -space-x-1">
          <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />
          <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />
        </div>
      );
    } else if (message.sent) {
      return <CheckIcon className="h-3.5 w-3.5 text-[#8696a0]" />;
    } else {
      return <ClockIcon className="h-3.5 w-3.5 text-[#8696a0]" />;
    }
  };

  const renderMediaContent = () => {
    if (!message.media) return null;

    if (message.media.type.startsWith('audio')) {
      return (
        <VoiceNotePlayer 
          audioUrl={message.media.url} 
          duration={message.media.duration}
          isOwnMessage={isOwnMessage}
        />
      );
    }

    // Use DisappearingMediaRenderer if this media has a disappearing timer attached
    if (message.media.disappearingTimer) {
      return (
        <DisappearingMediaRenderer 
          message={message} 
          topicId={topicId} 
          isOwnMessage={isOwnMessage} 
          onImageClick={onImageClick} 
        />
      );
    }

    return (
      <div 
        className="rounded-lg overflow-hidden cursor-pointer -mx-[9px] -mt-[6px] relative bg-black/5 dark:bg-white/5"
        onClick={() => onImageClick(message.media.url)}
      >
        <img
          src={message.media.url}
          alt="Shared media"
          className="w-full max-h-[300px] object-cover"
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            e.target.style.opacity = 1;
          }}
          style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
        />
      </div>
    );
  };

  const renderReplyContent = () => {
    if (!message.replyTo) return null;
    
    return (
      <div 
        className={`
          text-[13px] -mb-1 px-2 pt-1 pb-2 cursor-pointer flex items-start space-x-2
          ${isOwnMessage 
            ? 'bg-[#dcf8c6] text-[#303030]' 
            : 'bg-white text-[#303030]'
          }
          rounded-t-[7px] hover:opacity-95 transition-opacity
        `}
        onClick={handleReplyClick}
      >
        <div className="w-0.5 h-full bg-[#25d366] self-stretch flex-none mr-2"/>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-[#25d366] block text-[13px]">
            {message.replyTo.userId === user.uid ? 'You' : 'Partner'}
          </span>
          {message.replyTo.media ? (
            <div className="flex items-center space-x-2">
              {message.replyTo.media.type?.startsWith('audio') ? (
                <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MicrophoneIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              ) : (
                <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-black/5">
                  <img 
                    src={message.replyTo.media.url} 
                    alt="Replied media"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <span className="truncate text-[#667781]">
                {message.replyTo.media.type?.startsWith('audio') ? '🎤 Voice message' : '📷 Photo'}
              </span>
            </div>
          ) : (
            <span className="block truncate text-[#667781]">
              {message.replyTo.text}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={messageRef}
      className={`
        relative flex 
        ${isOwnMessage ? 'justify-end' : 'justify-start'} 
        mb-2
        touch-manipulation
        will-change-transform
      `}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
        longPressTimeout.current = setTimeout(() => {
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
          setShowMenu(true);
        }, 500);
      }}
      onTouchMove={(e) => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStart.current;
        
        if (diff > 0 && diff <= swipeThreshold) {
          setSwipeX(diff);
          setIsReplying(diff >= swipeThreshold / 2);
        }
      }}
      onTouchEnd={() => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        if (swipeX >= swipeThreshold / 2) {
          onReply(message);
        }
        // Add a small delay before resetting swipeX for smooth animation
        setTimeout(() => {
          setSwipeX(0);
          setIsReplying(false);
        }, 200);
      }}
      onTouchCancel={() => {
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
        }
        setSwipeX(0);
        setIsReplying(false);
      }}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        KhtmlUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div 
        className={`
          relative 
          max-w-[85%] 
          px-[9px] 
          py-[6px] 
          rounded-lg 
          ${isOwnMessage 
            ? 'bg-[#dcf8c6] text-[#303030]' 
            : 'bg-white text-[#303030]'
          }
          ${message.replyTo ? 'rounded-t-none' : ''}
          shadow-sm
          transition-all
          duration-200
          ease-out
          will-change-transform
        `}
        style={{
          transform: `translateX(${swipeX}px)`,
          WebkitTransform: `translateX(${swipeX}px)`
        }}
      >
        {/* Reply indicator */}
        <div 
          className={`
            absolute left-0 top-1/2 -translate-x-[24px] -translate-y-1/2
            transition-all duration-200 ease-out
            ${swipeX > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            will-change-transform
          `}
        >
          <ChatBubbleLeftRightIcon 
            className={`
              w-5 h-5 
              ${isReplying ? 'text-primary-600' : 'text-gray-400'}
              transition-colors duration-200
            `}
          />
        </div>

        {renderReplyContent()}
        {renderMediaContent()}
        {message.text && (
          <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
            {message.text}
          </p>
        )}
        <div className="flex items-center justify-end space-x-1 -mb-1 mt-1">
          {message.edited && (
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0] italic">
              edited
            </span>
          )}
          <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
            {timeString}
          </span>
          {renderMessageStatus()}
        </div>
        
        {/* Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {Object.entries(
              Object.values(message.reactions).reduce((acc, reaction) => {
                acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <div
                key={emoji}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-gray-600 dark:text-gray-400">{count}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp-Style Context Menu with Reactions */}
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed inset-x-0 bottom-0 z-50 animate-slide-up"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu Content */}
          <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t-2 border-gray-200/50 dark:border-gray-700/50">
            {/* Quick Reactions */}
            <div className="px-4 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-around gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full py-3 px-4 shadow-lg">
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={async () => {
                      try {
                        // Add reaction to message
                        const reactionRef = ref(rtdb, `topicChats/${topicId}/${message.id}/reactions/${user.uid}`);
                        await set(reactionRef, {
                          emoji: emoji,
                          timestamp: Date.now()
                        });
                        setShowMenu(false);
                      } catch (error) {
                        console.error('Error adding reaction:', error);
                      }
                    }}
                    className="text-2xl hover:scale-125 transition-transform duration-200 active:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowMenu(false)}
                  className="text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-full p-1 transition-all"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Action Menu */}
            <div className="px-4 py-2">
              <button
                onClick={() => {
                  onReply(message);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-3">
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  Reply
                </span>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              </button>
              
              {isOwnMessage && isWithinEditWindow() && !message.media?.type?.startsWith('audio') && (
                <button
                  onClick={startEdit}
                  className="w-full px-4 py-3 text-left text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-3">
                    <PencilIcon className="h-5 w-5" />
                    Edit
                  </span>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              
              {/* Delete - Shows modal only if own message within delete window */}
              <button
                onClick={() => {
                  if (isOwnMessage && isWithinDeleteWindow()) {
                    // Show modal for "Delete for Everyone" option
                    setShowDeleteModal(true);
                    setShowMenu(false);
                  } else {
                    // Delete immediately for me
                    handleDelete(false);
                    setShowMenu(false);
                  }
                }}
                className="w-full px-4 py-3 text-left text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-3">
                  <TrashIcon className="h-5 w-5" />
                  Delete
                </span>
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            {/* Safe area padding for notched phones */}
            <div className="h-safe pb-4" />
          </div>
        </div>
      )}

      {/* Delete Modal - Only for "Delete for Everyone" option */}
      {showDeleteModal && (
        <div className="fixed inset-x-0 bottom-0 z-[60] animate-slide-up">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t-2 border-gray-200/50 dark:border-gray-700/50">
            <div className="px-4 py-4">
              <p className="text-center text-gray-700 dark:text-gray-300 text-sm mb-4">
                Delete this message?
              </p>
              
              {error && (
                <div className="mb-3 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-xs font-medium text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => {
                    handleDelete(true);
                    setShowDeleteModal(false);
                  }}
                  className="w-full px-4 py-3 text-red-600 dark:text-red-400 font-medium hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                >
                  Delete for Everyone
                </button>
                <button
                  onClick={() => {
                    handleDelete(false);
                    setShowDeleteModal(false);
                  }}
                  className="w-full px-4 py-3 text-red-600 dark:text-red-400 font-medium hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                >
                  Delete for Me
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full px-4 py-3 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
            
            {/* Safe area padding */}
            <div className="h-safe pb-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Message; 