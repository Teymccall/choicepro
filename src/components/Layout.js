import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ref, onValue, get } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { cookieManager } from '../utils/cookieManager';
import FloatingNav from './FloatingNav';
import Navigation from './Navigation';
import { useWebRTCContext } from '../context/WebRTCContext';
import VideoCall from './VideoCall';
import IncomingCall from './IncomingCall';
import PermissionPrompt from './PermissionPrompt';

const Layout = ({ children }) => {
  const { user, partner } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';
  const isChatPage = location.pathname === '/chat';

  // Don't show navigation on login page
  const showNav = user && !isLoginPage;

  // Global call management
  const [incomingCall, setIncomingCall] = useState(null);
  const webRTC = useWebRTCContext();

  // Listen for incoming calls globally
  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;

    const callsRef = ref(rtdb, 'calls');
    const unsubscribe = onValue(callsRef, (snapshot) => {
      const calls = snapshot.val();
      
      if (!calls) {
        setIncomingCall(null);
        return;
      }

      // Find incoming calls for this user
      let foundIncomingCall = false;
      Object.entries(calls).forEach(([callId, callData]) => {
        if (
          callData.recipient === user.uid &&
          callData.caller === partner.uid
        ) {
          if (callData.status === 'ringing') {
            setIncomingCall({ callId, ...callData });
            foundIncomingCall = true;
          } 
          else if (callData.status === 'ended' || callData.status === 'rejected') {
            setIncomingCall(null);
          }
        }
      });

      if (!foundIncomingCall) {
        setIncomingCall(null);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid]);

  useEffect(() => {
    // Initialize theme from Firebase or localStorage
    const initializeTheme = async () => {
      // First check cookies (highest priority)
      const cookieTheme = cookieManager.getTheme();
      
      // Then check localStorage
      const storedTheme = localStorage.getItem('theme');
      
      // Default to light mode for new users
      let themeToApply = 'light';
      
      if (storedTheme) {
        themeToApply = storedTheme;
      }
      
      if (cookieTheme) {
        themeToApply = cookieTheme;
      }

      // If user is logged in, try to get theme from Firebase
      if (user?.uid) {
        try {
          const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
          const snapshot = await get(themeRef);
          const data = snapshot.val();
          
          if (data?.preference) {
            themeToApply = data.preference;
          }
        } catch (error) {
          console.error('Error fetching theme from Firebase:', error);
        }
      }

      // Apply the theme
      applyTheme(themeToApply);
    };

    // Helper function to apply theme
    const applyTheme = (theme) => {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = theme === 'dark' || (theme === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (theme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
        root.classList.add(theme);
      }

      // Store in both localStorage and cookies
      localStorage.setItem('theme', theme);
      cookieManager.saveTheme(theme);
    };

    initializeTheme();

    // Set up Firebase listener for theme changes
    let unsubscribe;
    if (user?.uid) {
      const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      unsubscribe = onValue(themeRef, (snapshot) => {
        const data = snapshot.val();
        if (data?.preference) {
          applyTheme(data.preference);
        }
      });
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      const currentTheme = localStorage.getItem('theme') || 'system';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      if (unsubscribe) unsubscribe();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {showNav && (
        <>
          <Navigation />
          <FloatingNav />
        </>
      )}
      <main 
        className={`
          ${showNav && !isChatPage ? 'pt-16 pb-20 md:pb-8' : ''} 
          ${isHomePage ? 'bg-gradient-to-b from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/40' : ''}
          ${isChatPage ? 'h-screen overflow-hidden' : 'min-h-screen'}
        `}
      >
        {children}
      </main>

      {/* Global Video/Audio Call Component */}
      {(webRTC.callStatus === 'calling' || webRTC.callStatus === 'active') && (
        <VideoCall
          localVideoRef={webRTC.localVideoRef}
          remoteVideoRef={webRTC.remoteVideoRef}
          callStatus={webRTC.callStatus}
          callType={webRTC.callType}
          isAudioEnabled={webRTC.isAudioEnabled}
          isVideoEnabled={webRTC.isVideoEnabled}
          isSpeakerOn={webRTC.isSpeakerOn}
          callDuration={webRTC.callDuration}
          partnerName={partner?.displayName}
          partnerPhotoURL={partner?.photoURL}
          onEndCall={webRTC.endCall}
          onToggleAudio={webRTC.toggleAudio}
          onToggleVideo={webRTC.toggleVideo}
          onToggleSpeaker={webRTC.toggleSpeaker}
        />
      )}

      {/* Global Incoming Call Notification */}
      {incomingCall && webRTC.callStatus === 'idle' && (
        <IncomingCall
          callerName={incomingCall.callerName}
          callerPhotoURL={incomingCall.callerPhotoURL}
          callType={incomingCall.type}
          onAccept={() => {
            webRTC.answerCall(incomingCall.callId, incomingCall);
            setIncomingCall(null);
          }}
          onReject={() => {
            webRTC.rejectCall(incomingCall.callId);
            setIncomingCall(null);
          }}
        />
      )}

      {/* Permission Prompt */}
      {webRTC.showPermissionPrompt && (
        <PermissionPrompt
          callType={webRTC.pendingCallType}
          onProceed={() => webRTC.startCall(webRTC.pendingCallType)}
          onCancel={webRTC.cancelPermissionPrompt}
        />
      )}
    </div>
  );
};

export default Layout; 