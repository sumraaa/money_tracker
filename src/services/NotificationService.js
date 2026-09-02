import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Defensive root handler configuration
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (err) {
  console.warn('[NotificationService] Failed to set notification handler:', err?.message || err);
}

/**
 * Configure high-importance Android channel 'pace-nudges'
 */
export const setupNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('pace-nudges', {
      name: 'Pace Daily Nudges',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ca0013',
    });
    console.log('[NotificationService] Android channel "pace-nudges" configured.');
  } catch (error) {
    console.warn('[NotificationService] Error creating notification channel:', error?.message || error);
  }
};

/**
 * Schedule 3 daily witty nudges safely
 */
export const scheduleDailyNudges = async () => {
  try {
    // 1. Safely check / request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }));
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Notification permissions not granted.');
      return false;
    }

    // 2. Ensure Android channel is created
    await setupNotificationChannel();

    // 3. Clear stale triggers
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

    const nudges = [
      {
        id: 'morning-nudge',
        title: 'Morning reality check ☕',
        body: 'Coffee at home: ₹10. Fancy cafe latte: ₹280 + emotional damage. Choose wisely.',
        hour: 8,
        minute: 45,
      },
      {
        id: 'lunch-nudge',
        title: 'Swiggy cart open again? 👀',
        body: 'We see you eyeing that burger. Check your daily pace before hitting pay.',
        hour: 13,
        minute: 45,
      },
      {
        id: 'evening-nudge',
        title: 'Be honest with yourself 🧾',
        body: 'Two minutes of logging now saves two hours of panic at the end of the month.',
        hour: 20,
        minute: 30,
      },
    ];

    for (const nudge of nudges) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: nudge.title,
          body: nudge.body,
          sound: true,
          color: '#ca0013',
        },
        trigger: {
          hour: nudge.hour,
          minute: nudge.minute,
          repeats: true,
          channelId: 'pace-nudges',
        },
      }).catch((err) => {
        console.warn(`[NotificationService] Error scheduling nudge ${nudge.id}:`, err?.message || err);
      });
    }

    console.log('[NotificationService] 3 daily nudges scheduled successfully.');
    return true;
  } catch (error) {
    console.error('[NotificationService] Error in scheduleDailyNudges:', error?.message || error);
    return false;
  }
};

/**
 * Initialize notifications in background non-blocking mode
 */
export const initNotifications = async () => {
  try {
    await setupNotificationChannel();
    await scheduleDailyNudges();
  } catch (err) {
    console.warn('[NotificationService] Non-blocking init warning:', err?.message || err);
  }
};
