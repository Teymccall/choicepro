import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { 
  getFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { ref, set, serverTimestamp } from 'firebase/database';
import { connectionDebugger, logFirestoreEvent, logError, logWarning } from '../utils/connectionDebugger';

// Constants for authentication and retry logic
export const TIMEOUT = 30000; // 30 seconds
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY = 1000; // 1 second

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBl5cdGzFmb4xxz-3inNjUbRI9AKhsw7SE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "choice-4496c.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://choice-4496c-default-rtdb.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "choice-4496c",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "choice-4496c.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "997107815311",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:997107815311:web:056bade42556f933faf1fa",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-FFDDRVPJRZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services with error handling
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Set persistence to LOCAL by default
setPersistence(auth, browserLocalPersistence)
  .catch(error => {
    console.error('Error setting auth persistence:', error);
  });

const rtdb = getDatabase(app);
const storage = getStorage(app);

// Initialize Firestore with optimized settings for connection stability
let db;
try {
  logFirestoreEvent('Initializing Firestore with forced long-polling', {
    forceLongPolling: true,
    persistentCache: true
  });
  
  db = initializeFirestore(app, {
    // Force long polling to improve stability on mobile/Safari
    experimentalForceLongPolling: true,
    // Disable fetch streams which can fail on some mobile networks
    useFetchStreams: false,
    // Enable local cache with multi-tab support
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    // Ignore undefined properties to prevent errors
    ignoreUndefinedProperties: true
  });
  
  logFirestoreEvent('Firestore initialized successfully', {
    longPolling: true,
    cacheEnabled: true
  });
} catch (error) {
  logError('Error initializing Firestore with long-polling', error);
  
  // Fallback to basic initialization
  try {
    db = getFirestore(app);
    logWarning('Firestore initialized with default settings (fallback)', {
      longPolling: false,
      reason: error.message
    });
  } catch (fallbackError) {
    logError('Critical: Failed to initialize Firestore', fallbackError);
    throw fallbackError;
  }
}

// Connection state monitoring
let firestoreConnectionState = 'initializing';
const firestoreConnectionListeners = new Set();

export const onFirestoreConnectionStateChange = (callback) => {
  firestoreConnectionListeners.add(callback);
  callback(firestoreConnectionState);
  return () => firestoreConnectionListeners.delete(callback);
};

const updateFirestoreConnectionState = (state) => {
  const previousState = firestoreConnectionState;
  firestoreConnectionState = state;
  
  if (previousState !== state) {
    logFirestoreEvent('Connection state changed', {
      from: previousState,
      to: state,
      online: navigator.onLine
    });
  }
  
  firestoreConnectionListeners.forEach(listener => listener(state));
};

// Monitor Firestore connection health
let connectionCheckInterval = null;
let lastConnectionCheck = Date.now();

const startConnectionMonitoring = () => {
  if (connectionCheckInterval) return;
  
  console.log('[Firestore] Starting connection monitoring');
  updateFirestoreConnectionState('connected');
  
  // Periodic connection health check
  connectionCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastConnectionCheck;
    lastConnectionCheck = now;
    
    if (!navigator.onLine) {
      console.log('[Firestore] Network offline detected');
      updateFirestoreConnectionState('offline');
    } else if (firestoreConnectionState === 'offline') {
      console.log('[Firestore] Network back online, reconnecting...');
      updateFirestoreConnectionState('reconnecting');
    } else if (timeSinceLastCheck > 15000) {
      // If more than 15 seconds since last check, connection might be unstable
      console.warn('[Firestore] Connection check interval exceeded, possible connection issue');
    }
  }, 5000);
};

// Listen for online/offline events
window.addEventListener('online', () => {
  logFirestoreEvent('Network online - Firestore reconnecting', {
    timestamp: new Date().toISOString()
  });
  updateFirestoreConnectionState('reconnecting');
  setTimeout(() => updateFirestoreConnectionState('connected'), 1000);
});

window.addEventListener('offline', () => {
  logFirestoreEvent('Network offline - Firestore disconnected', {
    timestamp: new Date().toISOString()
  });
  updateFirestoreConnectionState('offline');
});

// Export connection debugger for external use
export { connectionDebugger };

// Start monitoring
startConnectionMonitoring();

// Initialize Messaging with proper checks
let messaging = null;

// Add VAPID key configuration
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || "BLwiJ4v1I6ICbjuVg1y03ASqrrKD8SEy8jS2KgbvzgY4GX6UwLZknHaNz50507OKQsKFJMwh_7nXwUACTmW5lig";

// Function to initialize messaging
const initializeMessaging = async () => {
  try {
    const isMessagingSupported = await isSupported();
    if (isMessagingSupported) {
      messaging = getMessaging(app);
      console.log('Firebase messaging initialized successfully');
      return true;
    } else {
      console.log('Firebase messaging is not supported in this environment');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Firebase messaging:', error);
    return false;
  }
};

// Function to request notification permission
const requestNotificationPermission = async () => {
  try {
    console.log('Starting notification permission request process...');
    console.log('Browser/Device Info:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    });
    
    // Step 1: Check if notifications are supported
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      return null;
    }

    // Step 2: Check messaging initialization
    console.log('Checking messaging initialization...');
    const isInitialized = await initializeMessaging();
    if (!isInitialized) {
      console.error('Messaging not initialized, cannot request permission');
      return null;
    }
    console.log('Messaging initialized successfully');

    // Step 3: Check authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No authenticated user found');
      return null;
    }
    console.log('User authenticated:', currentUser.uid);

    // Step 4: Request browser permission with fallback
    console.log('Requesting notification permission...');
    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      // Fallback for older browsers
      permission = await new Promise((resolve) => {
        Notification.requestPermission(resolve);
      });
    }
    console.log('Notification permission:', permission);
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Step 5: Get service worker registration with better error handling
    console.log('Getting service worker registration...');
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
      console.log('Service worker is ready');
    } catch (error) {
      console.error('Service worker registration failed:', error);
      // Try registering the service worker if it failed
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered successfully');
      } catch (regError) {
        console.error('Service worker registration failed:', regError);
        return null;
      }
    }

    // Step 6: Get FCM token with device-specific options
    console.log('Getting FCM token...');
    const tokenOptions = {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    };

    // Add additional options for mobile devices if needed
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      console.log('Configuring for mobile device');
      // Mobile-specific configurations can be added here
    }

    const token = await getToken(messaging, tokenOptions);

    if (token) {
      console.log('FCM Token generated successfully');
      console.log('================== FCM TOKEN ==================');
      console.log(token);
      console.log('=============================================');
      
      // Store the token with device info
      const tokenRef = ref(rtdb, `users/${currentUser.uid}/fcmTokens/${token}`);
      await set(tokenRef, {
        token,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        device: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
          isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
          language: navigator.language,
          screenSize: {
            width: window.screen.width,
            height: window.screen.height
          }
        }
      });
      
      console.log('Token stored in database with device info');
      return token;
    } else {
      console.error('FCM Token generation failed - token is null');
      return null;
    }
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      browser: navigator.userAgent
    });
    throw error;
  }
};

// Function to handle incoming messages
const onMessageListener = () => {
  if (!messaging) {
    return Promise.reject(new Error('Messaging not initialized'));
  }
  
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      resolve(payload);
    });
  });
};

// Export initialized services
export { app, analytics, auth, rtdb, storage, db, requestNotificationPermission, onMessageListener, initializeMessaging }; 