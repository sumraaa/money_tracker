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
    let label = formatShortDate(d).toUpperCase();
    if (diffDays === 0) label = 'TODAY · ' + label;
    else if (diffDays === 1) label = 'YESTERDAY · ' + label;

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
      <View style={styles.header}>
        <Text style={styles.screenTitle}>History.</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}>
          {showSearch ? <X size={18} color="#FFFFFF" /> : <Search size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchRow}>
          <TextInput style={styles.searchInput}
            placeholder="Search merchants, notes, categories..."
            placeholderTextColor="#555555"
            value={searchQuery} onChangeText={setSearchQuery} autoFocus
          />
        </View>
      )}

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
          <ChevronDown size={12} color="#FF4500" />
        </TouchableOpacity>
      </View>

      {categoryFilter && (
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip} onPress={() => setCategoryFilter(null)}>
            <Text style={styles.filterText}>{categoryFilter}</Text>
            <X size={12} color="#FF4500" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FF4500" size="small" />
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptySub}>
            {searchQuery ? `No results matching "${searchQuery}"` : 'No expenses recorded in this period.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return renderSectionHeader(item.dateKey);
            }
            return renderItem({ item: item.item });
          }}
        />
      )}

      {selectedExpense && (
        <Modal
          visible={!!selectedExpense}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedExpense(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedExpense(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHeaderRow}>
                <View style={[styles.modalIconWrap, { backgroundColor: getCategoryColor(selectedExpense.category) + '20' }]}>
                  <Text style={{ fontSize: 24 }}>{getCategoryIcon(selectedExpense.category)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{selectedExpense.merchant || selectedExpense.category}</Text>
                  <Text style={styles.modalSub}>{selectedExpense.category} · {formatShortDate(selectedExpense.date_time)}</Text>
                </View>
                <Text style={styles.modalAmount}>{formatINR(selectedExpense.expense)}</Text>
              </View>

              {selectedExpense.message ? (
                <View style={styles.modalNoteBox}>
                  <Text style={styles.modalNoteLabel}>NOTE</Text>
                  <Text style={styles.modalNoteText}>{selectedExpense.message}</Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.modalDeleteBtn]}
                  onPress={() => {
                    const exp = selectedExpense;
                    setSelectedExpense(null);
                    handleDelete(exp.id, exp.merchant || exp.category, exp.expense);
                  }}
                >
                  <Trash2 size={16} color={COLORS.error} />
                  <Text style={[styles.modalActionText, { color: COLORS.error }]}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionBtn}
                  onPress={() => setSelectedExpense(null)}
                >
                  <Text style={styles.modalActionText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xxl, paddingTop: SPACING.lg, paddingBottom: SPACING.xs,
  },
  screenTitle: {
    fontFamily: TYPOGRAPHY.h1.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: '#111111',
    justify: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  searchRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.sm },
  searchInput: {
    backgroundColor: '#111111', color: '#FFFFFF', borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  periodRow: { paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.xs, gap: 6 },
  periodChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill,
    backgroundColor: '#111111', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  periodChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  periodText: { fontFamily: TYPOGRAPHY.labelSm.fontFamily, fontSize: 12, color: '#888888', fontWeight: '600' },
  periodTextActive: { color: '#000000', fontWeight: '800' },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, marginHorizontal: SPACING.xxl,
    marginVertical: SPACING.xs, backgroundColor: '#111111', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryTotal: { fontFamily: TYPOGRAPHY.monoXl.fontFamily, fontSize: 20, color: '#FFFFFF', fontWeight: '800' },
  summaryMeta: { fontFamily: TYPOGRAPHY.bodySm.fontFamily, fontSize: 11, color: '#888888', marginTop: 2 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 69, 0, 0.12)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(255, 69, 0, 0.3)',
  },
  sortLabel: { fontFamily: TYPOGRAPHY.labelSm.fontFamily, fontSize: 11, color: '#FF4500', fontWeight: '700' },

  filterRow: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 69, 0, 0.15)', paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255, 69, 0, 0.3)' },
  filterText: { fontFamily: TYPOGRAPHY.labelSm.fontFamily, fontSize: 12, color: '#FF4500' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xxl, paddingTop: SPACING.lg, paddingBottom: SPACING.xs,
  },
  dateHeaderText: { fontFamily: TYPOGRAPHY.overline.fontFamily, fontSize: 10, color: '#888888', letterSpacing: 1.5 },
  dateHeaderTotal: { fontFamily: TYPOGRAPHY.monoSm.fontFamily, fontSize: 12, color: '#888888', fontWeight: '700' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xxl, marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: '#111111',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', gap: SPACING.md,
  },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txLabel: { fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  unusualTag: { backgroundColor: 'rgba(255, 69, 0, 0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  unusualText: { fontSize: 10, color: '#FF4500', fontWeight: '700' },
  txSub: { fontFamily: TYPOGRAPHY.bodySm.fontFamily, fontSize: 12, color: '#888888' },
  txMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  txDate: { fontFamily: TYPOGRAPHY.labelSm.fontFamily, fontSize: 11, color: '#666666' },
  txPayment: { fontFamily: TYPOGRAPHY.labelSm.fontFamily, fontSize: 10, color: '#888888', marginLeft: 4 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.warning, marginLeft: 6 },
  txAmount: { fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: 16, color: '#FFFFFF', fontWeight: '700' },

  listContent: { paddingBottom: 60 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: SPACING.xxxl },
  emptyIcon: { fontSize: 44, marginBottom: SPACING.md, opacity: 0.5 },
  emptyTitle: { fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: 18, color: '#FFFFFF', marginBottom: SPACING.xs },
  emptySub: { fontFamily: TYPOGRAPHY.bodySm.fontFamily, fontSize: 13, color: '#888888', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xxl, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  modalIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: 18, color: '#FFFFFF' },
  modalSub: { fontFamily: TYPOGRAPHY.bodySm.fontFamily, fontSize: 12, color: '#888888', marginTop: 2 },
  modalAmount: { fontFamily: TYPOGRAPHY.monoXl.fontFamily, fontSize: 20, color: '#FF4500' },
  modalNoteBox: {
    backgroundColor: '#181818', padding: SPACING.md, borderRadius: 12, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalNoteLabel: { fontFamily: TYPOGRAPHY.overline.fontFamily, fontSize: 10, color: '#888888', marginBottom: 2 },
  modalNoteText: { fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: 14, color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: SPACING.md, justifyContent: 'flex-end' },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill, backgroundColor: '#181818', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalDeleteBtn: { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder },
  modalActionText: { fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: 14, color: '#FFFFFF' },
});
