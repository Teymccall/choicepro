# 🚀 Vercel Deployment Guide - Environment Variables Setup

## ⚠️ CRITICAL: Why Calls Don't Work on Phone After Deploy

**Problem:** When you deploy to Vercel, the app uses **hardcoded fallback values** for TURN server credentials instead of reading from environment variables.

**Solution:** You MUST add environment variables to your Vercel project settings.

---

## 📋 Required Environment Variables

You need to add these to Vercel:

### 1. Firebase Configuration
```
REACT_APP_FIREBASE_API_KEY=AIzaSyBl5cdGzFmb4xxz-3inNjUbRI9AKhsw7SE
REACT_APP_FIREBASE_AUTH_DOMAIN=choice-4496c.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://choice-4496c-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=choice-4496c
REACT_APP_FIREBASE_STORAGE_BUCKET=choice-4496c.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=997107815311
REACT_APP_FIREBASE_APP_ID=1:997107815311:web:056bade42556f933faf1fa
REACT_APP_FIREBASE_MEASUREMENT_ID=G-FFDDRVPJRZ
REACT_APP_FIREBASE_VAPID_KEY=BLwiJ4v1I6ICbjuVg1y03ASqrrKD8SEy8jS2KgbvzgY4GX6UwLZknHaNz50507OKQsKFJMwh_7nXwUACTmW5lig
```

### 2. Cloudinary Configuration
```
REACT_APP_CLOUDINARY_CLOUD_NAME=dmfoxrq1v
REACT_APP_CLOUDINARY_UPLOAD_PRESET=choice_app_preset
```

### 3. Xirsys TURN Server (CRITICAL FOR CALLS!)
```
REACT_APP_XIRSYS_TURN_HOST=us-turn4.xirsys.com
REACT_APP_XIRSYS_USERNAME=Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=
REACT_APP_XIRSYS_CREDENTIAL=d426b328-aef1-11f0-a45f-0242ac140004
```

---

## 🔧 How to Add Environment Variables to Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `choice-App-main`

2. **Navigate to Settings**
   - Click on your project
   - Click "Settings" tab
   - Click "Environment Variables" in the left sidebar

3. **Add Each Variable**
   - Click "Add New" button
   - Enter variable name (e.g., `REACT_APP_XIRSYS_TURN_HOST`)
   - Enter variable value (e.g., `us-turn4.xirsys.com`)
   - Select environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

4. **Repeat for ALL variables above** (total: 13 variables)

5. **Redeploy**
   - Go to "Deployments" tab
   - Click "..." on latest deployment
   - Click "Redeploy"
   - ✅ Check "Use existing Build Cache"
   - Click "Redeploy"

---

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add REACT_APP_XIRSYS_TURN_HOST
# Enter value: us-turn4.xirsys.com
# Select: Production, Preview, Development

vercel env add REACT_APP_XIRSYS_USERNAME
# Enter value: Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=

vercel env add REACT_APP_XIRSYS_CREDENTIAL
# Enter value: d426b328-aef1-11f0-a45f-0242ac140004

# Repeat for all other variables...

