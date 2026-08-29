import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

const BUTTONS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export default function Numpad({ value, onChange }) {
  const handlePress = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentValue = value || '';

    if (key === '⌫') {
      if (currentValue.length > 0) {
        onChange(currentValue.slice(0, -1));
      }
      return;
    }

    if (key === '.') {
      if (currentValue.includes('.')) return;
      if (currentValue === '') {
        onChange('0.');
        return;
      }
    }

    // Limit decimal precision to 2 digits
    if (currentValue.includes('.')) {
      const parts = currentValue.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    // Max amount safety (7 digits before decimal)
    const intPart = currentValue.split('.')[0] || '';
    if (key !== '.' && !currentValue.includes('.') && intPart.length >= 7) return;
    if (key !== '.' && currentValue.includes('.') && intPart.length >= 7) return;

    onChange(currentValue + key);
  };

  return (
    <View style={styles.grid}>
      {BUTTONS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              activeOpacity={0.5}
              style={[
                styles.button,
                key === '⌫' && styles.deleteButton,
              ]}
              onPress={() => handlePress(key)}
            >
              <Text
                style={[
                  styles.keyText,
                  key === '⌫' && styles.deleteKeyText,
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    paddingHorizontal: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.sm,
  },
  button: {
    width: 68,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  deleteButton: {
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.errorBorder,
  },
  keyText: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '500',
  },
  deleteKeyText: {
    color: COLORS.error,
    fontSize: 22,
  },
});
