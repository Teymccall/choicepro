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

### Xirsys Configuration (for WebRTC TURN servers - audio/video calls)
```
REACT_APP_XIRSYS_TURN_HOST=us-turn4.xirsys.com
REACT_APP_XIRSYS_USERNAME=Qygb8w_JAXvSFABvD9kfDS2vKIZhsaFJ--cowjIjrhUIpWpoAFzIN-vd-ojkvd6xAAAAAGj4RmN0ZXltY2NhbGw=
REACT_APP_XIRSYS_CREDENTIAL=d426b328-aef1-11f0-a45f-0242ac140004
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
4. Audio/video calls connect successfully (WebRTC with Xirsys TURN)

## Troubleshooting

If deployment fails:
- Check all variable names match exactly (case-sensitive)
- Verify no extra spaces in values
- Ensure all variables are set for the correct environment
- Check build logs in Vercel dashboard
