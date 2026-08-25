import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedExpenses, markExpensesAsSynced } from '../database/db';

// CONFIGURATION: Replace with deployed Google Apps Script Web App URL
let GOOGLE_APPS_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

let isSyncing = false;
let syncListeners = [];

export const setScriptUrl = (url) => {
  GOOGLE_APPS_SCRIPT_URL = url;
};

export const getScriptUrl = () => GOOGLE_APPS_SCRIPT_URL;

/**
 * Subscribe to sync state changes (for UI status updates)
 */
export const subscribeSyncState = (listener) => {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
};

const notifyListeners = (status) => {
  syncListeners.forEach((fn) => fn(status));
};

/**
 * Core Sync Function: Pushes local unsynced records to Google Sheets
 */
export const triggerSync = async () => {
  if (isSyncing) return { success: false, reason: 'Sync already in progress' };

  // Check network status
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    notifyListeners({ isSyncing: false, isOnline: false, message: 'Offline. Sync queued.' });
    return { success: false, reason: 'Device is offline' };
  }

  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes('YOUR_GOOGLE')) {
    notifyListeners({ isSyncing: false, isOnline: true, message: 'Google Apps Script URL not set.' });
    return { success: false, reason: 'URL not configured' };
  }

  isSyncing = true;
  notifyListeners({ isSyncing: true, isOnline: true, message: 'Syncing to Google Sheets...' });

  try {
    const unsyncedItems = await getUnsyncedExpenses();
    if (unsyncedItems.length === 0) {
      isSyncing = false;
      notifyListeners({ isSyncing: false, isOnline: true, message: 'All expenses synced' });
      return { success: true, count: 0 };
    }

    console.log(`[SyncService] Attempting to sync ${unsyncedItems.length} items to Google Sheets...`);

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'ADD_EXPENSES',
        expenses: unsyncedItems,
      }),
    });

    const result = await response.json();

    if (result.status === 'success' || response.ok) {
      const syncedIds = unsyncedItems.map((item) => item.id);
      await markExpensesAsSynced(syncedIds);
      console.log(`[SyncService] Successfully synced ${syncedIds.length} items.`);

      isSyncing = false;
      notifyListeners({
        isSyncing: false,
        isOnline: true,
        message: `Successfully synced ${syncedIds.length} item(s)`,
        lastSync: new Date().toLocaleTimeString(),
      });
      return { success: true, count: syncedIds.length };
    } else {
      throw new Error(result.message || 'Server error from Google Apps Script');
    }
  } catch (error) {
    console.error('[SyncService] Sync failed:', error);
    isSyncing = false;
    notifyListeners({
      isSyncing: false,
      isOnline: true,
      error: error.message,
      message: 'Sync failed. Will retry when connected.',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Initialize Automatic Network Monitoring Sync Trigger
 */
export const initSyncManager = () => {
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      console.log('[SyncService] Network reconnected. Triggering auto-sync...');
      triggerSync();
    }
  });
};