# Redeploy
vercel --prod
```

---

### Method 3: Bulk Import (Fastest)

1. **Create a file called `vercel-env.txt`** with this content:

```
REACT_APP_FIREBASE_API_KEY=AIzaSyBl5cdGzFmb4xxz-3inNjUbRI9AKhsw7SE
REACT_APP_FIREBASE_AUTH_DOMAIN=choice-4496c.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://choice-4496c-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=choice-4496c
REACT_APP_FIREBASE_STORAGE_BUCKET=choice-4496c.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=997107815311
REACT_APP_FIREBASE_APP_ID=1:997107815311:web:056bade42556f933faf1fa
REACT_APP_FIREBASE_MEASUREMENT_ID=G-FFDDRVPJRZ
REACT_APP_FIREBASE_VAPID_KEY=BLwiJ4v1I6ICbjuVg1y03ASqrrKD8SEy8jS2KgbvzgY4GX6UwLZknHaNz50507OKQsKFJMwh_7nXwUACTmW5lig
REACT_APP_CLOUDINARY_CLOUD_NAME=dmfoxrq1v
REACT_APP_CLOUDINARY_UPLOAD_PRESET=choice_app_preset
REACT_APP_XIRSYS_TURN_HOST=us-turn4.xirsys.com
REACT_APP_XIRSYS_USERNAME=Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=
REACT_APP_XIRSYS_CREDENTIAL=d426b328-aef1-11f0-a45f-0242ac140004
```

2. **In Vercel Dashboard:**
   - Go to Settings → Environment Variables
   - Look for "Bulk Import" or "Import from .env"
   - Paste the content above
   - Select all environments
   - Click "Import"

---

## 🔍 How to Verify Environment Variables Are Set

### Check in Vercel Dashboard:
1. Go to Settings → Environment Variables
2. You should see all 13 variables listed
3. Each should show: Production ✅ Preview ✅ Development ✅

### Check After Deployment:
1. Open browser console on deployed site
2. Type: `console.log(process.env)`
3. You should see all `REACT_APP_*` variables

**⚠️ Note:** If you don't see them, you need to **redeploy** after adding variables!

---

## 🐛 Troubleshooting

### Issue: "Calls still don't work after adding variables"

**Solution:**
1. ✅ Verify variables are added to Vercel
2. ✅ Redeploy the project (important!)
3. ✅ Clear browser cache
4. ✅ Test on phone in incognito/private mode

### Issue: "TURN server not working"

**Check Xirsys Dashboard:**
1. Login to https://xirsys.com
2. Go to your account dashboard
3. Check if credentials are still valid
4. Check usage limits (free tier has limits)

**If expired, get new credentials:**
1. Generate new credentials in Xirsys
2. Update `.env.example` file
3. Update Vercel environment variables
4. Redeploy

### Issue: "Environment variables not loading"

**Common causes:**
- Variables added but project not redeployed
- Variable names have typos (must match exactly)
- Variables not selected for "Production" environment

**Fix:**
1. Double-check variable names (case-sensitive!)
2. Ensure all environments are selected
3. Trigger a new deployment

---

## 📱 Testing After Deployment

### Test 1: Check Variables Loaded
```javascript
// Open browser console on deployed site
console.log('TURN Host:', process.env.REACT_APP_XIRSYS_TURN_HOST);
console.log('Firebase:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
```

**Expected:** Should show actual values, not `undefined`

### Test 2: Make a Call
1. Open app on phone
2. Make a call to another device
3. Check browser console for:
   ```
   ✅ ICE connection established successfully
   Connection state: connected
   ```

### Test 3: Check TURN Server Usage
1. Make a call
2. Open Chrome DevTools → More Tools → WebRTC Internals
3. Look for "googRemoteCandidateType: relay"
4. If you see "relay", TURN server is working!

---

## 🎯 Quick Checklist

Before deploying:
- [ ] All 13 environment variables added to Vercel
- [ ] Variables selected for Production, Preview, Development
- [ ] Project redeployed after adding variables
- [ ] Browser cache cleared
- [ ] Tested on phone in incognito mode

After deploying:
- [ ] Console shows environment variables loaded
- [ ] Firebase connection works
- [ ] Cloudinary image upload works
- [ ] Calls connect successfully on phone
- [ ] No "call failed" errors

---

## 🚀 Complete Deployment Workflow

```bash
# 1. Commit your fixes
git add .
git commit -m "Fix: Call failures, chat UI, partner invitations"
git push origin main

# 2. Add environment variables to Vercel (via dashboard)
# - Go to vercel.com/dashboard
# - Settings → Environment Variables
# - Add all 13 variables
# - Select all environments

# 3. Trigger redeploy
# - Deployments tab
# - Click "Redeploy" on latest deployment

# 4. Wait for deployment to complete (~2-3 minutes)

# 5. Test on phone
# - Open deployed URL
# - Make a call
# - Should work without "call failed" error
```

---

## 💡 Pro Tips

### Tip 1: Use .env.local for local development
Create `.env.local` (not tracked by git) with your variables:
```bash
cp .env.example .env.local
```

### Tip 2: Keep .env.example updated
When you get new credentials, update `.env.example` so you have a reference.

### Tip 3: Monitor Xirsys usage
Free tier has limits. Check dashboard regularly to avoid hitting limits during important demos.

### Tip 4: Test locally first
Before deploying:
```bash
npm start
# Test calls on localhost
# If they work locally, they should work on Vercel (with correct env vars)
```

---

## 🔐 Security Note

**Never commit `.env` or `.env.local` to git!**

Your `.gitignore` should include:
```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

Only `.env.example` should be committed (with example/placeholder values).

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ Calls connect on phone without "call failed"
- ✅ Audio/video works both ways
- ✅ Calls stay connected (don't drop immediately)
- ✅ Console shows "ICE connection established successfully"
- ✅ No TURN server errors in console

---

**Last Updated:** October 22, 2025  
**Status:** Ready for Deployment

**Next Step:** Add environment variables to Vercel and redeploy! 🚀
