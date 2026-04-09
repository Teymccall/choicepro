import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import { ref, onValue, remove, update } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

const NotificationTypes = {
  PARTNER_REQUEST: 'partner_request',
  TOPIC_RESPONSE: 'topic_response',
  CHAT_MESSAGE: 'chat_message',
  INCOMING_CALL: 'incoming_call',
  SYSTEM: 'system',
};

const Notifications = () => {
  const { user, partner, acceptPartnerRequest, declinePartnerRequest } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔔 Notifications component mounted, user:', user?.uid);
    
    if (!user?.uid) {
      console.log('⚠️ No user logged in, cannot load notifications');
      return;
    }

    console.log('📡 Setting up notification listener for user:', user.uid);
    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📬 Notifications data from Firebase:', data);
      console.log('📊 Number of notifications:', data ? Object.keys(data).length : 0);
      
      if (!data) {
        console.log('⚠️ No notifications found in Firebase');
        setNotifications([]);
        return;
      }

      const notificationsList = Object.entries(data).map(([id, notification]) => ({
        id,
        ...notification,
      })).sort((a, b) => b.timestamp - a.timestamp);

      console.log('✅ Loaded notifications:', notificationsList);
      console.log('🎯 Notification types:', notificationsList.map(n => n.type || 'no-type'));
      setNotifications(notificationsList);
    }, (error) => {
      console.error('❌ Error loading notifications:', error);
    });

    return () => {
      console.log('🔌 Unsubscribing from notifications');
      unsubscribe();
    };
  }, [user?.uid]);

  // Add new effect to clear notifications when panel is opened
  useEffect(() => {
    if (showNotifications && user?.uid) {
      // Mark all notifications as read in local storage
      localStorage.setItem(`lastChecked_notifications_${user.uid}`, Date.now().toString());
    }
  }, [showNotifications, user?.uid]);

  const handleDismiss = async (notificationId) => {
    if (!user?.uid) return;
    
    try {
      const notificationRef = ref(rtdb, `notifications/${user.uid}/${notificationId}`);
      await remove(notificationRef);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  // Add function to clear all notifications
  const handleClearAll = async () => {
    if (!user?.uid) return;
    try {
      const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
      await remove(notificationsRef);
      setShowNotifications(false);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleAcceptRequest = async (requestId, notificationId) => {
    setProcessingRequest(requestId);
    try {
      await acceptPartnerRequest(requestId);
      await handleDismiss(notificationId);
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (requestId, notificationId) => {
    setProcessingRequest(requestId);
    try {
      await declinePartnerRequest(requestId);
      await handleDismiss(notificationId);
    } catch (error) {
      console.error('Error declining request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.type === 'chat_message') {
      // Store the topic ID to open the chat when navigating
      sessionStorage.setItem('openChatTopicId', notification.topicId);
      
      // If we're already on the topics page, dispatch an event to open the chat
      if (window.location.pathname === '/topics') {
        window.dispatchEvent(new CustomEvent('openTopicChat', {
          detail: { topicId: notification.topicId }
        }));
      } else {
        navigate('/topics');
      }
    }
    
    // Clear this notification
    if (handleDismiss) {
      handleDismiss(notification.id);
    }
  };

  const getNotificationContent = (notification) => {
    switch (notification.type) {
      case NotificationTypes.PARTNER_REQUEST:
        return {
          icon: <UserPlusIcon className="h-5 w-5 text-blue-500" />,
          title: 'Partner Request',
          message: `${notification.senderName} wants to connect with you`,
          className: 'bg-blue-50',
        };
      case NotificationTypes.TOPIC_RESPONSE:
        return {
          icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-500" />,
          title: 'Topic Response',
          message: `${notification.senderName} responded to "${notification.topicTitle}"`,
          className: 'bg-green-50',
        };
      case NotificationTypes.CHAT_MESSAGE:
        return {
          icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-500" />,
          title: 'New Message',
          message: `${notification.senderName} sent a message in "${notification.topicTitle}": "${notification.message.length > 30 ? notification.message.substring(0, 30) + '...' : notification.message}"`,
          className: 'bg-primary-50',
          action: () => {
            const topicId = notification.topicId;
            if (topicId) {
              // Store the topicId in sessionStorage so it persists through navigation
              sessionStorage.setItem('openTopicChatId', topicId);
              
              // If already on topics page, dispatch event directly
              if (window.location.pathname === '/topics') {
                window.dispatchEvent(new CustomEvent('openTopicChat', { 
                  detail: { topicId } 
                }));
              } else {
                // Navigate to topics page - the Topics component will handle opening the chat
                window.location.href = '/topics';
              }
            }
          }
        };
      case NotificationTypes.INCOMING_CALL:
      case 'incoming_call':
        const callIcon = notification.callType === 'video' ? 
          <VideoCameraIcon className="h-5 w-5 text-blue-500" /> : 
          <PhoneIcon className="h-5 w-5 text-green-500" />;
        return {
          icon: callIcon,
          title: notification.callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Call',
          message: `${notification.senderName} is calling you...`,
          className: notification.callType === 'video' ? 'bg-blue-50' : 'bg-green-50',
          action: () => {
            // Navigate to chat page where the call notification will appear
            navigate('/chat');
          }
        };
      case NotificationTypes.SYSTEM:
        return {
          icon: <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />,
          title: 'System Notification',
          message: notification.message,
          className: 'bg-yellow-50',
        };
      default:
        return {
          icon: <BellIcon className="h-5 w-5 text-gray-500" />,
          title: 'Notification',
          message: notification.message,
          className: 'bg-gray-50',
        };
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
      >
        <BellIcon className="h-6 w-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Notifications Panel - Glassmorphism */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-50 animate-slide-down border border-white/20">
          <div className="p-4 bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-xl border-b border-white/20 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-white/90 hover:text-white font-semibold hover:bg-white/10 px-3 py-1 rounded-lg transition-all"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto bg-white/50 backdrop-blur-xl">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const content = getNotificationContent(notification);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 hover:bg-white/90 transition-all duration-200 ${
                      content.action && notification.type !== 'partner_request' ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (content.action && notification.type !== 'partner_request') {
                        content.action();
                        handleDismiss(notification.id);
                        setShowNotifications(false);
                      }
                    }}
                  >
                    {(notification.type === 'partner_request' || notification.requestId || notification.message?.includes('wants to connect')) ? (
                      /* Partner Request Card with Profile Picture */
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          {/* Profile Picture or Avatar */}
                          <div className="flex-shrink-0">
                            {notification.senderPhotoURL ? (
                              <img
                                src={notification.senderPhotoURL}
                                alt={notification.senderName}
                                className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-500/30"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white text-lg font-bold">
                                  {(notification.senderName || notification.message?.split(' ')[0] || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                              New Connection Request
                            </p>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                              {notification.senderName || notification.message?.split(' wants')[0] || 'Someone'}
                            </p>
                            {notification.senderEmail && (
                              <p className="text-xs text-gray-600 truncate">
                                {notification.senderEmail}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-700">
                              wants to connect with you
                            </p>
                          </div>
                          
                          {/* Close Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(notification.id);
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const reqId = notification.requestId || notification.id;
                              handleAcceptRequest(reqId, notification.id);
                            }}
                            disabled={processingRequest === (notification.requestId || notification.id)}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                          >
                            {processingRequest === (notification.requestId || notification.id) ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Processing...
                              </span>
                            ) : (
                              '✓ Accept'
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const reqId = notification.requestId || notification.id;
                              handleDeclineRequest(reqId, notification.id);
                            }}
                            disabled={processingRequest === (notification.requestId || notification.id)}
                            className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ✕ Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Other Notification Types */
                      <div className="flex items-start">
                        <div className="flex-shrink-0">{content.icon}</div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900">{content.title}</p>
                          <p className="mt-1 text-sm text-gray-500">{content.message}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(notification.id);
                            }}
                            className="inline-flex text-gray-400 hover:text-gray-500"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications; 