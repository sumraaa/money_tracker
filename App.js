import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar, BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { initSyncManager, subscribeSyncState } from './src/services/SyncService';
import { initNotifications, checkAndTriggerBudgetAlert, checkAndTriggerSubscriptionReminders } from './src/services/NotificationService';
import { getBudgetStatus } from './src/services/AnalyticsService';
import CustomTabBar from './src/components/CustomTabBar';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import { COLORS } from './src/constants/theme';
import { subscribe, EventTypes } from './src/services/EventBus';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    isOnline: true,
    message: '',
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        setDbReady(true);
        // Initialize Notification Channels & Reminders
        await initNotifications();
        await checkAndTriggerSubscriptionReminders();
      })
      .catch((err) => {
        console.error('[App] DB Init Error:', err);
        setDbReady(true);
      });

    initSyncManager();
    const unsubscribeSync = subscribeSyncState((status) => {
      setSyncStatus(status);
    });

    // Listen for data changes to re-check budget alerts
    const unsubscribeBus = subscribe(EventTypes.EXPENSE_CREATED, async () => {
      const budgetStatus = await getBudgetStatus().catch(() => null);
      if (budgetStatus) {
        checkAndTriggerBudgetAlert(budgetStatus);
      }
    });

    // Android Hardware Back Button Handling
    const onBackPress = () => {
      if (showRecurring) {
        setShowRecurring(false);
        return true;
      }
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // Exit app if already on home
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      unsubscribeSync();
      unsubscribeBus();
      backHandler.remove();
    };
  }, [showRecurring, showSettings, activeTab]);

  const handleExpenseAdded = () => {
    setRefreshToken((t) => t + 1);
  };

  const renderScreen = () => {
    if (!dbReady) return null;

    // Recurring / Subscription screen overlay
    if (showRecurring) {
      return <RecurringScreen onBack={() => setShowRecurring(false)} />;
    }

    // Settings overlay
    if (showSettings) {
      return (
        <SettingsScreen
          onBack={() => setShowSettings(false)}
          onOpenRecurring={() => setShowRecurring(true)}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            syncStatus={syncStatus}
            onExpenseAdded={handleExpenseAdded}
            onOpenSettings={() => setShowSettings(true)}
          />
        );
      case 'analytics':
        return <AnalyticsScreen key={`analytics-${refreshToken}`} />;
      case 'history':
        return (
          <HistoryScreen
            key={`history-${refreshToken}`}
            onDataChanged={handleExpenseAdded}
          />
        );
      default:
        return null;
    }
  };

  const hideTabBar = showSettings || showRecurring;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.screenArea}>{renderScreen()}</View>
        {!hideTabBar && (
          <SafeAreaView edges={['bottom']} style={styles.tabBarSafeArea}>
            <CustomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
          </SafeAreaView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenArea: {
    flex: 1,
  },
  tabBarSafeArea: {
    backgroundColor: COLORS.bg,
  },
});
