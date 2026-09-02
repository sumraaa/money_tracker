import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { DEFAULT_CATEGORIES } from '../constants/theme';
import { formatINR } from '../utils/money';

function getCategoryIcon(categoryName) {
  if (!categoryName) return '💳';
  const cat = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return cat?.icon || '💳';
}

function getCategoryColor(categoryName) {
  if (!categoryName) return '#6c7772';
  const cat = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return cat?.color || '#6c7772';
}

export default function PaceActionSheet({
  visible,
  transaction,
  onClose,
  onEdit,
  onDelete,
}) {
  if (!visible || !transaction) return null;

  const label = transaction.merchant || transaction.category || 'Expense';
  const category = transaction.category || 'Expense';
  const icon = getCategoryIcon(category);
  const color = getCategoryColor(category);
  const amountVal = parseFloat(transaction.expense !== undefined ? transaction.expense : transaction.amount || 0);
  const amountStr = formatINR(amountVal, { showPaise: false });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Transaction Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <View style={[styles.categoryBadge, { backgroundColor: color + '18' }]}>
                <Text style={styles.categoryIcon}>{icon}</Text>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </View>
            <Text style={styles.amountText}>{amountStr}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Edit Expense Button */}
            <TouchableOpacity
              style={styles.editBtn}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                if (onEdit) onEdit(transaction);
              }}
            >
              <Pencil size={18} color="#ffffff" strokeWidth={2.2} />
              <Text style={styles.editText}>Edit Expense</Text>
            </TouchableOpacity>

            {/* Delete Expense Button */}
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                if (onDelete) onDelete(transaction);
              }}
            >
              <Trash2 size={18} color="#ca0013" strokeWidth={2.2} />
              <Text style={styles.deleteText}>Delete Expense</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 30, 25, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    marginHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    maxWidth: '100%',
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171e19',
  },
  amountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#171e19',
  },
  actionsContainer: {
    gap: 10,
  },
  editBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#171e19',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    width: '100%',
    height: 52,
    backgroundColor: 'rgba(202, 0, 19, 0.08)',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    color: '#ca0013',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    width: '100%',
    height: 42,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#6c7772',
    fontSize: 14,
    fontWeight: '700',
  },
});
