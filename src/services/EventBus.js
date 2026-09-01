/**
 * ZERO FRICTION — Event Bus
 * Simple pub/sub for global data consistency.
 * When an expense is created/updated/deleted, all screens
 * can react without prop-drilling or complex state management.
 */

const listeners = {};

export const EventTypes = {
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_UPDATED: 'EXPENSE_UPDATED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  BUDGET_CHANGED: 'BUDGET_CHANGED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  DATA_IMPORTED: 'DATA_IMPORTED',
  TAB_CHANGED: 'TAB_CHANGED',
};

export function emit(event, data) {
  if (listeners[event]) {
    listeners[event].forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(`[EventBus] Error in listener for ${event}:`, e);
      }
    });
  }
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter((l) => l !== fn);
  }
}
