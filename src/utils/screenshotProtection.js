/**
 * Screenshot Protection Utilities
 * Implements multiple layers of screenshot deterrence and detection
 */

import { ref, push, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { toast } from 'react-hot-toast';

/**
 * Detect screenshot attempts on mobile devices
 * Note: This only works on some Android devices and iOS with limited success
 */
export const initScreenshotDetection = (userId, partnerId, topicId) => {
  if (!userId || !partnerId) return null;

  let screenshotDetected = false;
  let lastActivityTime = Date.now();
  
  // Track user activity
  const updateActivity = () => {
    lastActivityTime = Date.now();
  };
  
  document.addEventListener('mousemove', updateActivity);
  document.addEventListener('keypress', updateActivity);

  // Method 1: Enhanced visibility change detection
  const handleVisibilityChange = async () => {
    if (document.hidden && !screenshotDetected) {
      const timeSinceActivity = Date.now() - lastActivityTime;
      
      // If user was active less than 2 seconds ago, likely a screenshot
      if (timeSinceActivity < 2000) {
        screenshotDetected = true;
        await logScreenshotAttempt(userId, partnerId, topicId, 'visibility_change');
        
        setTimeout(() => {
          if (!document.hidden) {
            toast.error('📸 Screenshot detected! Your partner has been notified.', {
              duration: 4000,
              style: {
                background: '#DC2626',
                color: '#FFFFFF'
              }
            });
          }
          screenshotDetected = false;
        }, 800);
      }
    }
  };

  // Method 2: Detect focus loss with better timing
  const handleBlur = async () => {
    const timeSinceActivity = Date.now() - lastActivityTime;
    
    if (timeSinceActivity < 1500) {
      setTimeout(async () => {
        if (!document.hasFocus()) {
          await logScreenshotAttempt(userId, partnerId, topicId, 'focus_loss');
          
          setTimeout(() => {
            if (document.hasFocus()) {
              toast.error('📸 Screenshot activity detected! Your partner was notified.', {
                duration: 3000,
                style: {
                  background: '#DC2626',
                  color: '#FFFFFF'
                }
              });
            }
          }, 500);
        }
      }, 100);
    }
  };
  
  // Method 3: Detect rapid app switching (screenshot then return)
  let switchCount = 0;
  let switchTimer = null;
  
  const detectRapidSwitch = async () => {
    switchCount++;
    
    if (switchTimer) clearTimeout(switchTimer);
    
    if (switchCount >= 2) {
      await logScreenshotAttempt(userId, partnerId, topicId, 'rapid_switch');
      toast.error('📸 Suspicious activity detected! Your partner was notified.', {
        duration: 3000,
        style: {
          background: '#DC2626',
          color: '#FFFFFF'
        }
      });
    }
    
    switchTimer = setTimeout(() => {
      switchCount = 0;
    }, 3000);
  };
  
  const handleFocus = () => {
    if (document.hidden) return;
    detectRapidSwitch();
  };

  // Method 3: Detect keyboard shortcuts (Print Screen, etc.)
  const handleKeydown = async (e) => {
    // Print Screen detection
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      await logScreenshotAttempt(userId, partnerId, topicId, 'print_screen');
      toast.error('⚠️ Screenshots are not allowed! Your partner has been notified.', {
        duration: 5000,
        icon: '🚫'
      });
      return false;
    }

    // Windows Snipping Tool (Win + Shift + S)
    if (e.key === 's' && e.shiftKey && e.metaKey) {
      e.preventDefault();
      await logScreenshotAttempt(userId, partnerId, topicId, 'snipping_tool');
      toast.error('⚠️ Screenshots are not allowed! Your partner has been notified.', {
        duration: 5000,
        icon: '🚫'
      });
      return false;
    }

    // Mac screenshot (Cmd + Shift + 3/4/5)
    if ((e.key === '3' || e.key === '4' || e.key === '5') && e.shiftKey && e.metaKey) {
      e.preventDefault();
      await logScreenshotAttempt(userId, partnerId, topicId, 'mac_screenshot');
      toast.error('⚠️ Screenshots are not allowed! Your partner has been notified.', {
        duration: 5000,
        icon: '🚫'
      });
      return false;
    }
  };

  // Add event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('mousemove', updateActivity);
    document.removeEventListener('keypress', updateActivity);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('keydown', handleKeydown);
    if (switchTimer) clearTimeout(switchTimer);
  };
};

