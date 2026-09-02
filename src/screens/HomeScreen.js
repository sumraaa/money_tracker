/**
 * ZERO FRICTION — Home Screen (Log)
 * Sophisticated Playful / Modern Warm Aesthetic
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, FlatList, Alert, RefreshControl,
} from 'react-native';
import { Settings, Plus, ChevronRight, RefreshCw, TrendingDown, TrendingUp, Shield, Wallet, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { getAllExpenses, deleteExpense } from '../database/db';
import { triggerSync } from '../services/SyncService';
import { getTodaySpend, getMonthSpend, getMonthlyDailyAverage, getBudgetStatus, getSafeToSpendToday, getSpendingScore, getWeekSpend, getLastWeekSpend } from '../services/AnalyticsService';
import { getUser } from '../services/AuthService';
import { on, EventTypes } from '../services/EventBus';
import QuickLogModal from '../components/QuickLogModal';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatShortDate, formatTime } from '../utils/dates';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ GOOD MORNING';
  if (h < 17) return '🌤️ GOOD AFTERNOON';
  return '🌙 GOOD EVENING';
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

export default function HomeScreen({ syncStatus, onExpenseAdded, onOpenSettings, onOpenQuickLog }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [dailyAvg, setDailyAvg] = useState(0);
  const [budget, setBudget] = useState({ hasOverallBudget: false });
  const [safeToSpend, setSafeToSpend] = useState(null);
  const [weekData, setWeekData] = useState({ total: 0 });
  const [lastWeekData, setLastWeekData] = useState({ total: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Sumra');

  const loadData = useCallback(async () => {
    try {
      const [exps, today, month, avg, budgetData, safe, week, lastWeek, userData] = await Promise.all([
        getAllExpenses({ limit: 15, sortBy: 'date_time', sortOrder: 'DESC' }),
        getTodaySpend().catch(() => ({ total: 0 })),
        getMonthSpend().catch(() => ({ total: 0 })),
        getMonthlyDailyAverage().catch(() => 0),
        getBudgetStatus().catch(() => ({ hasOverallBudget: false })),
        getSafeToSpendToday().catch(() => null),
        getWeekSpend().catch(() => ({ total: 0 })),
        getLastWeekSpend().catch(() => ({ total: 0 })),
        getUser().catch(() => ({ name: 'Sumra' })),
      ]);
      setExpenses(exps);
      setTodayTotal(today.total);
      setMonthTotal(month.total);
      setDailyAvg(avg);
      setBudget(budgetData);
      setSafeToSpend(safe);
      setWeekData(week);
      setLastWeekData(lastWeek);
      if (userData?.name) {
        setUserName(userData.name);
      }
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
        if (onOpenQuickLog) onOpenQuickLog();
        else setModalVisible(true);
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const subscription = Linking.addEventListener('url', handleDeepLink);

    const unsub1 = on(EventTypes.BUDGET_CHANGED, loadData);
    const unsub2 = on(EventTypes.EXPENSE_DELETED, loadData);
    const unsub3 = on(EventTypes.SYNC_COMPLETED, loadData);
    const unsub4 = on(EventTypes.EXPENSE_CREATED, loadData);
    const unsub5 = on(EventTypes.EXPENSE_UPDATED, loadData);
    const unsub6 = on(EventTypes.TAB_CHANGED, (targetTab) => {
      if (targetTab === 'home') loadData();
    });

    return () => {
      subscription.remove();
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
    };
  }, [loadData]);

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

  const openLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onOpenQuickLog) onOpenQuickLog();
    else setModalVisible(true);
  };

  const unsyncedCount = expenses.filter((e) => e.sync_status === 0).length;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const weekChange = lastWeekData.total > 0
    ? ((weekData.total - lastWeekData.total) / lastWeekData.total) * 100
    : null;

  const initial = (userName?.trim()?.charAt(0) || 'P').toUpperCase();

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
        <View style={[styles.txIconWrap, { backgroundColor: getCategoryColor(item.category) + '18' }]}>
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
        <View style={styles.headerLeft}>
          <Text style={styles.greetingLabel}>{getGreeting()}</Text>
          <Text style={styles.userName}>Hi, {userName || 'Sumra'}!</Text>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>
              📅 {dateStr}
              {budget.hasOverallBudget ? ` · ${budget.percentUsed?.toFixed(0)}% budget used` : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.profileContainer}
          onPress={onOpenSettings}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initial}</Text>
          </View>
          <View style={[
            styles.profileStatusDot,
            unsyncedCount > 0 && { backgroundColor: COLORS.warning }
          ]} />
        </TouchableOpacity>
      </View>

      {/* Hero Feature Spend Card */}
      <View style={styles.heroCard}>
        {/* Semi-transparent decorative blob */}
        <View style={styles.decorativeBlob} />

        <View style={styles.heroTopRow}>
          <View style={styles.iconHolder}>
            <Text style={{ fontSize: 30 }}>💳</Text>
          </View>

          <View style={styles.heroLabelWrap}>
            <Text style={styles.heroOverline}>SPENT TODAY</Text>
            <Text style={styles.heroAmount}>
              {formatINR(todayTotal, { showPaise: false })}
            </Text>
          </View>
        </View>

        {/* 2-Column Bento Grid Inside Card */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoCard}>
            <Text style={styles.bentoTitle}>THIS MONTH</Text>
            <Text style={styles.bentoValue}>
              {formatINR(monthTotal, { showPaise: false, compact: monthTotal >= 100000 })}
            </Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoTitle}>DAILY AVG</Text>
            <Text style={styles.bentoValue}>
              {formatINR(dailyAvg, { showPaise: false })}
            </Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoTitle}>
              {safeToSpend ? 'SAFE TO SPEND' : 'REMAINING'}
            </Text>
            <Text style={styles.bentoValue}>
              {safeToSpend
                ? formatINR(safeToSpend.amount, { showPaise: false })
                : budget.hasOverallBudget
                ? formatINR(budget.remaining || 0, { showPaise: false })
                : '₹—'}
            </Text>
          </View>

          <View style={styles.bentoCard}>
            <Text style={styles.bentoTitle}>WEEK TREND</Text>
            <View style={styles.bentoTrendRow}>
              {weekChange !== null && (
                <Text style={[
                  styles.bentoValue,
                  weekChange <= 0 ? { color: COLORS.success } : { color: COLORS.warning }
                ]}>
                  {weekChange <= 0 ? '↓' : '↑'}{Math.abs(weekChange).toFixed(0)}%
                </Text>
              )}
              {weekChange === null && (
                <Text style={styles.bentoValue}>Flat</Text>
              )}
            </View>
          </View>
        </View>

        {/* Info/Alert Banner inside Card */}
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            {budget.hasOverallBudget
              ? budget.isOverBudget
                ? '⚠️ You have exceeded your monthly budget limit!'
                : `💡 Safe daily pace: ${formatINR(budget.dailyAllowance || 0, { showPaise: false })}/day remaining.`
              : '💡 Tip: Set a monthly budget in Settings for automated pace tracking.'}
          </Text>
        </View>
      </View>

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
      <StatusBar barStyle="dark-content" backgroundColor="#eeebe3" />

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
            tintColor={COLORS.accentRed}
            colors={[COLORS.accentRed]}
            progressBackgroundColor="#ffffff"
          />
        }
      />

      {/* Quick Log Modal Fallback */}
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
  container: {
    flex: 1,
    backgroundColor: '#eeebe3',
  },
  listContent: {
    paddingBottom: 140,
  },

  // Header & Greeting
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: 20,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6c7772',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  userName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#171e19',
    letterSpacing: -0.5,
  },
  datePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(183, 198, 194, 0.25)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c7772',
  },

  // Profile Avatar with cutout red status dot
  profileContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#171e19',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ca0013',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  // Hero Feature Spend Card
  heroCard: {
    position: 'relative',
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    padding: SPACING.xxl,
    backgroundColor: '#ffffff',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    overflow: 'hidden',
  },
  decorativeBlob: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(183, 198, 194, 0.20)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  iconHolder: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#eeebe3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabelWrap: {
    flex: 1,
  },
  heroOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6c7772',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#171e19',
    letterSpacing: -1,
  },

  // Bento 2-Column Grid Inside Card
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  bentoCard: {
    width: '47.5%',
    backgroundColor: '#eeebe3',
    borderRadius: 16,
    padding: SPACING.md,
  },
  bentoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6c7772',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bentoValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#171e19',
  },
  bentoTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Alert/Info Box
  alertBanner: {
    backgroundColor: 'rgba(183, 198, 194, 0.20)',
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#171e19',
    lineHeight: 18,
  },

  // Quick Log CTA
  quickLogCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    gap: SPACING.md,
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  quickLogIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ca0013',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogTextWrap: {
    flex: 1,
  },
  quickLogTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171e19',
  },
  quickLogSub: {
    fontSize: 11,
    color: '#6c7772',
    marginTop: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6c7772',
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c7772',
  },

  // Secondary Feed Items (Transaction Cards)
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    gap: SPACING.md,
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIcon: {
    fontSize: 20,
  },
  txDetails: {
    flex: 1,
  },
  txLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171e19',
    marginBottom: 2,
  },
  txSub: {
    fontSize: 12,
    color: '#6c7772',
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  txDate: {
    fontSize: 11,
    color: '#8a9691',
  },
  syncDotPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
    marginLeft: 6,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#171e19',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: SPACING.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171e19',
    marginBottom: SPACING.sm,
  },
  emptySub: {
    fontSize: 13,
    color: '#6c7772',
    textAlign: 'center',
    lineHeight: 20,
  },
});
