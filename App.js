import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, StatusBar, BackHandler, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { initSyncManager, subscribeSyncState } from './src/services/SyncService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import CustomTabBar from './src/components/CustomTabBar';
import QuickLogModal from './src/components/QuickLogModal';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import { emit, EventTypes } from './src/services/EventBus';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from './src/constants/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    emit(EventTypes.TAB_CHANGED, tab);
  };
  const [globalQuickLog, setGlobalQuickLog] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    isOnline: true,
    message: '',
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  const startDbInit = useCallback(async () => {
    setDbError(null);
    setDbReady(false);
    try {
      const res = await initDatabase();
      if (res && res.success === false) {
        setDbError(res.error || 'Unknown database error');
      } else {
        setDbReady(true);
      }
    } catch (err) {
      console.error('[App] Database init caught error:', err);
      setDbError(err?.message || 'Failed to initialize local database');
    }
  }, []);

  useEffect(() => {
    startDbInit();

    try {
      initSyncManager();
    } catch (e) {
      console.log('[App] initSyncManager notice:', e);
    }

    const unsubscribeSync = subscribeSyncState((status) => {
      setSyncStatus(status);
    });

    // Android Hardware Back Button Handling
    const onBackPress = () => {
      if (globalQuickLog) {
        setGlobalQuickLog(false);
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
      backHandler.remove();
    };
  }, [showSettings, activeTab, globalQuickLog, startDbInit]);

  const handleExpenseAdded = () => {
    setRefreshToken((t) => t + 1);
  };

  const renderScreen = () => {
    if (dbError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Database initialization failed</Text>
          <Text style={styles.errorSub}>{String(dbError)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={startDbInit} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!dbReady) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentRed} />
          <Text style={styles.loadingText}>Zero Friction</Text>
        </View>
      );
    }

    // Settings overlay
    if (showSettings) {
      return (
        <SettingsScreen
          onBack={() => setShowSettings(false)}
          onOpenRecurring={() => {
            setShowSettings(false);
            setActiveTab('recurring');
          }}
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
            onOpenQuickLog={() => setGlobalQuickLog(true)}
          />
        );
      case 'analytics':
        return <AnalyticsScreen key={`analytics-${refreshToken}`} />;
      case 'recurring':
        return (
          <RecurringScreen
            key={`recurring-${refreshToken}`}
            onBack={() => setActiveTab('home')}
          />
        );
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

  const hideTabBar = !dbReady || showSettings;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#eeebe3" />
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
          <View style={styles.screenArea}>{renderScreen()}</View>
          {!hideTabBar && (
            <CustomTabBar
              activeTab={activeTab}
              onTabPress={handleTabPress}
              onQuickLogPress={() => setGlobalQuickLog(true)}
            />
          )}
          <QuickLogModal
            visible={globalQuickLog}
            onClose={() => setGlobalQuickLog(false)}
            onExpenseAdded={handleExpenseAdded}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#eeebe3',
  },
  screenArea: {
    flex: 1,
    backgroundColor: '#eeebe3',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#eeebe3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.h3,
    color: '#171e19',
    marginTop: SPACING.md,
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#eeebe3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.error,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorSub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: COLORS.accentRed,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.pill,
  },
  retryText: {
    ...TYPOGRAPHY.label,
    color: '#ffffff',
    fontWeight: '700',
  },
});

