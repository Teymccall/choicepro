# 📱 Phone Call Issues - Complete Fix Guide

## 🔴 Problem: Calls Work Locally But Fail on Phone After Deploy

You mentioned:
- ✅ Environment variables are imported to Vercel
- ❌ Calls still fail on phone after deployment
- ✅ Calls work on laptop/local

---

## 🎯 Root Causes for Phone-Specific Call Failures

### 1. **Browser Permissions on Mobile**
Mobile browsers are MUCH stricter about camera/microphone permissions than desktop.

### 2. **HTTPS Requirement**
`getUserMedia()` (camera/mic access) is **BLOCKED on HTTP** on mobile browsers for security.

### 3. **Mobile Browser Compatibility**
Some mobile browsers handle WebRTC differently than desktop.

### 4. **Network/Firewall Issues**
Mobile networks often have stricter NAT/firewall rules.

### 5. **Autoplay Policies**
Mobile browsers block autoplay of audio/video without user interaction.

---

## ✅ Solutions

### Solution 1: Ensure HTTPS is Enabled

**Check your Vercel deployment:**
1. Go to Vercel dashboard
2. Check your domain - should be `https://your-app.vercel.app`
3. If using custom domain, ensure SSL certificate is active

**Vercel automatically provides HTTPS**, so this should be fine.

---

### Solution 2: Add User Gesture Requirement

Mobile browsers require a **user gesture** (tap/click) before accessing camera/mic.

**Already implemented in your code:**
- ✅ Call buttons require user tap
- ✅ Permission prompt before accessing media

---

### Solution 3: Fix Media Autoplay on Mobile

Add this to ensure remote audio/video plays on mobile:

**File: `src/utils/webRTC.js`**

Find the section where remote video is set (around line 226-250), and ensure it has:

```javascript
this.remoteVideoRef.current.muted = false;
this.remoteVideoRef.current.autoplay = true;
this.remoteVideoRef.current.playsInline = true; // CRITICAL for iOS
```

**Status:** ✅ Already implemented - `playsInline` is set on all video/audio elements

---

### Solution 4: Check Xirsys TURN Server Credentials

Your TURN server credentials might be expired or hitting rate limits.

**Test if TURN server is working:**
1. Go to: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Add your TURN server:
   ```
   turn:us-turn4.xirsys.com:80?transport=udp
   Username: Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=
   Credential: d426b328-aef1-11f0-a45f-0242ac140004
   ```
3. Click "Gather candidates"
4. Look for "relay" type candidates
5. If you see "relay" candidates, TURN server is working
6. If not, credentials are expired

**If TURN server is not working:**
1. Login to https://xirsys.com
2. Go to your account dashboard
3. Check if credentials are still valid
4. Generate new credentials if needed
5. Update `.env.example` and Vercel environment variables

---

### Solution 5: Add Mobile-Specific Error Handling

Mobile browsers fail differently than desktop. Let's add better error messages:

**File: `src/utils/webRTC.js`**

The `initializeMedia` function already has good error handling, but let's verify it catches mobile-specific errors.

---

### Solution 6: Check Firebase Realtime Database Rules

If calls data isn't syncing properly on mobile:

**Check Firebase Console:**
1. Go to Firebase Console → Realtime Database
2. Click "Rules" tab
3. Ensure rules allow read/write for authenticated users:
   ```json
   {
     "rules": {
       "calls": {
         ".read": "auth != null",
         ".write": "auth != null"
       }
     }
   }
   ```

---

## 🧪 Debugging Steps for Phone

### Step 1: Check Browser Console on Phone

**On iPhone (Safari):**
1. Settings → Safari → Advanced → Web Inspector (enable)
2. Connect iPhone to Mac
3. Open Safari on Mac → Develop → [Your iPhone] → [Your Site]
4. Make a call and watch console

**On Android (Chrome):**
1. Enable USB Debugging on phone
2. Connect to computer
3. Open Chrome → chrome://inspect
4. Find your device and click "Inspect"
5. Make a call and watch console

**Look for these errors:**
- `NotAllowedError` = User denied permissions
- `NotFoundError` = No camera/mic found
- `NotReadableError` = Device in use by another app
- `OverconstrainedError` = Constraints not supported
- `SecurityError` = HTTPS required or insecure context

---

### Step 2: Test Call Flow

Make a call and check console for this sequence:

**Caller side:**
```
🎬 Initializing media with constraints: {video: true, audio: true}
✅ Local stream created: ['video', 'audio']
📝 Creating offer...
✅ Offer created
✅ Call created in Firebase
ICE connection state: checking
ICE connection state: connected
Connection state: connected
```

**Answerer side (PHONE):**
```
🎬 Initializing media for answering call...
✅ Media initialized successfully
📝 Creating answer...
✅ Answer created
✅ Call status updated to active in Firebase
🎉 Call answered successfully
ICE connection state: checking
ICE connection state: connected
Connection state: connected
```

