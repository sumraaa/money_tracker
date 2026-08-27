import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, DEFAULT_CATEGORIES } from '../constants/theme';

export default function CategoryGrid({
  selectedCategory,
  onSelectCategory,
  customCategories = [],
  onAddCustomCategory,
}) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('🏷️');

  const safeCustomCategories = Array.isArray(customCategories) ? customCategories : [];

  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...safeCustomCategories
      .filter((c) => c && c.name && typeof c.name === 'string')
      .map((c) => ({
        id: String(c.name).toLowerCase().replace(/\s+/g, '-'),
        name: String(c.name).trim(),
        icon: String(c.icon || '🏷️'),
        color: String(c.color || COLORS.accent),
      })),
  ];

  const handleSelect = (cat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onSelectCategory && cat?.name) {
      onSelectCategory(String(cat.name).trim());
    }
  };

  const handleSaveCustom = () => {
    const cleanName = (customName || '').trim();
    const cleanIcon = customIcon || '🏷️';

    if (!cleanName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (onAddCustomCategory) {
      onAddCustomCategory(cleanName, cleanIcon);
    }
    if (onSelectCategory) {
      onSelectCategory(cleanName);
    }

    setCustomName('');
    setCustomIcon('🏷️');
    setShowCustomModal(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CATEGORY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {allCategories.map((item) => {
          const isSelected = selectedCategory === item.name;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.chipIcon}>{item.icon}</Text>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.chip, styles.addCustomChip]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCustomModal(true);
          }}
        >
          <Text style={styles.chipIcon}>+</Text>
          <Text style={[styles.chipText, { color: COLORS.accent }]}>Custom</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Category Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.customModalContent}>
            <Text style={styles.customModalTitle}>New Category</Text>
            <TextInput
              style={styles.customInput}
              placeholder="e.g. Coffee, Pet Care"
              placeholderTextColor={COLORS.textMuted}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />
            <View style={styles.iconSelector}>
              {['🏷️', '🛒', '☕', '🍿', '💻', '🚕', '🏥', '⚡'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.7}
                  style={[styles.emojiBtn, customIcon === emoji && styles.emojiBtnSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCustomIcon(emoji);
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCustomModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.saveBtn}
                onPress={handleSaveCustom}
              >
                <Text style={styles.saveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  scrollContent: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
  },
  addCustomChip: {
    borderStyle: 'dashed',
    borderColor: COLORS.borderAccent,
    backgroundColor: COLORS.accentBg,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  customModalContent: {
    width: '100%',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  customModalTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  customInput: {
    backgroundColor: COLORS.bgSurface,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  iconSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  emojiBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgSurface,
  },
  emojiBtnSelected: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: COLORS.accentStrong,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
  },
  saveText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
