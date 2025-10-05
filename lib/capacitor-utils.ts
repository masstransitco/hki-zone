import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

// Push Notifications Setup
export const initializePushNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Push notifications not available on web');
    return;
  }

  // Request permission to use push notifications
  // iOS will prompt user and return if they granted permission or not
  // Android will just grant without prompting
  const permStatus = await PushNotifications.requestPermissions();

  if (permStatus.receive === 'granted') {
    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();
  } else {
    console.log('Push notification permission denied');
  }

  // On success, we should be able to receive notifications
  PushNotifications.addListener('registration', (token: Token) => {
    console.log('Push registration success, token: ' + token.value);
    // Send this token to your server to send push notifications
    sendTokenToServer(token.value);
  });

  // Some issue with our setup and push will not work
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Push registration error: ', error);
  });

  // Show us the notification payload if the app is open on our device
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push notification received: ', notification);
    // Handle foreground notification
    showInAppNotification(notification);
  });

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push notification action performed', notification.actionId, notification.inputValue);
    // Handle notification tap
    handleNotificationTap(notification);
  });
};

// Send token to your server
const sendTokenToServer = async (token: string) => {
  try {
    await fetch('/api/register-push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.error('Failed to send token to server:', error);
  }
};

// Handle in-app notification display
const showInAppNotification = (notification: PushNotificationSchema) => {
  // You can use a toast library or custom UI here
  alert(`New notification: ${notification.title}`);
};

// Handle notification tap
const handleNotificationTap = (notification: ActionPerformed) => {
  // Navigate to specific screen based on notification data
  const data = notification.notification.data;
  if (data?.route) {
    // Use your router to navigate
    window.location.href = data.route;
  }
};

// Haptics utilities
export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Haptics not available on web');
    return;
  }

  try {
    await Haptics.impact({ style });
  } catch (error) {
    console.error('Haptics error:', error);
  }
};

// Share utilities
export const shareContent = async (title: string, text: string, url?: string) => {
  if (Capacitor.getPlatform() === 'web') {
    // Fallback to Web Share API or custom modal
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      console.log('Share not available on this browser');
    }
    return;
  }

  try {
    await Share.share({
      title,
      text,
      url,
      dialogTitle: 'Share with...',
    });
  } catch (error) {
    console.error('Share error:', error);
  }
};

// Example usage in components:
export const useNativeFeatures = () => {
  return {
    haptic: triggerHaptic,
    share: shareContent,
    isNative: Capacitor.getPlatform() !== 'web',
  };
};