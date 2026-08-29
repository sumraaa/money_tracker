import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { Search, X, ChevronDown, Edit3, Copy, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getAllExpenses, deleteExpense, updateExpense } from '../database/db';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, DEFAULT_CATEGORIES, PAYMENT_METHODS } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatShortDate, formatTime, startOfToday, startOfWeek, startOfMonth, startOfLastMonth, endOfLastMonth, startOfYear, daysAgo } from '../utils/dates';
import { emit, on, EventTypes } from '../services/EventBus';

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
function getCategoryColor(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.color || COLORS.textMuted;
}

function getPeriodDates(periodId) {
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
  const [selectedExpense, setSelectedExpense] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dates = getPeriodDates(period);
      const sort = SORT_OPTIONS.find(s => s.id === sortOption) || SORT_OPTIONS[0];
      const exps = await getAllExpenses({
        ...dates, search: searchQuery || undefined,
        category: categoryFilter || undefined,
        sortBy: sort.sortBy, sortOrder: sort.sortOrder, limit: 500,
      });
      setExpenses(exps || []);
    } catch (e) { console.error('[History] load error', e); }
    finally { setLoading(false); }
  }, [period, sortOption, searchQuery, categoryFilter]);

  useEffect(() => {
    loadData();
    const unsub1 = on(EventTypes.EXPENSE_CREATED, loadData);
    const unsub2 = on(EventTypes.EXPENSE_UPDATED, loadData);
    const unsub3 = on(EventTypes.EXPENSE_DELETED, loadData);
    const unsub4 = on(EventTypes.SYNC_COMPLETED, loadData);
    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
    };
  }, [loadData]);

  const handleDelete = (id, label, amount) => {
    Alert.alert('Delete expense', `Remove ${label} (${formatINR(amount)})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteExpense(id);
          emit(EventTypes.EXPENSE_DELETED);
          loadData();
          if (onDataChanged) onDataChanged();
        },
      },
    ]);
  };

  // Group by date
  const grouped = [];
  let currentGroup = null;
  expenses.forEach((item) => {
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
  const largest = expenses.length > 0 ? Math.max(...expenses.map(e => parseFloat(e.expense) || 0)) : 0;

  const renderItem = ({ item }) => {
    const icon = getCategoryIcon(item.category);
    const label = item.merchant || item.category || 'Expense';
    const subtitle = item.merchant ? item.category : (item.message || '');
    const isSynced = item.sync_status === 1;
    const amt = parseFloat(item.expense) || 0;
    const isUnusual = avgPerTx > 0 && amt >= avgPerTx * 2.5 && amt >= 500 && txCount >= 5;

    return (
      <TouchableOpacity
        style={styles.txRow} activeOpacity={0.6}
        onPress={() => setSelectedExpense(item)}
        onLongPress={() => handleDelete(item.id, label, item.expense)}
      >
        <View style={[styles.txIconWrap, { backgroundColor: getCategoryColor(item.category) + '14' }]}>
          <Text style={styles.txIcon}>{icon}</Text>
        </View>
        <View style={styles.txDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.txLabel} numberOfLines={1}>{label}</Text>
            {isUnusual && (
              <View style={styles.unusualTag}>
                <Text style={styles.unusualText}>High</Text>
              </View>
            )}
          </View>
          <View style={styles.txMeta}>
            {subtitle ? <Text style={styles.txSub} numberOfLines={1}>{subtitle} · </Text> : null}
            <Text style={styles.txDate}>{formatTime(item.date_time)}</Text>
            {item.payment_method && item.payment_method !== 'UPI' && (
              <Text style={styles.txPayment}>{item.payment_method}</Text>
            )}
            {!isSynced && <View style={styles.syncDot} />}
          </View>
        </View>
        <Text style={styles.txAmount}>{formatINR(amt, { showPaise: false })}</Text>
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
        <TouchableOpacity style={styles.iconBtn} onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}>
          {showSearch ? <X size={18} color={COLORS.textMuted} /> : <Search size={18} color={COLORS.textMuted} />}
        </TouchableOpacity>
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchRow}>
          <TextInput style={styles.searchInput}
            placeholder="Search merchants, notes, categories..."
            placeholderTextColor={COLORS.textDisabled}
            value={searchQuery} onChangeText={setSearchQuery} autoFocus
          />
        </View>
      )}

      {/* Period Toggle */}
      <FlatList
        horizontal data={PERIODS} keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={[styles.periodChip, period === p.id && styles.periodChipActive]}
            onPress={() => { Haptics.selectionAsync(); setPeriod(p.id); }}
          >
            <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryTotal}>{formatINR(totalSpent, { showPaise: false })}</Text>
          <Text style={styles.summaryMeta}>{txCount} transactions · avg {formatINR(avgPerTx, { showPaise: false })}</Text>
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={() => {
          Haptics.selectionAsync();
          const idx = SORT_OPTIONS.findIndex(s => s.id === sortOption);
          setSortOption(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id);
        }}>
          <Text style={styles.sortLabel}>{SORT_OPTIONS.find(s => s.id === sortOption)?.label}</Text>
          <ChevronDown size={12} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
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
          <Text style={styles.emptySub}>{searchQuery ? 'Try a different search term.' : 'No expenses for this period.'}</Text>
        </View>
      ) : (
        <FlatList
          data={flatData} keyExtractor={(item) => item.key}
          renderItem={({ item: row }) => {
            if (row.type === 'header') return renderSectionHeader(row.dateKey);
            return renderItem({ item: row.item });
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Transaction Detail Modal */}
      <Modal visible={!!selectedExpense} transparent animationType="fade" onRequestClose={() => setSelectedExpense(null)}>
        <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)}>
          <View style={styles.detailSheet} onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
            {selectedExpense && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIconWrap, { backgroundColor: getCategoryColor(selectedExpense.category) + '20' }]}>
                    <Text style={{ fontSize: 24 }}>{getCategoryIcon(selectedExpense.category)}</Text>
                  </View>
                  <Text style={styles.detailAmount}>{formatINR(parseFloat(selectedExpense.expense), { showPaise: true })}</Text>
                  <Text style={styles.detailLabel}>{selectedExpense.merchant || selectedExpense.category}</Text>
                </View>
                <View style={styles.detailRows}>
                  <DetailRow label="Category" value={selectedExpense.category} />
                  {selectedExpense.merchant ? <DetailRow label="Merchant" value={selectedExpense.merchant} /> : null}
                  {selectedExpense.message ? <DetailRow label="Note" value={selectedExpense.message} /> : null}
                  <DetailRow label="Payment" value={selectedExpense.payment_method || 'UPI'} />
                  <DetailRow label="Date" value={formatShortDate(selectedExpense.date_time)} />
                  <DetailRow label="Time" value={formatTime(selectedExpense.date_time)} />
                  <DetailRow label="Synced" value={selectedExpense.sync_status === 1 ? 'Yes' : 'Waiting'} />
                </View>
                <View style={styles.detailActions}>
                  <TouchableOpacity style={styles.detailActionBtn}
                    onPress={() => {
                      setSelectedExpense(null);
                      handleDelete(selectedExpense.id, selectedExpense.merchant || selectedExpense.category, selectedExpense.expense);
                    }}>
                    <Trash2 size={16} color={COLORS.error} />
                    <Text style={[styles.detailActionText, { color: COLORS.error }]}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailActionBtn}
                    onPress={() => { setCategoryFilter(selectedExpense.category); setSelectedExpense(null); }}>
                    <Search size={16} color={COLORS.accent} />
                    <Text style={styles.detailActionText}>Filter category</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  label: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted },
  value: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  screenTitle: { ...TYPOGRAPHY.h1, color: COLORS.textPrimary },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },

  searchRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  searchInput: { backgroundColor: COLORS.bgElevated, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 12, ...TYPOGRAPHY.body, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },

  periodRow: { paddingHorizontal: SPACING.xxl, gap: SPACING.sm, marginBottom: SPACING.md },
  periodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  periodChipActive: { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accent },
  periodText: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },
  periodTextActive: { color: COLORS.accent },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  summaryTotal: { ...TYPOGRAPHY.displaySm, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  summaryMeta: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted, marginTop: 3 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent },
  sortLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.accent },

  filterRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent },
  filterText: { ...TYPOGRAPHY.labelSm, color: COLORS.accent },

  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.sm, backgroundColor: COLORS.bgSubtle },
  dateHeaderText: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
  dateHeaderTotal: { ...TYPOGRAPHY.monoSm, color: COLORS.textMuted },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, gap: SPACING.md },
  txIconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txLabel: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 2 },
  unusualTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.error,
  },
  unusualText: { ...TYPOGRAPHY.labelXs, color: COLORS.error, fontSize: 9, fontWeight: '700' },
  txSub: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  txDate: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },
  txPayment: { ...TYPOGRAPHY.labelXs, color: COLORS.textMuted, backgroundColor: COLORS.bgSurface, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.warning },
  txAmount: { ...TYPOGRAPHY.mono, color: COLORS.textPrimary, fontWeight: '700' },

  listContent: { paddingBottom: 40 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 44, marginBottom: SPACING.md, opacity: 0.5 },
  emptyTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySub: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, textAlign: 'center' },

  // Detail Modal
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.xxl, paddingBottom: SPACING.xxxxl, borderTopWidth: 1, borderColor: COLORS.borderStrong },
  detailHeader: { alignItems: 'center', marginBottom: SPACING.xl },
  detailIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  detailAmount: { ...TYPOGRAPHY.displayMd, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  detailLabel: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: SPACING.xs },
  detailRows: { marginBottom: SPACING.xl },
  detailActions: { flexDirection: 'row', gap: SPACING.md },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgSurface, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  detailActionText: { ...TYPOGRAPHY.label, color: COLORS.accent },
});
