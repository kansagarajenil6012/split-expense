import admin from 'firebase-admin';

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    } else {
      // Defaults to application default credentials
      admin.initializeApp();
    }
  }
} catch (err) {
  console.error('Firebase Admin initialization error:', err);
}

export const verifyFirebaseToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw new Error('Invalid Firebase token');
  }
};

export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;
  try {
    const message = {
      notification: { title, body },
      data,
      token: fcmToken,
    };
    await admin.messaging().send(message);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
