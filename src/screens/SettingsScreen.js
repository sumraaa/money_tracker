/**
 * ZERO FRICTION — Settings Screen
 * Organized settings: Sync, Budget, Notifications, Subscriptions, Data, About.
 * Calm, trustworthy, well-structured.
 */


import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Share, Platform,
} from 'react-native';
import {
  ArrowLeft, Cloud, Wallet, Download, Upload, Info,
  ChevronRight, Shield, Trash2, Database, Repeat,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';
import { setScriptUrl, getScriptUrl, triggerSync } from '../services/SyncService';
import { getBudgets, setBudget, exportAllExpenses, getUnsyncedExpenses } from '../database/db';
import { getBudgetStatus } from '../services/AnalyticsService';
import { formatINR } from '../utils/money';
import { emit, EventTypes } from '../services/EventBus';

export default function SettingsScreen({ onBack, onOpenRecurring }) {
  const [scriptUrl, setUrl] = useState(getScriptUrl());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [currentBudget, setCurrentBudget] = useState(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

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

  const handleExport = async (format = 'csv') => {
    try {
      const expenses = await exportAllExpenses();
      if (!expenses || expenses.length === 0) {
        Alert.alert('No data', 'No expenses to export.');
        return;
      }

      let content;
      let title;

      if (format === 'json') {
        content = JSON.stringify(expenses, null, 2);
        title = 'Zero Friction — Expenses (JSON)';
      } else {
        const headers = 'ID,Category,Amount,Date,Merchant,Note,Payment Method,Synced\n';
        const rows = expenses.map((e) =>
          `${e.id},"${(e.category || '').replace(/"/g, '""')}",${e.expense},"${e.date_time}","${(e.merchant || '').replace(/"/g, '""')}","${(e.message || '').replace(/"/g, '""')}","${e.payment_method || ''}",${e.sync_status === 1 ? 'Yes' : 'No'}`
        ).join('\n');
        content = headers + rows;
        title = 'Zero Friction — Expenses (CSV)';
      }

      await Share.share({ message: content, title });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[Settings] Export error:', e);
      Alert.alert('Export failed', 'Could not export data. Please try again.');
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
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={[styles.settingIconWrap, danger && styles.settingIconDanger]}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && { color: COLORS.error }]}>{label}</Text>
        {value ? <Text style={styles.settingValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {showChevron && <ChevronRight size={16} color={COLORS.textDisabled} />}
    </TouchableOpacity>
  );

  const ToggleRow = ({ icon, label, sub, value, onToggle }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIconWrap}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingValue}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.bgSurface, true: COLORS.accentStrong }}
        thumbColor={COLORS.textPrimary}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
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
            icon={<Cloud size={18} color={COLORS.accent} />}
            label="Google Sheets URL"
            value={scriptUrl && !scriptUrl.includes('YOUR_GOOGLE') ? 'Configured' : 'Not set'}
            onPress={() => setShowSyncModal(true)}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<Database size={18} color={COLORS.info} />}
            label="Sync now"
            value={unsyncedCount > 0 ? `${unsyncedCount} pending` : 'All synced'}
            onPress={handleSync}
          />
        </View>

        {/* Subscriptions & Recurring Section */}
        <Text style={styles.sectionLabel}>SUBSCRIPTIONS & BILLS</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Repeat size={18} color={COLORS.accent} />}
            label="Subscriptions & Recurring Expenses"
            value="Netflix, Rent, Broadband, Gym"
            onPress={onOpenRecurring}
          />
        </View>

        {/* Budget Section */}
        <Text style={styles.sectionLabel}>BUDGET</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Wallet size={18} color={COLORS.success} />}
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
                icon={<Trash2 size={18} color={COLORS.error} />}
                label="Remove budget"
                onPress={handleRemoveBudget}
                danger
              />
            </>
          )}
        </View>

        {/* Data Section */}
        <Text style={styles.sectionLabel}>DATA & BACKUP</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Download size={18} color={COLORS.accent} />}
            label="Export as CSV"
            value="Share expense data"
            onPress={() => handleExport('csv')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<Download size={18} color={COLORS.accent} />}
            label="Export as JSON"
            value="Full data backup"
            onPress={() => handleExport('json')}
          />
        </View>

        {/* About Section */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Info size={18} color={COLORS.textMuted} />}
            label="Zero Friction"
            value="v1.0.0 • Offline Personal Financial OS"
            showChevron={false}
          />
          <View style={styles.divider} />
          <SettingRow
            icon={<Shield size={18} color={COLORS.textMuted} />}
            label="Privacy"
            value="All data stored locally on device"
            showChevron={false}
          />
        </View>

        <Text style={styles.footer}>
          Zero Friction • Personal Financial Operating System{'\n'}
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
              placeholderTextColor={COLORS.textDisabled}
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
                placeholderTextColor={COLORS.textDisabled}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  headerTitle: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 60 },

  sectionLabel: {
    ...TYPOGRAPHY.overline, color: COLORS.textMuted,
    marginTop: SPACING.xxl, marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 56 },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg, gap: SPACING.md, minHeight: 56,
  },
  settingIconWrap: {
    width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  settingIconDanger: { backgroundColor: COLORS.errorBg },
  settingContent: { flex: 1 },
  settingLabel: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '500' },
  settingValue: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, marginTop: 1 },

  footer: {
    ...TYPOGRAPHY.bodySm, color: COLORS.textDisabled, textAlign: 'center',
    marginTop: SPACING.xxxl, lineHeight: 20,
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: SPACING.xxl },
  modalBox: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xxl, borderWidth: 1, borderColor: COLORS.borderStrong },
  modalTitle: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  modalDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.lg },
  modalInput: {
    backgroundColor: COLORS.bgSurface, color: COLORS.textPrimary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, ...TYPOGRAPHY.body,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.xl, minHeight: 48,
  },
  budgetInputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    marginBottom: SPACING.xl, paddingHorizontal: SPACING.lg,
  },
  budgetCurrency: { ...TYPOGRAPHY.displaySm, color: COLORS.accent, marginRight: SPACING.sm },
  budgetInput: { flex: 1, color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', paddingVertical: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  modalCancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  modalCancelText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 15 },
  modalSaveBtn: { backgroundColor: COLORS.accentStrong, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.pill },
  modalSaveText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
});
