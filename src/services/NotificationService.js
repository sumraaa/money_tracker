import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pace-nudges', {
      name: 'Pace Smart Nudges',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ca0013',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
};

export const scheduleDailyNudges = async () => {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    if (existing && existing.length >= 10) {
      return true; // Already actively scheduled in Android OS
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const slots = [
      { hour: 8, minute: 0, title: "Morning reality check ☕", body: "Coffee at home: ₹10. Fancy cafe latte: ₹280 + emotional damage. Choose wisely." },
      { hour: 9, minute: 15, title: "Breakfast audit 🥐", body: "Quick UPI tap at the bakery? Don't let it slip your mind—drop it into Pace." },
      { hour: 10, minute: 30, title: "Workday warmup 💼", body: "Don't let mid-morning boredom trick you into browsing shopping apps. How's your daily pace?" },
      { hour: 11, minute: 45, title: "Pre-lunch warning ⏳", body: "Hunger is speaking, not your wallet. Remember your monthly goals before you order." },
      { hour: 13, minute: 15, title: "Swiggy cart open again? 👀", body: "We see you eyeing that gourmet meal. Check your remaining pace before hitting pay." },
      { hour: 14, minute: 45, title: "Post-lunch slump 🥱", body: "Resisting the urge to make impulse online buys is also financial cardio. Stay strong." },
      { hour: 16, minute: 15, title: "Chai & snack alert 🫖", body: "That ₹20 tea and snack wasn't 'free'. Take 5 seconds to log it now." },
      { hour: 18, minute: 0, title: "Evening commute 🌆", body: "Heading out? Keep the scanner in your pocket until dinner." },
      { hour: 19, minute: 45, title: "Dinner dilemma 🍕", body: "Dining out or cooking? Either way, keep your pace indicator in the green." },
      { hour: 21, minute: 45, title: "Nightly audit 🌙", body: "Did today happen to you, or to your bank balance? Take 30 seconds to log today's spends." }
    ];

    for (const slot of slots) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: slot.title,
          body: slot.body,
          sound: true,
          channelId: 'pace-nudges',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
        },
      });
    }

    return true;
  } catch (error) {
    console.warn('[NotificationService] Silent notification error:', error?.message || error);
    return false;
  }
};

