# Vercel Environment Variables Setup Guide

## How to Set Environment Variables in Vercel

1. **Log in to Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Navigate to your project

2. **Navigate to Environment Variables**
   - Click on your project
   - Go to **Settings** → **Environment Variables**

3. **Add Each Variable**
   Copy and paste these variables one by one:

### Firebase Configuration
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

### Cloudinary Configuration (for media/voice notes upload)
```
REACT_APP_CLOUDINARY_CLOUD_NAME=dmfoxrq1v
REACT_APP_CLOUDINARY_UPLOAD_PRESET=choice_app_preset
```

### ZegoCloud Configuration (for audio/video calls)
```
REACT_APP_ZEGO_APP_ID=903806736
REACT_APP_ZEGO_SERVER_SECRET=fc435d143bdc4b960915f221edd52a12
```

## Quick Import Method

Alternatively, you can bulk import using the Vercel CLI:

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. From your project directory, run:
   ```bash
   vercel env pull .env.local
   ```

## Important Notes

- **Environment**: Select **Production**, **Preview**, and **Development** for all variables
- **Redeploy**: After adding environment variables, trigger a new deployment for changes to take effect
- **Security**: Never commit `.env` or `.env.local` files to Git - they're in `.gitignore`

## Verification

After deployment, verify:
1. Login works (Firebase Auth)
2. Voice notes can be recorded and sent (Cloudinary)
3. Push notifications work (Firebase Messaging)
4. Audio/video calls connect successfully (ZegoCloud)

## Troubleshooting

If deployment fails:
- Check all variable names match exactly (case-sensitive)
- Verify no extra spaces in values
- Ensure all variables are set for the correct environment
- Check build logs in Vercel dashboard
