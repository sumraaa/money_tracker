import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, DEFAULT_CATEGORIES } from '../constants/theme';

export default function CategoryGrid({ selectedCategory, onSelectCategory, customCategories = [], onAddCustomCategory }) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('🏷️');

  const safeCustom = Array.isArray(customCategories) ? customCategories : [];
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...safeCustom
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
    if (onSelectCategory && cat?.name) onSelectCategory(String(cat.name).trim());
  };

  const handleSaveCustom = () => {
    const cleanName = (customName || '').trim();
    if (!cleanName) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onAddCustomCategory) onAddCustomCategory(cleanName, customIcon || '🏷️');
    if (onSelectCategory) onSelectCategory(cleanName);
    setCustomName(''); setCustomIcon('🏷️'); setShowCustomModal(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CATEGORY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {allCategories.map((item) => {
          const isSelected = selectedCategory === item.name;
          return (
            <TouchableOpacity key={item.id} activeOpacity={0.7}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleSelect(item)}>
              <Text style={styles.chipIcon}>{item.icon}</Text>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity activeOpacity={0.7} style={[styles.chip, styles.addCustomChip]}
          onPress={() => { Haptics.selectionAsync(); setShowCustomModal(true); }}>
          <Text style={styles.chipIcon}>+</Text>
          <Text style={[styles.chipText, { color: COLORS.accentRed, fontWeight: '700' }]}>Custom</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCustomModal} transparent animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.customModalContent}>
            <Text style={styles.customModalTitle}>New Category</Text>
            <TextInput style={styles.customInput}
              placeholder="e.g. Coffee, Pet Care" placeholderTextColor={COLORS.textMuted}
              value={customName} onChangeText={setCustomName} autoFocus
            />
            <View style={styles.iconSelector}>
              {['🏷️', '🛒', '☕', '🍿', '💻', '🚕', '🏥', '⚡'].map((emoji) => (
                <TouchableOpacity key={emoji} activeOpacity={0.7}
                  style={[styles.emojiBtn, customIcon === emoji && styles.emojiBtnSelected]}
                  onPress={() => { Haptics.selectionAsync(); setCustomIcon(emoji); }}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCustomModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.saveBtn} onPress={handleSaveCustom}>
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
  container: { marginVertical: SPACING.xs },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#6c7772', letterSpacing: 1.5, marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs },
  scrollContent: { gap: SPACING.sm, paddingRight: SPACING.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
  },
  chipSelected: { backgroundColor: '#171e19', borderColor: '#171e19' },
  addCustomChip: { borderStyle: 'dashed', borderColor: '#ca0013', backgroundColor: 'rgba(202, 0, 19, 0.08)' },
  chipIcon: { fontSize: 15, marginRight: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6c7772' },
  chipTextSelected: { color: '#ffffff', fontWeight: '800' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23, 30, 25, 0.65)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  customModalContent: {
    width: '100%', backgroundColor: '#ffffff', borderRadius: 32,
    padding: SPACING.xxl, borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  customModalTitle: { fontSize: 20, fontWeight: '800', color: '#171e19', marginBottom: SPACING.lg },
  customInput: {
    backgroundColor: '#eeebe3', color: '#171e19', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(183, 198, 194, 0.35)', marginBottom: SPACING.lg,
  },
  iconSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  emojiBtn: { padding: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: '#eeebe3' },
  emojiBtnSelected: { backgroundColor: 'rgba(202, 0, 19, 0.12)', borderWidth: 1, borderColor: '#ca0013' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  cancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  cancelText: { color: '#6c7772', fontWeight: '700' },
  saveBtn: { backgroundColor: '#ca0013', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.pill },
  saveText: { color: '#ffffff', fontWeight: '800' },
});

