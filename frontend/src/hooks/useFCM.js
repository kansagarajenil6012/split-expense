import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { authApi } from '../services/api.js';
import { useAuthStore } from '../store/auth.store.js';
import app from '../lib/firebase.js';

export function useFCM() {
  const { user, refreshToken } = useAuthStore();

  useEffect(() => {
    // Only request and save FCM token if user is logged in
    if (!user || !refreshToken) return;

    const requestPermissionAndSaveToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const messaging = getMessaging(app);
          // Note: VAPID key would normally go here if using web push
          // getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' })
          const fcmToken = await getToken(messaging);
          
          if (fcmToken) {
            // Save to backend
            await authApi.saveFCMToken(fcmToken, refreshToken);
          }
        }
      } catch (error) {
        console.error('Failed to get FCM token:', error);
      }
    };

    requestPermissionAndSaveToken();

    // Listen for foreground messages
    try {
      const messaging = getMessaging(app);
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        // You can integrate this with the UI toast system if desired
      });
      return () => unsubscribe();
    } catch (e) {
      // Messaging might not be supported (e.g. Safari without strict setup)
    }

  }, [user, refreshToken]);
}
