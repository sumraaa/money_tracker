/**
 * ZERO FRICTION — Recurring Expenses & Subscriptions Screen
 * Complete management system for recurring bills, subscriptions, and regular payments.
 * Includes monthly cost summary, active/pause toggles, manual expense logging, and add/edit modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Switch, FlatList,
} from 'react-native';
import { ArrowLeft, Plus, Calendar, RefreshCw, Trash2, CheckCircle2, PauseCircle, CreditCard, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, DEFAULT_CATEGORIES, PAYMENT_METHODS } from '../constants/theme';
import {
  getRecurringExpenses, addRecurringExpense, updateRecurringExpense,
  deleteRecurringExpense, toggleRecurringExpense, addExpense,
} from '../database/db';
import { formatINR } from '../utils/money';
import { formatShortDate } from '../utils/dates';
import { emit, EventTypes } from '../services/EventBus';

const FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'weekly', label: 'Weekly' },
];

function getCategoryIcon(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.icon || '🔄';
}

function getCategoryColor(name) {
  const cat = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
  return cat?.color || COLORS.accent;
}

export default function RecurringScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Subscriptions');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().substring(0, 10));
  const [isSub, setIsSub] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecurringExpenses();
      setItems(data || []);
    } catch (e) {
      console.error('[RecurringScreen] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    const safeMerchant = merchant.trim();

    if (!safeMerchant || isNaN(numericAmount) || numericAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid input', 'Please provide a valid merchant name and amount.');
      return;
    }

    try {
      await addRecurringExpense({
        merchant: safeMerchant,
        amount: numericAmount,
        category,
        frequency,
        next_date: nextDate,
        is_subscription: isSub,
        payment_method: paymentMethod,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false);
      setMerchant('');
      setAmount('');
      loadData();
      emit(EventTypes.SETTINGS_CHANGED);
    } catch (e) {
      Alert.alert('Error', 'Failed to save recurring expense.');
    }
  };

  const handleToggleActive = async (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleRecurringExpense(id);
    loadData();
  };

  const handleDelete = (id, name) => {
    Alert.alert('Delete subscription?', `Remove ${name} from recurring items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteRecurringExpense(id);
          loadData();
        },
      },
    ]);
  };

  const handleLogNow = async (item) => {
    Alert.alert('Log Expense', `Record ₹${item.amount} for ${item.merchant} today?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Expense',
        onPress: async () => {
          await addExpense({
            category: item.category || 'Subscriptions',
            expense: item.amount,
            date_time: new Date().toISOString(),
            merchant: item.merchant,
            payment_method: item.payment_method || 'UPI',
            message: `Recurring payment (${item.frequency})`,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          emit(EventTypes.EXPENSE_CREATED);
          Alert.alert('Success', `Logged ₹${item.amount} for ${item.merchant}.`);
        },
      },
    ]);
  };

  // Monthly Equivalent Calculation
  const totalMonthlyCost = items.filter(i => i.is_active === 1).reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    if (item.frequency === 'yearly') return sum + (amt / 12);
    if (item.frequency === 'weekly') return sum + (amt * 4.33);
    return sum + amt;
  }, 0);

  const activeCount = items.filter(i => i.is_active === 1).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions & Bills</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Cost Summary Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>ESTIMATED RECURRING SPEND</Text>
          <Text style={styles.heroAmount}>{formatINR(totalMonthlyCost, { showPaise: false })}<Text style={styles.heroPer}> /mo</Text></Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Sparkles size={12} color={COLORS.accent} />
              <Text style={styles.heroMetaText}>{activeCount} active recurring payments</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Timeline */}
        {items.length > 0 && (
          <View style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>UPCOMING TIMELINE</Text>
            {(() => {
              const todayStr = new Date().toISOString().substring(0, 10);
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().substring(0, 10);
              const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
              const nextWeekStr = nextWeek.toISOString().substring(0, 10);

              const activeItems = items.filter(i => i.is_active === 1 && i.next_date);
              const todayItems = activeItems.filter(i => i.next_date <= todayStr);
              const tomorrowItems = activeItems.filter(i => i.next_date === tomorrowStr);
              const weekItems = activeItems.filter(i => i.next_date > tomorrowStr && i.next_date <= nextWeekStr);
              const laterItems = activeItems.filter(i => i.next_date > nextWeekStr);

              const buckets = [
                { label: 'Due Today', items: todayItems, color: COLORS.error },
                { label: 'Due Tomorrow', items: tomorrowItems, color: COLORS.warning },
                { label: 'Due This Week', items: weekItems, color: COLORS.accent },
                { label: 'Later', items: laterItems, color: COLORS.textMuted },
              ].filter(b => b.items.length > 0);

              if (buckets.length === 0) {
                return <Text style={styles.timelineEmpty}>No upcoming due dates found.</Text>;
              }

              return buckets.map((b, bi) => (
                <View key={bi} style={styles.bucketRow}>
                  <View style={[styles.bucketDot, { backgroundColor: b.color }]} />
                  <View style={styles.bucketInfo}>
                    <Text style={styles.bucketLabel}>{b.label}</Text>
                    <Text style={styles.bucketSub}>
                      {b.items.map(i => `${i.merchant} (${formatINR(i.amount, { showPaise: false })})`).join(', ')}
                    </Text>
                  </View>
                </View>
              ));
            })()}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YOUR RECURRING PAYMENTS</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <RefreshCw size={36} color={COLORS.textDisabled} style={{ marginBottom: SPACING.md }} />
            <Text style={styles.emptyTitle}>No Subscriptions Added</Text>
            <Text style={styles.emptySub}>
              Track Netflix, Rent, Spotify, Broadband, Gym, and regular bills to get automatic reminders.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Plus size={16} color={COLORS.textPrimary} />
              <Text style={styles.emptyBtnText}>Add First Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((item) => {
            const icon = getCategoryIcon(item.category);
            const color = getCategoryColor(item.category);
            const isActive = item.is_active === 1;

            return (
              <View key={item.id} style={[styles.itemCard, !isActive && styles.itemCardPaused]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconWrap, { backgroundColor: color + '18' }]}>
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                  </View>
                  <View style={styles.itemMainInfo}>
                    <Text style={styles.itemMerchant} numberOfLines={1}>{item.merchant}</Text>
                    <Text style={styles.itemSub}>{item.category} • {item.frequency}</Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatINR(item.amount, { showPaise: false })}</Text>
                </View>

                <View style={styles.itemFooter}>
                  <Text style={styles.itemNextDate}>
                    Next due: {item.next_date ? formatShortDate(item.next_date) : 'N/A'}
                  </Text>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.actionPill}
                      onPress={() => handleLogNow(item)}>
                      <Text style={styles.actionPillText}>Log Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleToggleActive(item.id)}>
                      {isActive ? <CheckCircle2 size={18} color={COLORS.success} /> : <PauseCircle size={18} color={COLORS.textMuted} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleDelete(item.id, item.merchant)}>
                      <Trash2 size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Recurring Expense</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>MERCHANT / NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Netflix, Apartment Rent, Gym"
                placeholderTextColor={COLORS.textDisabled}
                value={merchant} onChangeText={setMerchant}
              />

              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 649"
                placeholderTextColor={COLORS.textDisabled}
                value={amount} onChangeText={setAmount} keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>FREQUENCY</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => (
                  <TouchableOpacity key={f.id}
                    style={[styles.freqChip, frequency === f.id && styles.freqChipActive]}
                    onPress={() => setFrequency(f.id)}>
                    <Text style={[styles.freqText, frequency === f.id && styles.freqTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>NEXT DUE DATE (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={nextDate} onChangeText={setNextDate}
                placeholder="2026-09-01" placeholderTextColor={COLORS.textDisabled}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Track as Subscription</Text>
                <Switch
                  value={isSub} onValueChange={setIsSub}
                  trackColor={{ false: COLORS.bgSurface, true: COLORS.accentStrong }}
                  thumbColor={COLORS.textPrimary}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated,
    justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  addHeaderBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.accentBg,
    justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent,
  },
  headerTitle: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 60 },

  heroCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.xl, marginTop: SPACING.sm,
  },
  heroLabel: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, marginBottom: SPACING.xs },
  heroAmount: { ...TYPOGRAPHY.displayLg, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  heroPer: { fontSize: 18, color: COLORS.textMuted, fontWeight: '400' },
  heroMetaRow: { flexDirection: 'row', marginTop: SPACING.md },
  heroMetaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent,
  },
  heroMetaText: { ...TYPOGRAPHY.labelSm, color: COLORS.accent },

  // Upcoming Timeline
  timelineCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.xl,
  },
  bucketRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACING.sm, gap: SPACING.sm },
  bucketDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  bucketInfo: { flex: 1 },
  bucketLabel: { ...TYPOGRAPHY.label, color: COLORS.textPrimary, marginBottom: 2 },
  bucketSub: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, lineHeight: 18 },
  timelineEmpty: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, marginTop: SPACING.xs },

  sectionHeader: { marginBottom: SPACING.md },
  sectionTitle: { ...TYPOGRAPHY.overline, color: COLORS.textMuted },

  emptyCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xxxl,
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  emptyTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  emptySub: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accentStrong,
    paddingHorizontal: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.pill,
  },
  emptyBtnText: { ...TYPOGRAPHY.label, color: COLORS.textPrimary },

  itemCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  itemCardPaused: { opacity: 0.5 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  itemIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  itemMainInfo: { flex: 1 },
  itemMerchant: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  itemSub: { ...TYPOGRAPHY.bodySm, color: COLORS.textMuted, marginTop: 2 },
  itemAmount: { ...TYPOGRAPHY.monoLg, color: COLORS.textPrimary },

  itemFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: SPACING.md,
  },
  itemNextDate: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  actionPill: {
    backgroundColor: COLORS.accentBg, paddingHorizontal: SPACING.md, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderAccent,
  },
  actionPillText: { ...TYPOGRAPHY.labelSm, color: COLORS.accent },
  iconActionBtn: { padding: 4 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: SPACING.xxl },
  modalBox: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xxl, borderWidth: 1, borderColor: COLORS.borderStrong, maxHeight: '85%' },
  modalTitle: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginBottom: SPACING.xl },
  inputLabel: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, marginTop: SPACING.md, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgSurface, color: COLORS.textPrimary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, ...TYPOGRAPHY.body,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  freqRow: { flexDirection: 'row', gap: SPACING.sm, marginVertical: SPACING.xs },
  freqChip: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.bgSurface,
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  freqChipActive: { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accent },
  freqText: { ...TYPOGRAPHY.labelSm, color: COLORS.textMuted },
  freqTextActive: { color: COLORS.accent },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md },
  switchLabel: { ...TYPOGRAPHY.body, color: COLORS.textPrimary },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  cancelText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  saveBtn: { backgroundColor: COLORS.accentStrong, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.pill },
  saveText: { ...TYPOGRAPHY.label, color: COLORS.textPrimary },
});
