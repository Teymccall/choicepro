import React, { createContext, useContext } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from './AuthContext';

const WebRTCContext = createContext(null);

export const WebRTCProvider = ({ children }) => {
  const { user, partner } = useAuth();
  const webRTC = useWebRTC(user, partner);

  return (
    <WebRTCContext.Provider value={webRTC}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTCContext = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTCContext must be used within WebRTCProvider');
  }
  return context;
};
