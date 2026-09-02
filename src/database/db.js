import * as SQLite from 'expo-sqlite';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from '../utils/dates';

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

// ─── Schema Migrations ──────────────────────────────────────────
// Each migration runs exactly once per version bump.
// NEVER drops tables or deletes user data.
// ─────────────────────────────────────────────────────────────────

// Safe helper to add missing columns without throwing on duplicate column name
async function addMissingColumn(db, tableName, colName, colTypeDef) {
  try {
    const cols = await getColumnNames(db, tableName);
    if (!cols.includes(colName)) {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colTypeDef};`);
      console.log(`[SQLite] Added missing column '${colName}' to '${tableName}'`);
    }
  } catch (err) {
    console.warn(`[SQLite] Column addition notice for '${tableName}.${colName}':`, err?.message || err);
  }
}

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema',
    up: async (db) => {
      try {
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
      } catch (err) {
        console.warn('[SQLite] Migration v1 warning:', err?.message || err);
      }
    },
  },
  {
    version: 2,
    description: 'Add merchant, payment_method, is_recurring, updated_at',
    up: async (db) => {
      await addMissingColumn(db, 'expenses', 'merchant', "TEXT DEFAULT ''");
      await addMissingColumn(db, 'expenses', 'payment_method', "TEXT DEFAULT 'UPI'");
      await addMissingColumn(db, 'expenses', 'is_recurring', 'INTEGER DEFAULT 0');
      await addMissingColumn(db, 'expenses', 'updated_at', 'DATETIME');
    },
  },
  {
    version: 3,
    description: 'Add budgets table and settings table',
    up: async (db) => {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            monthly_limit REAL NOT NULL DEFAULT 0,
            is_overall INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `);
      } catch (err) {
        console.warn('[SQLite] Migration v3 warning:', err?.message || err);
      }
    },
  },
  {
    version: 4,
    description: 'Add recurring_expenses table',
    up: async (db) => {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS recurring_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            merchant TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'Subscriptions',
            frequency TEXT NOT NULL DEFAULT 'monthly',
            next_date TEXT,
            is_subscription INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            payment_method TEXT DEFAULT 'UPI',
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
          );
        `);
      } catch (err) {
        console.warn('[SQLite] Migration v4 warning:', err?.message || err);
      }
    },
  },
];

async function getColumnNames(db, tableName) {
  try {
    const rows = await db.getAllAsync(`PRAGMA table_info(${tableName});`);
    return (rows || []).map((r) => r.name);
  } catch {
    return [];
  }
}

async function getCurrentVersion(db) {
  try {
    const result = await db.getFirstAsync(`PRAGMA user_version;`);
    return result?.user_version ?? 0;
  } catch {
    return 0;
  }
}

async function setVersion(db, version) {
  try {
    await db.execAsync(`PRAGMA user_version = ${version};`);
  } catch (err) {
    console.warn('[SQLite] setVersion error:', err?.message || err);
  }
}

/**
 * Initialize the SQLite Database & run migrations.
 * Guaranteed to NEVER throw an unhandled rejection to the root UI thread.
 */
export const initDatabase = async () => {
  try {
    const db = await getDb();
    try {
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
    } catch (e) {
      console.warn('[SQLite] PRAGMA journal_mode notice:', e?.message || e);
    }

    const currentVersion = await getCurrentVersion(db);
    console.log(`[SQLite] Current DB version: ${currentVersion}`);

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[SQLite] Running migration v${migration.version}: ${migration.description}`);
        try {
          await migration.up(db);
          await setVersion(db, migration.version);
        } catch (mErr) {
          console.error(`[SQLite] Migration v${migration.version} error:`, mErr);
        }
      }
    }

    console.log('[SQLite] Database initialized cleanly with fresh tables.');
    return { success: true };
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    return { success: false, error };
  }
};

export const initDB = initDatabase;

// ─── CRUD Operations ─────────────────────────────────────────────

/**
 * Add a new expense (Offline-First: saved with sync_status = 0)
 */
