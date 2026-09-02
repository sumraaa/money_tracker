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
  return cat?.color || COLORS.accentRed;
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
          <ArrowLeft size={20} color="#171e19" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions & Bills</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={20} color="#ca0013" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Cost Summary Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>ESTIMATED RECURRING SPEND</Text>
          <Text style={styles.heroAmount}>{formatINR(totalMonthlyCost, { showPaise: false })}<Text style={styles.heroPer}> /mo</Text></Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Sparkles size={12} color="#ca0013" />
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
                { label: 'Due Today', items: todayItems, color: '#ca0013' },
                { label: 'Due Tomorrow', items: tomorrowItems, color: COLORS.warning },
                { label: 'Due This Week', items: weekItems, color: '#171e19' },
                { label: 'Later', items: laterItems, color: '#6c7772' },
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
            <RefreshCw size={36} color="#6c7772" style={{ marginBottom: SPACING.md }} />
            <Text style={styles.emptyTitle}>No Subscriptions Added</Text>
            <Text style={styles.emptySub}>
              Track Netflix, Rent, Spotify, Broadband, Gym, and regular bills to get automatic reminders.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Plus size={16} color="#ffffff" />
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
                      {isActive ? <CheckCircle2 size={18} color={COLORS.success} /> : <PauseCircle size={18} color="#6c7772" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleDelete(item.id, item.merchant)}>
                      <Trash2 size={18} color="#ca0013" />
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
                placeholderTextColor="#6c7772"
                value={merchant} onChangeText={setMerchant}
              />

              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 649"
                placeholderTextColor="#6c7772"
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
                placeholder="2026-09-01" placeholderTextColor="#6c7772"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Track as Subscription</Text>
                <Switch
                  value={isSub} onValueChange={setIsSub}
                  trackColor={{ false: '#eeebe3', true: '#ca0013' }}
                  thumbColor="#ffffff"
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
  container: { flex: 1, backgroundColor: '#eeebe3' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  addHeaderBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#171e19', letterSpacing: -0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 140 },

  heroCard: {
    backgroundColor: '#ffffff', borderRadius: 32, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.xl, marginTop: SPACING.sm,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5, marginBottom: SPACING.xs },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#171e19', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  heroPer: { fontSize: 18, color: '#6c7772', fontWeight: '500' },
  heroMetaRow: { flexDirection: 'row', marginTop: SPACING.md },
  heroMetaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(202, 0, 19, 0.08)', paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(202, 0, 19, 0.25)',
  },
  heroMetaText: { fontSize: 12, fontWeight: '700', color: '#ca0013' },

  // Upcoming Timeline
  timelineCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.xl,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.xl,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  bucketRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACING.sm, gap: SPACING.sm },
  bucketDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  bucketInfo: { flex: 1 },
  bucketLabel: { fontSize: 14, fontWeight: '700', color: '#171e19', marginBottom: 2 },
  bucketSub: { fontSize: 13, color: '#6c7772', lineHeight: 18 },
  timelineEmpty: { fontSize: 13, color: '#6c7772', marginTop: SPACING.xs },

  sectionHeader: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5 },

  emptyCard: {
    backgroundColor: '#ffffff', borderRadius: 32, padding: SPACING.xxxl,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
  },
  emptyTitle: { fontSize: 18, color: '#171e19', fontWeight: '700', marginBottom: SPACING.xs },
  emptySub: { fontSize: 13, color: '#6c7772', textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ca0013',
    paddingHorizontal: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.pill,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  itemCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.md,
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  itemCardPaused: { opacity: 0.5 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  itemIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  itemMainInfo: { flex: 1 },
  itemMerchant: { fontSize: 16, fontWeight: '700', color: '#171e19' },
  itemSub: { fontSize: 12, color: '#6c7772', marginTop: 2 },
  itemAmount: { fontSize: 16, fontWeight: '800', color: '#171e19' },

  itemFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#eeebe3', paddingTop: SPACING.md,
  },
  itemNextDate: { fontSize: 12, color: '#6c7772', fontWeight: '500' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  actionPill: {
    backgroundColor: 'rgba(202, 0, 19, 0.08)', paddingHorizontal: SPACING.md, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(202, 0, 19, 0.25)',
  },
  actionPillText: { fontSize: 12, fontWeight: '700', color: '#ca0013' },
  iconActionBtn: { padding: 4 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23, 30, 25, 0.65)', justifyContent: 'center', padding: SPACING.xxl },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 32, padding: SPACING.xxl, borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#171e19', marginBottom: SPACING.xl },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5, marginTop: SPACING.md, marginBottom: 6 },
  input: {
    backgroundColor: '#eeebe3', color: '#171e19', borderRadius: 16,
    paddingHorizontal: SPACING.lg, paddingVertical: 12, fontSize: 14, fontWeight: '600',
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
  },
  freqRow: { flexDirection: 'row', gap: SPACING.sm, marginVertical: SPACING.xs },
  freqChip: {
    flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: '#eeebe3',
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
  },
  freqChipActive: { backgroundColor: '#171e19', borderColor: '#171e19' },
  freqText: { fontSize: 12, fontWeight: '600', color: '#6c7772' },
  freqTextActive: { color: '#ffffff', fontWeight: '800' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md },
  switchLabel: { fontSize: 15, color: '#171e19', fontWeight: '700' },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#6c7772' },
  saveBtn: { backgroundColor: '#ca0013', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.pill },
  saveText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});

