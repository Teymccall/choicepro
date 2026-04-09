# Firestore Connection Error Fix

## Problem
The application was experiencing `ERR_CONNECTION_CLOSED` errors with Firestore WebChannel connections:
```
Could not reach Cloud Firestore backend. Backend didn't respond within 10 seconds.
WebChannelConnection RPC 'Listen' stream transport errored
```

## Root Cause
1. **WebChannel Connection Instability**: Firebase SDK v11.2.0 uses HTTP/2 long-polling (WebChannel) for real-time listeners, which can fail due to:
   - Network instability or firewall/proxy interference
   - CORS or security policies blocking WebChannel connections
   - Connection timeout issues (default 10 seconds)
   - Too many concurrent listeners causing connection exhaustion

2. **Missing Error Recovery**: Snapshot listeners had no retry logic for transient network errors

3. **No Connection State Monitoring**: The app couldn't detect or respond to Firestore connection state changes

## Solution Implemented

### 1. Firestore Configuration (`src/firebase/config.js`)
- **Enabled Long-Polling**: Set `experimentalForceLongPolling: true` to use more stable HTTP long-polling instead of WebSocket/WebChannel
- **Auto-Detection**: Added `experimentalAutoDetectLongPolling: true` for automatic fallback
- **Persistent Cache**: Configured `persistentLocalCache` with `persistentMultipleTabManager` for better offline support and multi-tab compatibility
- **Connection Monitoring**: Added real-time connection state tracking with online/offline event listeners

### 2. Resilient Snapshot Listeners (`src/context/AuthContext.js`)
Created `createResilientSnapshot()` helper function that:
- **Automatic Retry**: Implements exponential backoff retry logic (1s, 2s, 4s delays)
- **Error Handling**: Distinguishes between retryable errors (network) and permanent errors (permission-denied)
- **Cleanup Management**: Properly cleans up retry timers and listeners
- **Connection Awareness**: Integrates with Firestore connection state monitoring

### 3. Updated All Snapshot Listeners
Applied resilient listeners to:
- Partner requests monitoring
- User pending requests
- Sent requests status changes
- Incoming partner requests
- User document changes
- Partner updates in setupDatabaseListeners

### 4. Enhanced Cleanup
- Clear all snapshot retry timers on component unmount
- Properly unsubscribe from all listeners
- Reset connection state

## Benefits
✅ **Stable Connections**: Long-polling is more reliable across different network conditions  
✅ **Automatic Recovery**: Listeners automatically retry on transient failures  
✅ **Better Offline Support**: Persistent cache works seamlessly across tabs  
✅ **Connection Visibility**: App can detect and respond to connection state changes  
✅ **Resource Management**: Proper cleanup prevents memory leaks  

## Testing
1. **Network Interruption**: Disconnect/reconnect internet - listeners should auto-recover
2. **Multiple Tabs**: Open app in multiple tabs - should work without conflicts
3. **Slow Network**: Test on throttled connection - should handle timeouts gracefully
4. **Firewall/Proxy**: Works behind restrictive network policies that block WebSockets

## Configuration Details

### Before
```javascript
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(console.error);
```

### After
```javascript
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

## Monitoring
The app now exports `onFirestoreConnectionStateChange()` to monitor connection state:
- `initializing` - Starting up
- `connected` - Active connection
- `reconnecting` - Attempting to reconnect
- `offline` - No network connection

## Notes
- Long-polling uses more bandwidth than WebSockets but is more compatible
- Retry logic prevents infinite loops with max 3 attempts
- Permission errors are not retried (they're permanent)
- All timers are properly cleaned up to prevent memory leaks
