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

const DEFAULT_CATEGORIES = [
  { id: 'fast-food', name: 'Fast Food & Swiggy', icon: '🍔', color: '#EF4444' },
  { id: 'gym', name: 'Gym & Supplements', icon: '🏋️', color: '#10B981' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🎵', color: '#A855F7' },
  { id: 'education', name: 'Education & Courses', icon: '🎓', color: '#3B82F6' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#F59E0B' },
];

export default function CategoryGrid({
  selectedCategory,
  onSelectCategory,
  customCategories = [],
  onAddCustomCategory,
}) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('🏷️');
  const [isFocused, setIsFocused] = useState(false);

  const safeCustomCategories = Array.isArray(customCategories) ? customCategories : [];

  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...safeCustomCategories
      .filter((c) => c && c.name && typeof c.name === 'string')
      .map((c) => ({
        id: String(c.name).toLowerCase().replace(/\s+/g, '-'),
        name: String(c.name).trim(),
        icon: String(c.icon || '🏷️'),
        color: String(c.color || '#3B82F6'),
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
              activeOpacity={0.75}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.chipIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add Custom Category Chip */}
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.chip, styles.addCustomChip]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCustomModal(true);
          }}
        >
          <Text style={styles.chipIcon}>➕</Text>
          <Text style={[styles.chipText, { color: '#60A5FA' }]}>Custom</Text>
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
            <Text style={styles.customModalTitle}>New Custom Category</Text>
            <TextInput
              style={[
                styles.customInput,
                isFocused && styles.customInputFocused,
              ]}
              placeholder="e.g. Coffee, Pet Care"
              placeholderTextColor="#71717A"
              value={customName}
              onChangeText={setCustomName}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoFocus
            />

            <View style={styles.iconSelector}>
              {['🏷️', '🛒', '☕', '🍿', '💻', '🚕', '🏥', '⚡'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.7}
                  style={[
                    styles.emojiBtn,
                    customIcon === emoji && styles.emojiBtnSelected,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCustomIcon(emoji);
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCustomModal(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.saveBtn}
                onPress={handleSaveCustom}
              >
                <Text style={styles.saveText}>Add Category</Text>
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
    marginVertical: 12,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  addCustomChip: {
    borderStyle: 'dashed',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  chipText: {
    color: '#A0A0AB',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  customModalContent: {
    width: '100%',
    backgroundColor: '#09090B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  customModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  customInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  customInputFocused: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  iconSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  emojiBtn: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  emojiBtnSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  cancelText: {
    color: '#71717A',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 100,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
