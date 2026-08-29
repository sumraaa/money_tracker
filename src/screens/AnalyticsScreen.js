import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Target, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getExpensesByTimeframe } from '../database/db';
import { getDashboardData } from '../services/AnalyticsService';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';
import { on, EventTypes } from '../services/EventBus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

const TIMEFRAMES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function getCategoryColor(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.color || COLORS.accent;
}
function getCategoryIcon(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.icon || '💳';
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

      if (cd.length >= 2) {
        const half = Math.floor(cd.length / 2);
        const first = cd.slice(0, half).reduce((s, d) => s + (d?.value || 0), 0);
        const second = cd.slice(half).reduce((s, d) => s + (d?.value || 0), 0);
        if (first > 0) {
          const pct = ((second - first) / first) * 100;
          setBurnRate({ pct: Math.abs(pct).toFixed(0), direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat' });
        } else { setBurnRate({ pct: null, direction: 'flat' }); }
      } else { setBurnRate({ pct: null, direction: 'flat' }); }
    } catch (e) {
      console.error('[Analytics] load error', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData(timeframe);
    const unsub1 = on(EventTypes.EXPENSE_CREATED, () => loadData(timeframe));
    const unsub2 = on(EventTypes.EXPENSE_UPDATED, () => loadData(timeframe));
    const unsub3 = on(EventTypes.EXPENSE_DELETED, () => loadData(timeframe));
    const unsub4 = on(EventTypes.BUDGET_CHANGED, () => loadData(timeframe));
    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
    };
  }, [timeframe]);

  const handleTimeframe = (tf) => {
    if (tf === timeframe) return;
    Haptics.selectionAsync();
    setTimeframe(tf);
  };

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e?.expense || 0), 0);
  const avgDaily = chartData.length > 0 ? totalSpent / chartData.length : 0;
  const txCount = expenses.length;

  const safeData = Array.isArray(chartData)
    ? chartData.map((d) => ({
        value: typeof d?.value === 'number' && !isNaN(d.value) ? d.value : 0,
        label: typeof d?.label === 'string' ? d.label : '',
        frontColor: COLORS.accent,
      }))
    : [];

  const hasData = safeData.length > 0 && safeData.some((d) => d.value > 0);
  const maxVal = safeData.length > 0 ? Math.max(100, ...safeData.map((d) => d.value)) : 100;
  const categoryBreakdown = dashboard?.categoryBreakdown || [];
  const insights = dashboard?.insights || [];
  const summary = dashboard?.summary;
  const score = dashboard?.spendingScore;
  const budget = dashboard?.budget;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Analytics</Text>
      </View>

      {/* Spending Summary */}
      {summary && summary.total > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeadline}>
            You spent {formatINR(summary.total, { showPaise: false })} {summary.period}.
          </Text>
          {summary.topCategories && summary.topCategories.length > 0 && (
            <View style={styles.summaryCategories}>
              {summary.topCategories.map((c, i) => (
                <View key={i} style={styles.summaryCatRow}>
                  <Text style={styles.summaryCatName}>{c.name}</Text>
                  <Text style={styles.summaryCatAmount}>{formatINR(c.total, { showPaise: false })}</Text>
                </View>
              ))}
            </View>
          )}
          {summary.changePercent !== null && (
            <Text style={[styles.summaryChange, summary.changePercent <= 0 ? { color: COLORS.success } : { color: COLORS.warning }]}>
              {summary.changePercent <= 0 ? '↓' : '↑'} {Math.abs(summary.changePercent).toFixed(0)}% {summary.direction} than last week
            </Text>
          )}
        </View>
      )}

      {/* Timeframe Toggle */}
      <View style={styles.toggleRow}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity key={tf.id} activeOpacity={0.7}
            style={[styles.toggleBtn, timeframe === tf.id && styles.toggleBtnActive]}
            onPress={() => handleTimeframe(tf.id)}>
            <Text style={[styles.toggleLabel, timeframe === tf.id && styles.toggleLabelActive]}>{tf.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero Metric */}
      <View style={styles.heroCard}>
        <Text style={styles.heroMeta}>TOTAL · THIS {timeframe.toUpperCase()}</Text>
        <Text style={styles.heroAmount}>{formatINR(totalSpent, { showPaise: false })}</Text>
        <View style={styles.burnRow}>
          {burnRate.pct !== null ? (
            <>
              {burnRate.direction === 'up' ? <TrendingUp size={14} color={COLORS.error} />
                : burnRate.direction === 'down' ? <TrendingDown size={14} color={COLORS.success} />
                : <Minus size={14} color={COLORS.textMuted} />}
              <Text style={[styles.burnText,
                burnRate.direction === 'up' && { color: COLORS.error },
                burnRate.direction === 'down' && { color: COLORS.success },
                burnRate.direction === 'flat' && { color: COLORS.textMuted },
              ]}>{burnRate.direction === 'up' ? '+' : burnRate.direction === 'down' ? '−' : ''}{burnRate.pct}% vs prior period</Text>
            </>
          ) : (<Text style={styles.burnFlat}>Insufficient data for trend</Text>)}
        </View>
      </View>

      {/* Mini Metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>AVG / DAY</Text>
          <Text style={styles.metricValue}>{formatINR(avgDaily, { showPaise: false })}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>TRANSACTIONS</Text>
          <Text style={styles.metricValue}>{txCount}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>PROJECTED</Text>
          <Text style={styles.metricValue}>{formatINR(dashboard?.projected || 0, { showPaise: false, compact: true })}</Text>
        </View>
      </View>

      {/* Spending Score */}
      {score && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>{score.score}</Text>
            <Text style={styles.scoreOf}>/100</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Spending Score</Text>
            <Text style={styles.scoreDesc}>{score.label}</Text>
          </View>
        </View>
      )}

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
            <Text style={styles.emptyChartText}>Log expenses to see your spending chart.</Text>
          </View>
        ) : (
          <BarChart
            data={safeData} width={CHART_WIDTH - 40} height={160}
            barWidth={safeData.length > 15 ? 6 : safeData.length > 7 ? 10 : 16}
            spacing={safeData.length > 15 ? 3 : safeData.length > 7 ? 6 : 12}
            barBorderRadius={3} frontColor={COLORS.accent}
            yAxisColor="transparent" xAxisColor={COLORS.border}
            yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 9 }}
            noOfSections={4} maxValue={maxVal * 1.2}
            backgroundColor="transparent" rulesColor={COLORS.borderSubtle}
            rulesType="solid" hideOrigin isAnimated animationDuration={400}
          />
        )}
      </View>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>WHERE DID YOUR MONEY GO?</Text>
          {categoryBreakdown.slice(0, 8).map((item, idx) => {
            const total = categoryBreakdown.reduce((s, c) => s + (c.total || 0), 0);
            const pct = total > 0 ? ((item.total || 0) / total) * 100 : 0;
            const catColor = getCategoryColor(item.category);
            const catIcon = getCategoryIcon(item.category);
            return (
              <View key={`${item.category}-${idx}`} style={styles.breakdownRow}>
                <Text style={styles.breakdownIcon}>{catIcon}</Text>
                <View style={styles.breakdownInfo}>
                  <View style={styles.breakdownLabelRow}>
                    <Text style={styles.breakdownCat} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.breakdownAmt}>{formatINR(item.total || 0, { showPaise: false })}</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${Math.max(pct, 1)}%`, backgroundColor: catColor }]} />
                  </View>
                </View>
                <Text style={styles.breakdownPct}>{pct.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Budget Status */}
      {budget?.hasOverallBudget && (
        <View style={styles.budgetCard}>
          <Text style={styles.sectionTitle}>BUDGET STATUS</Text>
          <View style={styles.budgetRow}>
            <View>
              <Text style={styles.budgetLabel}>Monthly budget</Text>
              <Text style={styles.budgetValue}>{formatINR(budget.overallBudget, { showPaise: false })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.budgetLabel}>Remaining</Text>
              <Text style={[styles.budgetValue, budget.isOverBudget && { color: COLORS.error }]}>
                {formatINR(budget.remaining || 0, { showPaise: false })}
              </Text>
            </View>
          </View>
          <View style={styles.budgetTrack}>
            <View style={[styles.budgetFill,
              { width: `${Math.min(budget.percentUsed || 0, 100)}%` },
              budget.isOverBudget && { backgroundColor: COLORS.error },
            ]} />
          </View>
          {budget.dailyAllowance > 0 && (
            <Text style={styles.budgetHint}>
              Safe to spend: {formatINR(budget.dailyAllowance, { showPaise: false })}/day for {budget.daysLeft} days
            </Text>
          )}
        </View>
      )}

      {/* Merchant Insights */}
      {dashboard?.merchantInsights && dashboard.merchantInsights.length > 0 && (
        <View style={styles.merchantCard}>
          <Text style={styles.sectionTitle}>TOP MERCHANTS THIS MONTH</Text>
          {dashboard.merchantInsights.map((m, idx) => (
            <View key={`${m.merchant}-${idx}`} style={styles.merchantRow}>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{m.merchant}</Text>
                <Text style={styles.merchantSub}>{m.count} transactions · Avg {formatINR(m.avgExpense || 0, { showPaise: false })}</Text>
              </View>
              <Text style={styles.merchantTotal}>{formatINR(m.total || 0, { showPaise: false })}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Payment Method Distribution */}
      {dashboard?.paymentAnalytics && dashboard.paymentAnalytics.length > 0 && (
        <View style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>PAYMENT METHODS</Text>
          {dashboard.paymentAnalytics.map((pm, idx) => (
            <View key={`${pm.method}-${idx}`} style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentLabelRow}>
                  <Text style={styles.paymentMethod}>{pm.method}</Text>
                  <Text style={styles.paymentAmt}>{formatINR(pm.total || 0, { showPaise: false })}</Text>
                </View>
                <View style={styles.paymentBarBg}>
                  <View style={[styles.paymentBarFill, { width: `${Math.max(pm.percent || 0, 2)}%` }]} />
                </View>
              </View>
              <Text style={styles.paymentPct}>{pm.percent ? pm.percent.toFixed(0) : 0}%</Text>
            </View>
          ))}
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
              <View style={[styles.insightDot,
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

      {/* Full empty state */}
      {!loading && txCount === 0 && categoryBreakdown.length === 0 && (
        <View style={styles.fullEmpty}>
          <Text style={styles.fullEmptyIcon}>📈</Text>
          <Text style={styles.fullEmptyTitle}>No analytics yet</Text>
          <Text style={styles.fullEmptyText}>Start logging expenses to unlock spending insights and category breakdowns.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: 40 },

  header: { marginBottom: SPACING.lg },
  screenTitle: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },

  // Spending Summary
  summaryCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.lg,
  },
  summaryHeadline: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginBottom: SPACING.md, lineHeight: 26 },
  summaryCategories: { marginBottom: SPACING.md },
  summaryCatRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryCatName: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  summaryCatAmount: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary },
  summaryChange: { ...TYPOGRAPHY.label, marginTop: SPACING.xs },

  // Toggle
  toggleRow: {
    flexDirection: 'row', backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, padding: 3, marginBottom: SPACING.lg, gap: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: COLORS.accentMuted },
  toggleLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },
  toggleLabelActive: { color: COLORS.accent },

  // Hero
  heroCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  heroMeta: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, marginBottom: SPACING.xs },
  heroAmount: { ...TYPOGRAPHY.displayMd, color: COLORS.textPrimary, fontVariant: ['tabular-nums'], marginBottom: SPACING.md },
  burnRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  burnText: { ...TYPOGRAPHY.labelSm },
  burnFlat: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },

  // Metrics
  metricsRow: {
    flexDirection: 'row', backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, alignItems: 'center',
  },
  metricChip: { flex: 1, alignItems: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: COLORS.border },
  metricLabel: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, fontSize: 9, marginBottom: 4 },
  metricValue: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary },

  // Score
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    marginBottom: SPACING.md, gap: SPACING.lg,
  },
  scoreCircle: {
    flexDirection: 'row', alignItems: 'baseline', width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.accentBg, borderWidth: 2, borderColor: COLORS.accent,
    justifyContent: 'center',
  },
  scoreNum: { ...TYPOGRAPHY.monoXl, color: COLORS.accent },
  scoreOf: { ...TYPOGRAPHY.labelXs, color: COLORS.textMuted, marginLeft: 1 },
  scoreInfo: { flex: 1 },
  scoreTitle: { ...TYPOGRAPHY.label, color: COLORS.textPrimary },
  scoreDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, marginTop: 2 },

  // Chart
  chartCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden',
  },
  sectionTitle: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, marginBottom: SPACING.md },
  emptyChart: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyChartIcon: { fontSize: 32, marginBottom: SPACING.md, opacity: 0.5 },
  emptyChartTitle: { ...TYPOGRAPHY.h3, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  emptyChartText: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, textAlign: 'center' },

  // Category Breakdown
  breakdownCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  breakdownIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  breakdownInfo: { flex: 1 },
  breakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  breakdownCat: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, fontWeight: '600', flex: 1 },
  breakdownAmt: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary },
  breakdownBarBg: { height: 4, backgroundColor: COLORS.bgSurface, borderRadius: 2, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 2 },
  breakdownPct: { ...TYPOGRAPHY.monoSm, color: COLORS.textMuted, minWidth: 36, textAlign: 'right' },

  // Budget
  budgetCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  budgetLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted, marginBottom: 3 },
  budgetValue: { ...TYPOGRAPHY.monoLg, color: COLORS.textPrimary },
  budgetTrack: { height: 6, backgroundColor: COLORS.bgSurface, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.sm },
  budgetFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
  budgetHint: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted },

  // Insights
  insightsCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md, gap: SPACING.sm },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: COLORS.accent },
  insightText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, flex: 1, lineHeight: 21 },

  // Merchant Insights
  merchantCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  merchantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  merchantInfo: { flex: 1, marginRight: SPACING.md },
  merchantName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '600' },
  merchantSub: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, marginTop: 2 },
  merchantTotal: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary },

  // Payment Method
  paymentCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  paymentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  paymentInfo: { flex: 1 },
  paymentLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  paymentMethod: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, fontWeight: '600' },
  paymentAmt: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary },
  paymentBarBg: { height: 4, backgroundColor: COLORS.bgSurface, borderRadius: 2, overflow: 'hidden' },
  paymentBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  paymentPct: { ...TYPOGRAPHY.monoSm, color: COLORS.textMuted, minWidth: 36, textAlign: 'right' },

  // Full empty
  fullEmpty: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  fullEmptyIcon: { fontSize: 44, marginBottom: SPACING.md, opacity: 0.5 },
  fullEmptyTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  fullEmptyText: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
