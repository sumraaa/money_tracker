import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Home, BarChart2, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { id: 'home', label: 'Log', Icon: Home },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'history', label: 'History', Icon: Clock },
];

const NEON = '#38BDF8'; // electric cyan accent
const INACTIVE = '#52525B';

export default function CustomTabBar({ activeTab, onTabPress }) {
  const scales = useRef(TABS.map(() => new Animated.Value(1))).current;
  const glows = useRef(TABS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    TABS.forEach((tab, idx) => {
      const isActive = tab.id === activeTab;
      Animated.parallel([
        Animated.spring(scales[idx], {
          toValue: isActive ? 1.18 : 1,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
        }),
        Animated.timing(glows[idx], {
          toValue: isActive ? 1 : 0,
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [activeTab]);

  const handlePress = (tabId, idx) => {
    if (tabId === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabPress(tabId);
  };

  return (
    <View style={styles.wrapper}>
      {/* Blurred glass surface */}
      <View style={styles.container}>
        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          const labelColor = glows[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [INACTIVE, NEON],
          });

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.75}
              style={styles.tabBtn}
              onPress={() => handlePress(tab.id, idx)}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  { transform: [{ scale: scales[idx] }] },
                ]}
              >
                {/* Glow halo behind icon when active */}
                {isActive && <View style={styles.iconGlow} />}
                <tab.Icon
                  size={22}
                  color={isActive ? NEON : INACTIVE}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </Animated.View>
              <Animated.Text style={[styles.tabLabel, { color: labelColor }]}>
                {tab.label}
              </Animated.Text>
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
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56,189,248,0.14)',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 3,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: NEON,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
});
