import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getExpensesByTimeframe, deleteExpense } from '../database/db';
import { triggerSync } from '../services/SyncService';

const TIMEFRAMES = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

const CATEGORY_EMOJIS = {
  'Fast Food & Swiggy': '🍔',
  'Gym & Supplements': '🏋️',
  'Subscriptions': '🎵',
  'Education & Courses': '🎓',
  'Transport': '🚗',
};

function getEmoji(cat) {
  if (!cat) return '💳';
  if (CATEGORY_EMOJIS[cat]) return CATEGORY_EMOJIS[cat];
  if (cat.includes('Food') || cat.includes('Swiggy')) return '🍔';
  if (cat.includes('Gym') || cat.includes('Fitness')) return '🏋️';
  if (cat.includes('Sub') || cat.includes('Spotify')) return '🎵';
  if (cat.includes('Edu') || cat.includes('Course')) return '🎓';
  if (cat.includes('Trans') || cat.includes('Uber')) return '🚗';
  return '💳';
}

export default function HistoryScreen({ onDataChanged }) {
  const [timeframe, setTimeframe] = useState('week');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true); // true = highest first

  const loadData = useCallback(async (tf) => {
    setLoading(true);
    try {
      const { expenses: exps } = await getExpensesByTimeframe(tf);
      setExpenses(exps || []);
    } catch (e) {
      console.error('[History] load error', e);
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

  const handleDelete = (id, category, expense) => {
    Alert.alert(
      'Delete Entry',
      `Remove ${category} (₹${parseFloat(expense).toFixed(2)}) from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteExpense(id);
            loadData(timeframe);
            if (onDataChanged) onDataChanged();
          },
        },
      ]
    );
  };

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.expense || 0), 0);

  const sortedExpenses = sortDesc
    ? [...expenses].sort((a, b) => parseFloat(b.expense || 0) - parseFloat(a.expense || 0))
    : [...expenses].sort((a, b) => parseFloat(a.expense || 0) - parseFloat(b.expense || 0));

  const renderItem = ({ item, index }) => {
    const isSynced = item.sync_status === 1;
    const date = new Date(item.date_time);
    const dateStr = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const emoji = getEmoji(item.category);

    return (
      <View style={[styles.row, index === 0 && styles.rowFirst]}>
        {/* Timeline dot */}
        <View style={styles.timelineCol}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineLine} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>{emoji}</Text>
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.catText} numberOfLines={1}>{item.category}</Text>
              {item.message ? (
                <Text style={styles.noteText} numberOfLines={1}>{item.message}</Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.dateText}>{dateStr} · {timeStr}</Text>
                <View style={[styles.syncDot, isSynced ? styles.syncDotSynced : styles.syncDotQueued]} />
              </View>
            </View>
          </View>

          <View style={styles.cardRight}>
            <Text style={styles.amountText}>
              ₹{parseFloat(item.expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id, item.category, item.expense)}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>History</Text>
        <Text style={styles.entryCount}>{expenses.length} entries</Text>
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

      {/* Summary Strip + Sort Toggle */}
      <View style={styles.summaryStrip}>
        <View>
          <Text style={styles.summaryLabel}>PERIOD TOTAL</Text>
          <Text style={styles.summaryValue}>
            ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.sortToggle}
          activeOpacity={0.75}
          onPress={() => {
            Haptics.selectionAsync();
            setSortDesc((v) => !v);
          }}
        >
          <Text style={styles.sortIcon}>{sortDesc ? '↓' : '↑'}</Text>
          <Text style={styles.sortLabel}>{sortDesc ? 'Highest' : 'Lowest'}</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#38BDF8" style={{ marginTop: 60 }} />
      ) : expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🗒️</Text>
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySub}>No expenses logged for this period yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedExpenses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  screenTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  entryCount: { color: '#52525B', fontSize: 13, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', marginHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 4, marginBottom: 16, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)' },
  toggleLabel: { color: '#52525B', fontSize: 12, fontWeight: '700' },
  toggleLabelActive: { color: '#38BDF8' },
  summaryStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 16, backgroundColor: 'rgba(56,189,248,0.06)',
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)' },
  summaryLabel: { color: '#38BDF8', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 3 },
  summaryValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  sortToggle: { flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)' },
  sortIcon: { color: '#38BDF8', fontSize: 14, fontWeight: '800' },
  sortLabel: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 },
  rowFirst: {},
  timelineCol: { width: 20, alignItems: 'center', paddingTop: 18 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  timelineLine: {
    flex: 1, width: 2, marginTop: 5,
    backgroundColor: 'rgba(56,189,248,0.2)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginLeft: 10 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  iconEmoji: { fontSize: 18 },
  cardDetails: { flex: 1 },
  catText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  noteText: { color: '#D4D4D8', fontSize: 12, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: '#71717A', fontSize: 11 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5 },
  syncDotSynced: { backgroundColor: '#34D399' },
  syncDotQueued: { backgroundColor: '#FBBF24' },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  amountText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  deleteBtn: { padding: 4 },
  deleteText: { color: '#3F3F46', fontSize: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { color: '#52525B', fontSize: 13, textAlign: 'center' },
});
