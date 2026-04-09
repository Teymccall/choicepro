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
    this.pendingRemoteStreamInterval = null;
    this.pendingLocalStreamInterval = null;
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.onConnectionStateChange = onConnectionStateChange;
    
    // Initialize Xirsys TURN credentials from environment
    this.xirsysHost = process.env.REACT_APP_XIRSYS_TURN_HOST || 'us-turn4.xirsys.com';
    this.xirsysUsername = process.env.REACT_APP_XIRSYS_USERNAME || 'Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=';
    this.xirsysCredential = process.env.REACT_APP_XIRSYS_CREDENTIAL || 'd426b328-aef1-11f0-a45f-0242ac140004';
    
    // ICE servers configuration: STUN + TURN for NAT traversal
    // STUN: Discovers public IP address
    // TURN: Relay server for strict NATs/firewalls
    const xirsysHost = process.env.REACT_APP_XIRSYS_TURN_HOST || 'us-turn4.xirsys.com';
    const xirsysUsername = process.env.REACT_APP_XIRSYS_USERNAME || 'Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=';
    const xirsysCredential = process.env.REACT_APP_XIRSYS_CREDENTIAL || 'd426b328-aef1-11f0-a45f-0242ac140004';
    
    this.configuration = {
      iceServers: [
        // Google STUN servers (free, reliable)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        
        // Xirsys TURN server configuration
        // Free tier: https://xirsys.com
        {
          urls: `stun:${xirsysHost}`
        },
        {
          urls: [
            `turn:${xirsysHost}:80?transport=udp`,
            `turn:${xirsysHost}:3478?transport=udp`,
            `turn:${xirsysHost}:80?transport=tcp`,
            `turn:${xirsysHost}:3478?transport=tcp`,
            `turns:${xirsysHost}:443?transport=tcp`,
            `turns:${xirsysHost}:5349?transport=tcp`
          ],
          username: xirsysUsername,
          credential: xirsysCredential
        }
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
      console.log('🎯 Local stream id:', this.localStream.id, 'tracks:', this.localStream.getTracks().map(t => ({ id: t.id, kind: t.kind, readyState: t.readyState })));
      
      if (this.localVideoRef?.current) {
        console.log('📹 Attaching local stream to video element immediately');
        this.localVideoRef.current.srcObject = this.localStream;
        console.log('📺 Video element after attach:', {
          hasElement: !!this.localVideoRef.current,
          srcObjectId: this.localVideoRef.current?.srcObject?.id,
          tracks: this.localVideoRef.current?.srcObject?.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        });
        
        // Wait for metadata to load before playing to avoid AbortError
        this.localVideoRef.current.onloadedmetadata = () => {
          this.localVideoRef.current.play().catch(err => {
            console.error('❌ Local video play error:', err);
          });
        };
      } else {
        console.warn('⚠️ Local video ref not available yet - storing stream');
        this.pendingLocalStream = this.localStream;
        console.log('📦 Stored pendingLocalStream:', {
          streamId: this.pendingLocalStream?.id,
          tracks: this.pendingLocalStream?.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        });
        if (this.pendingLocalStreamInterval) {
          clearInterval(this.pendingLocalStreamInterval);
        }
        this.pendingLocalStreamInterval = setInterval(() => {
          console.log('⏳ Polling applyPendingLocalStream...');
          if (this.applyPendingLocalStream()) {
            clearInterval(this.pendingLocalStreamInterval);
            this.pendingLocalStreamInterval = null;
          }
        }, 250);
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
          errorMessage = 'Permission Required';
          errorDetails = constraints.video 
            ? 'Please allow access to camera and microphone to make calls.'
            : 'Please allow access to microphone to make calls.';
          break;
          
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          errorMessage = 'Device Not Found';
          errorDetails = constraints.video
            ? 'No camera or microphone detected. Please connect your devices.'
            : 'No microphone detected. Please connect a microphone.';
          break;
          
        case 'NotReadableError':
        case 'TrackStartError':
          errorMessage = 'Device Busy';
          errorDetails = 'Camera or microphone is being used by another app. Please close other apps.';
          break;
          
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          errorMessage = 'Configuration Error';
          errorDetails = 'Your device settings need adjustment. Please check device settings.';
          break;
          
        case 'TypeError':
          errorMessage = 'Browser Not Supported';
          errorDetails = 'Please use a modern browser like Chrome, Firefox, Safari, or Edge.';
          break;
          
        case 'AbortError':
          errorMessage = 'Access Interrupted';
          errorDetails = 'Camera/microphone access was stopped. Please try again.';
          break;
          
        default:
          errorMessage = 'Access Failed';
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

      let incomingStream = null;

      if (event.streams && event.streams[0]) {
        incomingStream = event.streams[0];
      } else {
        console.warn('⚠️ No streams provided with ontrack event, constructing MediaStream fallback');
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        // Avoid duplicating the same track
        const alreadyPresent = this.remoteStream.getTracks().some(existing => existing.id === event.track.id);
        if (!alreadyPresent) {
          this.remoteStream.addTrack(event.track);
          console.log('➕ Added track to fallback remote stream:', event.track.id, event.track.kind);
        }
        incomingStream = this.remoteStream;
      }

      this.remoteStream = incomingStream;

      console.log('📹 Remote stream tracks:', this.remoteStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })));

      // Force enable all audio tracks
      this.remoteStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🔊 Force-enabled audio track:', track.id, track.enabled, 'muted:', track.muted);
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
          const mediaEl = this.remoteVideoRef.current;
          if (!mediaEl) return;
          mediaEl.play().then(() => {
            console.log('▶️ Remote media playback started successfully');
          }).catch(err => {
            console.error('❌ Remote media play error:', err);
            // Attempt to recover by forcing mute toggle then play again
            mediaEl.muted = false;
            mediaEl.volume = 1.0;
            mediaEl.play().catch(innerErr => {
              console.error('❌ Remote media retry failed:', innerErr);
            });
          });
        };
      } else {
        // Store stream for later when video element is ready
        console.warn('⚠️ Remote video ref not available yet - storing stream');
        this.pendingRemoteStream = this.remoteStream;
        if (this.pendingRemoteStreamInterval) {
          clearInterval(this.pendingRemoteStreamInterval);
        }
        this.pendingRemoteStreamInterval = setInterval(() => {
          if (this.applyPendingRemoteStream()) {
            clearInterval(this.pendingRemoteStreamInterval);
            this.pendingRemoteStreamInterval = null;
          }
        }, 250);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
      
      // Log detailed state for debugging
      if (this.peerConnection.connectionState === 'failed') {
        console.error('❌ Connection failed! ICE state:', this.peerConnection.iceConnectionState);
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      
      // Provide detailed logging for troubleshooting
      if (this.peerConnection.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed! This usually means:');
        console.error('  - Network/firewall blocking connection');
        console.error('  - TURN server not working');
        console.error('  - NAT traversal issue');
      } else if (this.peerConnection.iceConnectionState === 'disconnected') {
        console.warn('⚠️ ICE connection disconnected - may reconnect automatically');
      } else if (this.peerConnection.iceConnectionState === 'connected') {
        console.log('✅ ICE connection established successfully');
      }
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
      if (this.pendingRemoteStreamInterval) {
        clearInterval(this.pendingRemoteStreamInterval);
        this.pendingRemoteStreamInterval = null;
      }
      return true;
    }
    return false;
  }

  /**
   * Apply pending local stream if video ref is now available
   * For audio calls, we skip this since there's no local video preview
   */
  applyPendingLocalStream(callType = 'video') {
    // For audio calls, clear pending stream immediately - no video ref needed
    if (callType === 'audio' && this.pendingLocalStream) {
      console.log('🎵 Audio call - skipping local video ref (not needed)');
      this.pendingLocalStream = null;
      if (this.pendingLocalStreamInterval) {
        clearInterval(this.pendingLocalStreamInterval);
        this.pendingLocalStreamInterval = null;
      }
      return true;
    }
    
    if (this.pendingLocalStream && this.localVideoRef?.current) {
      console.log('🔄 Applying pending local stream to video element');
      console.log('📦 Pending stream details:', {
        streamId: this.pendingLocalStream.id,
        tracks: this.pendingLocalStream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
      });
      this.localVideoRef.current.srcObject = this.pendingLocalStream;
      console.log('📺 Video element after pending attach:', {
        srcObjectId: this.localVideoRef.current?.srcObject?.id,
        tracks: this.localVideoRef.current?.srcObject?.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
      });
      
      // Wait for metadata to load before playing to avoid AbortError
      this.localVideoRef.current.onloadedmetadata = () => {
        this.localVideoRef.current.play().catch(err => {
          console.error('❌ Pending local video play error:', err);
        });
      };
      
      this.pendingLocalStream = null; // Clear pending stream
      if (this.pendingLocalStreamInterval) {
        clearInterval(this.pendingLocalStreamInterval);
        this.pendingLocalStreamInterval = null;
      }
      console.log('✅ Pending local stream applied successfully');
      return true;
    }
    if (this.pendingLocalStream && !this.localVideoRef?.current && callType === 'video') {
      console.log('⌛ Pending local stream waiting for video ref (video call)');
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

    if (this.pendingLocalStreamInterval) {
      clearInterval(this.pendingLocalStreamInterval);
      this.pendingLocalStreamInterval = null;
    }

    if (this.pendingRemoteStreamInterval) {
      clearInterval(this.pendingRemoteStreamInterval);
      this.pendingRemoteStreamInterval = null;
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
