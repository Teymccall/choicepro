/**
 * WebRTC Connection Manager
 * Handles peer-to-peer audio/video connections
 */

export class WebRTCConnection {
  constructor(localVideoRef, remoteVideoRef, onConnectionStateChange) {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingRemoteStream = null; // Store stream if ref not ready
    this.pendingLocalStream = null; // Store local stream if ref not ready
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.onConnectionStateChange = onConnectionStateChange;
    
    // ICE servers configuration: STUN + TURN for NAT traversal
    // STUN: Discovers public IP address
    // TURN: Relay server for strict NATs/firewalls
    this.configuration = {
      iceServers: [
        // Google STUN servers (free, reliable)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        
        // TURN server configuration
        // 🔧 SETUP REQUIRED: Get free TURN credentials from:
        // - Twilio: https://www.twilio.com/stun-turn (free tier: 10GB/month)
        // - Xirsys: https://xirsys.com (free tier available)
        // - Metered: https://www.metered.ca/tools/openrelay/ (open relay)
        
        // Option 1: Metered TURN (Open Relay - No signup required)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        
        // Option 2: Add your own TURN server credentials here
        // Uncomment and configure with your credentials:
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: process.env.REACT_APP_TURN_USERNAME,
        //   credential: process.env.REACT_APP_TURN_CREDENTIAL
        // },
        // {
        //   urls: 'turn:your-turn-server.com:3478?transport=tcp',
        //   username: process.env.REACT_APP_TURN_USERNAME,
        //   credential: process.env.REACT_APP_TURN_CREDENTIAL
        // }
      ],
      
      // Additional configuration for better connectivity
      iceCandidatePoolSize: 10,  // Pre-gather ICE candidates for faster connection
      iceTransportPolicy: 'all'   // Use all candidates (STUN + TURN)
    };
  }

