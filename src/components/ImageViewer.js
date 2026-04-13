import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';

const ImageViewer = ({ image, onClose, disappearingTimer, viewedAt, onImageLoad }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  // If this is a disappearing image, track the countdown and auto-close when it expires
  useEffect(() => {
    if (!disappearingTimer || !viewedAt) return;

    const viewedTime = typeof viewedAt === 'number'
      ? viewedAt
      : new Date(viewedAt).getTime();
    const expirationTime = viewedTime + (disappearingTimer * 1000);

    const tick = () => {
      const remaining = Math.max(0, expirationTime - Date.now());
      if (remaining <= 0) {
        onClose(); // Auto-close the viewer when expired
      } else {
        setTimeLeft(remaining);
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [disappearingTimer, viewedAt, onClose]);

  const formatCountdown = (ms) => {
    if (!ms) return '';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
  };

  const isDisappearing = !!disappearingTimer;

  const handleDownload = async (e) => {
    e.stopPropagation();
    // Block download for disappearing images
    if (isDisappearing) return;

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" 
      onClick={onClose}
      // Block screenshots for disappearing images
      style={isDisappearing ? {
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      } : {}}
    >
      {/* Top Bar with buttons */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        <h3 className="text-white font-medium">Image</h3>
        <div className="flex items-center gap-2">
          {/* Only show download for non-disappearing images */}
          {!isDisappearing && (
            <button 
              className="text-white p-2.5 hover:bg-white/10 rounded-full transition-colors"
              onClick={handleDownload}
              title="Save to gallery"
            >
              <ArrowDownTrayIcon className="h-6 w-6" />
            </button>
          )}
          <button 
            className="text-white p-2.5 hover:bg-white/10 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Disappearing countdown banner */}
      {isDisappearing && timeLeft !== null && (
        <div className="absolute top-16 left-0 right-0 flex justify-center z-10">
          <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg animate-pulse">
            <ClockIcon className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-bold font-mono">
              {formatCountdown(timeLeft)}
            </span>
          </div>
        </div>
      )}

      <img 
        src={image} 
        alt="Full size" 
        className="max-w-[90vw] max-h-[90vh] object-contain"
        loading="eager"
        decoding="sync"
        onLoad={(e) => {
          e.target.style.opacity = 1;
          if (onImageLoad) onImageLoad(); // Only start the timer back-end sync once fully painted!
        }}
        style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
        // Prevent right-click save on disappearing images
        onContextMenu={isDisappearing ? (e) => e.preventDefault() : undefined}
        draggable={!isDisappearing}
      />
    </div>
  );
};

export default ImageViewer;