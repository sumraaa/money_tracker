import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getAllExpenses, deleteExpense, updateExpense } from '../database/db';
import { COLORS, SPACING, RADIUS, DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatShortDate, formatTime, dateToKey, startOfToday, startOfWeek, startOfMonth, startOfLastMonth, endOfLastMonth, startOfYear, daysAgo } from '../utils/dates';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest', sortBy: 'date_time', sortOrder: 'DESC' },
  { id: 'oldest', label: 'Oldest', sortBy: 'date_time', sortOrder: 'ASC' },
  { id: 'highest', label: 'Highest', sortBy: 'expense', sortOrder: 'DESC' },
  { id: 'lowest', label: 'Lowest', sortBy: 'expense', sortOrder: 'ASC' },
];

function getCategoryIcon(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.icon || '💳';
}

function getPeriodDates(periodId) {
  const now = new Date();
  switch (periodId) {
    case 'today': return { startDate: startOfToday().toISOString() };
    case 'yesterday': {
      const s = daysAgo(1); s.setHours(0,0,0,0);
      const e = new Date(s); e.setHours(23,59,59,999);
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }
    case 'week': return { startDate: startOfWeek().toISOString() };
    case 'month': return { startDate: startOfMonth().toISOString() };
    case 'lastMonth': return { startDate: startOfLastMonth().toISOString(), endDate: endOfLastMonth().toISOString() };
    case 'year': return { startDate: startOfYear().toISOString() };
    case 'all': default: return {};
  }
}

export default function HistoryScreen({ onDataChanged }) {
  const [period, setPeriod] = useState('month');
  const [sortOption, setSortOption] = useState('newest');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dates = getPeriodDates(period);
      const sort = SORT_OPTIONS.find(s => s.id === sortOption) || SORT_OPTIONS[0];
      const exps = await getAllExpenses({
        ...dates,
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
        limit: 500,
      });
      setExpenses(exps || []);
    } catch (e) {
      console.error('[History] load error', e);
    } finally {
      setLoading(false);
    }
  }, [period, sortOption, searchQuery, categoryFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = (id, label, amount) => {
    Alert.alert('Delete expense', `Remove ${label} (${formatINR(amount)})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteExpense(id);
          loadData();
          if (onDataChanged) onDataChanged();
        },
      },
    ]);
  };

  // Group by date
  const grouped = [];
  let currentGroup = null;
  const sortedByDate = sortOption === 'newest' || sortOption === 'oldest' ? expenses : [...expenses];

  sortedByDate.forEach((item) => {
    const key = (item.date_time || '').substring(0, 10);
    if (!currentGroup || currentGroup.key !== key) {
      currentGroup = { key, data: [] };
      grouped.push(currentGroup);
    }
    currentGroup.data.push(item);
  });

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e?.expense || 0), 0);
  const txCount = expenses.length;
  const avgPerTx = txCount > 0 ? totalSpent / txCount : 0;

  const renderItem = ({ item }) => {
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
          {subtitle ? <Text style={styles.txSub} numberOfLines={1}>{subtitle}</Text> : null}
          <View style={styles.txMeta}>
            <Text style={styles.txDate}>{formatTime(item.date_time)}</Text>
            {item.payment_method && item.payment_method !== 'UPI' && (
              <Text style={styles.txPayment}>{item.payment_method}</Text>
            )}
            {!isSynced && <View style={styles.syncDot} />}
          </View>
        </View>
        <Text style={styles.txAmount}>{formatINR(parseFloat(item.expense), { showPaise: false })}</Text>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (dateKey) => {
    const d = new Date(dateKey + 'T00:00:00');
    const today = startOfToday();
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
    let label = formatShortDate(d);
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';

    const groupTotal = grouped.find(g => g.key === dateKey)?.data.reduce((s, e) => s + parseFloat(e?.expense || 0), 0) || 0;

    return (
      <View style={styles.dateHeader}>
        <Text style={styles.dateHeaderText}>{label}</Text>
        <Text style={styles.dateHeaderTotal}>{formatINR(groupTotal, { showPaise: false })}</Text>
      </View>
    );
  };

  // Flatten grouped data with section headers
  const flatData = [];
  grouped.forEach((group) => {
    flatData.push({ type: 'header', key: `h-${group.key}`, dateKey: group.key });
    group.data.forEach((item) => {
      flatData.push({ type: 'item', key: `i-${item.id}`, item });
    });
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>History</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}>
            {showSearch ? <X size={18} color={COLORS.textMuted} /> : <Search size={18} color={COLORS.textMuted} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchants, notes, categories..."
            placeholderTextColor={COLORS.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* Period Toggle */}
      <FlatList
        horizontal
        data={PERIODS}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periodRow}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={[styles.periodChip, period === p.id && styles.periodChipActive]}
            onPress={() => { Haptics.selectionAsync(); setPeriod(p.id); }}
          >
            <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Summary + Sort */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryTotal}>{formatINR(totalSpent, { showPaise: false })}</Text>
          <Text style={styles.summaryMeta}>{txCount} transactions · avg {formatINR(avgPerTx, { showPaise: false })}</Text>
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => {
            Haptics.selectionAsync();
            const idx = SORT_OPTIONS.findIndex(s => s.id === sortOption);
            setSortOption(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id);
          }}
        >
          <Text style={styles.sortLabel}>{SORT_OPTIONS.find(s => s.id === sortOption)?.label}</Text>
          <ChevronDown size={12} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Category filter chips */}
      {categoryFilter && (
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip} onPress={() => setCategoryFilter(null)}>
            <Text style={styles.filterText}>{categoryFilter}</Text>
            <X size={12} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
      ) : flatData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🗒️</Text>
          <Text style={styles.emptyTitle}>No records found</Text>
          <Text style={styles.emptySub}>
            {searchQuery ? 'Try a different search term.' : 'No expenses for this period.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => item.key}
          renderItem={({ item: row }) => {
            if (row.type === 'header') return renderSectionHeader(row.dateKey);
            return renderItem({ item: row.item });
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  screenTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },

  searchRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  searchInput: { backgroundColor: COLORS.bgElevated, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 11, fontSize: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },

  periodRow: { paddingHorizontal: SPACING.xxl, gap: SPACING.sm, marginBottom: SPACING.md },
  periodChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  periodChipActive: { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accent },
  periodText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  periodTextActive: { color: COLORS.accent },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  summaryTotal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent },
  sortLabel: { color: COLORS.accent, fontSize: 11, fontWeight: '600' },

  filterRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: RADIUS.pill, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent },
  filterText: { color: COLORS.accent, fontSize: 11, fontWeight: '600' },

  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.sm, backgroundColor: COLORS.bgSubtle },
  dateHeaderText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  dateHeaderTotal: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, gap: SPACING.md },
  txIconWrap: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgSurface, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  txIcon: { fontSize: 15 },
  txDetails: { flex: 1 },
  txLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 1 },
  txSub: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 2 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txDate: { color: COLORS.textMuted, fontSize: 11 },
  txPayment: { color: COLORS.textMuted, fontSize: 10, backgroundColor: COLORS.bgSurface, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.warning },
  txAmount: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  listContent: { paddingBottom: 40 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.md, opacity: 0.5 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: SPACING.sm },
  emptySub: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
});
