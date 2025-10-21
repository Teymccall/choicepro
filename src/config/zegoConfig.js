// ZegoCloud Configuration
export const ZEGO_CONFIG = {
  appID: 903806736,
  serverSecret: 'fc435d143bdc4b960915f221edd52a12',
  
  // Common settings for both audio and video calls
  commonSettings: {
    turnOnMicrophoneWhenJoining: true,
    showMyMicrophoneToggleButton: true,
    showAudioVideoSettingsButton: true,
    showUserList: true,
    maxUsers: 2,
    showLayoutButton: false,
  },
  
  // Video call specific settings
  videoCallSettings: {
    turnOnCameraWhenJoining: true,
    showMyCameraToggleButton: true,
    showScreenSharingButton: true,
    showTextChat: true,
    layout: 'Auto',
    scenario: {
      mode: 'OneONoneCall',
      config: {
        role: 'Host',
      },
    },
  },
  
  // Audio call specific settings
  audioCallSettings: {
    turnOnCameraWhenJoining: false,
    showMyCameraToggleButton: false,
    showScreenSharingButton: false,
    showTextChat: true,
    layout: 'Auto',
    scenario: {
      mode: 'OneONoneCall',
      config: {
        role: 'Host',
      },
    },
  },
};

// Generate ZegoCloud token
export function generateZegoToken(userID, userName) {
  const appID = ZEGO_CONFIG.appID;
  const serverSecret = ZEGO_CONFIG.serverSecret;
  
  // Import the token generation utility from ZegoCloud
  // For production, you should generate tokens on your backend
  return {
    appID,
    serverSecret,
    userID,
    userName,
  };
}

// Get call configuration based on type
export function getCallConfig(callType) {
  const baseConfig = {
    ...ZEGO_CONFIG.commonSettings,
  };
  
  if (callType === 'video') {
    return {
      ...baseConfig,
      ...ZEGO_CONFIG.videoCallSettings,
    };
  } else {
    return {
      ...baseConfig,
      ...ZEGO_CONFIG.audioCallSettings,
    };
  }
}
