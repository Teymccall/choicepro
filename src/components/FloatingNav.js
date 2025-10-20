import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';
import toast from 'react-hot-toast';

const FloatingNav = () => {
  const location = useLocation();
  const { user, partner } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);
  const [pendingResponses, setPendingResponses] = useState(0);
  const [newTopics, setNewTopics] = useState(0);
  const [unreadMessagesByTopic, setUnreadMessagesByTopic] = useState({});
  const [unreadResponsesByTopic, setUnreadResponsesByTopic] = useState({});
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadResponses, setHasUnreadResponses] = useState(false);

  const navItems = [
    {
      path: '/dashboard',
      icon: HomeIcon,
      label: 'Home'
    },
    {
      path: '/chat',
      icon: ChatBubbleOvalLeftEllipsisIcon,
      label: 'Chat',
      showNotification: hasUnreadMessages
    },
    {
      path: '/topics',
      icon: ChatBubbleLeftRightIcon,
      label: 'Topics',
      showNotification: hasUnreadResponses
    },
    {
      path: '/results',
      icon: ChartBarIcon,
      label: 'Results'
    },
    {
      path: '/settings',
      icon: Cog6ToothIcon,
      label: 'Settings'
    }
  ];


  // Listen for chat updates
  useEffect(() => {
    let unsubscribe;

    if (!user?.uid || !partner?.uid) {
      setUnreadChats(0);
      setUnreadMessagesByTopic({});
      return;
    }

    const chatsRef = ref(rtdb, 'topicChats');
    unsubscribe = onValue(chatsRef, (snapshot) => {
      // Verify user and partner still exist when callback fires
      if (!user?.uid || !partner?.uid) {
        setUnreadChats(0);
        setUnreadMessagesByTopic({});
        return;
      }

      const data = snapshot.val();
      if (!data) {
        setUnreadChats(0);
        setUnreadMessagesByTopic({});
        return;
      }

      let unreadCount = 0;
      const unreadByTopic = {};

      Object.entries(data).forEach(([topicId, chat]) => {
        if (!chat) return;

        // Skip if user or partner is no longer available
        if (!user?.uid || !partner?.uid) return;

        const lastReadTimestamp = parseInt(localStorage.getItem(`lastRead_${topicId}_${user.uid}`)) || 0;
        const isTopicOpen = sessionStorage.getItem('openTopicChatId') === topicId;
        
        if (isTopicOpen) {
          localStorage.setItem(`lastRead_${topicId}_${user.uid}`, Date.now().toString());
          return;
        }

        let topicHasUnread = false;

        Object.entries(chat).forEach(([messageId, message]) => {
          if (messageId === 'typing') return;
          
          // Skip if message is not from current conversation partners
          if (message.userId !== partner.uid || message.partnerId !== user.uid) return;
          
          const messageTimestamp = message.timestamp ? 
            (typeof message.timestamp === 'number' ? 
              message.timestamp : 
              message.timestamp?.toMillis?.() || 
              parseInt(message.timestamp) || 
              Date.now()
            ) : Date.now();

          if (messageTimestamp > lastReadTimestamp) {
            unreadCount++;
            topicHasUnread = true;
          }
        });

        if (topicHasUnread) {
          unreadByTopic[topicId] = true;
        }
      });

      setUnreadChats(unreadCount);
      setUnreadMessagesByTopic(unreadByTopic);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, partner?.uid]);

  // Listen for topics and responses
  useEffect(() => {
    let unsubscribe;
    let previousPendingCount = 0;  // Track previous count to show toast only on changes

    if (!user?.uid || !partner?.uid) {
      setNewTopics(0);
      setPendingResponses(0);
      setUnreadResponsesByTopic({});
      return;
    }

    const topicsRef = ref(rtdb, 'topics');
    unsubscribe = onValue(topicsRef, (snapshot) => {
      // Verify user and partner still exist when callback fires
      if (!user?.uid || !partner?.uid) {
        setNewTopics(0);
        setPendingResponses(0);
        setUnreadResponsesByTopic({});
        return;
      }

      const data = snapshot.val();
      if (!data) {
        setNewTopics(0);
        setPendingResponses(0);
        setUnreadResponsesByTopic({});
        return;
      }

      const lastCheckedTopics = parseInt(
        localStorage.getItem(`lastChecked_topics_${user.uid}`)
      ) || Date.now();

      let newTopicsCount = 0;
      let pendingResponsesCount = 0;
      const unreadResponses = {};

      Object.entries(data).forEach(([topicId, topic]) => {
        if (!topic || !user?.uid || !partner?.uid) return;

        // Only count topics that involve both current user and current partner
        const isRelevantTopic = (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
                               (topic.createdBy === partner.uid && topic.partnerId === user.uid);
        
        if (!isRelevantTopic) return;

        // Check for new topics
        if (topic.createdAt > lastCheckedTopics && topic.createdBy === partner.uid) {
          newTopicsCount++;
        }

        // Check for new responses
        if (topic.responses?.[partner.uid]) {
          const lastChecked = parseInt(localStorage.getItem(`lastChecked_${topicId}_${user.uid}`)) || 0;
          const responseTime = topic.responses[partner.uid].timestamp;
          
          if (responseTime > lastChecked && !topic.responses[user.uid]) {
            pendingResponsesCount++;
            unreadResponses[topicId] = true;
          }
        }
      });

      // Show toast notification if pending responses count has increased
      if (pendingResponsesCount > previousPendingCount) {
        toast.success(`You have ${pendingResponsesCount} pending response${pendingResponsesCount === 1 ? '' : 's'} from your partner!`, {
          duration: 4000,
          position: 'bottom-right',
          icon: '🔔',
        });
      }
      previousPendingCount = pendingResponsesCount;

      setNewTopics(newTopicsCount);
      setPendingResponses(pendingResponsesCount);
      setUnreadResponsesByTopic(unreadResponses);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, partner?.uid]);

  // Add effect to clear unread messages when viewing a topic
  useEffect(() => {
    const handleStorageChange = () => {
      const openTopicId = sessionStorage.getItem('openTopicChatId');
      if (openTopicId && user?.uid) {
        localStorage.setItem(`lastRead_${openTopicId}_${user.uid}`, Date.now().toString());
        localStorage.setItem(`lastChecked_${openTopicId}_${user.uid}`, Date.now().toString());
      }
    };

    // Initial check
    handleStorageChange();

    // Listen for changes to sessionStorage
    window.addEventListener('storage', handleStorageChange);
    // Listen for custom event when topic is opened
    window.addEventListener('topicChatOpened', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('topicChatOpened', handleStorageChange);
    };
  }, [user?.uid]);

  // Update unread indicators when counts change
  useEffect(() => {
    setHasUnreadMessages(Object.keys(unreadMessagesByTopic).length > 0);
    setHasUnreadResponses(Object.keys(unreadResponsesByTopic).length > 0);
  }, [unreadMessagesByTopic, unreadResponsesByTopic]);

  // Clear unread states when navigating to topics
  useEffect(() => {
    if (location.pathname === '/topics' && user?.uid) {
      localStorage.setItem(`lastChecked_topics_${user.uid}`, Date.now().toString());
      
      // Get current open topic from session storage
      const openTopicId = sessionStorage.getItem('openTopicChatId');
      if (openTopicId) {
        localStorage.setItem(`lastRead_${openTopicId}_${user.uid}`, Date.now().toString());
        localStorage.setItem(`lastChecked_${openTopicId}_${user.uid}`, Date.now().toString());
      }
    }
  }, [location.pathname, user?.uid]);

  // Don't show nav if user is not logged in
  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 z-50 md:hidden shadow-lg">
      {/* Safe area padding for iOS devices */}
      <div className="safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const hasNotifications = item.showNotification && (unreadChats > 0 || pendingResponses > 0 || newTopics > 0);
            const totalNotifications = unreadChats + pendingResponses + newTopics;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full relative group
                  transition-all duration-300 ease-out
                  ${isActive 
                    ? 'text-black dark:text-white' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                {/* Active Indicator - Animated */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-black via-gray-800 to-black dark:from-white dark:via-gray-200 dark:to-white rounded-b-full animate-pulse" />
                )}
                
                {/* Icon Container with Background */}
                <div className="relative">
                  {/* Background circle for active state */}
                  {isActive && (
                    <div className="absolute inset-0 -m-2 bg-gray-100 dark:bg-gray-800 rounded-full scale-110 transition-transform duration-300" />
                  )}
                  
                  {/* Icon */}
                  <div className="relative">
                    <item.icon 
                      className={`
                        h-6 w-6 transition-all duration-300
                        ${isActive 
                          ? 'scale-110 drop-shadow-sm' 
                          : 'group-hover:scale-105 group-active:scale-95'
                        }
                      `} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    
                    {/* Notification Badge */}
                    {hasNotifications && (
                      <span className="absolute -top-2 -right-2 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] items-center justify-center font-bold shadow-lg ring-2 ring-white dark:ring-gray-900">
                          {totalNotifications > 9 ? '9+' : totalNotifications}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Label with smooth transition */}
                <span 
                  className={`
                    text-[10px] mt-1.5 font-medium tracking-wide transition-all duration-300
                    ${isActive 
                      ? 'font-bold opacity-100 scale-100' 
                      : 'opacity-70 group-hover:opacity-100 scale-95 group-hover:scale-100'
                    }
                  `}
                >
                  {item.label}
                </span>
                
                {/* Ripple effect on tap */}
                <span className="absolute inset-0 rounded-lg overflow-hidden">
                  <span className="absolute inset-0 bg-gray-200 dark:bg-gray-700 opacity-0 group-active:opacity-20 transition-opacity duration-150" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default FloatingNav;