export const addExpense = async (params = {}) => {
  try {
    const db = await getDb();

    const safeCategory = toSqlParam(params?.category, 'Other').trim() || 'Other';
    const numericAmount = parseFloat(params?.expense);
    const safeExpense = isNaN(numericAmount) ? 0 : numericAmount;
    const safeDateTime = toSqlParam(params?.date_time, new Date().toISOString());
    const safeMessage = toSqlParam(params?.message, '').trim();
    const safeMerchant = toSqlParam(params?.merchant, '').trim();
    const safePaymentMethod = toSqlParam(params?.payment_method, 'UPI');
    const safeIsRecurring = params?.is_recurring ? 1 : 0;

    if (safeExpense <= 0) {
      throw new Error('Invalid expense amount');
    }

    const now = new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO expenses (category, expense, date_time, message, merchant, payment_method, is_recurring, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [safeCategory, safeExpense, safeDateTime, safeMessage, safeMerchant, safePaymentMethod, safeIsRecurring, now, now]
    );

    console.log(`[SQLite] Expense added with ID: ${result.lastInsertRowId}`);
    return {
      id: result.lastInsertRowId,
      category: safeCategory,
      expense: safeExpense,
      date_time: safeDateTime,
      message: safeMessage,
      merchant: safeMerchant,
      payment_method: safePaymentMethod,
      is_recurring: safeIsRecurring,
      sync_status: 0,
      created_at: now,
      updated_at: now,
    };
  } catch (error) {
    console.error('[SQLite] Error adding expense:', error);
    throw error;
  }
};

/**
 * Update an existing expense by ID.
 */
export const updateExpense = async (id, params = {}) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid expense ID');

    const fields = [];
    const values = [];

    if (params.category !== undefined) {
      fields.push('category = ?');
      values.push(toSqlParam(params.category, 'Other'));
    }
    if (params.expense !== undefined) {
      const num = parseFloat(params.expense);
      if (isNaN(num) || num <= 0) throw new Error('Invalid amount');
      fields.push('expense = ?');
      values.push(num);
    }
    if (params.date_time !== undefined) {
      fields.push('date_time = ?');
      values.push(toSqlParam(params.date_time, new Date().toISOString()));
    }
    if (params.message !== undefined) {
      fields.push('message = ?');
      values.push(toSqlParam(params.message, ''));
    }
    if (params.merchant !== undefined) {
      fields.push('merchant = ?');
      values.push(toSqlParam(params.merchant, ''));
    }
    if (params.payment_method !== undefined) {
      fields.push('payment_method = ?');
      values.push(toSqlParam(params.payment_method, 'UPI'));
    }
    if (params.is_recurring !== undefined) {
      fields.push('is_recurring = ?');
      values.push(params.is_recurring ? 1 : 0);
    }

    if (fields.length === 0) return;

    // Mark as needing re-sync after edit
    fields.push('sync_status = 0');
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(safeId);

    await db.runAsync(
      `UPDATE expenses SET ${fields.join(', ')} WHERE id = ?;`,
      values
    );
    console.log(`[SQLite] Expense ${safeId} updated`);
  } catch (error) {
    console.error('[SQLite] Error updating expense:', error);
    throw error;
  }
};

/**
 * Get a single expense by ID.
 */
export const getExpenseById = async (id) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) return null;
    const row = await db.getFirstAsync(`SELECT * FROM expenses WHERE id = ?;`, [safeId]);
    return row || null;
  } catch (error) {
    console.error('[SQLite] Error getting expense:', error);
    return null;
  }
};

/**
 * Get all unsynced expenses (sync_status = 0)
 */
