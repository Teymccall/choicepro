import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false);
  const [waveform, setWaveform] = useState(Array(20).fill(0));
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const startXRef = useRef(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const holdTimerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio visualizer
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 64;
      
      // Start waveform animation
      animateWaveform();
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        
        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone permission denied or not available');
    }
  };

  // Animate waveform
  const animateWaveform = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Sample 20 points for waveform
    const step = Math.floor(dataArray.length / 20);
    const newWaveform = [];
    for (let i = 0; i < 20; i++) {
      const value = dataArray[i * step] / 255; // Normalize to 0-1
      newWaveform.push(value);
    }
    setWaveform(newWaveform);
    
    animationFrameRef.current = requestAnimationFrame(animateWaveform);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle touch/mouse start
  const handleStart = (e) => {
    // Only prevent default on touch to avoid scroll issues
    if (e.type.includes('touch')) {
      e.preventDefault();
    }
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    startTimeRef.current = Date.now();
    
    // Only start recording after 200ms of holding (prevents accidental taps)
    holdTimerRef.current = setTimeout(() => {
      startRecording();
    }, 200);
  };

  // Handle touch/mouse move
  const handleMove = (e) => {
    if (!isRecording) return;
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const diff = startXRef.current - clientX;
    
    if (diff > 0) {
      setSlideOffset(Math.min(diff, 150));
      setIsCanceling(diff > 100);
    }
  };

  // Handle touch/mouse end
  const handleEnd = () => {
    // Clear hold timer if user released before recording started
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    // If not recording yet, just cancel
    if (!isRecording) {
      return;
    }
    
    // Check if recording is too short (less than 1 second)
    const holdDuration = (Date.now() - startTimeRef.current) / 1000;
    if (holdDuration < 1 && !isCanceling) {
      // Too short - cancel
      console.log('⚠️ Recording too short - cancelled');
      stopRecording();
      setAudioBlob(null);
      setRecordingTime(0);
      setSlideOffset(0);
      setIsCanceling(false);
      if (onCancel) onCancel();
      return;
    }
    
    stopRecording();
    
    // Cancel if slid too far
    if (isCanceling || slideOffset > 100) {
      setAudioBlob(null);
      setRecordingTime(0);
      setSlideOffset(0);
      setIsCanceling(false);
      if (onCancel) onCancel();
    }
  };

  // Send recording
  useEffect(() => {
    if (audioBlob && !isCanceling && slideOffset <= 100) {
      onSend(audioBlob, recordingTime);
      // Reset
      setAudioBlob(null);
      setRecordingTime(0);
      setSlideOffset(0);
      setIsCanceling(false);
    }
  }, [audioBlob, isCanceling, slideOffset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Microphone Button */}
      <button
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        className={`flex-shrink-0 p-3 rounded-2xl transition-all duration-200 ${
          isRecording
            ? 'bg-red-500 scale-110'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:scale-105'
        }`}
        style={{
          transform: isRecording ? `translateX(-${slideOffset}px) scale(1.1)` : undefined,
        }}
        title="Hold to record voice note"
      >
        <MicrophoneIcon className="h-6 w-6 text-white" />
      </button>

      {/* Recording UI Overlay - Compact Version */}
      {isRecording && (
        <div className="fixed inset-0 z-[70] bg-black/30 pointer-events-none flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl pointer-events-auto max-w-xs mx-4">
            {/* Waveform */}
            <div className="flex items-center justify-center gap-0.5 mb-3 h-12">
              {waveform.map((height, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-t from-blue-600 to-purple-600 rounded-full transition-all duration-100"
                  style={{
                    width: '3px',
                    height: `${Math.max(6, height * 40)}px`,
                  }}
                />
              ))}
            </div>

            {/* Recording time */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-lg font-mono font-semibold text-gray-800 dark:text-gray-200">
                {formatTime(recordingTime)}
              </span>
            </div>

            {/* Instruction */}
            <p className="text-center text-xs text-gray-600 dark:text-gray-400">
              {isCanceling ? (
                <span className="text-red-600 dark:text-red-400 font-medium">Release to cancel</span>
              ) : (
                'Slide left to cancel • Release to send'
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
