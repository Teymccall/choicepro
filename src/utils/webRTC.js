/**
 * WebRTC Connection Manager
 * Handles peer-to-peer audio/video connections
 */

export class WebRTCConnection {
  constructor(localVideoRef, remoteVideoRef, onConnectionStateChange) {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.onConnectionStateChange = onConnectionStateChange;
    
    // STUN servers for NAT traversal
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }

  /**
   * Initialize local media stream
   */
  async initializeMedia(constraints = { video: true, audio: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.localVideoRef?.current) {
        this.localVideoRef.current.srcObject = this.localStream;
      }
      
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera/microphone. Please check permissions.');
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
      console.log('Received remote track:', event.track.kind);
      
      // Use the stream directly from the event
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        
        if (this.remoteVideoRef?.current) {
          this.remoteVideoRef.current.srcObject = this.remoteStream;
          console.log('Set remote stream to video element');
        }
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
   * Create answer (receiver side)
   */
  async createAnswer(offer) {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return answer;
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
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
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
