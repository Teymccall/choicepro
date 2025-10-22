import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PaperAirplaneIcon,
  XMarkIcon,
  UserCircleIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  DocumentIcon,
  XCircleIcon,
  CameraIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FaceSmileIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  MicrophoneIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  PhoneIcon,
  VideoCameraIcon,
  PaperClipIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { ref, onValue, push, update, serverTimestamp, remove, get, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { uploadMedia, validateFile } from '../utils/mediaUpload';
import cld from '../config/cloudinary';
import { AdvancedImage } from '@cloudinary/react';
import { fill } from '@cloudinary/url-gen/actions/resize';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import ProfilePicture from './ProfilePicture';
import { getRelationshipLevel, RELATIONSHIP_LEVELS } from '../utils/relationshipLevels';
import ImageViewer from './ImageViewer';
import Message from './Message';
import { formatTime } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import { 
  sanitizeInput, 
  validateMessage, 
  checkRateLimit, 
  verifyPartnerRelationship,
  logSecurityEvent 
} from '../utils/chatSecurity';
import {
  initScreenshotDetection,
  initContentProtection,
  preventContextMenu,
  preventTextSelection
} from '../utils/screenshotProtection';
import { useWebRTCContext } from '../context/WebRTCContext';

// Define DisconnectionNotice component outside of TopicChat
const DisconnectionNotice = () => (
  <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center">
    Partner disconnected. Some features may be limited.
  </div>
);

const TopicChat = ({ topic, onClose }) => {
  const { user, partner, isOnline } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(() => {
    // Initialize with saved draft if it exists
    const savedDraft = localStorage.getItem(`messageDraft_${topic.id}_${user?.uid}`);
    return savedDraft || '';
  });
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaMenuRef = useRef(null);
  const cameraInputRef = useRef(null);
  const messageRefs = useRef({});
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputContainerRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const autoSendRecordingRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const pendingStopRef = useRef(null);
  const previewAudioRef = useRef(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [partnerData, setPartnerData] = useState(partner);
  const [messageCount, setMessageCount] = useState(0);
  const [relationshipLevel, setRelationshipLevel] = useState({ level: 'Acquaintance', color: 'text-gray-600 dark:text-gray-400' });
  const [nextLevelProgress, setNextLevelProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const topicInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const optionsMenuRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  
  // WebRTC context for call buttons (UI is in Layout)
  const webRTC = useWebRTCContext();

  const scrollToBottom = (force = false, instant = false) => {
    if (force || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: instant ? 'instant' : 'smooth',
        block: 'end'
      });
    }
  };

  useEffect(() => {
    if (!user?.uid || !topic?.id) return;
    
    // Store the current chat ID in session storage
    localStorage.setItem(`lastRead_${topic.id}_${user.uid}`, Date.now().toString());
    localStorage.setItem(`lastChecked_${topic.id}_${user.uid}`, Date.now().toString());
    sessionStorage.setItem('openTopicChatId', topic.id);
    
    // Dispatch custom event for FloatingNav
    window.dispatchEvent(new Event('topicChatOpened'));
    
    // Only remove session storage if we're actually closing the chat
    // not just during component cleanup on refresh
    return () => {
      if (!window.performance.getEntriesByType('navigation').some(entry => entry.type === 'reload')) {
      sessionStorage.removeItem('openTopicChatId');
        // Dispatch event when chat is closed too
        window.dispatchEvent(new Event('topicChatOpened'));
      }
    };
  }, [topic?.id, user?.uid]);

  useEffect(() => {
    if (!topic?.id || !user?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const deletedMessagesRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
    
    let deletedMessagesCache = {};
    let messagesCache = {};
    let deletedMessagesLoaded = false;
    let messagesLoaded = false;
    
    // Function to process and filter messages
    const processMessages = async () => {
      // Don't process until both are loaded
      if (!deletedMessagesLoaded || !messagesLoaded) {
        console.log('⏳ Waiting for data to load...', { deletedMessagesLoaded, messagesLoaded });
        return [];
      }
      
      if (!messagesCache || Object.keys(messagesCache).length === 0) {
        setMessages([]);
        setLoading(false);
        return [];
      }

      console.log('📨 Processing messages. Deleted cache:', deletedMessagesCache);

      const messagesList = Object.entries(messagesCache)
        .map(([id, message]) => ({
          id,
          ...message,
          timestamp: message.timestamp || Date.now(),
          isDeleted: !!deletedMessagesCache[id],
          sent: true,
          delivered: message.delivered || false,
          read: message.read || false
        }))
        .filter(message => {
          // Filter out messages deleted for everyone
          if (message.deletedForEveryone) {
            console.log('🚫 Filtering out (deleted for everyone):', message.id);
            return false;
          }
          // Filter out messages deleted for me
          if (deletedMessagesCache[message.id]) {
            console.log('🚫 Filtering out (deleted for me):', message.id);
            return false;
          }
          // Only show messages from user or partner
          const shouldShow = message.userId === user.uid || (partner && message.userId === partner.uid);
          if (!shouldShow) {
            console.log('🚫 Filtering out (not from user/partner):', message.id);
          }
          return shouldShow;
        })
        .sort((a, b) => {
          const timestampA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.toMillis?.() || 0;
          const timestampB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.toMillis?.() || 0;
          return timestampA - timestampB;
        });

      setMessages(prevMessages => {
        // Determine if we should auto-scroll
        const isInitialLoad = prevMessages.length === 0;
        const hasNewMessages = messagesList.length > prevMessages.length;
        
        if (hasNewMessages && !isInitialLoad) {
          // Get the last message
          const lastMessage = messagesList[messagesList.length - 1];
          const isOwnMessage = lastMessage?.userId === user.uid;
          
          // Auto-scroll if:
          // 1. It's your own message (always scroll to your messages)
          // 2. It's a partner message AND you're already near the bottom
          if (isOwnMessage) {
            console.log('📤 Your message - scrolling to bottom');
            setTimeout(() => scrollToBottom(true, false), 100);
          } else if (shouldAutoScrollRef.current) {
            console.log('📥 Partner message - scrolling (near bottom)');
            setTimeout(() => scrollToBottom(false, false), 100);
          } else {
            console.log('📥 Partner message - NOT scrolling (reading history)');
          }
        } else if (isInitialLoad && messagesList.length > 0) {
          // Initial load - scroll to bottom instantly without animation
          console.log('🔄 Initial load - scrolling to bottom');
          // Use instant scroll and shorter delay for initial load
          setTimeout(() => scrollToBottom(true, true), 50);
        }
        
        return messagesList;
      });
      
      // Handle read receipts
      if (partner?.uid) {
        const unreadMessages = messagesList
          .filter(msg => msg.userId === partner.uid && !msg.read)
          .map(msg => msg.id);

        if (unreadMessages.length > 0) {
          const updates = {};
          unreadMessages.forEach(messageId => {
            updates[`${messageId}/read`] = true;
            updates[`${messageId}/readAt`] = serverTimestamp();
          });
          await update(chatRef, updates);
        }
      }
      
      return messagesList;
    };
    
    // Listen to deleted messages changes - Load this FIRST
    const deletedUnsubscribe = onValue(deletedMessagesRef, (snapshot) => {
      deletedMessagesCache = snapshot.val() || {};
      deletedMessagesLoaded = true;
      console.log('🗑️ Deleted messages loaded:', deletedMessagesCache);
      // Re-process messages when deleted list changes
      processMessages();
    });
    
    const unsubscribe = onValue(chatRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        messagesCache = {};
        messagesLoaded = true;
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        messagesCache = data;
        messagesLoaded = true;
        console.log('📨 Messages loaded from Firebase');
        
        // Process messages with current deleted cache
        await processMessages();
        
        setLoading(false);
      } catch (error) {
        console.error('Error processing messages:', error);
        toast.error('Error loading messages. Please try again.');
      }
    });

    return () => {
      unsubscribe();
      deletedUnsubscribe();
    };
  }, [topic?.id, user?.uid, partner?.uid]);

  // Add effect to mark messages as delivered when online
  useEffect(() => {
    if (!isOnline || !topic?.id || !partner?.uid || !user?.uid) return;

    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const query = ref(rtdb, `topicChats/${topic.id}`);
    
    const unsubscribe = onValue(query, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Find undelivered messages from partner
      const undeliveredMessages = Object.entries(data)
        .filter(([_, msg]) => msg.userId === partner.uid && !msg.delivered)
        .map(([id]) => id);

      if (undeliveredMessages.length > 0) {
        const updates = {};
        undeliveredMessages.forEach(messageId => {
          updates[`${messageId}/delivered`] = true;
          updates[`${messageId}/deliveredAt`] = serverTimestamp();
        });
        await update(chatRef, updates);
      }
    });

    return () => unsubscribe();
  }, [isOnline, topic?.id, partner?.uid, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !topic?.id) {
      console.log('Cannot setup typing listener:', {
        hasUser: !!user?.uid,
        hasTopicId: !!topic?.id,
        partnerId: partner?.uid
      });
      return;
    }

    const typingRef = ref(rtdb, `typing/${topic.id}`);
    console.log('Setting up typing listener for topic:', {
      topicId: topic.id,
      path: `typing/${topic.id}`,
      partnerId: partner?.uid
    });
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Typing status changed:', {
        data,
        partnerId: partner?.uid,
        partnerTyping: data?.[partner?.uid]?.isTyping,
        rawData: JSON.stringify(data)
      });
      
      if (data && data[partner?.uid]) {
        setPartnerTyping(data[partner.uid].isTyping);
      } else {
        setPartnerTyping(false);
      }
    });

    return () => {
      console.log('Cleaning up typing listener');
      unsubscribe();
      if (user?.uid) {
        update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
          isTyping: false,
          timestamp: serverTimestamp()
        }).then(() => {
          console.log('Successfully cleared typing status on cleanup');
        }).catch((error) => {
          console.error('Error clearing typing status:', error);
        });
      }
    };
  }, [user?.uid, topic?.id, partner?.uid]);

  // Real-time partner connection status monitoring
  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;
    
    console.log('Setting up partner connection listener for:', partner.uid);
    const partnerConnectionRef = ref(rtdb, `connections/${partner.uid}`);
    
    const unsubscribe = onValue(partnerConnectionRef, (snapshot) => {
      const connectionData = snapshot.exists() ? snapshot.val() : null;
      const isConnected = connectionData?.status === 'online';
      
      console.log('Partner connection update:', {
        partnerId: partner.uid,
        connected: isConnected,
        data: connectionData
      });
      
      // Force UI update by triggering a re-render
      setPartnerData(prev => ({
        ...prev,
        isOnline: isConnected,
        lastActive: connectionData?.lastActive,
        connectionStatus: connectionData?.status || 'offline'
      }));
    });

    return () => {
      console.log('Cleaning up partner connection listener');
      unsubscribe();
    };
  }, [user?.uid, partner?.uid]);

  const updateTypingStatus = (typing) => {
    if (!user?.uid || !topic?.id || !isOnline) {
      console.log('Cannot update typing status:', { 
        hasUser: !!user?.uid, 
        hasTopicId: !!topic?.id, 
        isOnline 
      });
      return;
    }

    console.log('Updating typing status:', {
      typing,
      userId: user.uid,
      topicId: topic.id,
      path: `typing/${topic.id}/${user.uid}`
    });

    update(ref(rtdb, `typing/${topic.id}/${user.uid}`), {
      isTyping: typing,
      timestamp: serverTimestamp()
    }).then(() => {
      console.log('Successfully updated typing status');
    }).catch((error) => {
      console.error('Error updating typing status:', error);
    });
  };

  const handleMessageChange = (e) => {
    const message = e.target.value;
    setNewMessage(message);
    
    // Auto-resize textarea with smaller max height
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    
    // Save draft to localStorage
    localStorage.setItem(`messageDraft_${topic.id}_${user?.uid}`, message);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Only update typing status if there's actual content
    if (message.trim()) {
    console.log('Message changed, setting typing status to true');
    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      console.log('Typing timeout, setting typing status to false');
      updateTypingStatus(false);
      }, 3000); // Increased to 3 seconds for better UX
    } else {
      // If message is empty, clear typing status immediately
      updateTypingStatus(false);
    }
  };

  // Handle typing indicator
  const handleTyping = (e) => {
    handleMessageChange(e);
  };

  // Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleMediaClick = (e) => {
    // Prevent click from bubbling to document
    e.stopPropagation();
    setShowMediaMenu(!showMediaMenu);
  };

  const handleCameraClick = async () => {
    try {
      // Instead of creating a custom UI, we'll use the phone's native camera
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Failed to access camera. Please try again.');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);

      // Validate file first
      await validateFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);

      // Optimize image if it's too large
      if (file.size > 1024 * 1024) { // If larger than 1MB
        const optimizedImage = await optimizeImage(file);
        if (optimizedImage) {
          setSelectedFile(optimizedImage);
          const optimizedReader = new FileReader();
          optimizedReader.onloadend = () => setPreviewUrl(optimizedReader.result);
          optimizedReader.readAsDataURL(optimizedImage);
        }
      }
      
      // Close media menu
      setShowMediaMenu(false);
    } catch (error) {
      console.error('File validation error:', error);
      setError(error.message);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.error(error.message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Add new function to optimize images
  const optimizeImage = async (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with reduced quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              resolve(file); // Fall back to original file if optimization fails
            }
          },
          'image/jpeg',
          0.8 // 80% quality
        );
      };
      
      img.onerror = () => resolve(file); // Fall back to original file on error
      
      const reader = new FileReader();
      reader.onload = (e) => img.src = e.target.result;
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const startEditing = (message) => {
    setEditingMessage(message);
    setNewMessage(message.text);
    setShowMediaMenu(false);
    setShowEmojiPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
      // Adjust height if needed
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const getPairingId = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
  };

  const formatVoiceTime = (seconds = 0) => {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const messageRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      await remove(messageRef);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    try {
      const trimmedText = newText.trim();
      const sanitizedText = sanitizeInput(trimmedText);
      const messageRef = ref(rtdb, `topicChats/${topic.id}/${messageId}`);
      await update(messageRef, {
        text: sanitizedText,
        edited: true,
        editedAt: Date.now()
      });
      toast.success('Message updated');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to update message');
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (editingMessage) {
      // Handle editing
      if (trimmedMessage !== editingMessage.text) {
        await handleEditMessage(editingMessage.id, trimmedMessage);
      }
      cancelEditing();
    } else {
      // Handle new message
      if ((!trimmedMessage && !selectedFile) || uploadingMedia) return;

      try {
        // ============ SECURITY CHECKS ============
        
        // 1. Verify partner relationship
        if (!verifyPartnerRelationship(user.uid, partner.uid, partner)) {
          logSecurityEvent('PARTNER_VERIFICATION_FAILED', { 
            userId: user.uid, 
            partnerId: partner.uid 
          });
          toast.error('Security check failed. Please try again.');
          return;
        }

        // 2. Validate message content
        const validation = validateMessage(trimmedMessage);
        if (!validation.valid && trimmedMessage) {
          toast.error(validation.error);
          return;
        }

        // 3. Check rate limiting
        const rateCheck = checkRateLimit(user.uid, trimmedMessage);
        if (!rateCheck.allowed) {
          toast.error(rateCheck.reason);
          return;
        }

        // 4. Sanitize input
        const messageToSend = sanitizeInput(trimmedMessage);
        
        // ============ END SECURITY CHECKS ============
        
        // Clear input and states immediately for better UX
        setNewMessage('');
        const replyingToRef = replyingTo;
        setReplyingTo(null);
        localStorage.removeItem(`messageDraft_${topic.id}_${user?.uid}`);
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = '42px';
        }

        // Get the latest user data to ensure we have the current photo URL
        const userRef = ref(rtdb, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val() || {};
        const currentPhotoURL = userData.photoURL || user.photoURL || '';

        const messageData = {
          text: messageToSend || '', // Sanitized text
          userId: user.uid,
          partnerId: partner.uid,
          userName: user.displayName || 'Anonymous',
          userPhotoURL: currentPhotoURL, // Use the latest photo URL
          userDisplayName: user.displayName || 'Anonymous',
          timestamp: serverTimestamp(),
          sent: true,
          delivered: false,
          read: false,
          edited: false
        };

        if (replyingToRef) {
          // Only include necessary properties in replyTo
          messageData.replyTo = {
            id: replyingToRef.id,
            text: replyingToRef.text || '',
            userId: replyingToRef.userId,
            userDisplayName: replyingToRef.userDisplayName || replyingToRef.userName || 'User',
            userPhotoURL: replyingToRef.userPhotoURL || '' // Include photo URL in reply reference
          };
          
          // Only add media if it exists
          if (replyingToRef.media) {
            messageData.replyTo.media = {
              type: replyingToRef.media.type,
              url: replyingToRef.media.url
            };
          }
        }

        let mediaData = null;
        if (selectedFile) {
          setUploadingMedia(true);
          mediaData = await uploadMedia(selectedFile);
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }

        const chatRef = ref(rtdb, `topicChats/${topic.id}`);
        const messageDataWithMedia = {
          ...messageData,
          ...(mediaData && {
            media: {
              url: mediaData.url,
              type: selectedFile.type,
              publicId: mediaData.publicId,
              resourceType: mediaData.resourceType,
              format: mediaData.format
            }
          })
        };

        const newMessageRef = await push(chatRef, messageDataWithMedia);

        if (isOnline) {
          update(ref(rtdb, `topicChats/${topic.id}/${newMessageRef.key}`), {
            delivered: true,
            deliveredAt: serverTimestamp()
          });
        }

        // Update message count with consistent pairing ID
        const pairingId = getPairingId(user.uid, partner.uid);
        const messageCountRef = ref(rtdb, `messageCount/${pairingId}`);
        const countSnapshot = await get(messageCountRef);
        const currentCount = countSnapshot.val() || 0;
        await set(messageCountRef, currentCount + 1);

        setUploadingMedia(false);
        
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message. Please try again.');
        setUploadingMedia(false);
      }
    }
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setNewMessage('');
    if (inputRef.current) {
      inputRef.current.style.height = '42px';
    }
  };

  // Handle voice note sending
  const handleVoiceNote = async (audioBlob, duration) => {
    try {
      console.log('🎤 Uploading voice note...', { duration, size: audioBlob.size });
      
      // Check if Cloudinary is configured
      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) {
        console.error('❌ Cloudinary not configured - REACT_APP_CLOUDINARY_CLOUD_NAME is missing');
        toast.error('Voice notes not configured. Please set up Cloudinary.');
        return;
      }
      
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
      formData.append('upload_preset', 'choice_app_preset'); // Same preset as images
      formData.append('resource_type', 'video'); // Cloudinary treats audio as video
      
      const uploadToast = toast.loading('Sending voice note...');
      
      // Upload to Cloudinary
      console.log('📤 Uploading to Cloudinary:', cloudName);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Upload successful:', data.secure_url);
      
      // Send message with voice note
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      const messageRef = push(chatRef);
      
      await set(messageRef, {
        userId: user.uid,
        text: '', // Voice notes don't have text
        media: {
          url: data.secure_url,
          type: 'audio/webm',
          duration: duration,
          publicId: data.public_id
        },
        timestamp: Date.now(),
        userName: user.displayName,
        userPhotoURL: user.photoURL,
        partnerId: partner?.uid,
        status: 'sent'
      });
      
      toast.dismiss(uploadToast);
      toast.success('Voice note sent!');
      
    } catch (error) {
      console.error('Error sending voice note:', error);
      toast.error('Failed to send voice note');
    }
  };

  const startRecording = async () => {
    try {
      // Haptic feedback on recording start
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Reset previous recording state
      setRecordedAudio(null);
      audioChunksRef.current = [];
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      setIsRecording(true);
      autoSendRecordingRef.current = false;
      pendingStopRef.current = null;
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
        previewAudioRef.current.src = '';
      }
      setPreviewPlaying(false);
      setPreviewCurrentTime(0);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        if (pendingStopRef.current) {
          const stopOptions = pendingStopRef.current;
          pendingStopRef.current = null;
          stopRecording(stopOptions);
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = recordingDurationRef.current;
        const shouldAutoSend = autoSendRecordingRef.current;

        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
        stream.getTracks().forEach(track => track.stop());
        autoSendRecordingRef.current = false;

        if (shouldAutoSend) {
          try {
            await uploadAndSendAudio(audioBlob, duration);
          } catch (error) {
            console.error('Auto-send voice message failed:', error);
            toast.error('Failed to send voice note');
          } finally {
            setRecordingDuration(0);
            recordingDurationRef.current = 0;
          }
          return;
        }

        setRecordedAudio({
          blob: audioBlob,
          url: URL.createObjectURL(audioBlob),
          duration
        });
      };

      mediaRecorder.start();
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Please check permissions.');
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const stopRecording = ({ autoSend = false } = {}) => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      autoSendRecordingRef.current = autoSend;
      recorder.stop();
      clearInterval(recordingTimerRef.current);
      pendingStopRef.current = null;
    } else if (!recorder || recorder.state === 'inactive') {
      pendingStopRef.current = { autoSend };
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        autoSendRecordingRef.current = false;
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    if (recordedAudio?.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordedAudio(null);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    pendingStopRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPreviewPlaying(false);
    setPreviewCurrentTime(0);
  };

  const uploadAndSendAudio = async (audioBlob, duration) => {
    try {
      setUploadingMedia(true);
      console.log('Starting audio upload...', {
        size: audioBlob?.size,
        type: audioBlob?.type,
        duration: duration ?? recordingDurationRef.current
      });
      
      const file = new File([audioBlob], 'voice-message.webm', { 
        type: 'audio/webm',
        lastModified: Date.now()
      });
      
      console.log('File created:', file);
      
      // Upload to Cloudinary
      console.log('Uploading to Cloudinary...');
      const mediaData = await uploadMedia(file);
      console.log('Upload successful:', mediaData);
      
      // Create message with audio
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      const messageData = {
        userId: user.uid,
        partnerId: partner.uid,
        userName: user.displayName || 'User',
        timestamp: serverTimestamp(),
        delivered: false,
        read: false,
        media: {
          url: mediaData.url,
          type: 'audio/webm',
          name: 'Voice message',
          publicId: mediaData.publicId,
          resourceType: mediaData.resourceType || 'video',
          format: mediaData.format || 'webm',
          duration: duration ?? recordingDurationRef.current
        }
      };

      console.log('Sending message to Firebase:', messageData);
      
      // Send message
      const newMessageRef = await push(chatRef, messageData);
      console.log('Message sent successfully:', newMessageRef.key);

      if (isOnline) {
        await update(ref(rtdb, `topicChats/${topic.id}/${newMessageRef.key}`), {
          delivered: true
        });
      }

      toast.success('Voice message sent!');
      setTimeout(() => toast.dismiss(), 2000);
    } catch (error) {
      console.error('Error sending voice message:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      toast.error(`Failed to send: ${error.message}`);
      setTimeout(() => toast.dismiss(), 3000);
    } finally {
      setUploadingMedia(false);
    }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudio) {
      console.error('No recorded audio to send');
      return;
    }

    await uploadAndSendAudio(recordedAudio.blob, recordedAudio.duration ?? recordingDurationRef.current);

    if (recordedAudio.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    setRecordedAudio(null);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    clearInterval(recordingTimerRef.current);
  };

  const deleteRecordedAudio = () => {
    if (recordedAudio?.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setRecordedAudio(null);
    setRecordingDuration(0);
    setPreviewPlaying(false);
    setPreviewCurrentTime(0);
    clearInterval(recordingTimerRef.current);
    recordingDurationRef.current = 0;
  };

  const togglePreviewPlayback = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      audio.play();
      setPreviewPlaying(true);
    }
  };

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setPreviewPlaying(false);
      setPreviewCurrentTime(0);
    };

    const handleLoadedMetadata = () => {
      // Audio is ready to play
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // Add cleanup for recording when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // ============ SCREENSHOT PROTECTION ============
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !topic?.id) return;

    // Initialize protection layers (NO WARNING TOAST)
    const cleanupScreenshot = initScreenshotDetection(user.uid, partner.uid, topic.id);
    const cleanupContentProtection = initContentProtection();
    const cleanupContextMenu = preventContextMenu();
    const cleanupTextSelection = preventTextSelection();

    // Cleanup all protections on unmount
    return () => {
      if (cleanupScreenshot) cleanupScreenshot();
      if (cleanupContentProtection) cleanupContentProtection();
      if (cleanupContextMenu) cleanupContextMenu();
      if (cleanupTextSelection) cleanupTextSelection();
    };
  }, [user?.uid, partner?.uid, topic?.id]);
  // ============ END SCREENSHOT PROTECTION ============

  // Sync layout height with visual viewport (fixes iOS keyboard overlap)
  useEffect(() => {
    const viewport = window.visualViewport;

    const updateViewportMetrics = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const offsetLeft = viewport?.offsetLeft ?? 0;

      if (chatContainerRef.current) {
        chatContainerRef.current.style.setProperty('--chat-viewport-height', `${height}px`);
        chatContainerRef.current.style.setProperty('--chat-viewport-offset-top', `${offsetTop}px`);
        chatContainerRef.current.style.setProperty('--chat-viewport-offset-left', `${offsetLeft}px`);
      }
    };

    updateViewportMetrics();

    viewport?.addEventListener('resize', updateViewportMetrics);
    viewport?.addEventListener('scroll', updateViewportMetrics);
    window.addEventListener('resize', updateViewportMetrics);
    window.addEventListener('orientationchange', updateViewportMetrics);

    return () => {
      viewport?.removeEventListener('resize', updateViewportMetrics);
      viewport?.removeEventListener('scroll', updateViewportMetrics);
      window.removeEventListener('resize', updateViewportMetrics);
      window.removeEventListener('orientationchange', updateViewportMetrics);
    };
  }, []);

  // Add click outside handler for media menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target) && 
          !event.target.closest('button[data-media-button="true"]')) {
        setShowMediaMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the partner data sync effect
  useEffect(() => {
    if (!partner?.uid) return;

    // Set up real-time listener for partner's profile
    const partnerRef = ref(rtdb, `users/${partner.uid}`);
    const unsubscribe = onValue(partnerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Update local partner data state with all fields
        setPartnerData(current => ({
          ...current,
          ...data,
          photoURL: data.photoURL || current?.photoURL,
          displayName: data.displayName || current?.displayName,
          lastSeen: data.lastSeen,
          isOnline: data.isOnline,
          status: data.status
        }));

        // Update existing messages with new photo URL if needed
        setMessages(prevMessages => 
          prevMessages.map(msg => {
            if (msg.userId === partner.uid) {
              return {
                ...msg,
                userPhotoURL: data.photoURL || msg.userPhotoURL
              };
            }
            if (msg.replyTo?.userId === partner.uid) {
              return {
                ...msg,
                replyTo: {
                  ...msg.replyTo,
                  userPhotoURL: data.photoURL || msg.replyTo.userPhotoURL
                }
              };
            }
            return msg;
          })
        );
      }
    });

    return () => unsubscribe();
  }, [partner?.uid]);

  // Incoming calls now handled globally in Layout component

  // Modify the message count effect
  useEffect(() => {
    if (!topic?.id) return;
    
    const chatRef = ref(rtdb, `topicChats/${topic.id}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      const count = data ? Object.keys(data).length : 0;
      setMessageCount(count);
    });

    return () => unsubscribe();
  }, [topic?.id]);

  // Add this effect to listen for topic deletion
  useEffect(() => {
    if (!topic?.id) return;
    
    // Skip deletion check for direct chat
    if (topic.isDirectChat) return;

    // Listen for topic deletion
    const topicRef = ref(rtdb, `topics/${topic.id}`);
    const unsubscribe = onValue(topicRef, (snapshot) => {
      if (!snapshot.exists() && !loading) {
        // Topic was deleted, close the chat
        onClose();
        // Optionally show a message
        setError('This topic has been deleted');
      }
    });

    return () => unsubscribe();
  }, [topic?.id, topic?.isDirectChat, loading, onClose]);

  const handleDeleteTopic = async () => {
    if (!isOnline || !user?.uid) {
      toast.error('You must be online to delete this topic');
      return;
    }

    try {
      // Show loading toast
      const loadingToast = toast.loading('Deleting topic...');

      // Delete the topic first
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await remove(topicRef);

      // Then delete associated chat messages
      const chatRef = ref(rtdb, `topicChats/${topic.id}`);
      await remove(chatRef);

      // Delete any associated deleted messages records
      const deletedMessagesRef = ref(rtdb, `deletedMessages/${user.uid}/${topic.id}`);
      await remove(deletedMessagesRef);
      
      const partnerDeletedMessagesRef = ref(rtdb, `deletedMessages/${partner.uid}/${topic.id}`);
      await remove(partnerDeletedMessagesRef);

      // Delete any typing indicators
      const typingRef = ref(rtdb, `typing/${topic.id}`);
      await remove(typingRef);

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success('Topic deleted successfully');

      // Close the chat after deletion
      onClose();
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error('Failed to delete topic. Please try again.');
    }
  };

  const handleEditTopic = async (newQuestion) => {
    if (!isOnline || !user?.uid) {
      toast.error('You must be online to edit this topic');
      return;
    }

    if (!newQuestion?.trim()) {
      toast.error('Topic question cannot be empty');
      return;
    }

    try {
      const loadingToast = toast.loading('Saving changes...');
      
      const topicRef = ref(rtdb, `topics/${topic.id}`);
      await update(topicRef, {
        question: newQuestion.trim(),
        updatedAt: serverTimestamp()
      });
      
      toast.dismiss(loadingToast);
      toast.success('Topic updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing topic:', error);
      toast.error('Failed to edit topic. Please try again.');
    }
  };

  // Add a new function to handle the save button click
  const handleSaveEdit = () => {
    const newQuestion = topicInputRef.current?.value;
    if (newQuestion) {
      handleEditTopic(newQuestion);
    } else {
      toast.error('Topic question cannot be empty');
    }
  };

  // Add click outside handler for emoji picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && 
          !emojiPickerRef.current.contains(event.target) && 
          !event.target.closest('button')?.contains(event.target.closest('.emoji-button'))) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add new useEffect for click outside handling
  useEffect(() => {
    function handleClickOutside(event) {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
        setShowOptionsMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add scroll handler to detect when user manually scrolls
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user is within 100px of bottom, enable auto-scroll
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const previewDuration = recordedAudio?.duration ?? previewAudioRef.current?.duration ?? 0;
  const previewProgress = previewDuration > 0 ? Math.min(1, previewCurrentTime / previewDuration) : 0;

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <div
      ref={chatContainerRef}
      className="flex flex-col h-full w-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black overflow-hidden"
    >
      {/* Chat Header - Won't shrink when keyboard appears */}
      <div 
        className="shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg z-10"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)'
        }}
      >
        {/* Top Row - Partner Info */}
        <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="md:hidden p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-full transition-all"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
      
      <div className="flex items-center flex-1 min-w-0">
        <div className="flex-shrink-0 mr-2 sm:mr-3">
          <div className="relative">
            <ProfilePicture 
              userId={partner?.uid} 
              photoURL={partner?.photoURL} 
              displayName={partner?.displayName}
              size="md" 
            />
            {partnerData?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
            {partner ? partner.displayName : 'Loading...'}
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              {partnerData?.isOnline ? 'Online' : 'Offline'}
            </p>
            <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">•</span>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Call Buttons - Visible on all screens */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Audio Call */}
        <button
          onClick={async () => {
            console.log('Audio call button clicked');
            if (!webRTC) {
              console.error('WebRTC context not available');
              toast.error('Call system not initialized');
              return;
            }
            if (!partner) {
              console.error('No partner connected');
              toast.error('No partner connected');
              return;
            }
            try {
              console.log('Starting audio call...');
              await webRTC.startCall('audio');
            } catch (error) {
              console.error('Error starting audio call:', error);
              toast.error('Failed to start call: ' + error.message);
            }
          }}
          className="flex p-1.5 sm:p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-all group"
          title="Audio Call"
        >
          <PhoneIcon className="h-5 w-5 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400" />
        </button>

        {/* Video Call */}
        <button
          onClick={async () => {
            console.log('Video call button clicked');
            if (!webRTC) {
              console.error('WebRTC context not available');
              toast.error('Call system not initialized');
              return;
            }
            if (!partner) {
              console.error('No partner connected');
              toast.error('No partner connected');
              return;
            }
            try {
              console.log('Starting video call...');
              await webRTC.startCall('video');
            } catch (error) {
              console.error('Error starting call:', error);
              toast.error('Failed to start call');
            }
          }}
          className="flex p-1.5 sm:p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-all group"
          title="Video Call"
        >
          <VideoCameraIcon className="h-5 w-5 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
        </button>

        {/* Options Menu - Always visible */}
        <button
          onClick={() => setShowOptionsMenu(!showOptionsMenu)}
          className="p-1.5 sm:p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-full transition-all"
        >
          <EllipsisVerticalIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      {/* Options Menu - Glassmorphism - Mobile Optimized */}
      {showOptionsMenu && (
        <div 
          ref={optionsMenuRef}
          className="absolute right-2 sm:right-4 top-12 sm:top-14 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl py-2 min-w-[180px] sm:min-w-[200px] z-50 border border-gray-200/50 dark:border-gray-700/50"
        >
          <button
            onClick={() => {
              setIsEditing(true);
              setShowOptionsMenu(false);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex items-center transition-all"
          >
            <PencilIcon className="h-4 w-4 mr-3" />
            Edit Topic
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this topic? This action cannot be undone.')) {
                handleDeleteTopic();
              }
              setShowOptionsMenu(false);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 flex items-center transition-all"
          >
            <TrashIcon className="h-4 w-4 mr-3" />
            Delete Topic
          </button>
        </div>
      )}
    </div>
    
    {/* Topic Title Banner - Transparent Glassmorphism */}
    <div className="px-3 sm:px-4 py-1.5 sm:py-2 md:py-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 backdrop-blur-md border-t border-gray-200/20 dark:border-gray-700/20">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ChatBubbleLeftRightIcon className="h-3.5 sm:h-4 md:h-5 w-3.5 sm:w-4 md:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-[11px] sm:text-xs md:text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 truncate">
          {topic?.question || 'Loading topic...'}
        </p>
      </div>
    </div>
  </div>
  
  {/* Messages Container - WhatsApp Style - Can shrink below content size */}
  <div 
    ref={messagesContainerRef}
    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden screenshot-protected bg-gradient-to-b from-gray-100/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50"
    style={{ 
      WebkitOverflowScrolling: 'touch',
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E\")",
      backgroundAttachment: "fixed",
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent'
    }}
  >
      <div className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-4 space-y-1.5 sm:space-y-2 max-w-3xl mx-auto w-full">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isOwnMessage={message.userId === user.uid}
            user={user}
            partner={partner}
            topicId={topic.id}
            onReply={handleReply}
            onImageClick={setViewingImage}
            messageRefs={messageRefs}
            onDelete={handleDeleteMessage}
            onEdit={handleEditMessage}
            onStartEdit={startEditing}
          />
        ))}
        {partnerTyping && (
          <div className="flex items-center space-x-2 text-gray-500 pl-2">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="text-sm">{partnerData?.displayName} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>

    {/* Input Container - WhatsApp Style - Won't shrink, stays above keyboard */}
    <div 
      ref={inputContainerRef}
      className="shrink-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)'
      }}
    >
      {(replyingTo || selectedFile || recordedAudio) && (
        <div className="px-3 sm:px-4 py-2 sm:py-3 max-w-3xl mx-auto w-full space-y-2 sm:space-y-3">
          {replyingTo && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Replying to {replyingTo.userId === user.uid ? 'yourself' : partnerData?.displayName}
                </p>
                <p className="text-xs sm:text-sm truncate text-gray-700 dark:text-gray-300">
                  {replyingTo.text || (replyingTo.media ? 'Media message' : '')}
                </p>
              </div>
              <button 
                onClick={() => setReplyingTo(null)} 
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors flex-shrink-0"
              >
                <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )}

          {/* Recorded Audio Preview */}
          {recordedAudio && !isRecording && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-3 flex items-center gap-3 shadow-lg">
              <audio ref={previewAudioRef} src={recordedAudio.url} preload="metadata" />
              
              <button
                onClick={deleteRecordedAudio}
                className="p-2 hover:bg-white/20 rounded-full transition-all flex-shrink-0"
                title="Discard recording"
              >
                <TrashIcon className="h-5 w-5 text-white" />
              </button>

              <button
                onClick={togglePreviewPlayback}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all flex-shrink-0"
                title={previewPlaying ? 'Pause' : 'Play'}
              >
                {previewPlaying ? (
                  <PauseIcon className="h-5 w-5 text-white" />
                ) : (
                  <PlayIcon className="h-5 w-5 text-white" />
                )}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-8 flex items-center gap-0.5">
                  {[...Array(20)].map((_, i) => {
                    const barProgress = (i / 20);
                    const isActive = previewProgress >= barProgress;
                    const height = 8 + Math.sin(i * 0.5) * 12;
                    
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-100 ${
                          isActive ? 'bg-white' : 'bg-white/40'
                        }`}
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>
                <span className="text-xs text-white font-mono whitespace-nowrap">
                  {formatVoiceTime(previewPlaying ? previewCurrentTime : previewDuration)}
                </span>
              </div>

              <button
                onClick={sendRecordedAudio}
                disabled={uploadingMedia}
                className="p-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-full transition-all flex-shrink-0"
                title="Send voice message"
              >
                <PaperAirplaneIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          )}
          
          {selectedFile && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-md overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                  {uploadingMedia && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {uploadingMedia ? 'Uploading...' : 'Photo'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {uploadingMedia ? 'Please wait...' : 'Ready to send'}
                  </p>
                </div>
                {!uploadingMedia && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

        {/* Message Input Area - Professional WhatsApp Style */}
        <div 
          className="flex-shrink-0 px-2 sm:px-3 md:px-4 pt-2 sm:pt-2.5 md:pt-3 pb-1 max-w-3xl mx-auto w-full bg-white dark:bg-gray-900"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)'
          }}
        >
          
          {/* Recording Active Bar */}
          {isRecording && (
            <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-2xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-2xl">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="relative">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping opacity-75"></div>
                </div>
                
                <div className="flex-1 flex items-center gap-1 min-w-0">
                  {[...Array(15)].map((_, i) => {
                    const baseHeight = 4 + Math.sin(i * 0.7) * 8;
                    const delay = i * 80;
                    
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-white/90 rounded-full animate-recording-wave"
                        style={{ 
                          height: `${baseHeight}px`,
                          minHeight: '4px',
                          animationDelay: `${delay}ms`
                        }}
                      />
                    );
                  })}
                </div>
                
                <span className="text-sm sm:text-base text-white font-mono font-bold whitespace-nowrap">
                  {formatVoiceTime(recordingDuration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={cancelRecording}
                  className="p-2 hover:bg-white/20 rounded-full transition-all flex-shrink-0"
                  title="Cancel"
                >
                  <XMarkIcon className="h-5 w-5 text-white" />
                </button>
                
                <button
                  onClick={() => stopRecording({ autoSend: false })}
                  disabled={uploadingMedia}
                  className="p-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-full transition-all flex-shrink-0"
                  title="Done"
                >
                  <CheckIcon className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Main Input Bar */}
          <div className="flex items-end gap-2">
            {/* Emoji Button - Left Side */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all flex-shrink-0"
              title="Add emoji"
            >
              <FaceSmileIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Input Field - Center */}
            <div className="flex-1 flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-2 border-2 border-transparent focus-within:border-blue-500 dark:focus-within:border-purple-500 transition-colors">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleTyping}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 resize-none max-h-20 text-sm leading-tight text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                rows="1"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Right Side Buttons - Conditional */}
            {newMessage.trim() || selectedFile ? (
              /* Send Button - Shows when typing */
              <button
                onClick={handleSendMessage}
                disabled={isLoading || uploadingMedia}
                className="p-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-all flex-shrink-0 shadow-lg"
                title="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            ) : (
              /* Media & Mic Buttons - Shows when not typing */
              <>
                <button
                  onClick={() => setShowMediaMenu(!showMediaMenu)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all flex-shrink-0"
                  title="Attach media"
                >
                  <PhotoIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>

                <button
                  onMouseDown={startRecording}
                  onMouseUp={() => stopRecording()}
                  onMouseLeave={() => isRecording && cancelRecording()}
                  onTouchStart={startRecording}
                  onTouchEnd={() => stopRecording()}
                  onTouchCancel={cancelRecording}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`p-2.5 rounded-full transition-all flex-shrink-0 select-none ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white scale-110'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title="Hold to record voice"
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Media Menu - Mobile Optimized */}
        {showMediaMenu && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-200"
              onClick={() => setShowMediaMenu(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 w-full sm:max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl shadow-xl z-50 border-t sm:border border-gray-200/50 dark:border-gray-700/50 mx-auto">
              {/* Handle bar */}
              <div className="flex justify-center pt-2 sm:pt-3">
                <div className="w-12 h-1 sm:h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-3 sm:px-4 pt-2 sm:pt-3 pb-3 sm:pb-4">
                <h3 className="text-sm sm:text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                  Share Media
                </h3>
                <button 
                  onClick={() => setShowMediaMenu(false)}
                  className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* Responsive Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 px-3 sm:px-4 pb-3 sm:pb-4">
                {/* Gallery */}
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMediaMenu(false);
                  }}
                  className="flex flex-col items-center py-4 sm:py-5 px-2 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200/50 dark:border-blue-700/30 hover:scale-105 active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                    <PhotoIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" strokeWidth={2} />
                  </div>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200">Gallery</span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Choose photo</span>
                </button>

                {/* Camera */}
                <button
                  onClick={() => {
                    handleCameraClick();
                    setShowMediaMenu(false);
                  }}
                  className="flex flex-col items-center py-4 sm:py-5 px-2 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/80 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200/50 dark:border-purple-700/30 hover:scale-105 active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                    <CameraIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" strokeWidth={2} />
                  </div>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200">Camera</span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Take photo</span>
                </button>
              </div>

              {/* Cancel */}
              <button
                onClick={() => setShowMediaMenu(false)}
                className="w-full py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-red-600 dark:text-red-400 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Viewer Modal */}
      {viewingImage && (
        <ImageViewer 
          image={viewingImage} 
          onClose={() => setViewingImage(null)} 
        />
      )}

      {/* Emoji Picker - Mobile Optimized with Glassmorphism */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-t-3xl shadow-2xl border-t-2 border-gray-200/50 dark:border-gray-700/50 pb-safe">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                Choose Emoji
              </h3>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-full transition-all"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Emoji Picker */}
            <div className="overflow-hidden">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setNewMessage((prev) => prev + emojiData.emoji);
                  setShowEmojiPicker(false);
                }}
                autoFocusSearch={false}
                theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                width="100%"
                height="450px"
                searchPlaceHolder="Search emojis..."
                previewConfig={{
                  showPreview: false
                }}
                emojiStyle="native"
                lazyLoadEmojis={true}
                skinTonesDisabled={false}
                searchDisabled={false}
                categories={[
                  {
                    name: 'Smileys & People',
                    category: 'smileys_people'
                  },
                  {
                    name: 'Animals & Nature',
                    category: 'animals_nature'
                  },
                  {
                    name: 'Food & Drink',
                    category: 'food_drink'
                  },
                  {
                    name: 'Travel & Places',
                    category: 'travel_places'
                  },
                  {
                    name: 'Activities',
                    category: 'activities'
                  },
                  {
                    name: 'Objects',
                    category: 'objects'
                  },
                  {
                    name: 'Symbols',
                    category: 'symbols'
                  },
                  {
                    name: 'Flags',
                    category: 'flags'
                  }
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Topic</h3>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <input
              ref={topicInputRef}
              type="text"
              defaultValue={topic?.question || ''}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter topic question..."
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
        /* Custom scrollbar for messages - professional and subtle */
        div[class*="overflow-y-auto"]::-webkit-scrollbar {
          width: 6px;
        }

        div[class*="overflow-y-auto"]::-webkit-scrollbar-track {
          background: transparent;
        }

        div[class*="overflow-y-auto"]::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
          transition: background 0.2s;
        }

        div[class*="overflow-y-auto"]::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }

        /* Hide scrollbar when not scrolling (optional) */
        div[class*="overflow-y-auto"] {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .typing-indicator span {
          width: 4px;
          height: 4px;
          background-color: #6B7280;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }

        /* Recording wave animation */
        @keyframes recording-wave {
          0%, 100% {
            opacity: 0.8;
            transform: scaleY(0.8);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.2);
          }
        }

        .animate-recording-wave {
          animation: recording-wave 1.5s ease-in-out infinite;
        }

        .animate-pulse-subtle {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          textarea {
            font-size: 16px !important;
          }
          
          /* Prevent iOS keyboard zoom */
          input, textarea, select {
            font-size: 16px !important;
          }
        }

        .online-dot {
          position: relative;
        }

        .online-dot::before {
          content: '';
          position: absolute;
          top: -1px;
          left: -1px;
          right: -1px;
          bottom: -1px;
          background: rgba(34, 197, 94, 0.4);
          border-radius: 50%;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.5);
          }
        }

        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .animate-flash {
          animation: flash 750ms ease-out forwards;
        }
        
        /* Ensure proper spacing on small devices */
        @media (max-width: 640px) {
          .font-size-16 {
            font-size: 16px;
          }
        }
        `}
      </style>

      {/* Call UI now handled globally in Layout component */}
    </div>
    </div>
  );
};

export default TopicChat; 