  /**
   * Initialize local media stream
   */
  async initializeMedia(constraints = { video: true, audio: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Local stream created:', this.localStream.getTracks().map(t => t.kind));
      
      if (this.localVideoRef?.current) {
        console.log('📹 Attaching local stream to video element immediately');
        this.localVideoRef.current.srcObject = this.localStream;
        
        // Wait for metadata to load before playing to avoid AbortError
        this.localVideoRef.current.onloadedmetadata = () => {
          this.localVideoRef.current.play().catch(err => {
            console.error('❌ Local video play error:', err);
          });
        };
      } else {
        console.warn('⚠️ Local video ref not available yet - storing stream');
        this.pendingLocalStream = this.localStream;
      }
      
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Provide detailed error messages based on error type
      let errorMessage = 'Could not access camera/microphone.';
      let errorDetails = '';
      
      switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          errorMessage = '🚫 Camera/Microphone Permission Denied';
          errorDetails = constraints.video 
            ? 'Please enable camera and microphone in your browser settings.'
            : 'Please enable microphone in your browser settings.';
          break;
          
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          errorMessage = '📷 No Camera or Microphone Found';
          errorDetails = constraints.video
            ? 'Please connect a camera and microphone to your device.'
            : 'Please connect a microphone to your device.';
          break;
          
        case 'NotReadableError':
        case 'TrackStartError':
          errorMessage = '⚠️ Device Already in Use';
          errorDetails = 'Your camera or microphone is being used by another application. Please close other apps and try again.';
          break;
          
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          errorMessage = '⚙️ Device Configuration Error';
          errorDetails = 'Your device does not meet the required specifications. Try adjusting settings.';
          break;
          
        case 'TypeError':
          errorMessage = '🔧 Browser Compatibility Issue';
          errorDetails = 'Your browser may not support video calls. Please use Chrome, Firefox, Safari, or Edge.';
          break;
          
        case 'AbortError':
          errorMessage = '❌ Media Access Interrupted';
          errorDetails = 'Camera/microphone access was stopped. Please try again.';
          break;
          
        default:
          errorMessage = '❌ Camera/Microphone Access Failed';
          errorDetails = `Error: ${error.message || 'Unknown error'}`;
      }
      
      // Create detailed error object
      const detailedError = new Error(errorMessage);
      detailedError.details = errorDetails;
      detailedError.originalError = error;
      detailedError.constraints = constraints;
      
      throw detailedError;
    }
  }

  /**
   * Create peer connection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 Received remote track:', event.track.kind, 'enabled:', event.track.enabled, 'muted:', event.track.muted);
      console.log('📺 Remote streams available:', event.streams?.length);
      
      // CRITICAL: Ensure audio track is enabled and unmuted
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        console.log('🔊 Audio track force-enabled:', event.track.enabled);
      }
      
      // Use the stream directly from the event
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log('📹 Remote stream tracks:', this.remoteStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        })));
        
        // Force enable all audio tracks
        this.remoteStream.getAudioTracks().forEach(track => {
          track.enabled = true;
          console.log('🔊 Force-enabled audio track:', track.id, track.enabled);
        });
        
        if (this.remoteVideoRef?.current) {
          this.remoteVideoRef.current.srcObject = this.remoteStream;
          console.log('✅ Set remote stream to video/audio element');
          
          // Ensure element is unmuted
          this.remoteVideoRef.current.muted = false;
          this.remoteVideoRef.current.volume = 1.0;
          console.log('🔊 Video/Audio element unmuted, volume:', this.remoteVideoRef.current.volume);
          
          // Wait for metadata to load before playing to avoid AbortError
          this.remoteVideoRef.current.onloadedmetadata = () => {
            this.remoteVideoRef.current.play().catch(err => {
              console.error('❌ Remote video play error:', err);
            });
          };
        } else {
          // Store stream for later when video element is ready
          console.warn('⚠️ Remote video ref not available yet - storing stream');
          this.pendingRemoteStream = this.remoteStream;
        }
      } else {
        console.warn('⚠️ No streams in ontrack event');
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    return this.peerConnection;
  }

  /**
   * Create offer (caller side)
   */
  async createOffer() {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Set remote offer (receiver side)
   */
  async setRemoteOffer(offer) {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  }

  /**
   * Create answer (receiver side)
   */
  async createAnswer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return {
      type: answer.type,
      sdp: answer.sdp
    };
  }

  /**
   * Set remote answer (caller side)
   */
  async setRemoteAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate) {
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  /**
   * Toggle audio
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Toggle video
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      console.log(`🎥 Toggling video: ${enabled ? 'ON' : 'OFF'}`);
      this.localStream.getVideoTracks().forEach(track => {
        console.log(`📹 Video track ${track.id}: ${track.enabled} -> ${enabled}`);
        track.enabled = enabled;
      });
    } else {
      console.warn('⚠️ No local stream available for video toggle');
    }
  }

  /**
   * Get connection stats
   */
  async getConnectionStats() {
    if (!this.peerConnection) return null;

    const stats = await this.peerConnection.getStats();
    let videoStats = {};

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        videoStats = {
          bytesReceived: report.bytesReceived,
          packetsLost: report.packetsLost,
          jitter: report.jitter
        };
      }
    });

    return videoStats;
  }

  /**
   * Apply pending remote stream if video ref is now available
   */
  applyPendingRemoteStream() {
    if (this.pendingRemoteStream && this.remoteVideoRef?.current) {
      console.log('🔄 Applying pending remote stream to video element');
      
      // Force enable all audio tracks
      this.pendingRemoteStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🔊 Force-enabled pending audio track:', track.id, track.enabled);
      });
      
      this.remoteVideoRef.current.srcObject = this.pendingRemoteStream;
      
      // Ensure element is unmuted
      this.remoteVideoRef.current.muted = false;
      this.remoteVideoRef.current.volume = 1.0;
      console.log('🔊 Pending stream - Video/Audio element unmuted, volume:', this.remoteVideoRef.current.volume);
      
      // Wait for metadata to load before playing to avoid AbortError
      this.remoteVideoRef.current.onloadedmetadata = () => {
        this.remoteVideoRef.current.play().catch(err => {
          console.error('❌ Pending remote video play error:', err);
        });
      };
      
      this.pendingRemoteStream = null; // Clear pending stream
      return true;
    }
    return false;
  }

  /**
   * Apply pending local stream if video ref is now available
   */
  applyPendingLocalStream() {
    if (this.pendingLocalStream && this.localVideoRef?.current) {
      console.log('🔄 Applying pending local stream to video element');
      this.localVideoRef.current.srcObject = this.pendingLocalStream;
      
      // Wait for metadata to load before playing to avoid AbortError
      this.localVideoRef.current.onloadedmetadata = () => {
        this.localVideoRef.current.play().catch(err => {
          console.error('❌ Pending local video play error:', err);
        });
      };
      
      this.pendingLocalStream = null; // Clear pending stream
      return true;
    }
    return false;
  }

  /**
   * Close connection and cleanup
   */
  close() {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // Stop all remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Clear video elements
    if (this.localVideoRef?.current) {
      this.localVideoRef.current.srcObject = null;
    }
    if (this.remoteVideoRef?.current) {
      this.remoteVideoRef.current.srcObject = null;
    }

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingRemoteStream = null;
    this.pendingLocalStream = null;
  }
}

/**
 * Check if WebRTC is supported
 */
export const isWebRTCSupported = () => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  );
};

/**
 * Check media device permissions
 */
export const checkMediaPermissions = async () => {
  try {
    const permissions = await Promise.all([
      navigator.permissions.query({ name: 'camera' }),
      navigator.permissions.query({ name: 'microphone' })
    ]);

    return {
      camera: permissions[0].state,
      microphone: permissions[1].state
    };
  } catch (error) {
    // Fallback: try to access devices
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      return { camera: 'granted', microphone: 'granted' };
    } catch (e) {
      return { camera: 'denied', microphone: 'denied' };
    }
  }
};

/**
 * Get available media devices
 */
export const getMediaDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter(d => d.kind === 'videoinput'),
      microphones: devices.filter(d => d.kind === 'audioinput'),
      speakers: devices.filter(d => d.kind === 'audiooutput')
    };
  } catch (error) {
    console.error('Error enumerating devices:', error);
    return { cameras: [], microphones: [], speakers: [] };
  }
};
