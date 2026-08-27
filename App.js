import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { initSyncManager, subscribeSyncState } from './src/services/SyncService';
import CustomTabBar from './src/components/CustomTabBar';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { COLORS } from './src/constants/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    isOnline: true,
    message: '',
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[App] DB Init Error:', err);
        setDbReady(true); // still show UI
      });

    initSyncManager();
    const unsubscribeSync = subscribeSyncState((status) => {
      setSyncStatus(status);
    });

    return () => unsubscribeSync();
  }, []);

  const handleExpenseAdded = () => {
    setRefreshToken((t) => t + 1);
  };

  const renderScreen = () => {
    if (!dbReady) return null;
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            syncStatus={syncStatus}
            onExpenseAdded={handleExpenseAdded}
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.screenArea}>{renderScreen()}</View>
        <SafeAreaView edges={['bottom']} style={styles.tabBarSafeArea}>
          <CustomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
        </SafeAreaView>
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
