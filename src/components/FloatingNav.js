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
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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
        // IMPORTANT: Only count messages from direct_chat for Chat badge
        // Topic discussions should NOT appear in Chat badge
        if (topicId !== 'direct_chat') return;
        
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

  // Auto-hide navigation on scroll - Professional mobile UX
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show nav when at top of page
      if (currentScrollY < 10) {
        setIsVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }
      
      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling down & past threshold - hide nav
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show nav
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    // Throttle scroll events for performance
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [lastScrollY]);

  // Reset visibility on route change
  useEffect(() => {
    setIsVisible(true);
    setLastScrollY(0);
  }, [location.pathname]);

  // Don't show nav if user is not logged in
  if (!user) return null;
  
  // Hide nav on chat route
  if (location.pathname === '/chat') return null;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 md:hidden transition-transform duration-300 ease-in-out"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(4rem + env(safe-area-inset-bottom))', // 4rem = 64px (h-16 equivalent)
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)'
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const hasNotifications = item.showNotification && (unreadChats > 0 || pendingResponses > 0 || newTopics > 0);
          const totalNotifications = unreadChats + pendingResponses + newTopics;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full relative group transition-all duration-200"
            >
              {/* Icon Container */}
              <div className="relative mb-1">
                {/* Icon */}
                <item.icon 
                  className={`h-6 w-6 transition-colors duration-200 ${
                    isActive 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                
                {/* Notification Badge */}
                {hasNotifications && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[9px] items-center justify-center font-bold">
                      {totalNotifications > 9 ? '9' : totalNotifications}
                    </span>
                  </span>
                )}
              </div>
              
              {/* Label */}
              <span 
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default FloatingNav;