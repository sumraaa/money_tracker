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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import CategoryGrid from './CategoryGrid';
import Numpad from './Numpad';
import { addExpense, getCustomCategories, addCustomCategory } from '../database/db';
import { triggerSync } from '../services/SyncService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function QuickLogModal({ visible, onClose, onExpenseAdded }) {
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Fast Food & Swiggy');
  const [message, setMessage] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      loadCategories();
      setAmount('');
      setMessage('');
      // Fluid spring animation with tactile physics
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 45,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadCategories = async () => {
    const custom = await getCustomCategories();
    setCustomCategories(Array.isArray(custom) ? custom : []);
  };

  const handleAddCustom = async (name, icon) => {
    const safeName = (name || '').trim();
    const safeIcon = icon || '🏷️';
    if (!safeName) return;
    await addCustomCategory(safeName, safeIcon);
    await loadCategories();
  };

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const safeCategory = (selectedCategory || '').trim() || 'Fast Food & Swiggy';
    const safeMessage = (message || '').trim();

    setIsSubmitting(true);

    try {
      const newExpense = await addExpense({
        category: safeCategory,
        expense: numericAmount,
        date_time: new Date().toISOString(),
        message: safeMessage,
      });

      // Heavy success vibration feedback on successful expense upload
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      triggerSync().catch((err) =>
        console.log('[Background Sync] Offline queue active:', err)
      );

      if (onExpenseAdded) {
        onExpenseAdded(newExpense);
      }

      setAmount('');
      setMessage('');
      setIsSubmitting(false);
      onClose();
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
            {/* Sheet Drag Handle */}
            <View style={styles.header}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* INR Hero Amount Display */}
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.amountDisplay}>
                {amount || '0'}
              </Text>
            </View>

            {/* Category Grid */}
            <CategoryGrid
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              customCategories={customCategories}
              onAddCustomCategory={handleAddCustom}
            />

            {/* Optional Note Input with Focus Glow */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.messageInput,
                  isNoteFocused && styles.messageInputFocused,
                ]}
                placeholder="Add optional note (e.g. Swiggy order)..."
                placeholderTextColor="#71717A"
                value={message}
                onChangeText={setMessage}
                onFocus={() => setIsNoteFocused(true)}
                onBlur={() => setIsNoteFocused(false)}
                maxLength={100}
              />
            </View>

            {/* Circular Tactile Numpad */}
            <Numpad value={amount} onChange={setAmount} />

            {/* Upload CTA Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              style={[
                styles.uploadBtn,
                (!amount || parseFloat(amount) <= 0) && styles.uploadBtnDisabled,
              ]}
              onPress={handleSubmit}
            >
              <Text style={styles.uploadBtnText}>
                {isSubmitting
                  ? 'LOGGING EXPENSE...'
                  : `⚡ UPLOAD EXPENSE ${amount ? `(₹${amount})` : ''}`}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxHeight: SCREEN_HEIGHT * 0.94,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: 6,
  },
  closeBtnText: {
    color: '#71717A',
    fontSize: 18,
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  currencySymbol: {
    color: '#60A5FA',
    fontSize: 36,
    fontWeight: '900',
    marginRight: 8,
  },
  amountDisplay: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputWrapper: {
    marginVertical: 8,
  },
  messageInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  messageInputFocused: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  uploadBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  uploadBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
