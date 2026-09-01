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
  return cat?.color || COLORS.accentRed;
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

  const rawValues = Array.isArray(chartData) ? chartData.map(d => (typeof d?.value === 'number' ? d.value : 0)) : [];
  const maxValueInChart = rawValues.length > 0 ? Math.max(...rawValues) : 0;

  const safeData = Array.isArray(chartData)
    ? chartData.map((d) => {
        const val = typeof d?.value === 'number' && !isNaN(d.value) ? d.value : 0;
        const isPeak = val > 0 && val === maxValueInChart;
        return {
          value: val,
          label: typeof d?.label === 'string' ? d.label : '',
          frontColor: isPeak ? '#ca0013' : '#171e19',
        };
      })
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

      {/* Timeframe Toggle Pills */}
      <View style={styles.toggleRow}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity key={tf.id} activeOpacity={0.7}
            style={[styles.toggleBtn, timeframe === tf.id && styles.toggleBtnActive]}
            onPress={() => handleTimeframe(tf.id)}>
            <Text style={[styles.toggleLabel, timeframe === tf.id && styles.toggleLabelActive]}>{tf.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Spending Summary Banner */}
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

      {/* Hero Metric Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroCardHeader}>
          <Text style={styles.heroMeta}>TOTAL SPEND · THIS {timeframe.toUpperCase()}</Text>
          <View style={styles.cardPillBadge}>
            <Text style={styles.cardPillText}>01</Text>
          </View>
        </View>
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

      {/* Mini Metrics 3-Column Bento Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridLabel}>AVG / DAY</Text>
          <Text style={styles.metricGridValue}>{formatINR(avgDaily, { showPaise: false })}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridLabel}>TRANSACTIONS</Text>
          <Text style={styles.metricGridValue}>{txCount}</Text>
        </View>
        <View style={styles.metricGridItem}>
          <Text style={styles.metricGridLabel}>PROJECTED</Text>
          <Text style={styles.metricGridValue}>{formatINR(dashboard?.projected || 0, { showPaise: false, compact: true })}</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartCardHeader}>
          <Text style={styles.sectionTitle}>SPENDING OVERVIEW</Text>
          <View style={styles.cardPillBadge}>
            <Text style={styles.cardPillText}>02</Text>
          </View>
        </View>
        {loading ? (
          <View style={styles.emptyChart}>
            <ActivityIndicator color={COLORS.accentRed} size="small" />
            <Text style={styles.emptyChartText}>Loading chart…</Text>
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
            barBorderRadius={6} frontColor="#171e19"
            yAxisColor="transparent" xAxisColor="rgba(183, 198, 194, 0.35)"
            yAxisTextStyle={{ color: '#6c7772', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#6c7772', fontSize: 9 }}
            noOfSections={4} maxValue={maxVal * 1.2}
            backgroundColor="transparent" rulesColor="rgba(183, 198, 194, 0.20)"
            rulesType="solid" hideOrigin isAnimated animationDuration={400}
          />
        )}
      </View>

      {/* Budget Status */}
      {budget?.hasOverallBudget && (
        <View style={styles.budgetCard}>
          <Text style={styles.sectionTitle}>BUDGET PROGRESS</Text>
          <View style={styles.budgetRow}>
            <View>
              <Text style={styles.budgetLabel}>Monthly Limit</Text>
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
              Safe daily limit: {formatINR(budget.dailyAllowance, { showPaise: false })}/day for {budget.daysLeft} remaining days.
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
            <Lightbulb size={16} color={COLORS.accentRed} />
            <Text style={styles.sectionTitle}>SMART INSIGHTS</Text>
          </View>
          {insights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={[styles.insightDot,
                insight.severity === 'warning' && { backgroundColor: COLORS.warning },
                insight.severity === 'error' && { backgroundColor: COLORS.error },
                insight.severity === 'success' && { backgroundColor: COLORS.success },
                insight.severity === 'info' && { backgroundColor: COLORS.accentRed },
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
  scroll: { flex: 1, backgroundColor: '#eeebe3' },
  content: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: 110 },

  header: { marginBottom: SPACING.md },
  screenTitle: { fontSize: 32, fontWeight: '800', color: '#171e19', letterSpacing: -0.5 },

  // Toggle
  toggleRow: {
    flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', padding: 4, marginBottom: SPACING.lg, gap: 4,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#171e19' },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#6c7772' },
  toggleLabelActive: { color: '#ffffff', fontWeight: '700' },

  // Spending Summary
  summaryCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.lg,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  summaryHeadline: { fontSize: 18, fontWeight: '800', color: '#171e19', marginBottom: SPACING.md, lineHeight: 24 },
  summaryCategories: { marginBottom: SPACING.md },
  summaryCatRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryCatName: { fontSize: 14, color: '#6c7772', fontWeight: '500' },
  summaryCatAmount: { fontSize: 14, fontWeight: '700', color: '#171e19' },
  summaryChange: { fontSize: 13, fontWeight: '700', marginTop: SPACING.xs },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff', borderRadius: 40, padding: SPACING.xxl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4,
  },
  heroCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  heroMeta: { fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5 },
  cardPillBadge: { backgroundColor: 'rgba(183, 198, 194, 0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  cardPillText: { fontSize: 10, fontWeight: '800', color: '#6c7772' },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#171e19', fontVariant: ['tabular-nums'], marginBottom: SPACING.md, letterSpacing: -0.5 },
  burnRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  burnText: { fontSize: 13, fontWeight: '700' },
  burnFlat: { fontSize: 13, color: '#6c7772', fontWeight: '500' },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  metricGridItem: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: SPACING.md,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', alignItems: 'center',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  metricGridLabel: { fontSize: 10, fontWeight: '800', color: '#6c7772', letterSpacing: 1, marginBottom: 4 },
  metricGridValue: { fontSize: 15, fontWeight: '800', color: '#171e19' },

  // Chart
  chartCard: {
    backgroundColor: '#ffffff', borderRadius: 32, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md, overflow: 'hidden',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  chartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5 },
  emptyChart: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyChartIcon: { fontSize: 32, marginBottom: SPACING.md, opacity: 0.5 },
  emptyChartTitle: { fontSize: 17, fontWeight: '700', color: '#171e19', marginBottom: SPACING.xs },
  emptyChartText: { fontSize: 13, color: '#6c7772', textAlign: 'center' },

  // Budget
  budgetCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  budgetLabel: { fontSize: 12, color: '#6c7772', fontWeight: '600', marginBottom: 3 },
  budgetValue: { fontSize: 18, fontWeight: '800', color: '#171e19' },
  budgetTrack: { height: 6, backgroundColor: '#eeebe3', borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.sm },
  budgetFill: { height: '100%', backgroundColor: '#ca0013', borderRadius: 3 },
  budgetHint: { fontSize: 13, color: '#6c7772', lineHeight: 18 },

  // Insights
  insightsCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
  },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md, gap: SPACING.sm },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: '#ca0013' },
  insightText: { fontSize: 14, color: '#171e19', flex: 1, lineHeight: 20 },

  // Merchant Insights
  merchantCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
  },
  merchantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  merchantInfo: { flex: 1, marginRight: SPACING.md },
  merchantName: { fontSize: 15, color: '#171e19', fontWeight: '700' },
  merchantSub: { fontSize: 12, color: '#6c7772', marginTop: 2 },
  merchantTotal: { fontSize: 15, fontWeight: '800', color: '#171e19' },

  // Payment Method
  paymentCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
  },
  paymentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  paymentInfo: { flex: 1 },
  paymentLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  paymentMethod: { fontSize: 14, color: '#171e19', fontWeight: '700' },
  paymentAmt: { fontSize: 14, fontWeight: '800', color: '#171e19' },
  paymentBarBg: { height: 4, backgroundColor: '#eeebe3', borderRadius: 2, overflow: 'hidden' },
  paymentBarFill: { height: '100%', backgroundColor: '#ca0013', borderRadius: 2 },
  paymentPct: { fontSize: 12, fontWeight: '700', color: '#6c7772', minWidth: 36, textAlign: 'right' },

  // Full empty
  fullEmpty: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  fullEmptyIcon: { fontSize: 44, marginBottom: SPACING.md, opacity: 0.5 },
  fullEmptyTitle: { fontSize: 18, fontWeight: '700', color: '#171e19', marginBottom: SPACING.sm },
  fullEmptyText: { fontSize: 13, color: '#6c7772', textAlign: 'center', lineHeight: 20 },
});

