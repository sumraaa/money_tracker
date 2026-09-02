import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_GUARD_KEY = '@pace_notifications_v3_scheduled';

// Defensive root handler configuration for Foreground Quiet Mode
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false, // Prevents in-app banner spam while tapping around
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
 * Schedule 8 daily recurring nudges (8:00 AM to 10:00 PM, 2-hour interval)
 */
export const scheduleDailyNudges = async () => {
  try {
    // 1. One-time persistent scheduling guard check
    const isAlreadyScheduled = await AsyncStorage.getItem(NOTIFICATION_GUARD_KEY).catch(() => null);
    if (isAlreadyScheduled === 'true') {
      console.log('[NotificationService] Nudges already scheduled (v3 guard active). Skipping.');
      return true;
    }

    // 2. Safely check / request permissions
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

    // 3. Ensure Android channel is created
    await setupNotificationChannel();

    // 4. Cancel all existing scheduled notifications first
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

    // 5. Define 8 daytime slots (8:00 AM to 10:00 PM)
    const nudges = [
      {
        id: 'nudge-08am',
        title: 'Morning reality check ☕',
        body: 'Coffee at home: ₹10. Fancy cafe latte: ₹280 + emotional damage. Choose wisely.',
        hour: 8,
        minute: 0,
      },
      {
        id: 'nudge-10am',
        title: 'Workday warmup 💼',
        body: "Don't let mid-morning boredom trick you into ordering snacks twice. Check your daily pace.",
        hour: 10,
        minute: 0,
      },
      {
        id: 'nudge-12pm',
        title: 'Lunch incoming 🍱',
        body: 'Swiggy cart open again? Check your remaining pace before hitting pay.',
        hour: 12,
        minute: 0,
      },
      {
        id: 'nudge-02pm',
        title: 'Post-lunch reality 🥱',
        body: 'Resisting the urge to buy random things online is also cardio. Stay strong.',
        hour: 14,
        minute: 0,
      },
      {
        id: 'nudge-04pm',
        title: 'Chai & snacks audit 🫖',
        body: "That ₹20 quick UPI tap wasn't 'free'. Don't forget to drop it in Pace.",
        hour: 16,
        minute: 0,
      },
      {
        id: 'nudge-06pm',
        title: 'Evening commute 🌆',
        body: 'Heading out? Keep the UPI scanner in your pocket until dinner.',
        hour: 18,
        minute: 0,
      },
      {
        id: 'nudge-08pm',
        title: 'Dinner dilemma 🍕',
        body: 'Dining out or cooking? Either way, keep your daily pace green.',
        hour: 20,
        minute: 0,
      },
      {
        id: 'nudge-10pm',
        title: 'Nightly audit 🌙',
        body: "Did today happen to you, or to your bank balance? Take 30 seconds to log today's spends.",
        hour: 22,
        minute: 0,
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

    // 6. Set persistent guard flag to true
    await AsyncStorage.setItem(NOTIFICATION_GUARD_KEY, 'true').catch(() => {});
    console.log('[NotificationService] 8 daytime nudges scheduled successfully (8 AM - 10 PM).');
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
