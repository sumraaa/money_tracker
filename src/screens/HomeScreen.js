import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, StatusBar,
} from 'react-native';
import { Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { getAllExpenses } from '../database/db';
import { triggerSync, setScriptUrl, getScriptUrl } from '../services/SyncService';
import QuickLogModal from '../components/QuickLogModal';
import ExpenseList from '../components/ExpenseList';

export default function HomeScreen({ syncStatus, onExpenseAdded }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(getScriptUrl());

  useEffect(() => {
    loadExpenses();

    const handleDeepLink = (event) => {
      const data = Linking.parse(event.url);
      if (
        data.hostname === 'quick-log' ||
        data.path === 'quick-log' ||
        data.scheme === 'exp-tracker'
      ) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setModalVisible(true);
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.appName}>ZERO FRICTION</Text>
          <View style={styles.dotAccent} />
        </View>
        <TouchableOpacity activeOpacity={0.7} style={styles.settingsIconBtn}
          onPress={() => setSettingsVisible(true)}>
          <Settings size={20} color="#A0A0AB" />
        </TouchableOpacity>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        <ExpenseList
          expenses={expenses}
          onRefresh={handleManualSync}
          syncStatus={syncStatus}
          onQuickLog={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModalVisible(true);
          }}
        />
      </View>


      {/* Quick Log Modal */}
      <QuickLogModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onExpenseAdded={() => {
          loadExpenses();
          if (onExpenseAdded) onExpenseAdded();
        }}
      />

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsBackdrop}>
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>⚙️ Google Apps Script URL</Text>
            <Text style={styles.settingsDesc}>
              Paste your deployed Google Apps Script Web App URL below to sync expenses to Google Sheets.
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                <Text style={styles.saveText}>Save URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  appName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  dotAccent: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#38BDF8', marginLeft: 6 },
  settingsIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  settingsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', padding: 24 },
  settingsBox: { backgroundColor: '#09090B', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  settingsTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  settingsDesc: { color: '#A0A0AB', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  urlInput: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  settingsActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 18 },
  cancelText: { color: '#71717A', fontWeight: '600' },
  saveBtn: { backgroundColor: '#0EA5E9', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 100 },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
});
