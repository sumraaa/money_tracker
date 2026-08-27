import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Home, BarChart2, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, ANIMATION } from '../constants/theme';

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
                  isActive && styles.iconWrapActive,
                  { transform: [{ scale: scales[idx] }] },
                ]}
              >
                <tab.Icon
                  size={20}
                  color={isActive ? COLORS.accent : COLORS.textMuted}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
              </Animated.View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
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
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    position: 'relative',
  },
  iconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  iconWrapActive: {
    backgroundColor: COLORS.accentMuted,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 3,
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
});