export const getUnsyncedExpenses = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM expenses WHERE sync_status = 0 ORDER BY id ASC;`
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
 * Get all expenses for history view with optional filters.
 */
export const getAllExpenses = async (options = {}) => {
  try {
    const db = await getDb();
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      category,
      paymentMethod,
      search,
      sortBy = 'date_time',
      sortOrder = 'DESC',
      minAmount,
      maxAmount,
    } = options;

    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (startDate) {
      query += ' AND date_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date_time <= ?';
      params.push(endDate);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (paymentMethod) {
      query += ' AND payment_method = ?';
      params.push(paymentMethod);
    }
    if (search) {
      query += ' AND (merchant LIKE ? OR message LIKE ? OR category LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    if (minAmount !== undefined && minAmount !== null) {
      query += ' AND expense >= ?';
      params.push(Number(minAmount));
    }
    if (maxAmount !== undefined && maxAmount !== null) {
      query += ' AND expense <= ?';
      params.push(Number(maxAmount));
    }

    // Validate sort column
    const validSortCols = ['date_time', 'expense', 'category', 'created_at'];
    const safeSortBy = validSortCols.includes(sortBy) ? sortBy : 'date_time';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 100, Number(offset) || 0);

    const rows = await db.getAllAsync(query, params);
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error fetching expenses:', error);
    return [];
  }
};

/**
 * Count total expenses (with optional filters for pagination).
 */
export const countExpenses = async (options = {}) => {
  try {
    const db = await getDb();
    const { startDate, endDate, category, search } = options;

    let query = 'SELECT COUNT(*) as count FROM expenses WHERE 1=1';
    const params = [];

    if (startDate) {
      query += ' AND date_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date_time <= ?';
      params.push(endDate);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (merchant LIKE ? OR message LIKE ? OR category LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const result = await db.getFirstAsync(query, params);
    return result?.count ?? 0;
  } catch (error) {
    return 0;
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
    console.log(`[SQLite] Expense ${safeId} deleted`);
  } catch (error) {
    console.error('[SQLite] Error deleting expense:', error);
  }
};

/**
 * Get daily totals for chart.
 */
export const getDailyTotals = async (startDate, endDate) => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT substr(date_time, 1, 10) AS day, SUM(expense) AS total, COUNT(*) AS count
       FROM expenses
       WHERE date_time >= ? AND date_time <= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [startDate, endDate || new Date().toISOString()]
    );
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error getting daily totals:', error);
    return [];
  }
};

/**
 * Get category breakdown for a period.
 */
export const getCategoryBreakdown = async (startDate, endDate) => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT category, SUM(expense) AS total, COUNT(*) AS count
       FROM expenses
       WHERE date_time >= ? AND date_time <= ?
       GROUP BY category
       ORDER BY total DESC;`,
      [startDate, endDate || new Date().toISOString()]
    );
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error getting category breakdown:', error);
    return [];
  }
};

/**
 * Get total spending for a date range.
 */
export const getTotalSpending = async (startDate, endDate) => {
  try {
    const db = await getDb();
    const result = await db.getFirstAsync(
      `SELECT COALESCE(SUM(expense), 0) AS total, COUNT(*) AS count
       FROM expenses
       WHERE date_time >= ? AND date_time <= ?;`,
      [startDate, endDate || new Date().toISOString()]
    );
    return {
      total: result?.total ?? 0,
      count: result?.count ?? 0,
    };
  } catch (error) {
    return { total: 0, count: 0 };
  }
};

/**
 * Get largest expense in a period.
 */
export const getLargestExpense = async (startDate, endDate) => {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync(
      `SELECT * FROM expenses
       WHERE date_time >= ? AND date_time <= ?
       ORDER BY expense DESC LIMIT 1;`,
      [startDate, endDate || new Date().toISOString()]
    );
    return row || null;
  } catch (error) {
    return null;
  }
};

/**
 * Get recent unique merchants for suggestions.
 */
