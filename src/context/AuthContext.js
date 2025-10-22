import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc,
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  updateDoc,
  runTransaction,
  Timestamp,
  arrayUnion,
  arrayRemove,
  serverTimestamp as firestoreTimestamp,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
  onSnapshot
} from 'firebase/firestore';
import { 
  ref, 
  onValue, 
  set, 
  get,
  update,
  serverTimestamp,
  onDisconnect,
  off,
  remove
} from 'firebase/database';
import { 
  auth, 
  db,
  rtdb,
  TIMEOUT, 
  MAX_RETRY_ATTEMPTS, 
  INITIAL_RETRY_DELAY,
  onFirestoreConnectionStateChange
} from '../firebase/config';
import { toast } from 'react-hot-toast';

const AuthContext = createContext(null);

// Utility function for retrying operations with exponential backoff
const retryOperation = async (operation, retryCount = 0) => {
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT)
      )
    ]);
  } catch (error) {
    console.error(`Operation failed (attempt ${retryCount + 1}):`, error);
    
    if (error.code === 'permission-denied') {
      throw new Error('You do not have permission to perform this action');
    }
    
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retryCount + 1);
    }
    
    if (error.code === 'failed-precondition') {
      throw new Error('Please try again in a few moments');
    }
    
    throw error;
  }
};

let firestoreInitialized = false;
let networkEnabled = true;

const setNetworkEnabled = async (enabled) => {
  if (enabled === networkEnabled) return;
  
  try {
    if (enabled) {
      await enableNetwork(db);
    } else {
      await disableNetwork(db);
    }
    networkEnabled = enabled;
  } catch (err) {
    console.error('Error setting network state:', err);
  }
};

// Simplified write operation
const safeWrite = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Error in write operation:', error);
    throw error;
  }
};

// Add a cleanup function for Firestore state
const cleanupFirestore = async () => {
  try {
    // Disable network first to prevent new operations
    await disableNetwork(db);
    
    // Clear any pending writes
    await waitForPendingWrites(db);
    
    // Reset initialization flag
    firestoreInitialized = false;
    
    // Re-enable network
    await enableNetwork(db);
  } catch (err) {
    console.error('Error cleaning up Firestore:', err);
  }
};

// Add connection state management
const CONNECTION_RETRY_DELAY = 3000;
const MAX_CONNECTION_RETRIES = 3;

