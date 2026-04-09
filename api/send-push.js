const admin = require('firebase-admin');

// Initialize Firebase Admin based on Vercel Environment variables securely
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully via ENV');
    } else {
      console.error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT string:', error);
  }
}

export default async function handler(req, res) {
  // CORS setup for allowing frontend to securely ping this
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
  }

  try {
    const { token, title, body, data } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'FCM delivery token is required.' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin SDK failed to construct on Vercel server.' });
    }

    // Build the V1 FCM Payload format
    const message = {
      token: token,
      notification: {
        title: title || 'New Notification',
        body: body || 'You have a new message'
      },
      data: data || {},
      webpush: {
        fcmOptions: {
          link: '/' // When notification is clicked, send user to dashboard
        }
      }
    };

    // Blast the push payload to the FCM servers via secure backend authentication
    const response = await admin.messaging().send(message);
    
    console.log('Successfully pushed FCM notification:', response);
    return res.status(200).json({ success: true, messageId: response });
    
  } catch (error) {
    console.error('Error sending push notification via V1 API:', error);
    return res.status(500).json({ error: error.message, code: error.code });
  }
}
