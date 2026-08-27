import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getExpensesByTimeframe } from '../database/db';
import { getDashboardData } from '../services/AnalyticsService';
import { COLORS, SPACING, RADIUS, DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

const TIMEFRAMES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function getCategoryColor(name) {
  const cat = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === (name || '').toLowerCase()
  );
  return cat?.color || COLORS.accent;
}

export default function AnalyticsScreen() {
  const [timeframe, setTimeframe] = useState('week');
  const [chartData, setChartData] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [burnRate, setBurnRate] = useState({ pct: null, direction: 'flat' });

  const loadData = useCallback(async (tf) => {
    setLoading(true);
    try {
      const [timeframeData, dashData] = await Promise.all([
        getExpensesByTimeframe(tf).catch(() => ({ chartData: [], expenses: [] })),
        getDashboardData().catch(() => null),
      ]);

      const cd = timeframeData?.chartData || [];
      const exps = timeframeData?.expenses || [];

      setChartData(cd);
      setExpenses(exps);
      setDashboard(dashData);

      // Burn rate calculation
      if (cd.length >= 2) {
        const half = Math.floor(cd.length / 2);
        const first = cd.slice(0, half).reduce((s, d) => s + (d?.value || 0), 0);
        const second = cd.slice(half).reduce((s, d) => s + (d?.value || 0), 0);
        if (first > 0) {
          const pct = ((second - first) / first) * 100;
          setBurnRate({
            pct: Math.abs(pct).toFixed(0),
            direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat',
          });
        } else {
          setBurnRate({ pct: null, direction: 'flat' });
        }
      } else {
        setBurnRate({ pct: null, direction: 'flat' });
      }
    } catch (e) {
      console.error('[Analytics] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(timeframe); }, [timeframe]);

  const handleTimeframe = (tf) => {
    if (tf === timeframe) return;
    Haptics.selectionAsync();
    setTimeframe(tf);
  };

  // Safe calculations
  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e?.expense || 0), 0);
  const avgDaily = chartData.length > 0 ? totalSpent / chartData.length : 0;
  const txCount = expenses.length;

  // Safe chart data
  const safeData = Array.isArray(chartData)
    ? chartData.map((d, i) => ({
        value: typeof d?.value === 'number' && !isNaN(d.value) ? d.value : 0,
        label: typeof d?.label === 'string' ? d.label : '',
        frontColor: COLORS.accent,
        topLabelComponent: undefined,
      }))
    : [];

  const hasData = safeData.length > 0 && safeData.some((d) => d.value > 0);
  const maxVal = safeData.length > 0 ? Math.max(100, ...safeData.map((d) => d.value)) : 100;

  // Category breakdown from dashboard
  const categoryBreakdown = dashboard?.categoryBreakdown || [];
  const insights = dashboard?.insights || [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Analytics</Text>
      </View>

      {/* Timeframe Toggle */}
      <View style={styles.toggleRow}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity
            key={tf.id}
            activeOpacity={0.7}
            style={[styles.toggleBtn, timeframe === tf.id && styles.toggleBtnActive]}
            onPress={() => handleTimeframe(tf.id)}
          >
            <Text style={[styles.toggleLabel, timeframe === tf.id && styles.toggleLabelActive]}>
              {tf.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero Metric */}
      <View style={styles.heroCard}>
        <Text style={styles.heroMeta}>TOTAL · THIS {timeframe.toUpperCase()}</Text>
        <Text style={styles.heroAmount}>
          {formatINR(totalSpent, { showPaise: false })}
        </Text>
        <View style={styles.burnRow}>
          {burnRate.pct !== null ? (
            <>
              {burnRate.direction === 'up'
                ? <TrendingUp size={14} color={COLORS.error} />
                : burnRate.direction === 'down'
                ? <TrendingDown size={14} color={COLORS.success} />
                : <Minus size={14} color={COLORS.textMuted} />}
              <Text style={[
                styles.burnText,
                burnRate.direction === 'up' && { color: COLORS.error },
                burnRate.direction === 'down' && { color: COLORS.success },
                burnRate.direction === 'flat' && { color: COLORS.textMuted },
              ]}>
                {burnRate.direction === 'up' ? '+' : burnRate.direction === 'down' ? '−' : ''}
                {burnRate.pct}% vs prior period
              </Text>
            </>
          ) : (
            <Text style={styles.burnFlat}>Insufficient data for trend</Text>
          )}
        </View>
      </View>

      {/* Mini Metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>AVG / DAY</Text>
          <Text style={styles.metricValue}>
            {formatINR(avgDaily, { showPaise: false })}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>TRANSACTIONS</Text>
          <Text style={styles.metricValue}>{txCount}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>PROJECTED</Text>
          <Text style={styles.metricValue}>
            {formatINR(dashboard?.projected || 0, { showPaise: false, compact: true })}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>DAILY SPEND</Text>
        {loading ? (
          <View style={styles.emptyChart}>
            <ActivityIndicator color={COLORS.accent} size="small" />
            <Text style={styles.emptyChartText}>Loading…</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartIcon}>📊</Text>
            <Text style={styles.emptyChartTitle}>No spending data</Text>
            <Text style={styles.emptyChartText}>
              Log expenses to see your spending chart.
            </Text>
          </View>
        ) : (
          <BarChart
            data={safeData}
            width={CHART_WIDTH - 40}
            height={160}
            barWidth={safeData.length > 15 ? 6 : safeData.length > 7 ? 10 : 16}
            spacing={safeData.length > 15 ? 3 : safeData.length > 7 ? 6 : 12}
            barBorderRadius={3}
            frontColor={COLORS.accent}
            yAxisColor="transparent"
            xAxisColor={COLORS.border}
            yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 8 }}
            noOfSections={4}
            maxValue={maxVal * 1.2}
            backgroundColor="transparent"
            rulesColor={COLORS.borderSubtle}
            rulesType="solid"
            hideOrigin
            isAnimated
            animationDuration={400}
          />
        )}
      </View>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>CATEGORY BREAKDOWN</Text>
          {categoryBreakdown.slice(0, 8).map((item, idx) => {
            const total = categoryBreakdown.reduce((s, c) => s + (c.total || 0), 0);
            const pct = total > 0 ? ((item.total || 0) / total) * 100 : 0;
            const catColor = getCategoryColor(item.category);
            const catIcon = DEFAULT_CATEGORIES.find(
              (c) => c.name.toLowerCase() === (item.category || '').toLowerCase()
            )?.icon || '💳';

            return (
              <View key={`${item.category}-${idx}`} style={styles.breakdownRow}>
                <Text style={styles.breakdownIcon}>{catIcon}</Text>
                <View style={styles.breakdownInfo}>
                  <View style={styles.breakdownLabelRow}>
                    <Text style={styles.breakdownCat} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.breakdownAmt}>
                      {formatINR(item.total || 0, { showPaise: false })}
                    </Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        { width: `${Math.max(pct, 1)}%`, backgroundColor: catColor },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.breakdownPct}>{pct.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Budget Status */}
      {dashboard?.budget?.hasOverallBudget && (
        <View style={styles.budgetCard}>
          <Text style={styles.sectionTitle}>BUDGET STATUS</Text>
          <View style={styles.budgetRow}>
            <View>
              <Text style={styles.budgetLabel}>Monthly budget</Text>
              <Text style={styles.budgetValue}>
                {formatINR(dashboard.budget.overallBudget, { showPaise: false })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.budgetLabel}>Remaining</Text>
              <Text style={[
                styles.budgetValue,
                dashboard.budget.isOverBudget && { color: COLORS.error },
              ]}>
                {formatINR(dashboard.budget.remaining || 0, { showPaise: false })}
              </Text>
            </View>
          </View>
          <View style={styles.budgetTrack}>
            <View
              style={[
                styles.budgetFill,
                { width: `${Math.min(dashboard.budget.percentUsed || 0, 100)}%` },
                dashboard.budget.isOverBudget && { backgroundColor: COLORS.error },
              ]}
            />
          </View>
          {dashboard.budget.dailyAllowance > 0 && (
            <Text style={styles.budgetHint}>
              Daily allowance: {formatINR(dashboard.budget.dailyAllowance, { showPaise: false })} for {dashboard.budget.daysLeft} days
            </Text>
          )}
        </View>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Lightbulb size={14} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>INSIGHTS</Text>
          </View>
          {insights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={[
                styles.insightDot,
                insight.severity === 'warning' && { backgroundColor: COLORS.warning },
                insight.severity === 'error' && { backgroundColor: COLORS.error },
                insight.severity === 'success' && { backgroundColor: COLORS.success },
                insight.severity === 'info' && { backgroundColor: COLORS.accent },
              ]} />
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state for analytics with no data at all */}
      {!loading && txCount === 0 && categoryBreakdown.length === 0 && (
        <View style={styles.fullEmpty}>
          <Text style={styles.fullEmptyIcon}>📈</Text>
          <Text style={styles.fullEmptyTitle}>No analytics yet</Text>
          <Text style={styles.fullEmptyText}>
            Start logging expenses to unlock spending insights and category breakdowns.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  screenTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 3,
    marginBottom: SPACING.lg,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accentMuted,
  },
  toggleLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  toggleLabelActive: { color: COLORS.accent },

  // Hero
  heroCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  heroMeta: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  heroAmount: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginBottom: SPACING.md,
  },
  burnRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  burnText: { fontSize: 12, fontWeight: '600' },
  burnFlat: { color: COLORS.textMuted, fontSize: 12 },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  metricChip: { flex: 1, alignItems: 'center' },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: COLORS.border,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Chart
  chartCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  emptyChart: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyChartIcon: { fontSize: 32, marginBottom: SPACING.md, opacity: 0.5 },
  emptyChartTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: SPACING.xs },
  emptyChartText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },

  // Category Breakdown
  breakdownCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  breakdownIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  breakdownInfo: { flex: 1 },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownCat: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  breakdownAmt: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  breakdownBarBg: {
    height: 4,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownPct: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },

  // Budget
  budgetCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  budgetLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  budgetValue: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  budgetTrack: {
    height: 6,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  budgetHint: {
    color: COLORS.textMuted,
    fontSize: 11,
  },

  // Insights
  insightsCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: COLORS.accent,
  },
  insightText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Full empty state
  fullEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  fullEmptyIcon: { fontSize: 40, marginBottom: SPACING.md, opacity: 0.5 },
  fullEmptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: SPACING.sm },
  fullEmptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
