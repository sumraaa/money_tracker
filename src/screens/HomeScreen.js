/**
 * ZERO FRICTION — Home Screen (Log)
 * Primary question: "How much am I spending right now?"
 *
 * Information hierarchy:
 * 1. Greeting + date + sync state
 * 2. Today's spend (hero metric)
 * 3. Supporting metrics (month, daily avg, safe-to-spend)
 * 4. Quick Log CTA
 * 5. Recent activity
 *
 * Feels: FAST
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, FlatList, Alert, RefreshControl,
} from 'react-native';
import { Settings, Plus, ChevronRight, RefreshCw, TrendingDown, TrendingUp, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { getAllExpenses, deleteExpense } from '../database/db';
import { triggerSync } from '../services/SyncService';
import { getTodaySpend, getMonthSpend, getMonthlyDailyAverage, getBudgetStatus, getSafeToSpendToday, getSpendingScore, getWeekSpend, getLastWeekSpend } from '../services/AnalyticsService';
import { on, EventTypes } from '../services/EventBus';
import QuickLogModal from '../components/QuickLogModal';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, DEFAULT_CATEGORIES } from '../constants/theme';
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

function getCategoryColor(categoryName) {
  if (!categoryName) return COLORS.textMuted;
  const cat = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return cat?.color || COLORS.textMuted;
}

export default function HomeScreen({ syncStatus, onExpenseAdded, onOpenSettings }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [dailyAvg, setDailyAvg] = useState(0);
  const [budget, setBudget] = useState({ hasOverallBudget: false });
  const [safeToSpend, setSafeToSpend] = useState(null);
  const [spendingScore, setSpendingScore] = useState(null);
  const [weekData, setWeekData] = useState({ total: 0 });
  const [lastWeekData, setLastWeekData] = useState({ total: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [exps, today, month, avg, budgetData, safe, score, week, lastWeek] = await Promise.all([
        getAllExpenses({ limit: 15, sortBy: 'date_time', sortOrder: 'DESC' }),
        getTodaySpend().catch(() => ({ total: 0 })),
        getMonthSpend().catch(() => ({ total: 0 })),
        getMonthlyDailyAverage().catch(() => 0),
        getBudgetStatus().catch(() => ({ hasOverallBudget: false })),
        getSafeToSpendToday().catch(() => null),
        getSpendingScore().catch(() => null),
        getWeekSpend().catch(() => ({ total: 0 })),
        getLastWeekSpend().catch(() => ({ total: 0 })),
      ]);
      setExpenses(exps);
      setTodayTotal(today.total);
      setMonthTotal(month.total);
      setDailyAvg(avg);
      setBudget(budgetData);
      setSafeToSpend(safe);
      setSpendingScore(score);
      setWeekData(week);
      setLastWeekData(lastWeek);
    } catch (e) {
      console.error('[Home] load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Deep link handling
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

    // Listen for global events
    const unsub1 = on(EventTypes.BUDGET_CHANGED, loadData);
    const unsub2 = on(EventTypes.EXPENSE_DELETED, loadData);
    const unsub3 = on(EventTypes.SYNC_COMPLETED, loadData);
    const unsub4 = on(EventTypes.EXPENSE_CREATED, loadData);
    const unsub5 = on(EventTypes.EXPENSE_UPDATED, loadData);

    return () => {
      subscription.remove();
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
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

  const unsyncedCount = expenses.filter((e) => e.sync_status === 0).length;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Week-over-week change
  const weekChange = lastWeekData.total > 0
    ? ((weekData.total - lastWeekData.total) / lastWeekData.total) * 100
    : null;

  const renderExpenseItem = ({ item }) => {
    const icon = getCategoryIcon(item.category);
    const label = item.merchant || item.category || 'Expense';
    const subtitle = item.merchant ? item.category : (item.message || '');
    const isSynced = item.sync_status === 1;

    return (
      <TouchableOpacity
        style={styles.txRow}
        activeOpacity={0.6}
        onLongPress={() => handleDelete(item.id, label, item.expense)}
      >
        <View style={[styles.txIconWrap, { backgroundColor: getCategoryColor(item.category) + '14' }]}>
          <Text style={styles.txIcon}>{icon}</Text>
        </View>
        <View style={styles.txDetails}>
          <Text style={styles.txLabel} numberOfLines={1}>{label}</Text>
          <View style={styles.txMeta}>
            {subtitle ? (
              <Text style={styles.txSub} numberOfLines={1}>{subtitle} · </Text>
            ) : null}
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
              <RefreshCw size={13} color={COLORS.accent} />
            </View>
          ) : unsyncedCount > 0 ? (
            <TouchableOpacity style={styles.syncBadge} onPress={handleRefresh}>
              <Text style={styles.syncBadgeText}>{unsyncedCount}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.settingsBtn}
            onPress={onOpenSettings}
          >
            <Settings size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Spend — Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>Spent today</Text>
        <Text style={styles.heroAmount}>
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
          {safeToSpend && (
            <>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Safe to spend</Text>
                <Text style={[
                  styles.metricValue,
                  safeToSpend.isOverToday && { color: COLORS.warning },
                ]}>
                  {formatINR(safeToSpend.amount, { showPaise: false })}
                </Text>
              </View>
            </>
          )}
          {!safeToSpend && budget.hasOverallBudget && (
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

      {/* Budget progress */}
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

      {/* Spending Score */}
      {spendingScore && (
        <View style={styles.scoreRow}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{spendingScore.score}</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Spending Score</Text>
            <Text style={styles.scoreLabel}>{spendingScore.label}</Text>
          </View>
        </View>
      )}

      {/* Week trend chip */}
      {weekChange !== null && weekData.total > 0 && (
        <View style={styles.weekChip}>
          {weekChange <= 0 ? (
            <TrendingDown size={14} color={COLORS.success} />
          ) : (
            <TrendingUp size={14} color={COLORS.warning} />
          )}
          <Text style={[
            styles.weekChipText,
            weekChange <= 0 ? { color: COLORS.success } : { color: COLORS.warning },
          ]}>
            {weekChange <= 0 ? '↓' : '↑'} {Math.abs(weekChange).toFixed(0)}% vs last week · {formatINR(weekData.total, { showPaise: false })}
          </Text>
        </View>
      )}

      {/* Quick Log CTA */}
      <TouchableOpacity
        activeOpacity={0.75}
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
    paddingBottom: SPACING.sm,
  },
  greeting: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  dateText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  syncIndicator: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.accentBg,
    justifyContent: 'center', alignItems: 'center',
  },
  syncBadge: {
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 7,
    borderWidth: 1, borderColor: COLORS.warningBorder,
  },
  syncBadgeText: {
    color: COLORS.warning,
    fontSize: 11, fontWeight: '800',
  },

  // Hero Section
  heroSection: {
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  heroLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  heroAmount: {
    ...TYPOGRAPHY.displayLg,
    color: COLORS.textPrimary,
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
    height: 32,
    backgroundColor: COLORS.border,
  },
  metricLabel: {
    ...TYPOGRAPHY.labelXs,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    ...TYPOGRAPHY.mono,
    color: COLORS.textPrimary,
  },

  // Budget bar
  budgetBar: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  budgetBarTrack: {
    height: 3,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  budgetBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  budgetBarLabel: {
    ...TYPOGRAPHY.labelXs,
    color: COLORS.textMuted,
  },

  // Spending Score
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  scoreCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.accentBg,
    borderWidth: 2, borderColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreValue: {
    ...TYPOGRAPHY.monoLg,
    color: COLORS.accent,
  },
  scoreInfo: { flex: 1 },
  scoreTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
  },
  scoreLabel: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Week trend chip
  weekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  weekChipText: {
    ...TYPOGRAPHY.labelSm,
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
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentStrong,
    justifyContent: 'center', alignItems: 'center',
  },
  quickLogTextWrap: { flex: 1 },
  quickLogTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
  },
  quickLogSub: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.overline,
    color: COLORS.textMuted,
  },
  sectionCount: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textMuted,
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
    width: 40, height: 40, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  txSub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  txDate: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textMuted,
  },
  syncDotPending: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: COLORS.warning,
    marginLeft: 6,
  },
  txAmount: {
    ...TYPOGRAPHY.mono,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIcon: { fontSize: 44, marginBottom: SPACING.md, opacity: 0.5 },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
