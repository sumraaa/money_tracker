/**
 * ZERO FRICTION — Date Utilities
 * All date operations centralized here.
 * Careful with IST, midnight boundaries, month boundaries.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Get current date/time in IST as a Date object.
 * Note: The returned Date object is still in UTC internally,
 * but the values represent IST time.
 */
export function nowIST() {
  return new Date();
}

/**
 * Get today's date string in YYYY-MM-DD format using local time.
 */
export function todayKey() {
  const d = new Date();
  return dateToKey(d);
}

/**
 * Convert a Date to YYYY-MM-DD using local timezone.
 */
export function dateToKey(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return todayKey();
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse an ISO string or date string to a Date object safely.
 */
export function parseDate(str) {
  if (!str) return new Date();
  if (str instanceof Date) return isNaN(str.getTime()) ? new Date() : str;
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Get start of today (midnight local time).
 */
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of today (23:59:59.999 local time).
 */
export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of a given date (midnight local time).
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get start of the current week (Monday midnight).
 */
export function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // Days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Get end of the current week (Sunday 23:59:59.999).
 */
export function endOfWeek() {
  const d = startOfWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of the current month (1st day midnight).
 */
export function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of the current month (last day 23:59:59.999).
 */
export function endOfMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of last month.
 */
export function startOfLastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of last month (last day, 23:59:59.999).
 */
export function endOfLastMonth() {
  const d = new Date();
  d.setDate(0); // Last day of previous month
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of the current year.
 */
export function startOfYear() {
  const d = new Date();
  d.setMonth(0);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of the current year (Dec 31 23:59:59.999).
 */
export function endOfYear() {
  const d = new Date();
  d.setMonth(11);
  d.setDate(31);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get N days ago from now.
 */
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Number of days between two dates (absolute).
 */
export function daysBetween(a, b) {
  const msPerDay = 86400000;
  const da = startOfDay(a).getTime();
  const db = startOfDay(b).getTime();
  return Math.max(1, Math.round(Math.abs(db - da) / msPerDay));
}

/**
 * Number of days remaining in the current month (including today).
 */
export function daysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format date for display: "27 Aug" or "27 Aug 2026"
 */
export function formatShortDate(date) {
  const d = parseDate(date);
  const day = d.getDate();
  let month;
  try {
    month = d.toLocaleDateString('en-IN', { month: 'short' });
  } catch {
    month = MONTH_NAMES[d.getMonth()];
  }
  if (!month) month = MONTH_NAMES[d.getMonth()];

  const thisYear = new Date().getFullYear();
  if (d.getFullYear() !== thisYear) {
    return `${day} ${month} ${d.getFullYear()}`;
  }
  return `${day} ${month}`;
}

/**
 * Format time: "2:30 PM"
 */
export function formatTime(date) {
  const d = parseDate(date);
  try {
    const formatted = d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (formatted) return formatted;
  } catch {
    // Fallback
  }

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Relative date label: "Today", "Yesterday", "Mon", date.
 */
export function relativeLabel(date) {
  const d = parseDate(date);
  const today = startOfToday();
  const dStart = startOfDay(d);

  const diffDays = Math.round((today.getTime() - dStart.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    try {
      const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' });
      if (weekday) return weekday;
    } catch {
      // Fallback
    }
    return DAY_NAMES[d.getDay()];
  }
  return formatShortDate(d);
}

/**
 * Group label for a date (for section headers in history).
 */
export function groupDateLabel(dateStr) {
  return relativeLabel(dateStr);
}

/**
 * Get a safe ISO string for the current moment.
 */
export function nowISO() {
  return new Date().toISOString();
}
