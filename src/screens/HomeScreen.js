import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, StatusBar, FlatList, Alert,
  RefreshControl,
} from 'react-native';
import { Settings, Plus, ChevronRight, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { getAllExpenses, deleteExpense } from '../database/db';
import { triggerSync, setScriptUrl, getScriptUrl } from '../services/SyncService';
import { getTodaySpend, getMonthSpend, getMonthlyDailyAverage, getBudgetStatus } from '../services/AnalyticsService';
import QuickLogModal from '../components/QuickLogModal';
import { COLORS, SPACING, RADIUS, DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatShortDate, formatTime, relativeLabel } from '../utils/dates';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCategoryIcon(categoryName) {
  if (!categoryName) return '💳';
  const cat = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return cat?.icon || '💳';
}

export default function HomeScreen({ syncStatus, onExpenseAdded }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(getScriptUrl());
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [dailyAvg, setDailyAvg] = useState(0);
  const [budget, setBudget] = useState({ hasOverallBudget: false });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [exps, today, month, avg, budgetData] = await Promise.all([
        getAllExpenses({ limit: 20, sortBy: 'date_time', sortOrder: 'DESC' }),
        getTodaySpend().catch(() => ({ total: 0 })),
        getMonthSpend().catch(() => ({ total: 0 })),
        getMonthlyDailyAverage().catch(() => 0),
        getBudgetStatus().catch(() => ({ hasOverallBudget: false })),
      ]);
      setExpenses(exps);
      setTodayTotal(today.total);
      setMonthTotal(month.total);
      setDailyAvg(avg);
      setBudget(budgetData);
    } catch (e) {
      console.error('[Home] load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData();

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

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await triggerSync().catch(() => {});
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = (id, label, amount) => {
    Alert.alert(
      'Delete expense',
      `Remove ${label} (${formatINR(amount)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteExpense(id);
            await loadData();
            if (onExpenseAdded) onExpenseAdded();
          },
        },
      ]
    );
  };

  const handleSaveSettings = () => {
    setScriptUrl(tempUrl);
    setSettingsVisible(false);
    triggerSync();
  };

  const unsyncedCount = expenses.filter((e) => e.sync_status === 0).length;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const renderExpenseItem = ({ item }) => {
    const icon = getCategoryIcon(item.category);
    const label = item.merchant || item.category || 'Expense';
    const subtitle = item.merchant ? item.category : (item.message || '');
    const isSynced = item.sync_status === 1;

    return (
      <TouchableOpacity
        style={styles.txRow}
        activeOpacity={0.7}
        onLongPress={() => handleDelete(item.id, label, item.expense)}
      >
        <View style={styles.txIconWrap}>
          <Text style={styles.txIcon}>{icon}</Text>
        </View>
        <View style={styles.txDetails}>
          <Text style={styles.txLabel} numberOfLines={1}>{label}</Text>
          {subtitle ? (
            <Text style={styles.txSub} numberOfLines={1}>{subtitle}</Text>
          ) : null}
          <View style={styles.txMeta}>
            <Text style={styles.txDate}>
              {formatShortDate(item.date_time)} · {formatTime(item.date_time)}
            </Text>
            {!isSynced && <View style={styles.syncDotPending} />}
          </View>
        </View>
        <Text style={styles.txAmount}>
          {formatINR(parseFloat(item.expense), { showPaise: false })}
        </Text>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Sync indicator */}
          {syncStatus?.isSyncing ? (
            <View style={styles.syncIndicator}>
              <RefreshCw size={12} color={COLORS.accent} />
            </View>
          ) : unsyncedCount > 0 ? (
            <TouchableOpacity style={styles.syncBadge} onPress={handleRefresh}>
              <Text style={styles.syncBadgeText}>{unsyncedCount}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.settingsBtn}
            onPress={() => setSettingsVisible(true)}
          >
            <Settings size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Metric: Today's spending */}
      <View style={styles.primaryCard}>
        <Text style={styles.primaryLabel}>Spent today</Text>
        <Text style={styles.primaryAmount}>
          {formatINR(todayTotal, { showPaise: false })}
        </Text>

        {/* Supporting metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>This month</Text>
            <Text style={styles.metricValue}>
              {formatINR(monthTotal, { showPaise: false, compact: monthTotal >= 100000 })}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Daily avg</Text>
            <Text style={styles.metricValue}>
              {formatINR(dailyAvg, { showPaise: false })}
            </Text>
          </View>
          {budget.hasOverallBudget && (
            <>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Remaining</Text>
                <Text style={[
                  styles.metricValue,
                  budget.isOverBudget && { color: COLORS.error },
                  !budget.isOverBudget && budget.percentUsed >= 80 && { color: COLORS.warning },
                ]}>
                  {formatINR(budget.remaining || 0, { showPaise: false })}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Budget progress bar */}
      {budget.hasOverallBudget && (
        <View style={styles.budgetBar}>
          <View style={styles.budgetBarTrack}>
            <View
              style={[
                styles.budgetBarFill,
                { width: `${Math.min(budget.percentUsed, 100)}%` },
                budget.isOverBudget && { backgroundColor: COLORS.error },
                budget.percentUsed >= 80 && !budget.isOverBudget && { backgroundColor: COLORS.warning },
              ]}
            />
          </View>
          <Text style={styles.budgetBarLabel}>
            {budget.percentUsed?.toFixed(0) || 0}% of {formatINR(budget.overallBudget, { showPaise: false })} budget
          </Text>
        </View>
      )}

      {/* Quick Log CTA */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.quickLogBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setModalVisible(true);
        }}
      >
        <View style={styles.quickLogIconWrap}>
          <Plus size={20} color={COLORS.textPrimary} />
        </View>
        <View style={styles.quickLogTextWrap}>
          <Text style={styles.quickLogTitle}>Quick Log</Text>
          <Text style={styles.quickLogSub}>Record an expense</Text>
        </View>
        <ChevronRight size={16} color={COLORS.textMuted} />
      </TouchableOpacity>

      {/* Recent Activity Header */}
      {expenses.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.sectionCount}>{expenses.length}</Text>
        </View>
      )}
    </>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySub}>
        Tap Quick Log to record your first expense.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpenseItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
            progressBackgroundColor={COLORS.bgElevated}
          />
        }
      />

      {/* Quick Log Modal */}
      <QuickLogModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onExpenseAdded={() => {
          loadData();
          if (onExpenseAdded) onExpenseAdded();
        }}
      />

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.settingsBackdrop}>
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>Google Sheets Sync</Text>
            <Text style={styles.settingsDesc}>
              Paste your deployed Google Apps Script Web App URL to sync expenses.
            </Text>
            <TextInput
              style={styles.urlInput}
              placeholder="https://script.google.com/macros/s/.../exec"
              placeholderTextColor={COLORS.textDisabled}
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
              <TouchableOpacity style={styles.saveSettingsBtn} onPress={handleSaveSettings}>
                <Text style={styles.saveText}>Save</Text>
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
  listContent: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  syncIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  syncBadgeText: {
    color: COLORS.warning,
    fontSize: 10,
    fontWeight: '800',
  },

  // Primary Card
  primaryCard: {
    marginHorizontal: SPACING.xxl,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  primaryLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  primaryAmount: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginBottom: SPACING.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: COLORS.border,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 3,
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Budget bar
  budgetBar: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  budgetBarTrack: {
    height: 4,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  budgetBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  budgetBarLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },

  // Quick Log CTA
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    backgroundColor: COLORS.accentBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderAccent,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  quickLogIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLogTextWrap: {
    flex: 1,
  },
  quickLogTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  quickLogSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  txIcon: {
    fontSize: 16,
  },
  txDetails: {
    flex: 1,
  },
  txLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  txSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txDate: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  syncDotPending: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.warning,
  },
  txAmount: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.md,
    opacity: 0.6,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Settings Modal
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  settingsBox: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  settingsTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  settingsDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACING.lg,
  },
  urlInput: {
    backgroundColor: COLORS.bgSurface,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  saveSettingsBtn: {
    backgroundColor: COLORS.accentStrong,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
  },
  saveText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
