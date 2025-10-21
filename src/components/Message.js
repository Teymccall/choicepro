import React, { useState, useEffect, useRef } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  DocumentIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';
import { formatTime } from '../utils/dateUtils';
import { ref, set } from 'firebase/database';
import { rtdb } from '../firebase/config';

// Voice Note Player Component
const VoiceNotePlayer = ({ audioUrl, duration, isOwnMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
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
        {[...Array(20)].map((_, i) => {
          const barProgress = (i / 20) * 100;
          const isActive = progress >= barProgress;
          const height = Math.random() * 16 + 8; // Random heights between 8-24px
          
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
      <span className={`text-[11px] ${
        isOwnMessage
          ? 'text-white/70'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        {formatDuration(isPlaying ? currentTime : duration || 0)}
      </span>
    </div>
  );
};

const Message = ({ message, isOwnMessage, user, topicId, onReply, onImageClick, messageRefs, onDelete, onEdit, onStartEdit }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleted, setIsDeleted] = useState(message.deleted);
  const menuRef = useRef(null);
  const timeString = formatTime(message.timestamp);
  const messageRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef(0);
  const swipeThreshold = 50;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const longPressTimeout = useRef(null);
  const [isLongPressed, setIsLongPressed] = useState(false);
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
    setIsDeleted(message.deleted);
  }, [message.deleted]);

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
              <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-black/5">
                <img 
                  src={message.replyTo.media.url} 
                  alt="Replied media"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="truncate text-[#667781]">Photo</span>
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
              
              {isOwnMessage && isWithinEditWindow() && (
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