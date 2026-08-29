import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar, BackHandler, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { initSyncManager, subscribeSyncState } from './src/services/SyncService';
import { initNotifications, checkAndTriggerBudgetAlert, checkAndTriggerSubscriptionReminders } from './src/services/NotificationService';
import { getBudgetStatus } from './src/services/AnalyticsService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import CustomTabBar from './src/components/CustomTabBar';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import { COLORS, SPACING, TYPOGRAPHY } from './src/constants/theme';
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
    // 1. Initialize SQLite Database gracefully
    initDatabase()
      .then(() => {
        setDbReady(true);
        // 2. Decouple background service initialization (non-blocking)
        setTimeout(() => {
          initNotifications().catch((e) => console.log('[App] Notif init skipped:', e));
          checkAndTriggerSubscriptionReminders().catch((e) => console.log('[App] Sub reminder check skipped:', e));
        }, 300);
      })
      .catch((err) => {
        console.error('[App] Database init caught error:', err);
        setDbReady(true); // Proceed to dashboard safely
      });

    try {
      initSyncManager();
    } catch (e) {
      console.log('[App] initSyncManager notice:', e);
    }

    const unsubscribeSync = subscribeSyncState((status) => {
      setSyncStatus(status);
    });

    // Listen for data changes to re-check budget alerts
    const unsubscribeBus = subscribe(EventTypes.EXPENSE_CREATED, async () => {
      try {
        const budgetStatus = await getBudgetStatus().catch(() => null);
        if (budgetStatus) {
          checkAndTriggerBudgetAlert(budgetStatus).catch(() => {});
        }
      } catch (e) {
        console.log('[App] Event check notice:', e);
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
    if (!dbReady) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Zero Friction</Text>
        </View>
      );
    }

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

  const hideTabBar = !dbReady || showSettings || showRecurring;

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justify: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    letterSpacing: 1,
  },
});
