import React from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const ImageViewer = ({ image, onClose }) => {
  const handleDownload = async (e) => {
    e.stopPropagation();
    
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
    >
      {/* Top Bar with buttons */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <h3 className="text-white font-medium">Image</h3>
        <div className="flex items-center gap-2">
          <button 
            className="text-white p-2.5 hover:bg-white/10 rounded-full transition-colors"
            onClick={handleDownload}
            title="Save to gallery"
          >
            <ArrowDownTrayIcon className="h-6 w-6" />
          </button>
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
      <img 
        src={image} 
        alt="Full size" 
        className="max-w-[90vw] max-h-[90vh] object-contain"
        loading="eager"
        decoding="sync"
        onLoad={(e) => {
          e.target.style.opacity = 1;
        }}
        style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
      />
    </div>
  );
};

export default ImageViewer; 