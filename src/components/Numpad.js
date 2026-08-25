import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

const BUTTONS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export default function Numpad({ value, onChange }) {
  const handlePress = (key) => {
    // Medium haptic tap on numpad press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

    // Max amount safety check
    if (currentValue.length >= 8 && key !== '⌫') return;

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
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  button: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  keyText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  deleteKeyText: {
    color: '#F87171',
    fontSize: 22,
  },
});
