/**
 * ZERO FRICTION — Notification Service
 * Handles Android Notification Channels, Daily Spending Summaries,
 * Budget Threshold Alerts, Subscription/Recurring Reminders, and Sync Alerts.
 * Safe execution with fallback logic when permissions are not granted.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting, getUnsyncedExpenses, getRecurringExpenses } from '../database/db';
import { getTodaySpend, getBudgetStatus, getWeeklyDigest } from './AnalyticsService';
import { formatINR } from '../utils/money';

// Notification Keys in DB Settings
export const NOTIF_KEYS = {
  DAILY_SUMMARY: 'notif_daily_summary_enabled',
  BUDGET_ALERTS: 'notif_budget_alerts_enabled',
  WEEKLY_DIGEST: 'notif_weekly_digest_enabled',
  SUBSCRIPTION_REMINDERS: 'notif_sub_reminders_enabled',
  SYNC_REMINDERS: 'notif_sync_reminders_enabled',
  LAST_BUDGET_ALERT_TIME: 'notif_last_budget_alert_time',
  LAST_DAILY_SUMMARY_DATE: 'notif_last_daily_summary_date',
};

// Configure foreground behavior safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log('[NotificationService] setNotificationHandler skipped:', e?.message || e);
}

/**
 * Initialize Notification Channels & Default Settings
 * Safe, asynchronous, non-blocking.
 */
export async function initNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-summary', {
        name: 'Daily Spend Summary',
        description: 'Evening summary of daily spending and remaining budget',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });

      await Notifications.setNotificationChannelAsync('budget-alerts', {
        name: 'Budget & Overspend Alerts',
        description: 'High-priority alerts when approaching or exceeding budget',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#F87171',
      });

      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Subscriptions & Reminders',
        description: 'Reminders for upcoming recurring bills and pending syncs',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#818CF8',
      });
    }

    // Schedule default daily check if enabled
    const dailyEnabled = await getSetting(NOTIF_KEYS.DAILY_SUMMARY);
    if (dailyEnabled === null) {
      // Default to enabled
      await setSetting(NOTIF_KEYS.DAILY_SUMMARY, 'true');
      await setSetting(NOTIF_KEYS.BUDGET_ALERTS, 'true');
      await setSetting(NOTIF_KEYS.WEEKLY_DIGEST, 'true');
      await setSetting(NOTIF_KEYS.SUBSCRIPTION_REMINDERS, 'true');
    }

    await scheduleDailySummaryNotification();
  } catch (error) {
    console.error('[NotificationService] Initialization error:', error);
  }
}

/**
 * Request Notification Permissions safely
 */
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.log('[NotificationService] Permission request failed/skipped:', error);
    return false;
  }
}

/**
 * Schedule Daily Evening Summary Notification (Every day at 8:00 PM)
 */
export async function scheduleDailySummaryNotification() {
  try {
    const enabled = await getSetting(NOTIF_KEYS.DAILY_SUMMARY);
    if (enabled === 'false') {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Clear existing to avoid duplicate schedules
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule daily trigger at 20:00 (8 PM)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Daily Spending Summary',
        body: 'Check your daily spending and remaining budget balance.',
        data: { screen: 'home' },
        channelId: 'daily-summary',
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to schedule daily summary:', error);
  }
}

/**
 * Trigger immediate local notification for budget threshold breach (80% / 100%)
 */
export async function checkAndTriggerBudgetAlert(budgetStatus) {
  try {
    const enabled = await getSetting(NOTIF_KEYS.BUDGET_ALERTS);
    if (enabled === 'false' || !budgetStatus || !budgetStatus.hasOverallBudget) return;

    const now = Date.now();
    const lastAlertTime = parseInt((await getSetting(NOTIF_KEYS.LAST_BUDGET_ALERT_TIME)) || '0', 10);

    // Don't spam notifications: max 1 budget alert every 6 hours
    if (now - lastAlertTime < 6 * 60 * 60 * 1000) return;

    const { percentUsed, isOverBudget, remaining, overAmount, overallBudget } = budgetStatus;

    if (isOverBudget) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 Budget Exceeded!',
          body: `You are ${formatINR(overAmount, { showPaise: false })} over your monthly budget of ${formatINR(overallBudget, { showPaise: false })}.`,
          data: { screen: 'analytics' },
          channelId: 'budget-alerts',
        },
        trigger: null, // immediate
      });
      await setSetting(NOTIF_KEYS.LAST_BUDGET_ALERT_TIME, String(now));
    } else if (percentUsed >= 80) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Budget Alert (80% Used)',
          body: `You have used ${percentUsed.toFixed(0)}% of your monthly budget. Only ${formatINR(remaining, { showPaise: false })} remaining.`,
          data: { screen: 'analytics' },
          channelId: 'budget-alerts',
        },
        trigger: null, // immediate
      });
      await setSetting(NOTIF_KEYS.LAST_BUDGET_ALERT_TIME, String(now));
    }
  } catch (error) {
    console.error('[NotificationService] Budget alert check error:', error);
  }
}

/**
 * Trigger notification if unsynced transactions are accumulating offline
 */
export async function checkAndTriggerSyncReminder() {
  try {
    const enabled = await getSetting(NOTIF_KEYS.SYNC_REMINDERS);
    if (enabled === 'false') return;

    const unsynced = await getUnsyncedExpenses();
    if (unsynced && unsynced.length >= 5) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☁️ Unsynced Transactions',
          body: `You have ${unsynced.length} pending transactions saved locally. Connect to sync with Google Sheets.`,
          data: { screen: 'settings' },
          channelId: 'reminders',
        },
        trigger: null,
      });
    }
  } catch (error) {
    console.error('[NotificationService] Sync reminder error:', error);
  }
}

/**
 * Trigger notification for due subscriptions / recurring expenses
 */
export async function checkAndTriggerSubscriptionReminders() {
  try {
    const enabled = await getSetting(NOTIF_KEYS.SUBSCRIPTION_REMINDERS);
    if (enabled === 'false') return;

    const recurring = await getRecurringExpenses();
    const today = new Date().toISOString().substring(0, 10);

    for (const item of recurring) {
      if (item.is_active === 1 && item.next_date === today) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔄 Subscription Due: ${item.merchant}`,
            body: `${formatINR(item.amount, { showPaise: false })} for ${item.merchant} is due today.`,
            data: { screen: 'recurring' },
            channelId: 'reminders',
          },
          trigger: null,
        });
      }
    }
  } catch (error) {
    console.error('[NotificationService] Subscription reminder error:', error);
  }
}
