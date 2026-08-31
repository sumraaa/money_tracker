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
        <View style={styles.headerTitleWrap}>
          <Text style={styles.brandTitle}>Superdesign.</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>NYC / IST • LIVE</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {/* Sync indicator */}
          {syncStatus?.isSyncing ? (
            <View style={styles.syncIndicator}>
              <RefreshCw size={13} color="#FF4500" />
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
            <Settings size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Spend — Hero Card 1 (Red / Flame Aesthetic) */}
      <View style={styles.heroSection}>
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroLabel}>SPENT TODAY</Text>
          <View style={styles.heroPillBadge}>
            <Text style={styles.heroPillText}>01</Text>
          </View>
        </View>

        <Text style={styles.heroAmount}>
          {formatINR(todayTotal, { showPaise: false })}
        </Text>

        {/* Supporting metrics in pitch-black layout */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>THIS MONTH</Text>
            <Text style={styles.metricValue}>
              {formatINR(monthTotal, { showPaise: false, compact: monthTotal >= 100000 })}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>DAILY AVG</Text>
            <Text style={styles.metricValue}>
              {formatINR(dailyAvg, { showPaise: false })}
            </Text>
          </View>
          {safeToSpend && (
            <>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>SAFE TO SPEND</Text>
                <Text style={styles.metricValue}>
                  {formatINR(safeToSpend.amount, { showPaise: false })}
                </Text>
              </View>
            </>
          )}
          {!safeToSpend && budget.hasOverallBudget && (
            <>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>REMAINING</Text>
                <Text style={styles.metricValue}>
                  {formatINR(budget.remaining || 0, { showPaise: false })}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Budget progress */}
      {budget.hasOverallBudget && (
        <View style={styles.budgetCard}>
          <View style={styles.budgetCardHeader}>
            <Text style={styles.budgetCardTitle}>MONTHLY BUDGET</Text>
            <View style={styles.budgetPillBadge}>
              <Text style={styles.budgetPillText}>02</Text>
            </View>
          </View>
          <View style={styles.budgetBarTrack}>
            <View
              style={[
                styles.budgetBarFill,
                { width: `${Math.min(budget.percentUsed || 0, 100)}%` },
                budget.isOverBudget && { backgroundColor: COLORS.error },
                budget.percentUsed >= 80 && !budget.isOverBudget && { backgroundColor: COLORS.warning },
              ]}
            />
          </View>
          <Text style={styles.budgetBarLabel}>
            {budget.percentUsed?.toFixed(0) || 0}% used of {formatINR(budget.overallBudget, { showPaise: false })} limit
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

      {/* Quick Log CTA - Full Width High Contrast Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.quickLogBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setModalVisible(true);
        }}
      >
        <View style={styles.quickLogIconWrap}>
          <Plus size={20} color="#000000" />
        </View>
        <View style={styles.quickLogTextWrap}>
          <Text style={styles.quickLogTitle}>Quick Log Expense</Text>
          <Text style={styles.quickLogSub}>Record a transaction instantly</Text>
        </View>
        <ChevronRight size={18} color="#000000" />
      </TouchableOpacity>

      {/* Recent Activity Header */}
      {expenses.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
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
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

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
            progressBackgroundColor="#111111"
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
  container: { flex: 1, backgroundColor: '#050505' },
  listContent: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitleWrap: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4500',
  },
  statusText: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  syncIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 69, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  syncBadgeText: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: '800',
  },

  // Hero Card 1 - Red / Flame Aesthetic (#FF4500)
  heroSection: {
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    backgroundColor: '#FF4500',
    borderRadius: 24,
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  heroLabel: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroPillBadge: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#000000',
    fontVariant: ['tabular-nums'],
    marginBottom: SPACING.lg,
    letterSpacing: -1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.15)',
    paddingTop: SPACING.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  metricLabel: {
    fontSize: 9,
    color: 'rgba(0, 0, 0, 0.65)',
    fontWeight: '700',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '800',
  },

  // Budget Card (Card 2 Aesthetic - #111111)
  budgetCard: {
    marginHorizontal: SPACING.xxl,
    padding: SPACING.lg,
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.md,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  budgetCardTitle: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 1.2,
  },
  budgetPillBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  budgetPillText: {
    fontSize: 10,
    color: '#888888',
  },
  budgetBarTrack: {
    height: 4,
    backgroundColor: '#181818',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  budgetBarFill: {
    height: '100%',
    backgroundColor: '#FF4500',
    borderRadius: 2,
  },
  budgetBarLabel: {
    fontSize: 11,
    color: '#888888',
  },

  // Spending Score
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  scoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 69, 0, 0.15)',
    borderWidth: 2,
    borderColor: '#FF4500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 16,
    color: '#FF4500',
    fontWeight: '800',
  },
  scoreInfo: { flex: 1 },
  scoreTitle: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 1,
  },

  // Week trend chip
  weekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  weekChipText: {
    fontSize: 12,
  },

  // Quick Log CTA - Full width high contrast rounded button
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  quickLogIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF4500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLogTextWrap: { flex: 1 },
  quickLogTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  quickLogSub: {
    fontSize: 11,
    color: '#444444',
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
    fontSize: 11,
    color: '#888888',
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 12,
    color: '#888888',
  },

  // Transaction rows - Editorial dark card aesthetic (#111111)
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#111111',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: SPACING.md,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  txSub: {
    fontSize: 12,
    color: '#888888',
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  txDate: {
    fontSize: 11,
    color: '#666666',
  },
  syncDotPending: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.warning,
    marginLeft: 6,
  },
  txAmount: {
    fontSize: 16,
    color: '#FFFFFF',
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
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  emptySub: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
