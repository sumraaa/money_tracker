import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import {
  initSyncManager,
  subscribeSyncState,
} from './src/services/SyncService';
import CustomTabBar from './src/components/CustomTabBar';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    isOnline: true,
    message: '',
  });
  // Signal to child screens that a new expense was logged so they can refresh
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    // Initialize DB and sync manager once on mount
    initDatabase()
      .catch((err) => console.error('[App] DB Init Error:', err));

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
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {/* Active screen fills remaining space */}
        <View style={styles.screenArea}>{renderScreen()}</View>

        {/* Tab bar pinned to bottom, respects safe area inset */}
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
    backgroundColor: '#000000',
  },
  screenArea: {
    flex: 1,
  },
  tabBarSafeArea: {
    backgroundColor: '#000000',
  },
});