**If you see:**
- ❌ `Connection state: failed` → TURN server issue
- ❌ `ICE connection state: failed` → Network/firewall issue
- ❌ `NotAllowedError` → Permissions denied
- ❌ `Call failed` toast → Check previous console errors

---

### Step 3: Test on Different Networks

**Try calling on:**
1. ✅ WiFi (both devices)
2. ✅ Mobile data (both devices)
3. ✅ WiFi (one) + Mobile data (other)

**If fails on mobile data but works on WiFi:**
- Mobile carrier is blocking WebRTC ports
- TURN server is required (should already be configured)
- Check TURN server is actually being used (see Step 4)

---

### Step 4: Verify TURN Server is Being Used

**In Chrome DevTools (on phone via remote debugging):**
1. Make a call
2. Go to: `chrome://webrtc-internals`
3. Find your peer connection
4. Look for "googRemoteCandidateType"
5. Should see: `googRemoteCandidateType: relay`
6. If you see `host` or `srflx` only, TURN server isn't working

---

## 🔧 Quick Fixes to Try

### Fix 1: Force TURN Server Usage

**File: `src/utils/webRTC.js` (line 59)**

Change:
```javascript
iceTransportPolicy: 'all'   // Use all candidates (STUN + TURN)
```

To:
```javascript
iceTransportPolicy: 'relay'   // Force TURN server (for testing)
```

**⚠️ Warning:** This forces ALL traffic through TURN server (slower, uses more bandwidth). Only use for testing.

---

### Fix 2: Increase ICE Gathering Timeout

**File: `src/hooks/useWebRTC.js`**

Add timeout for ICE gathering:

```javascript
// After creating offer/answer, wait for ICE candidates
await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
```

This gives more time for TURN candidates to be gathered.

---

### Fix 3: Add Mobile Browser Detection

**File: `src/utils/webRTC.js`**

Add at the top:

```javascript
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// In initializeMedia, adjust constraints for mobile:
if (isMobile && constraints.video) {
  constraints.video = {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 }
  };
}
```

This uses lower resolution on mobile (faster, more reliable).

---

## 🎯 Most Likely Causes (In Order)

### 1. **TURN Server Credentials Expired** (80% likely)
- Xirsys free tier credentials expire
- Check Xirsys dashboard
- Generate new credentials

### 2. **Mobile Network Blocking WebRTC** (15% likely)
- Some carriers block WebRTC
- Test on WiFi vs mobile data
- TURN server should bypass this

### 3. **Browser Permissions** (3% likely)
- User denied camera/mic
- Check browser settings
- Clear site data and retry

### 4. **Firebase Rules** (1% likely)
- Calls data not syncing
- Check Firebase console
- Verify rules allow authenticated access

### 5. **Code Issue** (1% likely)
- Already fixed in previous updates
- Proper sequencing implemented
- Error handling added

---

## ✅ Action Plan

### Do This Right Now:

1. **Test TURN Server** (5 minutes)
   - Go to https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
   - Add your TURN credentials
   - Check if you get "relay" candidates
   - If not, TURN server is the problem

2. **Check Xirsys Dashboard** (2 minutes)
   - Login to https://xirsys.com
   - Check account status
   - Check usage limits
   - Generate new credentials if needed

3. **Remote Debug Phone** (10 minutes)
   - Connect phone to computer
   - Open remote debugging
   - Make a call
   - Watch console for errors

4. **Test on WiFi** (2 minutes)
   - Make sure both devices on WiFi
   - Try call again
   - If works on WiFi but not mobile data → TURN issue

---

## 📱 Expected Behavior

### What Should Happen:
1. User taps call button
2. Browser asks for camera/mic permission
3. User grants permission
4. "Calling..." toast appears
5. Other phone receives call notification
6. User answers
7. "Call connected" toast appears
8. Audio/video works both ways
9. Call stays connected

### What's Happening (Your Issue):
1. ✅ User taps call button
2. ✅ Browser asks for permission
3. ✅ User grants permission
4. ✅ "Calling..." toast appears
5. ✅ Other phone receives call
6. ✅ User answers
7. ❌ "Call failed" toast appears immediately
8. ❌ Call disconnects

**This pattern suggests:** Media initialization or ICE negotiation failing on the answering side.

---

## 🔍 Root Cause Analysis

Based on your description ("after the person picks up it hangs up saying call fail"), the issue is:

**The call connects initially, but fails during the answer phase.**

This is typically caused by:
1. ✅ **FIXED:** Call status set before media ready (we fixed this)
2. ❌ **POSSIBLE:** TURN server not working (check this)
3. ❌ **POSSIBLE:** ICE candidates not exchanging properly
4. ❌ **POSSIBLE:** Mobile browser blocking media after initial grant

---

## 🚀 Next Steps

1. **Check TURN server** (most likely issue)
2. **Remote debug phone** to see actual error
3. **Test on WiFi** to rule out network issues
4. **Report back** with console errors

Once you check the TURN server and remote debug, we'll know exactly what's failing!