export const getRecentMerchants = async (limit = 10) => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT merchant, category, COUNT(*) AS freq
       FROM expenses
       WHERE merchant IS NOT NULL AND merchant != ''
       GROUP BY merchant
       ORDER BY MAX(date_time) DESC
       LIMIT ?;`,
      [limit]
    );
    return rows || [];
  } catch (error) {
    return [];
  }
};

/**
 * Get expenses aggregated by timeframe for legacy chart compat.
 */
export const getExpensesByTimeframe = async (timeframe = 'week') => {
  try {
    const db = await getDb();
    let startDate;
    let endDate;

    if (timeframe === 'week') {
      startDate = startOfWeek();
      endDate = endOfWeek();
    } else if (timeframe === 'month') {
      startDate = startOfMonth();
      endDate = endOfMonth();
    } else {
      startDate = startOfYear();
      endDate = endOfYear();
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const expenses = await db.getAllAsync(
      `SELECT * FROM expenses WHERE date_time >= ? AND date_time <= ? ORDER BY date_time DESC;`,
      [startIso, endIso]
    );

    const aggregated = await db.getAllAsync(
      `SELECT substr(date_time, 1, 10) AS day, SUM(expense) AS total
       FROM expenses
       WHERE date_time >= ? AND date_time <= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [startIso, endIso]
    );

    const chartMap = {};
    (aggregated || []).forEach((row) => {
      chartMap[row.day] = row.total;
    });

    const chartData = [];

    if (timeframe === 'year') {
      const monthTotals = {};
      (expenses || []).forEach((e) => {
        const d = new Date(e.date_time);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthTotals[mKey] = (monthTotals[mKey] || 0) + (parseFloat(e.expense) || 0);
      });

      for (let m = 0; m < 12; m++) {
        const d = new Date(startDate.getFullYear(), m, 1);
        const mKey = `${d.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
        const val = monthTotals[mKey] ? parseFloat(monthTotals[mKey].toFixed(2)) : 0;
        chartData.push({
          day: mKey,
          value: val,
          label: d.toLocaleDateString('en-IN', { month: 'short' }),
        });
      }
    } else {
      const cursor = new Date(startDate);
      cursor.setHours(0, 0, 0, 0);

      while (cursor <= endDate) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const dayKey = `${y}-${m}-${d}`;

        let label = '';
        if (timeframe === 'week') {
          label = cursor.toLocaleDateString('en-IN', { weekday: 'short' });
        } else {
          if (cursor.getDate() % 5 === 1 || cursor.getDate() === 1) {
            label = `${cursor.getDate()} ${cursor.toLocaleDateString('en-IN', { month: 'short' })}`;
          }
        }

        const val = chartMap[dayKey] ? parseFloat(chartMap[dayKey].toFixed(2)) : 0;
        chartData.push({
          day: dayKey,
          value: val,
          label,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return { chartData, expenses: expenses || [] };
  } catch (error) {
    console.error('[SQLite] Error in getExpensesByTimeframe:', error);
    return { chartData: [], expenses: [] };
  }
};

/**
 * Get spending aggregated by merchant.
 */
export const getMerchantBreakdown = async (startDate, limit = 10) => {
  try {
    const db = await getDb();
    const startIso = startDate || new Date(0).toISOString();
    const rows = await db.getAllAsync(
      `SELECT merchant, category, SUM(expense) AS total, COUNT(*) AS count, AVG(expense) AS avg_expense
       FROM expenses
       WHERE merchant IS NOT NULL AND merchant != '' AND date_time >= ?
       GROUP BY merchant
       ORDER BY total DESC
       LIMIT ?;`,
      [startIso, limit]
    );
    return rows || [];
  } catch (error) {
    return [];
  }
};

/**
 * Get spending aggregated by payment method.
 */
export const getPaymentMethodBreakdown = async (startDate) => {
  try {
    const db = await getDb();
    const startIso = startDate || new Date(0).toISOString();
    const rows = await db.getAllAsync(
      `SELECT COALESCE(payment_method, 'UPI') AS method, SUM(expense) AS total, COUNT(*) AS count
       FROM expenses
       WHERE date_time >= ?
       GROUP BY method
       ORDER BY total DESC;`,
      [startIso]
    );
    return rows || [];
  } catch (error) {
    return [];
  }
};

// ─── Custom Categories CRUD ──────────────────────────────────────

export const getCustomCategories = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM custom_categories;`);
    return rows || [];
  } catch (error) {
    return [];
  }
};

export const addCustomCategory = async (name, icon = '🏷️', color = '#818CF8') => {
  try {
    const db = await getDb();
    const safeName = toSqlParam(name, '').trim();
    const safeIcon = toSqlParam(icon, '🏷️');
    const safeColor = toSqlParam(color, '#818CF8');

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

// ─── Budgets ──────────────────────────────────────────────────────

export const getBudgets = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM budgets;`);
    return rows || [];
  } catch (error) {
    return [];
  }
};

export const setBudget = async (monthlyLimit, category = null) => {
  try {
    const db = await getDb();
    const isOverall = category ? 0 : 1;
    const safeCategory = category || 'overall';

    // Upsert: delete old, insert new
    if (isOverall) {
      await db.runAsync(`DELETE FROM budgets WHERE is_overall = 1;`);
    } else {
      await db.runAsync(`DELETE FROM budgets WHERE category = ? AND is_overall = 0;`, [safeCategory]);
    }

    await db.runAsync(
      `INSERT INTO budgets (category, monthly_limit, is_overall) VALUES (?, ?, ?);`,
      [safeCategory, Number(monthlyLimit) || 0, isOverall]
    );
  } catch (error) {
    console.error('[SQLite] Error setting budget:', error);
  }
};

// ─── Settings ─────────────────────────────────────────────────────

export const getSetting = async (key) => {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync(`SELECT value FROM settings WHERE key = ?;`, [key]);
    return row?.value ?? null;
  } catch (error) {
    return null;
  }
};

export const setSetting = async (key, value) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`,
      [String(key), String(value)]
    );
  } catch (error) {
    console.error('[SQLite] Error saving setting:', error);
  }
};

