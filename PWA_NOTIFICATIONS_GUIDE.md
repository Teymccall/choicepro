# PWA Push Notifications Guide

## Overview

The Choice App has **full PWA push notifications** already implemented using Firebase Cloud Messaging (FCM). Notifications work both when the app is:
- **In the foreground** (user is actively using the app)
- **In the background** (app is minimized or user is on another tab)
- **When app is closed** (app is completely closed)

## Current Implementation

### 1. Service Worker (`public/firebase-messaging-sw.js`)
Handles background notifications when the app is not in focus:
- Shows notifications with vibration
- Displays app icon and badge
- Provides "Open App" and "Dismiss" actions
- Handles notification clicks to open/focus the app

### 2. Notification Handler (`src/components/NotificationHandler.js`)
Manages notification permissions and foreground messages:
- Requests notification permission on login
- Stores FCM token in Firebase RTDB
- Listens for foreground messages
- Displays toast notifications when app is active

### 3. Firebase Configuration (`src/firebase/config.js`)
Provides core notification functionality:
- `requestNotificationPermission()` - Requests browser permission
- `onMessageListener()` - Listens for incoming messages
- Stores user FCM tokens for message targeting

## How It Works

### User Flow:
1. **User logs in** → NotificationHandler automatically requests notification permission
2. **Permission granted** → FCM token is generated and stored in database
3. **Message sent** → Firebase delivers notification to user's device
4. **User clicks notification** → App opens or focuses

### For Developers:
```javascript
// Sending a notification (backend/Firebase Functions)
const message = {
  notification: {
    title: 'New Message from Sarah',
    body: 'Hey! Want to grab coffee?'
  },
  data: {
    type: 'message',
    chatId: 'chat_123',
    senderId: 'user_456'
  },
  token: userFCMToken // Retrieved from database
};

await admin.messaging().send(message);
```

## Testing Notifications

### 1. **Using Firebase Console (Easiest)**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → **Cloud Messaging**
3. Click **"Send your first message"**
4. Fill in:
   - **Notification title**: Test Notification
   - **Notification text**: This is a test message
   - **Target**: Select **"User segment"** → **"All users"**
5. Click **"Test on device"** → Enter FCM token (from browser console)
6. Click **"Send test message"**

### 2. **Using cURL (Advanced)**
```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: Bearer YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "notification": {
      "title": "Test Notification",
      "body": "Testing push notifications"
    },
    "to": "USER_FCM_TOKEN"
  }'
```

### 3. **Check Browser Console**
When logged in, check console for:
```
✓ Notification permission granted
✓ FCM Token: xxxxxxxxxxxxxxxxx
✓ Token stored in database
```

## Troubleshooting

### Notifications Not Working?

#### 1. **Check Permission**
- Browser Settings → Site Settings → Notifications
- Ensure "Allow" is selected for your domain

#### 2. **Check Service Worker**
- Open DevTools → Application → Service Workers
- Verify `firebase-messaging-sw.js` is registered and activated

#### 3. **Check VAPID Key**
- Verify `REACT_APP_FIREBASE_VAPID_KEY` in environment variables
- Should match the key in Firebase Console → Project Settings → Cloud Messaging

#### 4. **Check Browser Support**
- Notifications work in Chrome, Firefox, Edge, Safari 16+
- iOS Safari requires iOS 16.4+ and "Add to Home Screen"

### iOS Specific

**iOS requires the PWA to be installed:**
1. Open app in Safari
2. Tap **Share** button
3. Select **"Add to Home Screen"**
4. Open app from home screen icon
5. Grant notification permission

## Environment Variables Required

```env
REACT_APP_FIREBASE_VAPID_KEY=BLwiJ4v1I6ICbjuVg1y03ASqrrKD8SEy8jS2KgbvzgY4GX6UwLZknHaNz50507OKQsKFJMwh_7nXwUACTmW5lig
```

This is already configured in `.env.example` and `VERCEL_ENV_SETUP.md`

## Notification Features

### Current Features:
- ✅ Push notifications (foreground & background)
- ✅ Vibration on mobile devices
- ✅ Click to open app
- ✅ Auto-focus if app already open
- ✅ Icon and badge display
- ✅ FCM token storage and management

### Future Enhancements:
- 📱 Rich notifications with images
- 🔔 Sound customization
- 🎯 Action buttons (Reply, Mark as Read)
- 📊 Notification analytics

## Security Notes

1. **FCM tokens are stored securely** in Firebase Realtime Database
2. **VAPID key is public** - safe to expose in client code
3. **Server key must remain private** - never expose in client code
4. **Tokens auto-refresh** - old tokens are replaced automatically

## Deployment Checklist

- [x] Service worker registered (`firebase-messaging-sw.js`)
- [x] NotificationHandler component active
- [x] Environment variables configured
- [x] VAPID key set correctly
- [x] Firebase project configured
- [ ] Test on production domain
- [ ] Test on mobile devices (iOS & Android)
- [ ] Verify HTTPS (required for notifications)

## Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