/**
 * Log screenshot attempt and notify partner
 */
const logScreenshotAttempt = async (userId, partnerId, topicId, method) => {
  try {
    // Log to security events
    const securityRef = ref(rtdb, `securityEvents/${userId}`);
    await push(securityRef, {
      type: 'SCREENSHOT_ATTEMPT',
      method,
      topicId,
      timestamp: serverTimestamp()
    });

    // Notify partner
    const notificationRef = ref(rtdb, `notifications/${partnerId}`);
    await push(notificationRef, {
      type: 'screenshot_detected',
      message: 'Your partner attempted to take a screenshot',
      senderId: userId,
      topicId,
      timestamp: serverTimestamp(),
      read: false
    });

    console.warn('[SECURITY] Screenshot attempt detected:', { userId, method, topicId });
  } catch (error) {
    console.error('Error logging screenshot attempt:', error);
  }
};

/**
 * Apply blur effect when user leaves chat
 */
export const initContentProtection = () => {
  const chatContainer = document.querySelector('.chat-messages-container');
  if (!chatContainer) return null;

  const handleBlur = () => {
    chatContainer.style.filter = 'blur(20px)';
    chatContainer.style.userSelect = 'none';
  };

  const handleFocus = () => {
    chatContainer.style.filter = 'none';
    chatContainer.style.userSelect = 'auto';
  };

  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);

  return () => {
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
  };
};

/**
 * Prevent right-click context menu (helps prevent "Save Image" etc.)
 */
export const preventContextMenu = () => {
  const handleContextMenu = (e) => {
    e.preventDefault();
    toast.error('Right-click is disabled for security', {
      duration: 2000,
      icon: '🔒'
    });
    return false;
  };

  document.addEventListener('contextmenu', handleContextMenu);

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
  };
};

/**
 * Prevent text selection on sensitive content
 */
export const preventTextSelection = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .screenshot-protected {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
    
    .screenshot-protected::selection {
      background: transparent;
    }
    
    .screenshot-protected::-moz-selection {
      background: transparent;
    }
  `;
  document.head.appendChild(style);

  return () => {
    document.head.removeChild(style);
  };
};

/**
 * Add watermark overlay to messages
 */
export const addWatermark = (userId, displayName) => {
  const style = document.createElement('style');
  style.innerHTML = `
    .chat-messages-container::before {
      content: "${displayName || 'Private'} • ${new Date().toLocaleDateString()}";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 48px;
      font-weight: bold;
      color: rgba(0, 0, 0, 0.05);
      pointer-events: none;
      white-space: nowrap;
      z-index: 9999;
      user-select: none;
    }
    
    .dark .chat-messages-container::before {
      color: rgba(255, 255, 255, 0.05);
    }
  `;
  document.head.appendChild(style);

  return () => {
    document.head.removeChild(style);
  };
};

/**
 * Check if device supports screenshot detection
 */
export const supportsScreenshotDetection = () => {
  // Most accurate on mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return {
    supported: isMobile,
    partial: !isMobile, // Desktop has partial support through keyboard detection
    message: isMobile 
      ? 'Screenshot detection active' 
      : 'Screenshot detection partially active (keyboard shortcuts)'
  };
};

/**
 * Show security warning banner
 */
export const showSecurityWarning = () => {
  return {
    title: '🔒 Screenshot Protection Active',
    message: 'This chat is private. Screenshots will be detected and your partner will be notified.',
    level: 'warning'
  };
};
