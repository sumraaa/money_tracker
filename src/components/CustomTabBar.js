import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BarChart2, Plus, Repeat, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ANIMATION } from '../constants/theme';

export default function CustomTabBar({ activeTab, onTabPress, onQuickLogPress }) {
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(16, insets.bottom + 8);

  const homeScale = useRef(new Animated.Value(1)).current;
  const analyticsScale = useRef(new Animated.Value(1)).current;
  const recurringScale = useRef(new Animated.Value(1)).current;
  const historyScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(homeScale, {
      toValue: activeTab === 'home' ? 1.1 : 1,
      useNativeDriver: true,
      friction: ANIMATION.spring.friction,
      tension: ANIMATION.spring.tension,
    }).start();

    Animated.spring(analyticsScale, {
      toValue: activeTab === 'analytics' ? 1.1 : 1,
      useNativeDriver: true,
      friction: ANIMATION.spring.friction,
      tension: ANIMATION.spring.tension,
    }).start();

    Animated.spring(recurringScale, {
      toValue: activeTab === 'recurring' ? 1.1 : 1,
      useNativeDriver: true,
      friction: ANIMATION.spring.friction,
      tension: ANIMATION.spring.tension,
    }).start();

    Animated.spring(historyScale, {
      toValue: activeTab === 'history' ? 1.1 : 1,
      useNativeDriver: true,
      friction: ANIMATION.spring.friction,
      tension: ANIMATION.spring.tension,
    }).start();
  }, [activeTab]);

  const handleTabPress = (tabId) => {
    if (tabId === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabPress(tabId);
  };

  const handleQuickLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onQuickLogPress) {
      onQuickLogPress();
    } else {
      onTabPress('home');
    }
  };

  return (
    <View style={[styles.floatingContainer, { bottom: bottomMargin }]}>
      {/* Slot 1: Home Tab (Left Outer) */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.tabBtn}
        onPress={() => handleTabPress('home')}
      >
        <Animated.View
          style={[
            styles.iconWrap,
            activeTab === 'home' && styles.activeIconWrap,
            { transform: [{ scale: homeScale }] },
          ]}
        >
          <Home
            size={22}
            color={activeTab === 'home' ? '#ffffff' : '#b7c6c2'}
            strokeWidth={activeTab === 'home' ? 2.4 : 1.8}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Slot 2: Analytics Tab (Left Inner) */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.tabBtn}
        onPress={() => handleTabPress('analytics')}
      >
        <Animated.View
          style={[
            styles.iconWrap,
            activeTab === 'analytics' && styles.activeIconWrap,
            { transform: [{ scale: analyticsScale }] },
          ]}
        >
          <BarChart2
            size={22}
            color={activeTab === 'analytics' ? '#ffffff' : '#b7c6c2'}
            strokeWidth={activeTab === 'analytics' ? 2.4 : 1.8}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Slot 3: Quick Log FAB (+) (Dead Center) */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fabBtn}
        onPress={handleQuickLog}
      >
        <View style={styles.centerFab}>
          <Plus size={26} color="#ffffff" strokeWidth={2.6} />
        </View>
      </TouchableOpacity>

      {/* Slot 4: Subscriptions & Bills Tab (Right Inner) */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.tabBtn}
        onPress={() => handleTabPress('recurring')}
      >
        <Animated.View
          style={[
            styles.iconWrap,
            activeTab === 'recurring' && styles.activeIconWrap,
            { transform: [{ scale: recurringScale }] },
          ]}
        >
          <Repeat
            size={22}
            color={activeTab === 'recurring' ? '#ffffff' : '#b7c6c2'}
            strokeWidth={activeTab === 'recurring' ? 2.4 : 1.8}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Slot 5: History Tab (Right Outer) */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.tabBtn}
        onPress={() => handleTabPress('history')}
      >
        <Animated.View
          style={[
            styles.iconWrap,
            activeTab === 'history' && styles.activeIconWrap,
            { transform: [{ scale: historyScale }] },
          ]}
        >
          <Clock
            size={22}
            color={activeTab === 'history' ? '#ffffff' : '#b7c6c2'}
            strokeWidth={activeTab === 'history' ? 2.4 : 1.8}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 16,
    left: 18,
    right: 18,
    height: 66,
    backgroundColor: '#171e19',
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  fabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ca0013',
    borderWidth: 4,
    borderColor: '#eeebe3',
    transform: [{ translateY: -22 }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ca0013',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
