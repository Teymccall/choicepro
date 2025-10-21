import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { CheckIcon, ArrowUturnLeftIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';

const MessageStatus = ({ status }) => {
  if (!status) return null;

  switch (status) {
    case 'sent':
      return (
        <div className="flex items-center ml-1">
          <CheckIcon className="h-3.5 w-3.5 opacity-60" />
        </div>
      );
    case 'delivered':
      return (
        <div className="flex items-center ml-1 -space-x-1.5">
          <CheckIcon className="h-3.5 w-3.5 opacity-60" />
          <CheckIcon className="h-3.5 w-3.5 opacity-60" />
        </div>
      );
    case 'read':
      return (
        <div className="flex items-center ml-1 -space-x-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-blue-500" />
          <CheckIcon className="h-3.5 w-3.5 text-blue-500" />
        </div>
      );
    default:
      return null;
  }
};

const ContextMenu = ({ isOpen, onClose, position, isSent, onReply, onEdit, onDelete, onReact }) => {
  if (!isOpen) return null;

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉'];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      
      {/* Context Menu */}
      <div 
        className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
        style={{
          top: `${position.y}px`,
          left: isSent ? 'auto' : `${position.x}px`,
          right: isSent ? '16px' : 'auto',
        }}
      >
        {/* Reactions Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-full shadow-2xl px-4 py-3 mb-2 flex items-center gap-2">
          {reactions.map((emoji, index) => (
            <button
              key={index}
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="text-2xl hover:scale-125 transition-transform duration-150 active:scale-110"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Actions Menu */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]">
          <button
            onClick={() => {
              onReply();
              onClose();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-800 dark:text-gray-200">Reply</span>
          </button>
          
          {isSent && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <PencilIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-800 dark:text-gray-200">Edit</span>
              </button>
            </>
          )}
          
          {isSent && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
              >
                <TrashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                <span className="text-red-600 dark:text-red-500">Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

const ChatMessage = ({ message, isSent, timestamp, media, status, onReply, onEdit, onDelete, onReact }) => {
  const [showDownload, setShowDownload] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const messageRef = useRef(null);

  // Long press handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const rect = messageRef.current.getBoundingClientRect();
    
    longPressTimer.current = setTimeout(() => {
      setMenuPosition({
        x: touch.clientX,
        y: rect.top - 10
      });
      setShowContextMenu(true);
      
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    // Cancel long press if user is scrolling
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleMouseDown = (e) => {
    const rect = messageRef.current.getBoundingClientRect();
    
    longPressTimer.current = setTimeout(() => {
      setMenuPosition({
        x: e.clientX,
        y: rect.top - 10
      });
      setShowContextMenu(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Prevent default context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    const rect = messageRef.current.getBoundingClientRect();
    setMenuPosition({
      x: e.clientX,
      y: rect.top - 10
    });
    setShowContextMenu(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading media:', error);
    }
  };

  const renderMedia = () => {
    if (!media) return null;

    const isImage = media.type?.startsWith('image') || media.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = media.type?.startsWith('video') || media.url?.match(/\.(mp4|webm|ogg)$/i);

    return (
      <div 
        className="media-container relative overflow-hidden rounded-lg"
        onMouseEnter={() => setShowDownload(true)}
        onMouseLeave={() => setShowDownload(false)}
        onTouchStart={() => setShowDownload(true)}
      >
        {isImage && (
          <img src={media.url} alt="Shared content" loading="lazy" />
        )}
        {isVideo && (
          <video controls>
            <source src={media.url} type={media.type} />
            Your browser does not support the video tag.
          </video>
        )}
        <button 
          className={`absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white px-3 py-2 rounded-lg backdrop-blur-sm transition-all duration-200 flex items-center gap-2 shadow-lg ${
            showDownload ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleDownload(media.url, media.filename);
          }}
          title="Save to gallery"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Save</span>
        </button>
      </div>
    );
  };

  return (
    <>
      <div className={`mb-2 px-4 ${isSent ? 'flex justify-end' : 'flex justify-start'}`}>
        <div 
          ref={messageRef}
          className={`max-w-[75%] rounded-lg shadow-sm cursor-pointer select-none ${
            isSent 
              ? 'message-sent rounded-br-none' 
              : 'message-received rounded-bl-none'
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        >
          {renderMedia()}
          {message && (
            <div className="px-3 py-2">
              <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                {message}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-1 px-3 pb-1 pt-0">
            <span className="text-[11px] opacity-70">
              {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            {isSent && <MessageStatus status={status} />}
          </div>
        </div>
      </div>

      <ContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        position={menuPosition}
        isSent={isSent}
        onReply={onReply || (() => console.log('Reply'))}
        onEdit={onEdit || (() => console.log('Edit'))}
        onDelete={onDelete || (() => console.log('Delete'))}
        onReact={onReact || ((emoji) => console.log('React:', emoji))}
      />
    </>
  );
};

export default ChatMessage; 