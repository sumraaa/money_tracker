import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { AreaChart } from 'react-native-gifted-charts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getExpensesByTimeframe } from '../database/db';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const NEON = '#38BDF8';

const TIMEFRAMES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function CategoryBreakdown({ expenses }) {
  const totals = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    totals[cat] = (totals[cat] || 0) + parseFloat(e.expense || 0);
  });
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.sectionTitle}>CATEGORY BREAKDOWN</Text>
      {sorted.map(([cat, val]) => {
        const pct = total > 0 ? (val / total) * 100 : 0;
        return (
          <View key={cat} style={styles.breakdownRow}>
            <Text style={styles.breakdownCat} numberOfLines={1}>{cat}</Text>
            <View style={styles.breakdownBarBg}>
              <View style={[styles.breakdownBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.breakdownAmt}>
              ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AnalyticsScreen() {
  const [timeframe, setTimeframe] = useState('week');
  const [chartData, setChartData] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [burnRate, setBurnRate] = useState({ pct: null, direction: 'flat' });

  const loadData = useCallback(async (tf) => {
    setLoading(true);
    try {
      const { chartData: cd, expenses: exps } = await getExpensesByTimeframe(tf);
      setChartData(cd || []);
      setExpenses(exps || []);
      // Burn rate: compare first half vs second half of period
      const half = Math.floor((cd || []).length / 2);
      const first = (cd || []).slice(0, half).reduce((s, d) => s + d.value, 0);
      const second = (cd || []).slice(half).reduce((s, d) => s + d.value, 0);
      if (first > 0) {
        const pct = ((second - first) / first) * 100;
        setBurnRate({
          pct: Math.abs(pct).toFixed(1),
          direction: pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat',
        });
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

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.expense || 0), 0);
  const avgDaily = chartData.length > 0 ? totalSpent / chartData.length : 0;
  const peakDay = chartData.length > 0
    ? chartData.reduce((max, d) => (d.value > max.value ? d : max), { value: 0, label: '—' })
    : { value: 0, label: '—' };
  // Strict: ensure every data point is a plain number, never undefined/NaN
  const safeData = Array.isArray(chartData)
    ? chartData.map((d) => ({
        value: typeof d?.value === 'number' && !isNaN(d.value) ? d.value : 0,
        label: typeof d?.label === 'string' ? d.label : '',
      }))
    : [];
  const hasData = safeData.length > 0 && safeData.some((d) => d.value > 0);
  // Clamp to 100 minimum to avoid Math.max spread crash on empty array
  const maxVal = safeData.length > 0 ? Math.max(100, ...safeData.map((d) => d.value)) : 100;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Analytics</Text>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Timeframe Toggle */}
      <View style={styles.toggleRow}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity key={tf.id} activeOpacity={0.7}
            style={[styles.toggleBtn, timeframe === tf.id && styles.toggleBtnActive]}
            onPress={() => handleTimeframe(tf.id)}>
            <Text style={[styles.toggleLabel, timeframe === tf.id && styles.toggleLabelActive]}>
              {tf.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroMeta}>TOTAL SPENT · THIS {timeframe.toUpperCase()}</Text>
        <Text style={styles.heroAmount}>
          ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.burnRow}>
          {burnRate.pct !== null ? (
            <>
              {burnRate.direction === 'up'
                ? <TrendingUp size={16} color="#F87171" />
                : burnRate.direction === 'down'
                ? <TrendingDown size={16} color="#34D399" />
                : <Minus size={16} color="#A0A0AB" />}
              <Text style={[styles.burnText,
                burnRate.direction === 'up' ? styles.burnUp
                : burnRate.direction === 'down' ? styles.burnDown
                : styles.burnFlat]}>
                {burnRate.direction === 'up' ? '+' : burnRate.direction === 'down' ? '-' : ''}
                {burnRate.pct}% Burn Rate vs prior period
              </Text>
            </>
          ) : (
            <Text style={styles.burnFlat}>Not enough data for burn rate</Text>
          )}
        </View>
      </View>

      {/* Chart Card */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>DAILY SPEND · ₹</Text>
        {loading ? (
          <View style={styles.emptyChart}>
            <ActivityIndicator color={NEON} size="large" />
            <Text style={styles.emptySub} numberOfLines={1}>Fetching data…</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.insufficientData}>
            <View style={styles.insufficientGrid}>
              {[...Array(9)].map((_, i) => (
                <View key={i} style={styles.gridDot} />
              ))}
            </View>
            <Text style={styles.insufficientIcon}>⬡</Text>
            <Text style={styles.insufficientTitle}>Insufficient Data{`\n`}for Analysis</Text>
            <Text style={styles.insufficientSub}>Log at least one expense to{`\n`}generate your spending chart.</Text>
            <View style={styles.insufficientRule} />
            <Text style={styles.insufficientHint}>CHART · AWAITING INPUT</Text>
          </View>
        ) : (
          <AreaChart
            data={safeData}
            width={CHART_WIDTH - 24}
            height={180}
            color={NEON}
            startFillColor={NEON}
            endFillColor={'rgba(56,189,248,0.01)'}
            startOpacity={0.28}
            endOpacity={0.01}
            thickness={2.5}
            curved
            hideDataPoints={safeData.length > 14}
            dataPointsColor={NEON}
            dataPointsRadius={3}
            xAxisColor="rgba(255,255,255,0.08)"
            yAxisColor="rgba(255,255,255,0.08)"
            yAxisTextStyle={{ color: '#52525B', fontSize: 9 }}
            xAxisLabelTextStyle={{ color: '#52525B', fontSize: 9 }}
            noOfSections={4}
            maxValue={maxVal * 1.25}
            backgroundColor="transparent"
            rulesColor="rgba(255,255,255,0.04)"
            rulesType="solid"
            hideOrigin
            pointerConfig={{
              pointerStripUptoDataPoint: true,
              pointerStripColor: NEON,
              pointerStripWidth: 1,
              strokeDashArray: [4, 4],
              pointerColor: NEON,
              radius: 5,
              pointerLabelWidth: 100,
              pointerLabelHeight: 40,
              activatePointersOnLongPress: false,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items) => {
                const item = items?.[0];
                if (!item) return null;
                return (
                  <View style={styles.tooltipBox}>
                    <Text style={styles.tooltipVal}>
                      ₹{(item.value || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                );
              },
            }}
          />
        )}
      </View>

      {/* Metric Chips */}
      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>AVG / DAY</Text>
          <Text style={styles.metricValue}>
            ₹{avgDaily.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>PEAK DAY</Text>
          <Text style={styles.metricValue}>
            ₹{(peakDay?.value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.metricSub}>{peakDay?.label || '—'}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>ENTRIES</Text>
          <Text style={styles.metricValue}>{expenses.length}</Text>
        </View>
      </View>

      {expenses.length > 0 && <CategoryBreakdown expenses={expenses} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  liveChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#38BDF8' },
  liveText: { color: '#38BDF8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 4, marginBottom: 20, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)' },
  toggleLabel: { color: '#52525B', fontSize: 13, fontWeight: '700' },
  toggleLabelActive: { color: '#38BDF8' },
  heroCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  heroMeta: { color: '#52525B', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  heroAmount: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', letterSpacing: 0.5, marginBottom: 12 },
  burnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  burnText: { fontSize: 13, fontWeight: '700' },
  burnUp: { color: '#F87171' },
  burnDown: { color: '#34D399' },
  burnFlat: { color: '#71717A', fontSize: 13 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16, overflow: 'hidden' },
  sectionTitle: { color: '#A0A0AB', fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 16 },
  emptyChart: { alignItems: 'center', paddingVertical: 24 },
  emptySub: { color: '#52525B', fontSize: 12, marginTop: 10 },
  // Futuristic "Insufficient Data" placeholder
  insufficientData: { alignItems: 'center', paddingVertical: 32, position: 'relative', overflow: 'hidden' },
  insufficientGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 60, height: 60,
    justifyContent: 'space-between', alignContent: 'space-between', marginBottom: 16, opacity: 0.25 },
  gridDot: { width: 6, height: 6, borderRadius: 1, backgroundColor: '#38BDF8' },
  insufficientIcon: { fontSize: 34, marginBottom: 10, color: '#38BDF8', opacity: 0.6 },
  insufficientTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center',
    letterSpacing: 0.3, lineHeight: 22, marginBottom: 8 },
  insufficientSub: { color: '#52525B', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  insufficientRule: { width: 60, height: 1, backgroundColor: 'rgba(56,189,248,0.25)', marginBottom: 10 },
  insufficientHint: { color: '#38BDF8', fontSize: 9, fontWeight: '700', letterSpacing: 2, opacity: 0.6 },
  tooltipBox: { backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: 8, paddingHorizontal: 8,
    paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)' },
  tooltipVal: { color: '#38BDF8', fontSize: 12, fontWeight: '800' },
  metricsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20, marginBottom: 16, alignItems: 'center' },
  metricChip: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  metricLabel: { color: '#52525B', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  metricValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  metricSub: { color: '#52525B', fontSize: 10, marginTop: 2 },
  breakdownCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownCat: { color: '#D4D4D8', fontSize: 12, fontWeight: '600', width: 90 },
  breakdownBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', backgroundColor: '#38BDF8', borderRadius: 3 },
  breakdownAmt: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', minWidth: 52, textAlign: 'right' },
});
