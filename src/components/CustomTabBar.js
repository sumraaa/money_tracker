import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Home, BarChart2, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, ANIMATION, TYPOGRAPHY } from '../constants/theme';

const TABS = [
  { id: 'home', label: 'Log', Icon: Home },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'history', label: 'History', Icon: Clock },
];

export default function CustomTabBar({ activeTab, onTabPress }) {
  const scales = useRef(TABS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    TABS.forEach((tab, idx) => {
      Animated.spring(scales[idx], {
        toValue: tab.id === activeTab ? 1.08 : 1,
        useNativeDriver: true,
        friction: ANIMATION.spring.friction,
        tension: ANIMATION.spring.tension,
      }).start();
    });
  }, [activeTab]);

  const handlePress = (tabId) => {
    if (tabId === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabPress(tabId);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              style={styles.tabBtn}
              onPress={() => handlePress(tab.id)}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  { transform: [{ scale: scales[idx] }] },
                ]}
              >
                <tab.Icon
                  size={20}
                  color={isActive ? '#FFFFFF' : '#555555'}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
              </Animated.View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive ? <View style={styles.activeDot} /> : <View style={styles.dotPlaceholder} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
    backgroundColor: '#050505',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justify: 'center',
  },
  tabLabel: {
    ...TYPOGRAPHY.labelXs,
    marginTop: 2,
    color: '#555555',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF4500',
    marginTop: 4,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
});

