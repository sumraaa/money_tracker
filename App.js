import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { initDatabase, getAllExpenses } from './src/database/db';
import {
  initSyncManager,
  triggerSync,
  subscribeSyncState,
  setScriptUrl,
  getScriptUrl,
} from './src/services/SyncService';
import QuickLogModal from './src/components/QuickLogModal';
import ExpenseList from './src/components/ExpenseList';

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    isOnline: true,
    message: '',
  });

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(getScriptUrl());

  useEffect(() => {
    // 1. Initialize SQLite Database
    initDatabase()
      .then(() => loadExpenses())
      .catch((err) => console.error('DB Init Error:', err));

    // 2. Initialize Network Sync Manager
    initSyncManager();
    const unsubscribeSync = subscribeSyncState((status) => {
      setSyncStatus(status);
      loadExpenses();
    });

    // 3. Deep Link Listener (Intent Launch for Hardware Button / Shortcut)
    const handleDeepLink = (event) => {
      const data = Linking.parse(event.url);
      console.log('[DeepLink] Received URL:', event.url, data);

      if (
        data.hostname === 'quick-log' ||
        data.path === 'quick-log' ||
        data.scheme === 'exp-tracker'
      ) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setModalVisible(true);
      }
    };

    // Check initial launch URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
      unsubscribeSync();
    };
  }, []);

  const loadExpenses = async () => {
    const data = await getAllExpenses(50);
    setExpenses(data);
  };

  const handleManualSync = async () => {
    Haptics.selectionAsync();
    await triggerSync();
    await loadExpenses();
  };

  const handleSaveSettings = () => {
    setScriptUrl(tempUrl);
    setSettingsVisible(false);
    triggerSync();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Sleek Minimal Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.appName}>ZERO FRICTION</Text>
            <View style={styles.dotAccent} />
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.settingsIconBtn}
            onPress={() => setSettingsVisible(true)}
          >
            <Settings size={20} color="#A0A0AB" />
          </TouchableOpacity>
        </View>

        {/* Main Expense Dashboard */}
        <View style={styles.body}>
          <ExpenseList
            expenses={expenses}
            onRefresh={handleManualSync}
            syncStatus={syncStatus}
          />
        </View>

        {/* Floating Glowing Pill FAB */}
        <View style={styles.fabContainer} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.fabPill}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setModalVisible(true);
            }}
          >
            <Text style={styles.fabIcon}>⚡</Text>
            <Text style={styles.fabText}>Quick Log</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet Pop-Up Modal */}
        <QuickLogModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onExpenseAdded={() => {
            loadExpenses();
          }}
        />

        {/* Apps Script Settings Modal */}
        <Modal
          visible={settingsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSettingsVisible(false)}
        >
          <View style={styles.settingsBackdrop}>
            <View style={styles.settingsBox}>
              <Text style={styles.settingsTitle}>⚙️ Google Apps Script URL</Text>
              <Text style={styles.settingsDesc}>
                Paste your deployed Google Apps Script Web App URL below to sync your expenses to Google Sheets.
              </Text>
              <TextInput
                style={styles.urlInput}
                placeholder="https://script.google.com/macros/s/.../exec"
                placeholderTextColor="#71717A"
                value={tempUrl}
                onChangeText={setTempUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setSettingsVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveSettings}
                >
                  <Text style={styles.saveText}>Save URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  dotAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginLeft: 6,
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 100,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fabIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    padding: 24,
  },
  settingsBox: {
    backgroundColor: '#09090B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  settingsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  settingsDesc: {
    color: '#A0A0AB',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  urlInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  cancelText: {
    color: '#71717A',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 100,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
