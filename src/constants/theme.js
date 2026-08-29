/**
 * ZERO FRICTION — Design System
 * Premium Dark Fintech Aesthetic
 * All visual tokens centralized here. No scattered arbitrary values.
 *
 * TYPOGRAPHY: Sized for real phone readability, not desktop previews.
 * COLORS: Layered near-black with restrained accent usage.
 */

export const COLORS = {
  // Backgrounds (near-black layers)
  bg: '#09090B',
  bgElevated: '#111113',
  bgSurface: '#18181B',
  bgSubtle: '#1C1C1F',
  bgHover: '#27272A',
  bgInput: '#141416',

  // Borders
  border: 'rgba(255,255,255,0.06)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  borderStrong: 'rgba(255,255,255,0.10)',
  borderAccent: 'rgba(129,140,248,0.18)',

  // Text
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textDisabled: '#3F3F46',
  textInverse: '#09090B',

  // Accent (restrained indigo-violet)
  accent: '#818CF8',
  accentMuted: 'rgba(129,140,248,0.12)',
  accentStrong: '#6366F1',
  accentBg: 'rgba(99,102,241,0.06)',

  // Semantic
  success: '#34D399',
  successMuted: '#059669',
  successBg: 'rgba(52,211,153,0.08)',
  successBorder: 'rgba(52,211,153,0.20)',

  warning: '#FBBF24',
  warningMuted: '#D97706',
  warningBg: 'rgba(251,191,36,0.08)',
  warningBorder: 'rgba(251,191,36,0.20)',

  error: '#F87171',
  errorMuted: '#DC2626',
  errorBg: 'rgba(248,113,113,0.08)',
  errorBorder: 'rgba(248,113,113,0.20)',

  info: '#60A5FA',
  infoBg: 'rgba(96,165,250,0.08)',

  // Chart palette (harmonious)
  chart: ['#818CF8', '#34D399', '#FBBF24', '#F87171', '#60A5FA', '#C084FC', '#FB923C'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 100,
};

/**
 * TYPOGRAPHY HIERARCHY
 * Designed for real-world phone distance reading.
 * Primary financial numbers: 34-40pt
 * Section titles: 16-18pt
 * Body/transaction text: 15-16pt
 * Meta/labels: 12-13pt
 * Overlines: 11pt
 */
export const TYPOGRAPHY = {
  // Display (hero financial numbers)
  displayLg: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  displayMd: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  displaySm: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },

  // Headings
  h1: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22 },

  // Body
  bodyLg: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: '400', lineHeight: 20 },

  // Labels
  label: { fontSize: 14, fontWeight: '600' },
  labelSm: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  labelXs: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  // Overline (section headers)
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },

  // Mono (financial numbers)
  monoXl: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monoLg: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mono: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  monoSm: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
};

export const ELEVATION = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { friction: 8, tension: 65 },
  springBouncy: { friction: 6, tension: 80 },
};

// Minimum touch target (48px per Android guidelines)
export const TOUCH = {
  minTarget: 48,
};

// ─── Category System ─────────────────────────────────────────────
export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍔', color: '#F87171' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#FBBF24' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#C084FC' },
  { id: 'bills', name: 'Bills', icon: '📄', color: '#60A5FA' },
  { id: 'education', name: 'Education', icon: '🎓', color: '#34D399' },
  { id: 'health', name: 'Health', icon: '💊', color: '#F472B6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#FB923C' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#38BDF8' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#A78BFA' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔄', color: '#818CF8' },
  { id: 'fees', name: 'Fees', icon: '🏦', color: '#94A3B8' },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👧', color: '#F9A8D4' },
  { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#FCD34D' },
  { id: 'other', name: 'Other', icon: '💳', color: '#71717A' },
];

export const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI', icon: '📱' },
  { id: 'cash', name: 'Cash', icon: '💵' },
  { id: 'debit', name: 'Debit Card', icon: '💳' },
  { id: 'credit', name: 'Credit Card', icon: '💳' },
  { id: 'bank', name: 'Bank Transfer', icon: '🏦' },
  { id: 'other', name: 'Other', icon: '💰' },
];

// Known merchant → category mappings for smart defaults
export const MERCHANT_HINTS = {
  'swiggy': 'Food',
  'zomato': 'Food',
  'uber eats': 'Food',
  'dominos': 'Food',
  'mcdonalds': 'Food',
  'starbucks': 'Food',
  'uber': 'Transport',
  'ola': 'Transport',
  'rapido': 'Transport',
  'metro': 'Transport',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'myntra': 'Shopping',
  'netflix': 'Subscriptions',
  'spotify': 'Subscriptions',
  'youtube': 'Subscriptions',
  'hotstar': 'Subscriptions',
  'jio': 'Bills',
  'airtel': 'Bills',
  'electricity': 'Bills',
  'rent': 'Bills',
  'gym': 'Health',
  'pharmacy': 'Health',
  'hospital': 'Health',
  'course': 'Education',
  'udemy': 'Education',
  'movie': 'Entertainment',
  'pvr': 'Entertainment',
};
