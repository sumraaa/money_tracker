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
              activeOpacity={0.6}
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
    paddingHorizontal: SPACING.xs,
    marginVertical: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  deleteButton: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(202, 0, 19, 0.3)',
  },
  keyText: {
    fontFamily: TYPOGRAPHY.mono.fontFamily,
    color: '#171e19',
    fontSize: 22,
    fontWeight: '700',
  },
  deleteKeyText: {
    color: '#ca0013',
    fontSize: 20,
    fontWeight: '700',
  },
});

