import * as SQLite from 'expo-sqlite';

const DB_NAME = 'zero_friction_expenses.db';

let dbInstance = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbInstance;
};

/**
 * Universal SQLite parameter binder sanitizer.
 * Guarantees zero `undefined` values ever reach native Android/iOS prepareAsync call.
 */
const toSqlParam = (val, fallback = '') => {
  if (val === undefined || val === null) {
    return fallback;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  return String(val);
};

/**
 * Initialize the SQLite Database & Schema
 */
export const initDatabase = async () => {
  try {
    const db = await getDb();
    
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        expense REAL NOT NULL,
        date_time TEXT NOT NULL,
        message TEXT,
        sync_status INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS custom_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        color TEXT
      );
    `);

    console.log('[SQLite] Database initialized successfully');
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
};

/**
 * Add a new expense (Offline-First: saved with sync_status = 0)
 */
export const addExpense = async (params = {}) => {
  try {
    const db = await getDb();
    
    const rawCategory = params?.category;
    const rawExpense = params?.expense;
    const rawDateTime = params?.date_time;
    const rawMessage = params?.message;

    const safeCategory = toSqlParam(rawCategory, 'Uncategorized').trim() || 'Uncategorized';
    const numericAmount = parseFloat(rawExpense);
    const safeExpense = isNaN(numericAmount) ? 0 : numericAmount;
    const safeDateTime = toSqlParam(rawDateTime, new Date().toISOString());
    const safeMessage = toSqlParam(rawMessage, '').trim();

    if (safeExpense <= 0) {
      throw new Error('Invalid expense amount');
    }

    const sqlParams = [safeCategory, safeExpense, safeDateTime, safeMessage];
    const cleanSqlParams = sqlParams.map((p) => toSqlParam(p, ''));

    const result = await db.runAsync(
      `INSERT INTO expenses (category, expense, date_time, message, sync_status) VALUES (?, ?, ?, ?, 0);`,
      cleanSqlParams
    );

    console.log(`[SQLite] Expense added with ID: ${result.lastInsertRowId}`);
    return {
      id: result.lastInsertRowId,
      category: safeCategory,
      expense: safeExpense,
      date_time: safeDateTime,
      message: safeMessage,
      sync_status: 0
    };
  } catch (error) {
    console.error('[SQLite] Error adding expense:', error);
    throw error;
  }
};

/**
 * Get all unsynced expenses (sync_status = 0)
 */
export const getUnsyncedExpenses = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT id, category, expense, date_time, message, sync_status FROM expenses WHERE sync_status = 0 ORDER BY id ASC;`
    );
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error fetching unsynced expenses:', error);
    return [];
  }
};

/**
 * Mark expenses as synced (sync_status = 1)
 */
export const markExpensesAsSynced = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  try {
    const db = await getDb();
    const cleanIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
    if (cleanIds.length === 0) return;

    const placeholders = cleanIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE expenses SET sync_status = 1 WHERE id IN (${placeholders});`,
      cleanIds
    );
    console.log(`[SQLite] Marked ${cleanIds.length} items as synced.`);
  } catch (error) {
    console.error('[SQLite] Error updating sync_status:', error);
  }
};

/**
 * Get all expenses for history view
 */
export const getAllExpenses = async (limit = 50) => {
  try {
    const db = await getDb();
    const safeLimit = Number(limit) && limit > 0 ? Number(limit) : 50;
    const rows = await db.getAllAsync(
      `SELECT * FROM expenses ORDER BY date_time DESC LIMIT ?;`,
      [safeLimit]
    );
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error fetching all expenses:', error);
    return [];
  }
};

/**
 * Delete expense by ID
 */
export const deleteExpense = async (id) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) return;
    await db.runAsync(`DELETE FROM expenses WHERE id = ?;`, [safeId]);
  } catch (error) {
    console.error('[SQLite] Error deleting expense:', error);
  }
};

/**
 * Get expenses aggregated by timeframe for chart + history display.
 * @param {'week'|'month'|'year'} timeframe
 * @returns {{ chartData: Array<{day: string, value: number}>, expenses: Array }}
 */
export const getExpensesByTimeframe = async (timeframe = 'week') => {
  try {
    const db = await getDb();
    const now = new Date();
    let startDate;

    if (timeframe === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
    } else if (timeframe === 'month') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
    } else {
      // year
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 364);
    }

    const startIso = startDate.toISOString();

    // Raw expense list for history view
    const expenses = await db.getAllAsync(
      `SELECT * FROM expenses WHERE date_time >= ? ORDER BY date_time DESC;`,
      [startIso]
    );

    // Aggregate daily totals for the chart
    const aggregated = await db.getAllAsync(
      `SELECT substr(date_time, 1, 10) AS day, SUM(expense) AS total
       FROM expenses
       WHERE date_time >= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [startIso]
    );

    // Build a dense day-by-day array (fill gaps with 0)
    const chartMap = {};
    (aggregated || []).forEach((row) => {
      chartMap[row.day] = row.total;
    });

    const chartData = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= now) {
      const dayKey = cursor.toISOString().slice(0, 10);
      chartData.push({
        day: dayKey,
        value: chartMap[dayKey] ? parseFloat(chartMap[dayKey].toFixed(2)) : 0,
        label:
          timeframe === 'week'
            ? cursor.toLocaleDateString('en-IN', { weekday: 'short' })
            : timeframe === 'month'
            ? cursor.getDate() % 5 === 1 || cursor.getDate() === 1
              ? cursor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : ''
            : cursor.getDate() === 1
            ? cursor.toLocaleDateString('en-IN', { month: 'short' })
            : '',
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { chartData, expenses: expenses || [] };
  } catch (error) {
    console.error('[SQLite] Error in getExpensesByTimeframe:', error);
    return { chartData: [], expenses: [] };
  }
};

/**
 * Custom Categories CRUD
 */
export const getCustomCategories = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM custom_categories;`);
    return rows || [];
  } catch (error) {
    return [];
  }
};

export const addCustomCategory = async (name, icon = '🏷️', color = '#3B82F6') => {
  try {
    const db = await getDb();
    const safeName = toSqlParam(name, '').trim();
    const safeIcon = toSqlParam(icon, '🏷️');
    const safeColor = toSqlParam(color, '#3B82F6');

    if (!safeName) return;

    await db.runAsync(
      `INSERT OR IGNORE INTO custom_categories (name, icon, color) VALUES (?, ?, ?);`,
      [safeName, safeIcon, safeColor]
    );
    console.log(`[SQLite] Custom category saved: ${safeName}`);
  } catch (error) {
    console.error('[SQLite] Error adding custom category:', error);
  }
};