// Helper function for handling connection retries
const withConnectionRetry = async (operation, retries = 0) => {
  try {
    return await operation();
  } catch (error) {
    if (retries < MAX_CONNECTION_RETRIES && 
        (error.code === 'NETWORK_ERROR' || 
         error.code === 'PERMISSION_DENIED' || 
         error.name === 'FirebaseError')) {
      await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
      return withConnectionRetry(operation, retries + 1);
    }
    throw error;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [activeInviteCode, setActiveInviteCode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [disconnectMessage, setDisconnectMessage] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider();

  // Add refs to store cleanup functions
  const presenceRef = useRef(null);
  const userStatusRef = useRef(null);
  const listenerCleanups = useRef([]);

  // Add connection state management
  const [connectionState, setConnectionState] = useState('checking');
  const connectionRetryCount = useRef(0);
  const [firestoreConnectionState, setFirestoreConnectionState] = useState('initializing');
  const snapshotRetryTimers = useRef(new Map());

  // Monitor Firestore connection state
  useEffect(() => {
    const unsubscribe = onFirestoreConnectionStateChange((state) => {
      setFirestoreConnectionState(state);
      console.log('Firestore connection state:', state);
    });
    return () => unsubscribe();
  }, []);

  // Helper function to create resilient snapshot listeners
  const createResilientSnapshot = (query, onSuccess, onError, listenerId) => {
    let retryCount = 0;
    let unsubscribe = null;
    let isActive = true;
    
    const setupListener = () => {
      if (!isActive) return;
      
      try {
        console.log(`[${listenerId}] Setting up snapshot listener (attempt ${retryCount + 1})`);
        
        unsubscribe = onSnapshot(query, 
          (snapshot) => {
            // Reset retry count on success
            if (retryCount > 0) {
              console.log(`[${listenerId}] Snapshot listener recovered after ${retryCount} retries`);
            }
            retryCount = 0;
            
            if (snapshotRetryTimers.current.has(listenerId)) {
              clearTimeout(snapshotRetryTimers.current.get(listenerId));
              snapshotRetryTimers.current.delete(listenerId);
            }
            
            try {
              onSuccess(snapshot);
            } catch (callbackError) {
              console.error(`[${listenerId}] Error in success callback:`, callbackError);
            }
          },
          (error) => {
            console.error(`[${listenerId}] Snapshot listener error:`, {
              code: error.code,
              message: error.message,
              retryCount,
              firestoreState: firestoreConnectionState
            });
            
            // Handle specific error codes
            if (error.code === 'permission-denied') {
              console.error(`[${listenerId}] Permission denied - not retrying`);
              onError(error);
              return;
            }
            
            // Don't retry if listener was deactivated
            if (!isActive) {
              console.log(`[${listenerId}] Listener deactivated, not retrying`);
              return;
            }
            
            // Retry with exponential backoff for network errors
            if (retryCount < MAX_RETRY_ATTEMPTS) {
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
              console.log(`[${listenerId}] Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
              
              const timer = setTimeout(() => {
                retryCount++;
                if (unsubscribe) {
                  try {
                    unsubscribe();
                  } catch (e) {
                    console.error(`[${listenerId}] Error unsubscribing:`, e);
                  }
                }
                setupListener();
              }, delay);
              
              snapshotRetryTimers.current.set(listenerId, timer);
            } else {
              console.error(`[${listenerId}] Max retries (${MAX_RETRY_ATTEMPTS}) reached`);
              onError(error);
            }
          },
          // Add options for better error handling
          {
            includeMetadataChanges: false
          }
        );
      } catch (error) {
        console.error(`[${listenerId}] Error setting up snapshot listener:`, error);
        onError(error);
      }
    };
    
    setupListener();
    
    return () => {
      console.log(`[${listenerId}] Cleaning up snapshot listener`);
      isActive = false;
      
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          console.error(`[${listenerId}] Error during cleanup:`, e);
        }
      }
      
      if (snapshotRetryTimers.current.has(listenerId)) {
        clearTimeout(snapshotRetryTimers.current.get(listenerId));
        snapshotRetryTimers.current.delete(listenerId);
      }
    };
  };

  // Add listener for partner requests
  useEffect(() => {
    if (!user) return;

    // Listen for changes in partner requests collection where user is the recipient
    const q = query(
      collection(db, 'partnerRequests'),
      where('recipientId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = createResilientSnapshot(
      q,
      (snapshot) => {
        const updatedRequests = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.expiresAt.toDate() > new Date()) {
            updatedRequests.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        // Update the pending requests state
        setPendingRequests(updatedRequests);
      },
      (error) => {
        console.error('Error listening to partner requests:', error);
      },
      'partnerRequests'
    );

    // Also listen for user's pending requests array
    const userRef = doc(db, 'users', user.uid);
    const userUnsubscribe = createResilientSnapshot(
      userRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          if (userData.pendingRequests?.length > 0) {
            // Fetch full request details
            const requests = await Promise.all(
              userData.pendingRequests.map(async (requestId) => {
                try {
                  const requestDoc = await getDoc(doc(db, 'partnerRequests', requestId));
                  if (requestDoc.exists()) {
                    const requestData = requestDoc.data();
                    // Only include pending requests where user is the recipient
                    if (requestData.status === 'pending' && 
                        requestData.recipientId === user.uid && 
                        requestData.expiresAt.toDate() > new Date()) {
                      return {
                        id: requestDoc.id,
                        ...requestData
                      };
                    }
                  }
                } catch (error) {
                  console.error('Error fetching request:', error);
                }
                return null;
              })
            );
            setPendingRequests(requests.filter(Boolean));
          } else {
            setPendingRequests([]);
          }
        }
      },
      (error) => {
        console.error('Error listening to user pending requests:', error);
      },
      'userPendingRequests'
    );

    return () => {
      unsubscribe();
      userUnsubscribe();
    };
  }, [user]);

  // Add searchUsers function
  const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      const usersRef = collection(db, 'users');
      const searchTermLower = searchTerm.toLowerCase();
      
      // Get all users and filter client-side for better search
      const usersSnapshot = await getDocs(usersRef);
      const results = new Map();
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        // Don't include current user or users who are already connected
        if (doc.id !== user?.uid && !userData.partnerId) {
          const displayName = userData.displayName || '';
          const email = userData.email || '';
          
          // Case insensitive search on both display name and email
          if (displayName.toLowerCase().includes(searchTermLower) || 
              email.toLowerCase().includes(searchTermLower)) {
            results.set(doc.id, {
              id: doc.id,
              displayName: userData.displayName,
              email: userData.email
            });
          }
        }
      });
      
      return Array.from(results.values());
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search for users. Please try again.');
    }
  };

  // Add sendPartnerRequest function
  const sendPartnerRequest = async (targetUserId) => {
    if (!user) throw new Error('You must be logged in to send a partner request');
    
    try {
      const requestRef = doc(collection(db, 'partnerRequests'));
      
      await setDoc(requestRef, {
        senderId: user.uid,
        senderName: user.displayName || user.email,
        senderEmail: user.email,
        senderPhotoURL: user.photoURL || null,
        recipientId: targetUserId,
        status: 'pending',
        createdAt: firestoreTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)) // 30 minutes expiry
      });
      
      // Create notification in Realtime Database for recipient
      // Use requestRef.id as the key to prevent duplicates
      const notificationRef = ref(rtdb, `notifications/${targetUserId}/${requestRef.id}`);
      
      // Always create/update notification to ensure delivery
      await set(notificationRef, {
        type: 'partner_request',
        senderId: user.uid,
        senderName: user.displayName || user.email,
        senderEmail: user.email,
        senderPhotoURL: user.photoURL || null,
        requestId: requestRef.id,
        message: `${user.displayName || user.email} wants to connect with you`,
        timestamp: Date.now(),
        read: false
      });
      
      // Also update the recipient's user document to ensure they get notified
      const recipientRef = doc(db, 'users', targetUserId);
      await updateDoc(recipientRef, {
        pendingRequests: arrayUnion(requestRef.id),
        lastNotificationTimestamp: firestoreTimestamp()
      });
      
      console.log('✅ Partner request sent successfully:', requestRef.id);
      return requestRef.id;
    } catch (error) {
      console.error('Error sending partner request:', error);
      throw new Error('Failed to send partner request. Please try again.');
    }
  };

  // Add listener for sent requests status changes
  useEffect(() => {
    if (!user) return;

    // Listen for changes in partner requests where user is the sender
    const q = query(
      collection(db, 'partnerRequests'),
      where('senderId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'declined'])
    );

    const unsubscribe = createResilientSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const request = change.doc.data();
            
            // Show notification based on status change
            if (request.status === 'declined') {
              toast.error(`${request.recipientName || 'User'} has declined your connection request`, {
                duration: 5000,
                position: 'top-center',
              });
            } else if (request.status === 'accepted') {
              toast.success(`${request.recipientName || 'User'} has accepted your connection request!`, {
                duration: 5000,
                position: 'top-center',
              });
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to sent requests:', error);
      },
      'sentRequests'
    );

    return () => unsubscribe();
  }, [user]);

  // Add listener for incoming partner requests - show floating toast + notification bell
  useEffect(() => {
    if (!user) return;

    // Track shown toasts to prevent duplicates
    const shownToasts = new Set();

    // Listen for new partner requests where user is the recipient
    const q = query(
      collection(db, 'partnerRequests'),
      where('recipientId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = createResilientSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const request = change.doc.data();
          const requestId = change.doc.id;
          
          // Only show toast for new requests (not on initial load)
          if (shownToasts.has(requestId)) return;
          shownToasts.add(requestId);
          
          // Check if this is a fresh request (created in last 5 seconds)
          const createdAt = request.createdAt?.toMillis() || 0;
          const now = Date.now();
          const isFreshRequest = (now - createdAt) < 5000; // 5 seconds
          
          // Only show floating toast for fresh requests
          if (!isFreshRequest) return;
          
          // Show floating glassmorphism toast with Accept/Decline buttons
          toast.custom((t) => (
            <div className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white/90 backdrop-blur-2xl shadow-2xl rounded-2xl pointer-events-auto border border-white/20 overflow-hidden`}>
              {/* Gradient glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-2xl -z-10" />
              
              <div className="relative bg-white/95 backdrop-blur-xl">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Profile Image or Avatar */}
                    <div className="flex-shrink-0">
                      {request.senderPhotoURL ? (
                        <img
                          src={request.senderPhotoURL}
                          alt={request.senderName}
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-lg"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg ring-2 ring-white">
                          <span className="text-white text-xl font-bold">
                            {(request.senderName || request.senderEmail || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                            New Connection Request
                          </p>
                          <p className="mt-1 text-base font-semibold text-gray-900">
                            {request.senderName || 'Someone'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {request.senderEmail}
                          </p>
                          <p className="mt-2 text-sm text-gray-700">
                            wants to connect with you
                          </p>
                        </div>
                        
                        {/* Close button */}
                        <button
                          onClick={() => toast.dismiss(t.id)}
                          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                              await acceptPartnerRequest(requestId);
                              toast.success('Partner request accepted! 🎉', {
                                duration: 3000,
                                position: 'top-center',
                              });
                            } catch (error) {
                              toast.error(error.message, {
                                duration: 3000,
                                position: 'top-center',
                              });
                            }
                          }}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                              await declinePartnerRequest(requestId);
                              toast('Request declined', {
                                duration: 2000,
                                position: 'top-center',
                              });
                            } catch (error) {
                              toast.error(error.message, {
                                duration: 3000,
                                position: 'top-center',
                              });
                            }
                          }}
                          className="flex-1 px-4 py-2.5 bg-white/80 hover:bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ), {
            duration: 10000, // 10 seconds - then auto-hides
            position: 'top-right',
          });
        }
      });
    }, (error) => {
      console.error('Error listening to incoming requests:', error);
    }, 'incomingRequests');

    return () => unsubscribe();
  }, [user]);

  // Add acceptPartnerRequest function
  const acceptPartnerRequest = async (requestId) => {
    try {
      const requestDoc = await getDoc(doc(db, 'partnerRequests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Partner request not found');
      }
      
      const request = requestDoc.data();
      if (request.status !== 'pending') {
        throw new Error('This request is no longer valid');
      }
      
      if (request.recipientId !== user.uid) {
        throw new Error('You are not authorized to accept this request');
      }
      
      // Update request status
      const requestRef = doc(db, 'partnerRequests', requestId);
      await updateDoc(requestRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        recipientName: user.displayName || 'User' // Add recipient name for notification
      });

      // Update both users
      const batch = writeBatch(db);
      const senderRef = doc(db, 'users', request.senderId);
      const recipientRef = doc(db, 'users', user.uid);
      
      batch.update(senderRef, {
        partnerId: user.uid,
        partnerDisplayName: user.displayName
      });
      
      batch.update(recipientRef, {
        partnerId: request.senderId,
        partnerDisplayName: request.senderName,
        pendingRequests: arrayRemove(requestId)
      });
      
      await batch.commit();
      
      // Send notification to sender
      const notificationRef = ref(rtdb, `notifications/${request.senderId}`);
      await update(notificationRef, {
        [Date.now()]: {
          type: 'request_accepted',
          message: `${user.displayName || 'Someone'} has accepted your connection request`,
          timestamp: serverTimestamp()
        }
      });

      // Fetch and set partner data
      const partnerDoc = await getDoc(senderRef);
      if (partnerDoc.exists()) {
        setPartner(partnerDoc.data());
      }
    } catch (error) {
      console.error('Error accepting partner request:', error);
      throw new Error('Failed to accept partner request. Please try again.');
    }
  };

  // Add declinePartnerRequest function
  const declinePartnerRequest = async (requestId) => {
    if (!user) throw new Error('You must be logged in to decline a partner request');
    
    try {
      // Get the request document first
      const requestRef = doc(db, 'partnerRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Partner request not found');
      }
      
      const request = requestDoc.data();
      
      // Validate the request
      if (request.status !== 'pending') {
        throw new Error('This request is no longer valid');
      }
      
      if (request.recipientId !== user.uid) {
        throw new Error('You are not authorized to decline this request');
      }

      // Update the request status directly
      await updateDoc(requestRef, {
        status: 'declined',
        declinedAt: Timestamp.now(),
        declinedBy: user.uid,
        recipientName: user.displayName || 'User' // Add recipient name for notification
      });

      // Remove from pending requests
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        pendingRequests: arrayRemove(requestId)
      });

      // Send notification to sender
      const notificationRef = ref(rtdb, `notifications/${request.senderId}`);
      await update(notificationRef, {
        [Date.now()]: {
          type: 'request_declined',
          message: `${user.displayName || 'Someone'} has declined your connection request`,
          timestamp: serverTimestamp()
        }
      });

      return true;
    } catch (error) {
      console.error('Error declining partner request:', error);
      if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to decline this request');
      }
      throw new Error('Failed to decline the request. Please try again.');
    }
  };

  // Setup database listeners with improved connection handling
  const setupDatabaseListeners = async (user) => {
    if (!user) return;

    try {
      // Set up presence system with retry logic
      presenceRef.current = ref(rtdb, '.info/connected');
      userStatusRef.current = ref(rtdb, `connections/${user.uid}`);
      const userPresenceRef = ref(rtdb, `presence/${user.uid}`);

      const presenceUnsubscribe = onValue(presenceRef.current, async (snapshot) => {
        try {
          if (!snapshot.val()) {
            setConnectionState('disconnected');
            return;
          }

          setConnectionState('connected');
          connectionRetryCount.current = 0;

          // Set up disconnect handlers with validation
          await withConnectionRetry(async () => {
            const disconnectRef = onDisconnect(userStatusRef.current);
            await disconnectRef.remove();

            const presenceDisconnectRef = onDisconnect(userPresenceRef);
            await presenceDisconnectRef.update({
              isOnline: false,
              lastOnline: serverTimestamp()
            });
          });

          // Check if there's an existing partnership
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().partnerId) {
            const partnerId = userDoc.data().partnerId;
            
            // Set current connection status with retry
            await withConnectionRetry(async () => {
              await set(userStatusRef.current, {
                partnerId: partnerId,
                lastActive: serverTimestamp(),
                status: 'online',
                connectionId: Date.now().toString() // Add unique connection ID
              });

              await set(userPresenceRef, {
                isOnline: true,
                lastOnline: serverTimestamp(),
                connectionId: Date.now().toString()
              });
            });

            // Set up partner monitoring with improved error handling
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
              setPartner(partnerDoc.data());

              const partnerPresenceRef = ref(rtdb, `presence/${partnerId}`);
              const partnerPresenceUnsubscribe = onValue(partnerPresenceRef, (presenceSnapshot) => {
                if (presenceSnapshot.exists()) {
                  const presenceData = presenceSnapshot.val();
                  setPartner(current => ({
                    ...current,
                    isOnline: presenceData.isOnline,
                    lastOnline: presenceData.lastOnline,
                    connectionId: presenceData.connectionId
                  }));
                }
              });

              // Monitor partner connection with improved validation
              const partnerConnectionRef = ref(rtdb, `connections/${partnerId}`);
              const partnerConnectionUnsubscribe = onValue(partnerConnectionRef, async (connectionSnapshot) => {
                if (!connectionSnapshot.exists()) {
                  // Validate disconnection before clearing partnership
                  const freshPartnerDoc = await getDoc(doc(db, 'users', partnerId));
                  if (!freshPartnerDoc.exists() || !freshPartnerDoc.data().partnerId) {
                    // Partner has truly disconnected - update both users
                    const batch = writeBatch(db);
                    
                    // Update current user's document
                    const currentUserRef = doc(db, 'users', user.uid);
                    batch.update(currentUserRef, {
                      partnerId: null,
                      partnerDisplayName: null,
                      lastUpdated: Timestamp.now()
                    });
                    
                    // Update partner's document
                    const partnerRef = doc(db, 'users', partnerId);
                    batch.update(partnerRef, {
                      partnerId: null,
                      partnerDisplayName: null,
                      lastUpdated: Timestamp.now()
                    });

                    try {
                      await withConnectionRetry(async () => {
                        await batch.commit();
                        await remove(userStatusRef.current);
                        await update(userPresenceRef, {
                          isOnline: true,
                          lastOnline: serverTimestamp()
                        });
                      });

                      setPartner(null);
                      setDisconnectMessage(`${partnerDoc.data().displayName || 'Your partner'} has disconnected`);
                    } catch (err) {
                      console.warn('Error handling partner disconnect:', err);
                    }
                  }
                }
              });

              listenerCleanups.current.push(partnerPresenceUnsubscribe);
              listenerCleanups.current.push(partnerConnectionUnsubscribe);
            }
          } else {
            // Set basic connection status if no partner
            await withConnectionRetry(async () => {
              await set(userStatusRef.current, {
                lastActive: serverTimestamp(),
                status: 'online',
                connectionId: Date.now().toString()
              });

              await set(userPresenceRef, {
                isOnline: true,
                lastOnline: serverTimestamp(),
                connectionId: Date.now().toString()
              });
            });
          }
        } catch (error) {
          console.error('Error in presence system:', error);
          if (connectionRetryCount.current < MAX_CONNECTION_RETRIES) {
            connectionRetryCount.current++;
            setTimeout(() => setupDatabaseListeners(user), CONNECTION_RETRY_DELAY);
          }
        }
      });

      listenerCleanups.current.push(presenceUnsubscribe);

      // Listen for partner updates in Firestore
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userUnsubscribe = createResilientSnapshot(
          userRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const userData = snapshot.data();
              if (!userData.partnerId) {
                // If partner ID is null, user has been disconnected
                setPartner(null);
                // Clean up RTDB connection
                await remove(userStatusRef.current);
              } else if (userData.partnerId && (!partner || partner.uid !== userData.partnerId)) {
                const partnerRef = doc(db, 'users', userData.partnerId);
                const partnerDoc = await getDoc(partnerRef);
                if (partnerDoc.exists()) {
                  setPartner(partnerDoc.data());
                }
              }
            }
          },
          (error) => {
            console.error('Error listening to user partner updates:', error);
          },
          'userPartnerUpdates'
        );

        listenerCleanups.current.push(userUnsubscribe);
      }
    } catch (error) {
      console.error('Error setting up database listeners:', error);
      if (connectionRetryCount.current < MAX_CONNECTION_RETRIES) {
        connectionRetryCount.current++;
        setTimeout(() => setupDatabaseListeners(user), CONNECTION_RETRY_DELAY);
      }
    }
  };

  // Cleanup database listeners
  const cleanupDatabaseListeners = async () => {
    try {
      // Clean up all listeners
      listenerCleanups.current.forEach(cleanup => cleanup());
      listenerCleanups.current = [];

      // Clear all snapshot retry timers
      snapshotRetryTimers.current.forEach((timer) => clearTimeout(timer));
      snapshotRetryTimers.current.clear();

      // Clean up presence refs
      if (presenceRef.current) {
        off(presenceRef.current);
      }
      if (userStatusRef.current) {
        // Cancel any onDisconnect operations
        await onDisconnect(userStatusRef.current).cancel();
        // Remove the connection
        await remove(userStatusRef.current);
      }

      // Reset states
      setPartner(null);
      setActiveInviteCode(null);
      setDisconnectMessage(null);
    } catch (error) {
      console.error('Error cleaning up database listeners:', error);
    }
  };

  // Handle authentication errors
  const handleAuthError = (error) => {
    console.error('Auth error:', error);
    setError(null);
    let errorMessage = '';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password. Please try again.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled.';
        break;
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists.';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Email/password sign-in is not enabled.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid login credentials. Please check your email and password.';
        break;
      case 'auth/invalid-login-credentials':
        errorMessage = 'Invalid login credentials. Please check your email and password.';
        break;
      default:
        errorMessage = error.message || 'An error occurred during authentication.';
    }
    
    setError(errorMessage);
  };

  // Add persistence for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        try {
          // Get user data from Firestore
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          // Set basic user data immediately
          setUser({
            ...user,
            ...(userDoc.exists() ? userDoc.data() : {})
          });

          if (!userDoc.exists()) {
            // If user doc doesn't exist, create it
            try {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                createdAt: Timestamp.now(),
                lastLogin: Timestamp.now(),
                displayNameLower: (user.displayName || '').toLowerCase(),
                emailLower: user.email.toLowerCase()
              });
            } catch (error) {
              console.error('Error creating user document:', error);
              // Continue even if document creation fails
            }
          }

          // Set up real-time listener for user document changes (including partnerId)
          const userDocUnsubscribe = createResilientSnapshot(
            userRef,
            async (docSnapshot) => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                
                // Update user data
                setUser(prevUser => ({
                  ...prevUser,
                  ...userData
                }));

                // Check if partnerId changed and fetch partner data
                if (userData.partnerId) {
                  try {
                    const partnerRef = doc(db, 'users', userData.partnerId);
                    const partnerDoc = await getDoc(partnerRef);
                    if (partnerDoc.exists()) {
                      setPartner(partnerDoc.data());
                    }
                  } catch (error) {
                    console.error('Error fetching partner data:', error);
                  }
                } else {
                  // If partnerId is null, clear partner
                  setPartner(null);
                }

                // Update active invite code
                if (userData.inviteCodes && Array.isArray(userData.inviteCodes)) {
                  const now = new Date();
                  const activeCode = userData.inviteCodes
                    .filter(code => !code.used && code.expiresAt.toDate() > now)
                    .sort((a, b) => b.createdAt - a.createdAt)[0];
                  
                  if (activeCode) {
                    setActiveInviteCode({
                      code: activeCode.code,
                      expiresAt: activeCode.expiresAt
                    });
                  } else {
                    setActiveInviteCode(null);
                  }
                }
              }
            },
            (error) => {
              console.error('Error listening to user document:', error);
            },
            'userDocument'
          );

          // Store unsubscribe function in cleanup array
          listenerCleanups.current.push(userDocUnsubscribe);

          // Try to set up database listeners, but don't let failure affect auth state
          try {
            await setupDatabaseListeners(user);
          } catch (error) {
            console.error('Error setting up database listeners:', error);
            // Continue even if listener setup fails
          }
        } catch (error) {
          console.error('Error in auth state restoration:', error);
          // Set basic user data even if other operations fail
          setUser(user);
        }
      } else {
        // User is signed out
        setUser(null);
        setPartner(null);
        setActiveInviteCode(null);
        try {
          await cleanupDatabaseListeners();
        } catch (error) {
          console.error('Error cleaning up listeners:', error);
        }
      }
      setIsLoading(false);
    });

    // Set up online/offline detection
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        enableNetwork(db).catch(console.error);
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      cleanupDatabaseListeners();
    };
  }, []);

  // Initialize user data after sign up or sign in
  const initializeUserData = async (user) => {
    if (!user) return;
    
    try {
      // Clear any existing notifications for new users
      const notificationsRef = ref(rtdb, `notifications/${user.uid}`);
      await set(notificationsRef, null);

      // Clear any existing connections
      const connectionsRef = ref(rtdb, `connections/${user.uid}`);
      await set(connectionsRef, null);

      // Initialize user settings with defaults
      const userSettingsRef = ref(rtdb, `userSettings/${user.uid}`);
      const defaultSettings = {
        notifications: {
          chatMessages: true,
          topicResponses: true,
          systemNotifications: true
        },
        theme: {
          preference: 'light',
          updatedAt: serverTimestamp()
        },
        privacy: {
          showProfile: true,
          anonymousNotes: false
        },
        profile: {
          displayName: user.displayName || '',
          email: user.email || '',
          updatedAt: serverTimestamp()
        }
      };

      // Only set if not exists
      const snapshot = await get(userSettingsRef);
      if (!snapshot.exists()) {
        await set(userSettingsRef, defaultSettings);
      } else {
        // Update any missing sections while preserving existing settings
        const currentSettings = snapshot.val();
        const updatedSettings = {
          notifications: { ...defaultSettings.notifications, ...currentSettings?.notifications },
          theme: { ...defaultSettings.theme, ...currentSettings?.theme },
          privacy: { ...defaultSettings.privacy, ...currentSettings?.privacy },
          profile: { ...defaultSettings.profile, ...currentSettings?.profile }
        };
        await update(userSettingsRef, updatedSettings);
      }

      // Clear partner state
      setPartner(null);
      setDisconnectMessage(null);
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  const signIn = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      // Trim the email to remove any accidental spaces
      const trimmedEmail = email.trim();
      
      // Set persistence first
      await setPersistence(auth, browserLocalPersistence);
      
      // Attempt to sign in
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      // Get user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Create the user document if it doesn't exist
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          createdAt: Timestamp.now(),
          lastLogin: Timestamp.now(),
          displayNameLower: (user.displayName || '').toLowerCase(),
          emailLower: user.email.toLowerCase()
        });
      } else {
        try {
          // Try to update last login
          await updateDoc(userRef, {
            lastLogin: Timestamp.now()
          });
        } catch (updateError) {
          // If we can't update lastLogin, just log it and continue
          console.warn('Could not update lastLogin:', updateError);
        }
      }

      // Initialize user data
      await initializeUserData(user);
      
      setIsLoading(false);
      return userCredential;
    } catch (err) {
      console.error('Sign in error:', err);
      setIsLoading(false);
      handleAuthError(err);
      throw err;
    }
  };

  const signUp = async (email, password, displayName) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Set display name
      await updateProfile(userCredential.user, { displayName });
      
      // Initialize user data
      await initializeUserData(userCredential.user);
      
      return userCredential;
    } catch (err) {
      handleAuthError(err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      setError(null);
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const connectPartner = async (inviteCode) => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      if (!user) {
        throw new Error('You must be logged in to connect with a partner.');
      }

      if (partner?.uid) {
        throw new Error('You are already connected with a partner. Please disconnect first.');
      }

      // Normalize the invite code
      const normalizedCode = inviteCode.trim().toUpperCase();

      // Use atomic transaction to prevent race conditions
      const result = await runTransaction(db, async (transaction) => {
        // Find the user with this invite code atomically
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        let partnerDocRef = null;
        let partnerData = null;
        let validCodeIndex = -1;
        
        // Add buffer time to account for slight time differences
        const now = new Date();
        now.setMinutes(now.getMinutes() - 1); // 1 minute buffer
        
        // Search through all users to find matching invite code
        for (const docSnapshot of querySnapshot.docs) {
          const userData = docSnapshot.data();
          if (userData.inviteCodes && Array.isArray(userData.inviteCodes)) {
            const codeIndex = userData.inviteCodes.findIndex(code => {
              const isMatch = code.code === normalizedCode;
              const isUnused = !code.used;
              const expiryDate = code.expiresAt.toDate();
              const isNotExpired = expiryDate > now;
              
              return isMatch && isUnused && isNotExpired;
            });
            
            if (codeIndex !== -1) {
              partnerDocRef = doc(db, 'users', docSnapshot.id);
              partnerData = { id: docSnapshot.id, ...userData };
              validCodeIndex = codeIndex;
              break;
            }
          }
        }

        if (!partnerData) {
          throw new Error('Invalid or expired invite code. Please try again with a valid code.');
        }

        if (partnerData.id === user.uid) {
          throw new Error('You cannot connect with yourself.');
        }

        // Read current state of both documents in transaction
        const userRef = doc(db, 'users', user.uid);
        const currentUserDoc = await transaction.get(userRef);
        const currentPartnerDoc = await transaction.get(partnerDocRef);

        if (!currentUserDoc.exists() || !currentPartnerDoc.exists()) {
          throw new Error('User documents not found.');
        }

        const currentUserData = currentUserDoc.data();
        const currentPartnerData = currentPartnerDoc.data();

        // Double-check the code is still valid and unused
        const currentCode = currentPartnerData.inviteCodes?.[validCodeIndex];
        if (!currentCode || currentCode.used || currentCode.code !== normalizedCode) {
          throw new Error('Invite code has already been used or is no longer valid.');
        }

        // Check if either user is already connected
        if (currentUserData.partnerId) {
          throw new Error('You are already connected with a partner. Please disconnect first.');
        }

        if (currentPartnerData.partnerId) {
          throw new Error('This partner is already connected with someone else.');
        }

        // Update invite codes array with the code marked as used
        const updatedInviteCodes = [...currentPartnerData.inviteCodes];
        updatedInviteCodes[validCodeIndex] = {
          ...currentCode,
          used: true,
          usedBy: user.uid,
          usedAt: Timestamp.now()
        };

        // Atomically update both users
        transaction.update(userRef, {
          partnerId: partnerData.id,
          partnerDisplayName: partnerData.displayName,
          lastUpdated: Timestamp.now()
        });

        transaction.update(partnerDocRef, {
          inviteCodes: updatedInviteCodes,
          partnerId: user.uid,
          partnerDisplayName: user.displayName,
          lastUpdated: Timestamp.now()
        });

        return partnerData;
      });

      const partnerDoc = result;

      // Wait a moment for Firestore to propagate the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      // First update current user's connection status
      const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
      await set(userConnectionRef, {
        partnerId: partnerDoc.id,
        lastActive: serverTimestamp(),
        status: 'online'
      });

      // Send a notification to partner about the connection
      try {
        const notificationRef = ref(rtdb, `notifications/${partnerDoc.id}`);
        await update(notificationRef, {
          [Date.now()]: {
            type: 'partner_connected',
            message: `${user.displayName || 'A new partner'} has connected with you`,
            timestamp: serverTimestamp()
          }
        });
      } catch (err) {
        console.warn('Error sending connection notification:', err);
      }

      // Set up database listeners for the new partnership
      await setupDatabaseListeners(user);

      // Force refresh current user data to reflect partnership
      const userRef = doc(db, 'users', user.uid);
      const freshUserDoc = await getDoc(userRef);
      if (freshUserDoc.exists()) {
        const freshUserData = freshUserDoc.data();
        setUser(prevUser => ({
          ...prevUser,
          ...freshUserData
        }));
      }

      // Get fresh partner data and update state
      const partnerRef = doc(db, 'users', partnerDoc.id);
      const freshPartnerDoc = await getDoc(partnerRef);
      if (freshPartnerDoc.exists()) {
        setPartner({
          uid: partnerDoc.id,
          ...freshPartnerDoc.data()
        });
      }

      return partnerDoc.id;
    } catch (err) {
      console.error('Error connecting with partner:', err);
      setError(err.message);
      throw err;
    }
  };

  const generateInviteCode = async () => {
    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }

      if (!user) {
        throw new Error('You must be logged in to generate an invite code.');
      }

      if (partner?.uid) {
        throw new Error('You are already connected with a partner. Please disconnect first to generate a new code.');
      }

      // Generate a cryptographically secure code with collision detection
      const generateSecureCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const array = new Uint8Array(6);
        crypto.getRandomValues(array);
        return Array.from(array, byte => chars[byte % chars.length]).join('');
      };

      // Try up to 10 times to generate a unique code
      let code;
      let attempts = 0;
      const maxAttempts = 10;
      const now = Timestamp.now();
      // Add 10 minutes instead of 5 to account for time differences
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + (10 * 60 * 1000))); 

      // Get current user document
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Filter out expired and used codes (this also cleans up the document)
        const validCodes = (userData.inviteCodes || []).filter(existingCode => 
          !existingCode.used && existingCode.expiresAt.toDate() > now.toDate()
        );

        // Clean up expired codes if there are many accumulated
        const totalCodes = (userData.inviteCodes || []).length;
        if (totalCodes > validCodes.length + 5) {
          // If we have more than 5 expired codes, clean them up
          await updateDoc(userRef, {
            inviteCodes: validCodes
          });
        }

        // Generate unique code with collision detection
        while (attempts < maxAttempts) {
          code = generateSecureCode();
          
          // Check for collisions in all users' invite codes
          const usersRef = collection(db, 'users');
          const querySnapshot = await getDocs(usersRef);
          let codeExists = false;
          
          for (const doc of querySnapshot.docs) {
            const docData = doc.data();
            if (docData.inviteCodes && Array.isArray(docData.inviteCodes)) {
              const hasMatchingCode = docData.inviteCodes.some(existingCode => 
                existingCode.code === code && 
                !existingCode.used && 
                existingCode.expiresAt.toDate() > now.toDate()
              );
              if (hasMatchingCode) {
                codeExists = true;
                break;
              }
            }
          }
          
          if (!codeExists) {
            break; // Found unique code
          }
          
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Unable to generate a unique invite code. Please try again.');
        }
        
        // Create the new invite code object
        const newInviteCode = {
          code,
          createdBy: user.uid,
          createdAt: now,
          expiresAt,
          used: false
        };
        
        // Update with cleaned up codes array plus new code
        await updateDoc(userRef, {
          inviteCodes: [...validCodes, newInviteCode]
        });

        // Set activeInviteCode with the Timestamp object directly
        setActiveInviteCode({
          code,
          expiresAt
        });
        
        setError(null);
        return newInviteCode;
      }
      
      throw new Error('User document not found');
    } catch (err) {
      console.error('Error generating invite code:', err);
      setError(err.message || 'Failed to generate invite code');
      throw err;
    }
  };

  const disconnectPartner = async () => {
    try {
      if (!user) {
        throw new Error('You must be logged in to disconnect.');
      }

      if (!partner?.uid) {
        throw new Error('You are not currently connected with a partner.');
      }

      const partnerId = partner.uid;
      const partnerName = partner.displayName || 'Your partner';

      // First, update Firestore documents atomically
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', user.uid);
      const partnerRef = doc(db, 'users', partnerId);

      batch.update(userRef, {
        partnerId: null,
        partnerDisplayName: null,
        lastUpdated: Timestamp.now()
      });

      batch.update(partnerRef, {
        partnerId: null,
        partnerDisplayName: null,
        lastUpdated: Timestamp.now()
      });

      // Clean up RTDB connections first
      const userConnectionRef = ref(rtdb, `connections/${user.uid}`);
      const partnerConnectionRef = ref(rtdb, `connections/${partnerId}`);
      
      // Update presence data
      const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
      const partnerPresenceRef = ref(rtdb, `presence/${partnerId}`);

      // Execute all updates in parallel
      await Promise.all([
        remove(userConnectionRef),
        remove(partnerConnectionRef),
        update(userPresenceRef, {
          isOnline: true,
          lastOnline: serverTimestamp(),
          connectionId: Date.now().toString()
        }),
        update(partnerPresenceRef, {
          lastOnline: serverTimestamp()
        }),
        batch.commit()
      ]);

      // Send notification to partner about disconnection
      try {
        const notificationRef = ref(rtdb, `notifications/${partnerId}`);
        await update(notificationRef, {
          [Date.now()]: {
            type: 'partner_disconnected',
            message: `${user.displayName || 'Your partner'} has disconnected`,
            timestamp: serverTimestamp()
          }
        });
      } catch (err) {
        console.warn('Error sending disconnect notification:', err);
      }

      // Force cleanup of all listeners
      await cleanupDatabaseListeners();

      // Update local state last
      setPartner(null);
      setActiveInviteCode(null);
      setError(null);
      setDisconnectMessage(`You have disconnected from ${partnerName}`);

    } catch (err) {
      console.error('Error disconnecting partner:', err);
      setError(err.message);
      throw err;
    }
  };

  const clearDisconnectMessage = () => {
    setDisconnectMessage(null);
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Configure Google provider
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      // First set persistence to LOCAL
      await setPersistence(auth, browserLocalPersistence);

      // Use signInWithPopup instead of redirect for better UX
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in database
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Create new user profile in database
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.now(),
          emailVerified: true,
          lastLogin: Timestamp.now(),
          displayNameLower: (user.displayName || '').toLowerCase(),
          emailLower: user.email.toLowerCase()
        };

        await setDoc(userRef, userData);

        // Initialize user data after creation
        await initializeUserData(user);

        toast.success(
          `Welcome to Choice, ${user.displayName || 'new user'}! 👋`,
          {
            duration: 5000,
            position: 'top-center',
          }
        );
      } else {
        // Update existing user's last login
        await updateDoc(userRef, {
          lastLogin: Timestamp.now(),
          emailVerified: true
        });

        // Ensure user data is properly initialized
        await initializeUserData(user);
      }

      setIsLoading(false);
      return user;

    } catch (error) {
      console.error('Sign in error:', error);
      setIsLoading(false);

      let errorMessage = 'Failed to sign in with Google. Please try again.';

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with the same email address but different sign-in credentials. Please sign in using the original method.';
      }

      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-center',
      });

      setError(errorMessage);
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setError(null);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const value = {
    user,
    partner,
    activeInviteCode,
    setActiveInviteCode,
    login: signIn,
    logout,
    signup: signUp,
    connectPartner,
    generateInviteCode,
    disconnectPartner,
    disconnectMessage,
    clearDisconnectMessage,
    isLoading,
    error,
    isOnline,
    signInWithGoogle,
    resetPassword,
    searchUsers,
    sendPartnerRequest,
    acceptPartnerRequest,
    declinePartnerRequest,
    pendingRequests
  };

  // Only show loading for initial auth check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 