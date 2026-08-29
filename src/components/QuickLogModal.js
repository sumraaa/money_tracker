import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  TextInput, Keyboard, Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import CategoryGrid from './CategoryGrid';
import Numpad from './Numpad';
import { addExpense, getCustomCategories, addCustomCategory, getRecentMerchants } from '../database/db';
import { triggerSync } from '../services/SyncService';
import { emit, EventTypes } from '../services/EventBus';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, PAYMENT_METHODS, MERCHANT_HINTS } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function QuickLogModal({ visible, onClose, onExpenseAdded }) {
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [merchant, setMerchant] = useState('');
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [customCategories, setCustomCategories] = useState([]);
  const [recentMerchants, setRecentMerchants] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      loadData();
      setAmount('');
      setMerchant('');
      setMessage('');
      setShowSuccess(false);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, friction: 8, tension: 50,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadData = async () => {
    const [custom, merchants] = await Promise.all([
      getCustomCategories(), getRecentMerchants(8),
    ]);
    setCustomCategories(Array.isArray(custom) ? custom : []);
    setRecentMerchants(Array.isArray(merchants) ? merchants : []);
  };

  const handleMerchantChange = (text) => {
    setMerchant(text);
    if (text.trim().length >= 2) {
      const lower = text.toLowerCase().trim();
      for (const [key, cat] of Object.entries(MERCHANT_HINTS)) {
        if (lower.includes(key)) { setSelectedCategory(cat); break; }
      }
    }
  };

  const handleAddCustom = async (name, icon) => {
    const safeName = (name || '').trim();
    if (!safeName) return;
    await addCustomCategory(safeName, icon || '🏷️');
    await loadData();
  };

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);

    try {
      const newExpense = await addExpense({
        category: (selectedCategory || '').trim() || 'Food',
        expense: numericAmount,
        date_time: new Date().toISOString(),
        message: (message || '').trim(),
        merchant: (merchant || '').trim(),
        payment_method: paymentMethod,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
      emit(EventTypes.EXPENSE_CREATED, newExpense);
      triggerSync().catch(() => {});
      if (onExpenseAdded) onExpenseAdded(newExpense);

      setTimeout(() => {
        setAmount(''); setMerchant(''); setMessage('');
        setIsSubmitting(false); setShowSuccess(false);
        onClose();
      }, 600);
    } catch (error) {
      console.error('[QuickLog] Submit error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1}
        onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY }] }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
              {/* Amount Display */}
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <Text style={styles.amountDisplay}>{amount || '0'}</Text>
              </View>

              {/* Merchant input */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.merchantInput}
                  placeholder="Merchant (e.g. Swiggy)"
                  placeholderTextColor={COLORS.textDisabled}
                  value={merchant} onChangeText={handleMerchantChange} maxLength={50}
                />
              </View>

              {/* Recent merchants */}
              {recentMerchants.length > 0 && !merchant && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsRow} contentContainerStyle={styles.suggestionsContent}>
                  {recentMerchants.map((m, i) => (
                    <TouchableOpacity key={`${m.merchant}-${i}`} style={styles.suggestionChip}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMerchant(m.merchant);
                        if (m.category) setSelectedCategory(m.category);
                      }}>
                      <Text style={styles.suggestionText}>{m.merchant}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Category */}
              <CategoryGrid
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                customCategories={customCategories}
                onAddCustomCategory={handleAddCustom}
              />

              {/* Payment method */}
              <View style={styles.paymentSection}>
                <Text style={styles.sectionLabel}>PAYMENT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paymentContent}>
                  {PAYMENT_METHODS.map((pm) => (
                    <TouchableOpacity key={pm.id}
                      style={[styles.paymentChip, paymentMethod === pm.name && styles.paymentChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setPaymentMethod(pm.name); }}>
                      <Text style={styles.paymentIcon}>{pm.icon}</Text>
                      <Text style={[styles.paymentText, paymentMethod === pm.name && styles.paymentTextActive]}>
                        {pm.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Note */}
              <TextInput style={styles.noteInput}
                placeholder="Add a note (optional)" placeholderTextColor={COLORS.textDisabled}
                value={message} onChangeText={setMessage} maxLength={100}
              />

              {/* Numpad */}
              <Numpad value={amount} onChange={setAmount} />

              {/* Save */}
              <TouchableOpacity activeOpacity={0.8}
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                style={[styles.saveBtn,
                  (!amount || parseFloat(amount) <= 0) && styles.saveBtnDisabled,
                  showSuccess && styles.saveBtnSuccess,
                ]}
                onPress={handleSubmit}>
                <Text style={styles.saveBtnText}>
                  {showSuccess ? '✓ Saved' : isSubmitting ? 'Saving...' : `Save${amount ? ` ₹${amount}` : ''}`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderStrong,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  scrollContent: { paddingBottom: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING.sm, position: 'relative' },
  sheetHandle: { width: 36, height: 4, backgroundColor: COLORS.bgHover, borderRadius: 2 },
  closeBtn: { position: 'absolute', right: 0, top: -4, padding: SPACING.sm },
  closeBtnText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '500' },

  amountContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: SPACING.md, paddingVertical: SPACING.lg,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  currencySymbol: { color: COLORS.accent, fontSize: 32, fontWeight: '800', marginRight: SPACING.sm },
  amountDisplay: { ...TYPOGRAPHY.displayLg, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },

  inputRow: { marginBottom: SPACING.sm },
  merchantInput: {
    backgroundColor: COLORS.bgElevated, color: COLORS.textPrimary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, ...TYPOGRAPHY.body,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  suggestionsRow: { marginBottom: SPACING.sm, maxHeight: 40 },
  suggestionsContent: { gap: SPACING.sm },
  suggestionChip: {
    backgroundColor: COLORS.bgSurface, paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  suggestionText: { ...TYPOGRAPHY.labelSm, color: COLORS.textSecondary },

  paymentSection: { marginVertical: SPACING.sm },
  sectionLabel: { ...TYPOGRAPHY.overline, color: COLORS.textMuted, marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs },
  paymentContent: { gap: SPACING.sm },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, gap: 5,
  },
  paymentChipActive: { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accent },
  paymentIcon: { fontSize: 14 },
  paymentText: { ...TYPOGRAPHY.labelSm, color: COLORS.textSecondary },
  paymentTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  noteInput: {
    backgroundColor: COLORS.bgElevated, color: COLORS.textPrimary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, ...TYPOGRAPHY.bodySm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },

  saveBtn: {
    backgroundColor: COLORS.accentStrong, paddingVertical: 16, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xs,
  },
  saveBtnDisabled: { backgroundColor: COLORS.bgSurface },
  saveBtnSuccess: { backgroundColor: '#059669' },
  saveBtnText: { ...TYPOGRAPHY.label, color: COLORS.textPrimary, fontSize: 16 },
});
