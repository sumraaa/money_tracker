/**
 * ZERO FRICTION — Settings Screen
 * Organized settings: Sync, Budget, Notifications, Subscriptions, Data, About.
 * Calm, trustworthy, well-structured.
 */


import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft, Cloud, Wallet, Download, Upload, Info,
  ChevronRight, Shield, Trash2, Database, Repeat, FileText, FileSpreadsheet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';
import { setScriptUrl, getScriptUrl, triggerSync } from '../services/SyncService';
import { getBudgets, setBudget, getUnsyncedExpenses } from '../database/db';
import { getBudgetStatus } from '../services/AnalyticsService';
import { exportPdfStatement, exportWordStatement } from '../services/StatementExportService';
import { formatINR } from '../utils/money';
import { emit, EventTypes } from '../services/EventBus';

export default function SettingsScreen({ onBack, onOpenRecurring }) {
  const [scriptUrl, setUrl] = useState(getScriptUrl());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [currentBudget, setCurrentBudget] = useState(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [budget, unsynced] = await Promise.all([
        getBudgetStatus().catch(() => ({ hasOverallBudget: false })),
        getUnsyncedExpenses().catch(() => []),
      ]);
      setCurrentBudget(budget);
      setUnsyncedCount(unsynced.length);
    } catch (e) {
      console.error('[Settings] load error:', e);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const handleSaveSync = () => {
    setScriptUrl(scriptUrl);
    setShowSyncModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerSync().catch(() => {});
  };

  const handleSaveBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await setBudget(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowBudgetModal(false);
    setBudgetAmount('');
    emit(EventTypes.BUDGET_CHANGED);
    loadData();
  };

  const handleRemoveBudget = async () => {
    Alert.alert('Remove budget?', 'This will remove your monthly budget target.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await setBudget(0);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          emit(EventTypes.BUDGET_CHANGED);
          loadData();
        },
      },
    ]);
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await exportPdfStatement();
      if (res && res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (res && res.reason) {
        Alert.alert('No Data', res.reason);
      } else {
        Alert.alert('Export Failed', res?.error || 'Could not generate PDF statement.');
      }
    } catch (e) {
      Alert.alert('Export Error', 'An error occurred generating PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportWord = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await exportWordStatement();
      if (res && res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (res && res.reason) {
        Alert.alert('No Data', res.reason);
      } else {
        Alert.alert('Export Failed', res?.error || 'Could not generate Word document.');
      }
    } catch (e) {
      Alert.alert('Export Error', 'An error occurred generating Word document.');
    } finally {
      setExporting(false);
    }
  };

  const handleSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await triggerSync().catch(() => ({ success: false }));
    if (result.success) {
      Alert.alert('Sync complete', `${result.count || 0} expenses synced.`);
    } else {
      Alert.alert('Sync issue', result.reason || result.error || 'Could not sync right now.');
    }
    loadData();
  };

  const SettingRow = ({ icon, label, value, onPress, danger, showChevron = true }) => (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.settingIconWrap, danger && styles.settingIconDanger]}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && { color: '#ca0013' }]}>{label}</Text>
        {value ? <Text style={styles.settingValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {showChevron && <ChevronRight size={16} color="#6c7772" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#171e19" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync Section */}
        <Text style={styles.sectionLabel}>SYNC</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Cloud size={18} color="#ca0013" />}
            label="Google Sheets URL"
            value={scriptUrl && !scriptUrl.includes('YOUR_GOOGLE') ? 'Configured' : 'Not set'}
            onPress={() => setShowSyncModal(true)}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<Database size={18} color="#171e19" />}
            label="Sync now"
            value={unsyncedCount > 0 ? `${unsyncedCount} pending` : 'All synced'}
            onPress={handleSync}
          />
        </View>

        {/* Subscriptions & Recurring Section */}
        <Text style={styles.sectionLabel}>SUBSCRIPTIONS & BILLS</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Repeat size={18} color="#ca0013" />}
            label="Subscriptions & Recurring Expenses"
            value="Netflix, Rent, Broadband, Gym"
            onPress={onOpenRecurring}
          />
        </View>

        {/* Budget Section */}
        <Text style={styles.sectionLabel}>BUDGET</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Wallet size={18} color="#171e19" />}
            label="Monthly budget"
            value={currentBudget?.hasOverallBudget
              ? formatINR(currentBudget.overallBudget, { showPaise: false })
              : 'Not set'}
            onPress={() => {
              if (currentBudget?.hasOverallBudget) {
                setBudgetAmount(String(currentBudget.overallBudget));
              }
              setShowBudgetModal(true);
            }}
          />
          {currentBudget?.hasOverallBudget && (
            <>
              <View style={styles.divider} />
              <SettingRow
                icon={<Trash2 size={18} color="#ca0013" />}
                label="Remove budget"
                onPress={handleRemoveBudget}
                danger
              />
            </>
          )}
        </View>

        {/* Data Section */}
        <Text style={styles.sectionLabel}>DATA & STATEMENT EXPORT</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<FileText size={18} color="#ca0013" />}
            label="Export Statement (PDF)"
            value="High-resolution financial document with charts/tables"
            onPress={handleExportPdf}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<FileSpreadsheet size={18} color="#ca0013" />}
            label="Export Document (Word .doc)"
            value="Formatted office document for desktop/mobile editing"
            onPress={handleExportWord}
          />
        </View>

        {/* About Section */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Info size={18} color="#6c7772" />}
            label="Pace"
            value="v1.0.0 • Offline Personal Financial OS"
            showChevron={false}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<Shield size={18} color="#6c7772" />}
            label="Privacy"
            value="All data stored locally on device"
            showChevron={false}
          />
        </View>

        <Text style={styles.footer}>
          Pace • Personal Financial Operating System{'\n'}
          Your financial data remains private on your device.
        </Text>
      </ScrollView>

      {/* Sync URL Modal */}
      <Modal
        visible={showSyncModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSyncModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Google Sheets Sync</Text>
            <Text style={styles.modalDesc}>
              Paste your deployed Google Apps Script Web App URL to sync expenses to Google Sheets.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://script.google.com/macros/s/.../exec"
              placeholderTextColor="#6c7772"
              value={scriptUrl}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSyncModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSync}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Monthly Budget</Text>
            <Text style={styles.modalDesc}>
              Set your total monthly spending limit. You'll see progress and alerts based on this target.
            </Text>
            <View style={styles.budgetInputRow}>
              <Text style={styles.budgetCurrency}>₹</Text>
              <TextInput
                style={styles.budgetInput}
                placeholder="10000"
                placeholderTextColor="#6c7772"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowBudgetModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveBudget}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eeebe3' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#171e19', letterSpacing: -0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 110 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5,
    marginTop: SPACING.xxl, marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: '#ffffff', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', overflow: 'hidden',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#eeebe3', marginLeft: 56 },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg, gap: SPACING.md, minHeight: 56,
  },
  settingIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#eeebe3',
    justifyContent: 'center', alignItems: 'center',
  },
  settingIconDanger: { backgroundColor: 'rgba(202, 0, 19, 0.1)' },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 15, color: '#171e19', fontWeight: '700' },
  settingValue: { fontSize: 13, color: '#6c7772', marginTop: 1 },

  footer: {
    fontSize: 12, color: '#8a9691', textAlign: 'center',
    marginTop: SPACING.xxxl, lineHeight: 18, fontWeight: '500',
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23, 30, 25, 0.65)', justifyContent: 'center', padding: SPACING.xxl },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 32, padding: SPACING.xxl, borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#171e19', marginBottom: SPACING.sm },
  modalDesc: { fontSize: 13, color: '#6c7772', lineHeight: 20, marginBottom: SPACING.lg },
  modalInput: {
    backgroundColor: '#eeebe3', color: '#171e19', borderRadius: 16,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: 14, fontWeight: '600',
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.xl, minHeight: 48,
  },
  budgetInputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#eeebe3',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
    marginBottom: SPACING.xl, paddingHorizontal: SPACING.lg,
  },
  budgetCurrency: { fontSize: 24, fontWeight: '800', color: '#ca0013', marginRight: SPACING.sm },
  budgetInput: { flex: 1, color: '#171e19', fontSize: 22, fontWeight: '800', paddingVertical: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  modalCancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  modalCancelText: { color: '#6c7772', fontWeight: '600', fontSize: 15 },
  modalSaveBtn: { backgroundColor: '#ca0013', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.pill },
  modalSaveText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});

