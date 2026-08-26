import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { deleteExpense } from '../database/db';

const CATEGORY_EMOJIS = {
  'Fast Food & Swiggy': '🍔',
  'Gym & Supplements': '🏋️',
  'Subscriptions': '🎵',
  'Education & Courses': '🎓',
  'Transport': '🚗',
};

export default function ExpenseList({ expenses, onRefresh, syncStatus, onQuickLog }) {
  const handleDelete = (id, category, expense) => {
    Alert.alert(
      'Delete Expense',
      `Delete ${category} (₹${parseFloat(expense).toFixed(2)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(id);
            if (onRefresh) onRefresh();
          },
        },
      ]
    );
  };

  const getEmojiForCategory = (catName) => {
    if (CATEGORY_EMOJIS[catName]) return CATEGORY_EMOJIS[catName];
    if (catName.includes('Food') || catName.includes('Swiggy')) return '🍔';
    if (catName.includes('Gym') || catName.includes('Fitness')) return '🏋️';
    if (catName.includes('Sub') || catName.includes('Spotify')) return '🎵';
    if (catName.includes('Edu') || catName.includes('Course')) return '🎓';
    if (catName.includes('Trans') || catName.includes('Uber')) return '🚗';
    return '💳';
  };

  const renderItem = ({ item }) => {
    const isSynced = item.sync_status === 1;
    const dateFormatted = new Date(item.date_time).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const emoji = getEmojiForCategory(item.category);

    return (
      <View style={styles.cardRow}>
        {/* Left Circular Badge */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>{emoji}</Text>
        </View>

        {/* Middle Stacked Title & Date */}
        <View style={styles.cardDetails}>
          <Text style={styles.itemTitle}>{item.category}</Text>
          {item.message ? (
            <Text style={styles.itemSub} numberOfLines={1}>
              {item.message}
            </Text>
          ) : null}
          <Text style={styles.itemDate}>{dateFormatted}</Text>
        </View>

        {/* Right Amount & Sync Status */}
        <View style={styles.cardRight}>
          <Text style={styles.amountText}>
            ₹{parseFloat(item.expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>

          <View style={[styles.syncBadge, isSynced ? styles.syncedBadge : styles.queuedBadge]}>
            <Text style={[styles.syncText, isSynced ? styles.syncedText : styles.queuedText]}>
              {isSynced ? '🟢 Synced' : '🟡 Local Queue'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id, item.category, item.expense)}
          >
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalSpent = expenses.reduce((sum, item) => sum + parseFloat(item.expense), 0);
  const unsyncedCount = expenses.filter((item) => item.sync_status === 0).length;

  return (
    <View style={styles.container}>
      {/* Center Stage Hero Metric Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TOTAL TRACKED</Text>
        <Text style={styles.heroValue}>
          ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>

        <View style={styles.statusPillRow}>
          <View
            style={[
              styles.statusPill,
              unsyncedCount > 0 ? styles.statusPillQueued : styles.statusPillSynced,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                unsyncedCount > 0 ? styles.statusPillTextQueued : styles.statusPillTextSynced,
              ]}
            >
              {unsyncedCount > 0
                ? `🟡 ${unsyncedCount} Unsynced in Local Queue`
                : '🟢 Cloud Synced to Google Sheets'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Quick Log CTA Block ── */}
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.quickLogBlock}
        onPress={onQuickLog}
      >
        <View style={styles.quickLogLeft}>
          <View style={styles.quickLogIconWrap}>
            <Text style={styles.quickLogIcon}>⚡</Text>
          </View>
          <View>
            <Text style={styles.quickLogTitle}>Quick Log</Text>
            <Text style={styles.quickLogSub}>Tap to record an expense instantly</Text>
          </View>
        </View>
        <View style={styles.quickLogArrow}>
          <Text style={styles.quickLogArrowText}>›</Text>
        </View>
      </TouchableOpacity>

      {/* List Header */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Sync 🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity List */}
      {expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💸</Text>
          <Text style={styles.emptyTitle}>No Transactions Recorded</Text>
          <Text style={styles.emptySubtitle}>
            Tap "⚡ Quick Log" below or double press your hardware button to log an expense in seconds!
          </Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroLabel: {
    color: '#A0A0AB',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusPillRow: {
    marginTop: 12,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  statusPillSynced: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusPillQueued: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillTextSynced: {
    color: '#34D399',
  },
  statusPillTextQueued: {
    color: '#FBBF24',
  },
  syncBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  syncBannerText: {
    color: '#A0A0AB',
    fontSize: 12,
    fontWeight: '500',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  refreshBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  refreshText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  // Quick Log CTA Block
  quickLogBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 20,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  quickLogLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quickLogIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)',
  },
  quickLogIcon: { fontSize: 20 },
  quickLogTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  quickLogSub: { color: '#38BDF8', fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.8 },
  quickLogArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  quickLogArrowText: { color: '#38BDF8', fontSize: 20, fontWeight: '300', lineHeight: 24 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconEmoji: {
    fontSize: 22,
  },
  cardDetails: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemSub: {
    color: '#D4D4D8',
    fontSize: 13,
    marginBottom: 2,
  },
  itemDate: {
    color: '#A0A0AB',
    fontSize: 11,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginBottom: 4,
  },
  syncedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  queuedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncedText: {
    color: '#34D399',
  },
  queuedText: {
    color: '#FBBF24',
  },
  deleteBtn: {
    padding: 2,
  },
  deleteText: {
    color: '#52525B',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#A0A0AB',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 19,
  },
});
