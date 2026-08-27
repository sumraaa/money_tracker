/**
 * ZERO FRICTION — Money Utilities
 * Safe financial calculations using integer paise to avoid floating-point errors.
 * ₹917.00 = 91700 paise internally.
 *
 * Display layer always goes through formatINR().
 */

/**
 * Convert a rupee amount (number or string) to integer paise.
 * @param {number|string} rupees
 * @returns {number} integer paise
 */
export function toPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') return 0;
  const n = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Convert integer paise back to rupees (number).
 * @param {number} paise
 * @returns {number}
 */
export function toRupees(paise) {
  if (!paise || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Format a rupee amount as ₹X,XX,XXX.XX (Indian locale).
 * @param {number} amount - in rupees (not paise)
 * @param {object} opts
 * @param {boolean} [opts.showPaise=true] - show decimal places
 * @param {boolean} [opts.compact=false] - use K/L/Cr notation for large amounts
 * @returns {string}
 */
export function formatINR(amount, opts = {}) {
  const { showPaise = true, compact = false } = opts;
  const n = typeof amount === 'number' && isFinite(amount) ? amount : 0;

  if (compact && Math.abs(n) >= 10000000) {
    return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  }
  if (compact && Math.abs(n) >= 100000) {
    return '₹' + (n / 100000).toFixed(1) + 'L';
  }
  if (compact && Math.abs(n) >= 1000) {
    return '₹' + (n / 1000).toFixed(1) + 'K';
  }

  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  });
  return '₹' + formatted;
}

/**
 * Safe addition of two amounts in paise.
 */
export function addPaise(a, b) {
  return (a || 0) + (b || 0);
}

/**
 * Safe subtraction.
 */
export function subtractPaise(a, b) {
  return (a || 0) - (b || 0);
}

/**
 * Sum an array of rupee amounts safely.
 * @param {number[]} amounts - in rupees
 * @returns {number} total in rupees
 */
export function sumAmounts(amounts) {
  if (!Array.isArray(amounts) || amounts.length === 0) return 0;
  const totalPaise = amounts.reduce((sum, val) => {
    return sum + toPaise(val);
  }, 0);
  return toRupees(totalPaise);
}

/**
 * Calculate percentage safely.
 */
export function safePercent(part, total) {
  if (!total || total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Parse a display amount string to a clean number.
 * Strips commas, ₹ sign, whitespace.
 */
export function parseAmount(str) {
  if (typeof str !== 'string') return typeof str === 'number' ? str : 0;
  const cleaned = str.replace(/[₹,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