// ─── Export ───────────────────────────────────────────────────────

export const exportAllExpenses = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM expenses ORDER BY date_time DESC;`);
    return rows || [];
  } catch (error) {
    return [];
  }
};

// ─── Recurring Expenses ───────────────────────────────────────────

export const getRecurringExpenses = async () => {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM recurring_expenses ORDER BY next_date ASC;`);
    return rows || [];
  } catch (error) {
    console.error('[SQLite] Error fetching recurring expenses:', error);
    return [];
  }
};

export const addRecurringExpense = async (params = {}) => {
  try {
    const db = await getDb();
    const safeMerchant = toSqlParam(params.merchant, '').trim();
    const safeAmount = parseFloat(params.amount) || 0;
    const safeCategory = toSqlParam(params.category, 'Subscriptions');
    const safeFrequency = toSqlParam(params.frequency, 'monthly');
    const safeNextDate = toSqlParam(params.next_date, '');
    const safeIsSub = params.is_subscription ? 1 : 0;
    const safePayment = toSqlParam(params.payment_method, 'UPI');
    const safeNote = toSqlParam(params.note, '');
    const now = new Date().toISOString();

    if (!safeMerchant || safeAmount <= 0) throw new Error('Invalid recurring expense');

    const result = await db.runAsync(
      `INSERT INTO recurring_expenses (merchant, amount, category, frequency, next_date, is_subscription, is_active, payment_method, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?);`,
      [safeMerchant, safeAmount, safeCategory, safeFrequency, safeNextDate, safeIsSub, safePayment, safeNote, now, now]
    );
    return { id: result.lastInsertRowId, merchant: safeMerchant, amount: safeAmount };
  } catch (error) {
    console.error('[SQLite] Error adding recurring expense:', error);
    throw error;
  }
};

export const updateRecurringExpense = async (id, params = {}) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) return;

    const fields = [];
    const values = [];

    if (params.merchant !== undefined) { fields.push('merchant = ?'); values.push(toSqlParam(params.merchant, '')); }
    if (params.amount !== undefined) { fields.push('amount = ?'); values.push(parseFloat(params.amount) || 0); }
    if (params.category !== undefined) { fields.push('category = ?'); values.push(toSqlParam(params.category, 'Subscriptions')); }
    if (params.frequency !== undefined) { fields.push('frequency = ?'); values.push(toSqlParam(params.frequency, 'monthly')); }
    if (params.next_date !== undefined) { fields.push('next_date = ?'); values.push(toSqlParam(params.next_date, '')); }
    if (params.is_subscription !== undefined) { fields.push('is_subscription = ?'); values.push(params.is_subscription ? 1 : 0); }
    if (params.is_active !== undefined) { fields.push('is_active = ?'); values.push(params.is_active ? 1 : 0); }
    if (params.payment_method !== undefined) { fields.push('payment_method = ?'); values.push(toSqlParam(params.payment_method, 'UPI')); }
    if (params.note !== undefined) { fields.push('note = ?'); values.push(toSqlParam(params.note, '')); }

    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(safeId);

    await db.runAsync(`UPDATE recurring_expenses SET ${fields.join(', ')} WHERE id = ?;`, values);
  } catch (error) {
    console.error('[SQLite] Error updating recurring expense:', error);
  }
};

export const deleteRecurringExpense = async (id) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) return;
    await db.runAsync(`DELETE FROM recurring_expenses WHERE id = ?;`, [safeId]);
  } catch (error) {
    console.error('[SQLite] Error deleting recurring expense:', error);
  }
};

export const toggleRecurringExpense = async (id) => {
  try {
    const db = await getDb();
    const safeId = Number(id);
    if (isNaN(safeId) || safeId <= 0) return;
    await db.runAsync(
      `UPDATE recurring_expenses SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?;`,
      [new Date().toISOString(), safeId]
    );
  } catch (error) {
    console.error('[SQLite] Error toggling recurring expense:', error);
  }
};

