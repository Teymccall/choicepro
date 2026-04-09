# Bug Fix: Circular Dependency Error

## 🐛 Error

```
useWebRTC.js:58 Uncaught ReferenceError: Cannot access 'endCall' before initialization
```

## 🔍 Root Cause

The `attemptReconnection` function was defined **before** `endCall`, but it tried to reference `endCall` in its dependency array and function body. This created a circular dependency:

```javascript
// ❌ BEFORE (BROKEN)
const attemptReconnection = useCallback(async () => {
  // ...
  setTimeout(() => {
    endCall(); // <-- endCall doesn't exist yet!
  }, 2000);
}, [endCall]); // <-- Trying to depend on endCall before it's defined

// ... (other code)

const endCall = useCallback(async () => {
  // ... defined later
}, [/* deps */]);
```

## ✅ Solution

Moved the reconnection logic **inline** within `initializeConnection` to avoid the circular dependency. Instead of calling `endCall()`, we now set `callStatus` to `'idle'`, which triggers cleanup naturally.

```javascript
// ✅ AFTER (FIXED)
const initializeConnection = useCallback(() => {
  // ...
  (state) => {
    if (state === 'disconnected' || state === 'failed') {
      // Inline reconnection logic
      if (callStatus === 'active' && reconnectionAttemptRef.current < MAX_RECONNECTION_ATTEMPTS) {
        reconnectionAttemptRef.current += 1;
        toast('Connection lost. Reconnecting...');
        // ... reconnection logic
      } else if (reconnectionAttemptRef.current >= MAX_RECONNECTION_ATTEMPTS) {
        toast.error('Connection lost. Call will end.');
        setTimeout(() => {
          setCallStatus('idle'); // <-- Triggers cleanup without calling endCall
        }, 2000);
      }
    }
  }
}, [callStatus, connectionQuality, MAX_RECONNECTION_ATTEMPTS]);
```

## 📝 Changes Made

**File:** `src/hooks/useWebRTC.js`

1. **Removed** the separate `attemptReconnection` function
2. **Moved** reconnection logic inline within `initializeConnection`
3. **Changed** from calling `endCall()` to setting `callStatus = 'idle'`
4. **Avoided** circular dependency by not referencing functions that don't exist yet

## ✅ Result

- ✅ No more circular dependency error
- ✅ App loads successfully
- ✅ Reconnection logic still works as intended
- ✅ Call cleanup happens naturally through state changes

## 🧪 Testing

The fix maintains the same functionality:
1. Connection drops → Reconnection attempts (up to 3)
2. Reconnection succeeds → "Connection restored!" toast
3. All attempts fail → "Connection lost. Call will end." → Call ends after 2 seconds

## 📚 Lesson Learned

When using `useCallback` with dependencies:
- ✅ **DO:** Define functions in order of dependency
- ✅ **DO:** Use inline logic when circular dependencies exist
- ✅ **DO:** Use state changes to trigger effects instead of direct function calls
- ❌ **DON'T:** Reference functions before they're defined
- ❌ **DON'T:** Create circular dependencies in callback hooks
