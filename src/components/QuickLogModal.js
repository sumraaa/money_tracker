import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Animated,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import CategoryGrid from './CategoryGrid';
import Numpad from './Numpad';
import { addExpense, getCustomCategories, addCustomCategory, getRecentMerchants } from '../database/db';
import { triggerSync } from '../services/SyncService';
import { COLORS, SPACING, RADIUS, PAYMENT_METHODS, MERCHANT_HINTS } from '../constants/theme';

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
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadData = async () => {
    const [custom, merchants] = await Promise.all([
      getCustomCategories(),
      getRecentMerchants(8),
    ]);
    setCustomCategories(Array.isArray(custom) ? custom : []);
    setRecentMerchants(Array.isArray(merchants) ? merchants : []);
  };

  // Smart category detection from merchant name
  const handleMerchantChange = (text) => {
    setMerchant(text);
    if (text.trim().length >= 2) {
      const lower = text.toLowerCase().trim();
      for (const [key, cat] of Object.entries(MERCHANT_HINTS)) {
        if (lower.includes(key)) {
          setSelectedCategory(cat);
          break;
        }
      }
    }
  };

  const handleAddCustom = async (name, icon) => {
    const safeName = (name || '').trim();
    const safeIcon = icon || '🏷️';
    if (!safeName) return;
    await addCustomCategory(safeName, safeIcon);
    await loadData();
  };

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const safeCategory = (selectedCategory || '').trim() || 'Food';
    const safeMerchant = (merchant || '').trim();
    const safeMessage = (message || '').trim();

    setIsSubmitting(true);

    try {
      const newExpense = await addExpense({
        category: safeCategory,
        expense: numericAmount,
        date_time: new Date().toISOString(),
        message: safeMessage,
        merchant: safeMerchant,
        payment_method: paymentMethod,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show brief success state
      setShowSuccess(true);

      triggerSync().catch((err) =>
        console.log('[Background Sync] Offline queue active:', err)
      );

      if (onExpenseAdded) {
        onExpenseAdded(newExpense);
      }

      // Auto-close after brief success flash
      setTimeout(() => {
        setAmount('');
        setMerchant('');
        setMessage('');
        setIsSubmitting(false);
        setShowSuccess(false);
        onClose();
      }, 600);
    } catch (error) {
      console.error('[QuickLogModal] Submit error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY }] },
          ]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <SafeAreaView edges={['bottom']}>
            {/* Handle */}
            <View style={styles.header}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Amount Display */}
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <Text style={styles.amountDisplay}>
                  {amount || '0'}
                </Text>
              </View>

              {/* Merchant input with suggestions */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.merchantInput}
                  placeholder="Merchant (e.g. Swiggy)"
                  placeholderTextColor={COLORS.textDisabled}
                  value={merchant}
                  onChangeText={handleMerchantChange}
                  maxLength={50}
                />
              </View>

              {/* Recent merchant chips */}
              {recentMerchants.length > 0 && !merchant && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsRow}
                  contentContainerStyle={styles.suggestionsContent}
                >
                  {recentMerchants.map((m, i) => (
                    <TouchableOpacity
                      key={`${m.merchant}-${i}`}
                      style={styles.suggestionChip}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMerchant(m.merchant);
                        if (m.category) setSelectedCategory(m.category);
                      }}
                    >
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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paymentContent}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <TouchableOpacity
                      key={pm.id}
                      style={[
                        styles.paymentChip,
                        paymentMethod === pm.name && styles.paymentChipActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setPaymentMethod(pm.name);
                      }}
                    >
                      <Text style={styles.paymentIcon}>{pm.icon}</Text>
                      <Text
                        style={[
                          styles.paymentText,
                          paymentMethod === pm.name && styles.paymentTextActive,
                        ]}
                      >
                        {pm.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Note */}
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={COLORS.textDisabled}
                value={message}
                onChangeText={setMessage}
                maxLength={100}
              />

              {/* Numpad */}
              <Numpad value={amount} onChange={setAmount} />

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                style={[
                  styles.saveBtn,
                  (!amount || parseFloat(amount) <= 0) && styles.saveBtnDisabled,
                  showSuccess && styles.saveBtnSuccess,
                ]}
                onPress={handleSubmit}
              >
                <Text style={styles.saveBtnText}>
                  {showSuccess
                    ? '✓ Saved'
                    : isSubmitting
                    ? 'Saving...'
                    : `Save${amount ? ` ₹${amount}` : ''}`}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  scrollContent: {
    paddingBottom: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.bgHover,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: SPACING.sm,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  currencySymbol: {
    color: COLORS.accent,
    fontSize: 30,
    fontWeight: '800',
    marginRight: SPACING.sm,
  },
  amountDisplay: {
    color: COLORS.textPrimary,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  inputRow: {
    marginBottom: SPACING.xs,
  },
  merchantInput: {
    backgroundColor: COLORS.bgElevated,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  suggestionsRow: {
    marginBottom: SPACING.sm,
    maxHeight: 36,
  },
  suggestionsContent: {
    gap: SPACING.sm,
  },
  suggestionChip: {
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  suggestionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  paymentSection: {
    marginVertical: SPACING.sm,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  paymentContent: {
    gap: SPACING.sm,
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    gap: 4,
  },
  paymentChipActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
  },
  paymentIcon: {
    fontSize: 12,
  },
  paymentText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  paymentTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: COLORS.bgElevated,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  saveBtn: {
    backgroundColor: COLORS.accentStrong,
    paddingVertical: 16,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.bgSurface,
  },
  saveBtnSuccess: {
    backgroundColor: '#059669',
  },
  saveBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
