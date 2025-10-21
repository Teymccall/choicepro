import React, { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import {
  Cog6ToothIcon,
  BellIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  BookOpenIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  TrashIcon,
  UserIcon,
  PaintBrushIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, onValue, update, remove, get, serverTimestamp, set } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { updatePassword, updateProfile } from 'firebase/auth';
import { cookieManager } from '../utils/cookieManager';
import { auth } from '../firebase/config';
import { requestNotificationPermission } from '../firebase/config';
import ProfilePicture from '../components/ProfilePicture';

const Settings = () => {
  const { user, partner, isOnline } = useAuth();
  const [notifications, setNotifications] = useState({
    newTopics: true,
    partnerResponses: true,
    suggestions: true,
  });
  const [privacy, setPrivacy] = useState({
    showProfile: true,
    anonymousNotes: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState(() => {
    // Try to get from localStorage first
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    // Default values
    return {
      chatNotifications: true,
      topicNotifications: true,
      systemNotifications: true
    };
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || ''
  });
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'system';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme === 'dark' || ((!savedTheme || savedTheme === 'system') && isSystemDark);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notificationBlocked, setNotificationBlocked] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('default');

  // Add a check for valid authentication
  const checkAuthAndPermissions = () => {
    if (!user?.uid) {
      setError('You must be logged in to change settings');
      return false;
    }
    
    if (!isOnline) {
      setError('You must be online to save settings to the cloud');
      return false;
    }

    return true;
  };

  // Apply theme on initial mount and handle system changes
  useEffect(() => {
    const initializeTheme = () => {
      const savedTheme = localStorage.getItem('theme') || 'system';
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme === 'dark' || (savedTheme === 'system' && isSystemDark);
      
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (savedTheme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', savedTheme);
        root.classList.add(savedTheme);
      }
      
      setTheme(savedTheme);
      setIsDarkMode(shouldBeDark);
    };

    // Initialize theme immediately
    initializeTheme();

    // Set up system theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const applyTheme = (themeName) => {
    try {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeName === 'dark' || (themeName === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (themeName === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', themeName);
        root.classList.add(themeName);
      }

      // Store in localStorage
      localStorage.setItem('theme', themeName);
      localStorage.setItem('lastThemeUpdate', new Date().toISOString());
      
      // Update state
      setTheme(themeName);
      setIsDarkMode(shouldBeDark);
      
      return true;
    } catch (error) {
      console.error('Error applying theme:', error);
      return false;
    }
  };

  // Modified handleThemeChange
  const handleThemeChange = async (newTheme) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Apply theme locally first
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = newTheme === 'dark' || (newTheme === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (newTheme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', newTheme);
        root.classList.add(newTheme);
      }

      // Store in both localStorage and cookies
      localStorage.setItem('theme', newTheme);
      cookieManager.saveTheme(newTheme);
      
      // Update state
      setTheme(newTheme);
      setIsDarkMode(shouldBeDark);

      // Try to update Firebase if authenticated
      if (checkAuthAndPermissions()) {
        try {
          const settingsRef = ref(rtdb, `userSettings/${user.uid}`);
          await update(settingsRef, {
            theme: {
              preference: newTheme,
              updatedAt: serverTimestamp(),
              localUpdate: new Date().toISOString()
            }
          });
        } catch (error) {
          console.warn('Firebase sync failed:', error);
        }
      }

      setSuccessMessage('Theme updated successfully');
    } catch (err) {
      console.error('Error updating theme:', err);
      setError('Theme update failed. Please try again.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  // Fetch notification settings and unread count
  useEffect(() => {
    if (!user?.uid) return;

    const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
    const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
    
    setIsLoading(true);
    
    // First get the current settings
    get(settingsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSettings = {
          chatNotifications: data.chatNotifications ?? true,
          topicNotifications: data.topicNotifications ?? true,
          systemNotifications: data.systemNotifications ?? true
        };
        setNotificationSettings(newSettings);
        // Save to localStorage
        localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      }
      setIsLoading(false);
    });
    
    // Then listen for changes
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSettings = {
          chatNotifications: data.chatNotifications ?? true,
          topicNotifications: data.topicNotifications ?? true,
          systemNotifications: data.systemNotifications ?? true
        };
        setNotificationSettings(newSettings);
        // Save to localStorage
        localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      }
    });

    const notificationsUnsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter(n => !n.read).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    });

    return () => {
      settingsUnsubscribe();
      notificationsUnsubscribe();
    };
  }, [user?.uid]);

  // Fetch privacy settings
  useEffect(() => {
    if (!user?.uid) return;

    const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
    
    const privacyUnsubscribe = onValue(privacyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrivacy(data);
      }
    });

    return () => privacyUnsubscribe();
  }, [user?.uid]);

  // Fetch profile data
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
    
    const profileUnsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Only update if we're not in editing mode
        if (!isEditing) {
          setProfile(prev => ({
            ...prev,
            ...data,
            displayName: auth.currentUser?.displayName || data.displayName || '',
            email: auth.currentUser?.email || data.email || ''
          }));
        }
      }
    });

    return () => profileUnsubscribe();
  }, [user?.uid, auth.currentUser?.displayName, auth.currentUser?.email, isEditing]);

  // Check notification permission status
  const checkNotificationPermission = () => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return false;
    }

    const permission = Notification.permission;
    setNotificationStatus(permission);
    setNotificationBlocked(permission === 'denied');
    return permission === 'granted';
  };

  // Handle notification toggle
  const handleNotificationToggle = async (setting, value) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Check if notifications are supported
      if (!('Notification' in window)) {
        setError('Notifications are not supported in your browser');
        return;
      }

      // Create a new settings object with all current values
      const newSettings = {
        ...notificationSettings,
        [setting]: value
      };

      // Update local state first for immediate feedback
      setNotificationSettings(newSettings);
      // Save to localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(newSettings));

      // If permission is denied, show instructions to unblock
      if (Notification.permission === 'denied') {
        setError(
          'Notifications are blocked. To enable them, click the lock/info icon in your browser\'s address bar, then allow notifications.'
        );
        return;
      }

      // If permission not granted and trying to enable, request it
      if (value && Notification.permission === 'default') {
        try {
          const token = await requestNotificationPermission();
          if (!token) {
            // Revert local state if permission wasn't granted
            setNotificationSettings(prev => ({
              ...prev,
              [setting]: !value
            }));
            setError('Failed to enable notifications. Please try again.');
            return;
          }
        } catch (err) {
          console.error('Error requesting notification permission:', err);
          // Revert local state on error
          setNotificationSettings(prev => ({
            ...prev,
            [setting]: !value
          }));
          setError('Failed to enable notifications. Please check your browser settings.');
          return;
        }
      }

      // Try to update Firebase if online
      if (isOnline && user?.uid) {
        try {
          const settingsRef = ref(rtdb, `userSettings/${user.uid}/notifications`);
          // Update all notification settings at once
          await update(settingsRef, {
            chatNotifications: newSettings.chatNotifications,
            topicNotifications: newSettings.topicNotifications,
            systemNotifications: newSettings.systemNotifications,
            updatedAt: serverTimestamp()
          });
          
          // If enabling notifications, send a test notification
          if (value) {
            const testNotificationRef = ref(rtdb, `notifications/${user.uid}/test_${Date.now()}`);
            await set(testNotificationRef, {
              type: 'test',
              title: 'Test Notification',
              body: `${setting} notifications are now enabled`,
              timestamp: serverTimestamp(),
              data: {
                type: 'test',
                setting
              }
            });
          }
          
          setSuccessMessage('Notification settings updated');
        } catch (error) {
          console.warn('Failed to save notification settings to Firebase:', error);
          // Only show error if we're online but save failed
          if (isOnline) {
            setError('Failed to save settings to the server, but notifications are enabled locally');
          }
        }
      }
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError('Failed to update notification settings');
      // Revert local state on error
      setNotificationSettings(prev => ({
        ...prev,
        [setting]: !value
      }));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  // Initialize notification permission check
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const handleProfileUpdate = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to update profile');
      return;
    }

    if (!profile.displayName?.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const newDisplayName = profile.displayName.trim();
      
      // First update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName
      });

      // Then update profile in database
      const profileRef = ref(rtdb, `userSettings/${user.uid}/profile`);
      await update(profileRef, {
        displayName: newDisplayName,
        email: user.email,
        updatedAt: serverTimestamp()
      });

      // Update user data in RTDB
      const userRef = ref(rtdb, `users/${user.uid}`);
      await update(userRef, {
        displayName: newDisplayName,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        displayName: newDisplayName
      }));
      
      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating profile:', err);
      if (err.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check if you are logged in.');
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change password');
      return;
    }

    if (password.new !== password.confirm) {
      setError('New passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await updatePassword(user, password.new);
      
      setPassword({
        current: '',
        new: '',
        confirm: ''
      });
      
      setSuccessMessage('Password updated successfully');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrivacyChange = async (key) => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to change settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const newPrivacy = {
        ...privacy,
        [key]: !privacy[key]
      };

      const privacyRef = ref(rtdb, `userSettings/${user.uid}/privacy`);
      await update(privacyRef, newPrivacy);
      
      setPrivacy(newPrivacy);
      setSuccessMessage('Privacy settings updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error updating privacy settings:', err);
      setError('Failed to update privacy settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSettings = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to reset settings');
      return;
    }

    try {
      setIsSubmitting(true);
      const defaultSettings = {
        notifications: {
          chatNotifications: true,
          topicNotifications: true,
          systemNotifications: true
        },
        privacy: {
          showProfile: true,
          anonymousNotes: false
        },
        theme: {
          preference: 'system',
          updatedAt: serverTimestamp()
        }
      };

      const settingsRef = ref(rtdb, `userSettings/${user.uid}`);
      await update(settingsRef, defaultSettings);
      
      setNotificationSettings(defaultSettings.notifications);
      setPrivacy(defaultSettings.privacy);
      handleThemeChange(defaultSettings.theme.preference);
      
      setSuccessMessage('Settings reset to defaults');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError('Failed to reset settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearTopics = async () => {
    if (!isOnline || !user?.uid) {
      setError('You must be online to clear topics');
      return;
    }

    try {
      setIsClearing(true);

      // Get all topics where the user is involved
      const topicsRef = ref(rtdb, 'topics');
      const snapshot = await get(topicsRef);
      const topics = snapshot.val();

      if (!topics) {
        setSuccessMessage('No topics to clear');
        return;
      }
      
      // Find and remove topics where the user is either creator or partner
      const batch = {};
      Object.entries(topics).forEach(([topicId, topic]) => {
        if ((topic.createdBy === user.uid && topic.partnerId === partner?.uid) ||
            (topic.createdBy === partner?.uid && topic.partnerId === user.uid)) {
          batch[`topics/${topicId}`] = null;
          // Also clear associated chat messages
          batch[`topicChats/${topicId}`] = null;
        }
      });

      if (Object.keys(batch).length > 0) {
        await update(ref(rtdb), batch);
        setSuccessMessage('Topics cleared successfully');
      } else {
        setSuccessMessage('No topics to clear');
      }
      
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error clearing topics:', err);
      setError('Failed to clear topics');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 pb-24">
      {/* Hero Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cog6ToothIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">Settings</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Customize your experience</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Section */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300 hover:shadow-blue-500/20 dark:hover:shadow-purple-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <UserCircleIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
          </div>
          <div className="space-y-6">
            {/* Add Profile Picture */}
            <div className="flex justify-center">
              <div className="relative group/avatar">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-md opacity-60 group-hover/avatar:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <ProfilePicture size="lg" editable={isEditing} />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Display Name</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-blue-500/20 dark:focus:ring-purple-500/20 transition-all"
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70 backdrop-blur-sm text-gray-600 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-purple-500/40"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 bg-gray-200/70 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-300 dark:hover:bg-gray-600 backdrop-blur-sm transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileUpdate}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-purple-500/40"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
          </div>
        </section>

        {/* Password Section */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center">
              <KeyIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Change Password</h2>
          </div>
          <div className="space-y-5">
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password.new}
                onChange={(e) => setPassword({ ...password, new: e.target.value })}
                className="block w-full px-4 py-3 pr-12 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-purple-500/20 dark:focus:ring-pink-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-11 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-pink-500 transition-colors"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 dark:focus:border-pink-500 focus:ring-4 focus:ring-purple-500/20 dark:focus:ring-pink-500/20 transition-all"
              />
            </div>
            <div className="flex justify-end pt-4">
              <button
                onClick={handlePasswordChange}
                disabled={isSubmitting || !password.new || !password.confirm || password.new !== password.confirm}
                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold rounded-2xl hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-purple-500/40"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-600 to-blue-600 flex items-center justify-center">
              <BellIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h2>
          </div>
          <div className="space-y-6">
            <div className="notification-settings">
              {isLoading ? (
                <div className="py-2 flex items-center justify-center">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
                  <span className="ml-2 text-gray-500 dark:text-gray-400">Loading notification settings...</span>
                </div>
              ) : !('Notification' in window) ? (
                <p className="text-red-500 dark:text-red-400">Notifications are not supported in your browser</p>
              ) : Notification.permission === 'denied' ? (
                <p className="text-red-500 dark:text-red-400">
                  Notifications are blocked. To enable them, click the lock/info icon in your browser's address bar,
                  then allow notifications.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 transition-all">
                    <label htmlFor="chatNotifications" className="flex-grow cursor-pointer">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">Chat Messages</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get notified when you receive new chat messages</p>
                    </label>
                    <div className="relative ml-4">
                      <Switch
                        id="chatNotifications"
                        checked={notificationSettings.chatNotifications}
                        onChange={(checked) => handleNotificationToggle('chatNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.chatNotifications ? 'bg-gradient-to-r from-green-500 to-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        } relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-500/30 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : 'shadow-md'
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.chatNotifications ? 'translate-x-8' : 'translate-x-1'
                          } inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 transition-all">
                    <label htmlFor="topicNotifications" className="flex-grow cursor-pointer">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">Topic Responses</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get notified when someone responds to your topics</p>
                    </label>
                    <div className="relative ml-4">
                      <Switch
                        id="topicNotifications"
                        checked={notificationSettings.topicNotifications}
                        onChange={(checked) => handleNotificationToggle('topicNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.topicNotifications ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                        } relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/30 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : 'shadow-md'
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.topicNotifications ? 'translate-x-8' : 'translate-x-1'
                          } inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 transition-all">
                    <label htmlFor="systemNotifications" className="flex-grow cursor-pointer">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">System Notifications</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get notified about important system updates</p>
                    </label>
                    <div className="relative ml-4">
                      <Switch
                        id="systemNotifications"
                        checked={notificationSettings.systemNotifications}
                        onChange={(checked) => handleNotificationToggle('systemNotifications', checked)}
                        disabled={isSubmitting || !isOnline}
                        className={`${
                          notificationSettings.systemNotifications ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                        } relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/30 ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : 'shadow-md'
                        }`}
                      >
                        <span
                          className={`${
                            notificationSettings.systemNotifications ? 'translate-x-8' : 'translate-x-1'
                          } inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </section>

        {/* Privacy Settings */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy Settings</h2>
          </div>
          <div className="space-y-4">
            {Object.entries(privacy).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 transition-all">
                <span className="text-base font-semibold capitalize text-gray-900 dark:text-white">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <Switch
                  checked={enabled}
                  onChange={() => handlePrivacyChange(key)}
                  className={`${
                    enabled ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                  } relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/30 shadow-md`}
                >
                  <span
                    className={`${
                      enabled ? 'translate-x-8' : 'translate-x-1'
                    } inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Theme Settings */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-blue-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <PaintBrushIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Theme Settings</h2>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`relative group/theme p-5 rounded-2xl border-2 ${
                  theme === 'light' ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20' : 'border-gray-300 dark:border-gray-600 bg-white/30 dark:bg-gray-900/30'
                } hover:border-yellow-400 dark:hover:border-yellow-500 flex flex-col items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm shadow-md hover:shadow-lg transform hover:scale-105`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  theme === 'light' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                } transition-all duration-200`}>
                  <SunIcon className="h-6 w-6 text-white" />
                </div>
                <span className={`font-semibold ${
                  theme === 'light' ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'
                }`}>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`relative group/theme p-5 rounded-2xl border-2 ${
                  theme === 'dark' ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20' : 'border-gray-300 dark:border-gray-600 bg-white/30 dark:bg-gray-900/30'
                } hover:border-blue-400 dark:hover:border-blue-500 flex flex-col items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm shadow-md hover:shadow-lg transform hover:scale-105`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  theme === 'dark' ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                } transition-all duration-200`}>
                  <MoonIcon className="h-6 w-6 text-white" />
                </div>
                <span className={`font-semibold ${
                  theme === 'dark' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`relative group/theme p-5 rounded-2xl border-2 ${
                  theme === 'system' ? 'border-green-500 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20' : 'border-gray-300 dark:border-gray-600 bg-white/30 dark:bg-gray-900/30'
                } hover:border-green-400 dark:hover:border-green-500 flex flex-col items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm shadow-md hover:shadow-lg transform hover:scale-105`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  theme === 'system' ? 'bg-gradient-to-br from-green-500 to-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                } transition-all duration-200`}>
                  <ComputerDesktopIcon className="h-6 w-6 text-white" />
                </div>
                <span className={`font-semibold ${
                  theme === 'system' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                }`}>System</span>
              </button>
            </div>
          </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="group relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
              <Cog6ToothIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                onClick={handleClearTopics}
                disabled={isClearing}
                className="group/btn relative p-6 rounded-2xl border-2 border-red-300 dark:border-red-700 bg-white/30 dark:bg-gray-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 flex flex-col items-center justify-center gap-3 transition-all duration-200 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-md hover:shadow-lg hover:border-red-500"
                    >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                  <TrashIcon className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold text-red-700 dark:text-red-400">Clear All Topics</span>
                <p className="text-xs text-center text-gray-600 dark:text-gray-400">Permanently delete all conversation topics</p>
                    </button>
                      <button
                onClick={handleResetSettings}
                disabled={isSubmitting}
                className="group/btn relative p-6 rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-white/30 dark:bg-gray-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex flex-col items-center justify-center gap-3 transition-all duration-200 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-md hover:shadow-lg hover:border-blue-500"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                  <ArrowPathIcon className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold text-blue-700 dark:text-blue-400">Reset All Settings</span>
                <p className="text-xs text-center text-gray-600 dark:text-gray-400">Restore default settings</p>
                      </button>
            </div>
          </div>
          </div>
        </section>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="fixed bottom-24 right-6 z-50 backdrop-blur-xl bg-green-500/90 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-green-400 animate-slide-in">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircleIcon className="h-5 w-5" />
          </div>
          <span className="font-semibold">{successMessage}</span>
      </div>
        )}
      {error && (
        <div className="fixed bottom-24 right-6 z-50 backdrop-blur-xl bg-red-500/90 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400 animate-slide-in">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <XCircleIcon className="h-5 w-5" />
          </div>
          <span className="font-semibold">{error}</span>
        </div>
      )}
    </div>
  );
};

export default Settings; 