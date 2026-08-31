import { Platform } from 'react-native';

export const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace' });

export const COLORS = {
  // Backgrounds (pitch black & dark zinc layers)
  background: '#050505',
  bg: '#050505',
  card: '#111111',
  bgElevated: '#111111',
  cardElevated: '#161616',
  bgSurface: '#181818',
  bgSubtle: '#0E0E0E',
  bgHover: '#222222',
  bgInput: '#141414',

  // Accent (Superdesign Vivid Flame Orange & Warm secondary)
  accent: '#FF4500',
  accentGlow: 'rgba(255, 69, 0, 0.25)',
  accentSecondary: '#FFE0E0',
  accentMuted: 'rgba(255, 69, 0, 0.15)',
  accentStrong: '#FF4500',
  accentBg: 'rgba(255, 69, 0, 0.10)',

  // Text Hierarchy
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#888888',
  textDim: '#444444',
  textDisabled: '#555555',
  textInverse: '#050505',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  borderAccent: 'rgba(255, 69, 0, 0.4)',

  // Semantic Colors
  success: '#34D399',
  successMuted: '#059669',
  successBg: 'rgba(52, 211, 153, 0.08)',
  successBorder: 'rgba(52, 211, 153, 0.20)',

  warning: '#FBBF24',
  warningMuted: '#D97706',
  warningBg: 'rgba(251, 191, 36, 0.08)',
  warningBorder: 'rgba(251, 191, 36, 0.20)',

  error: '#F87171',
  errorMuted: '#DC2626',
  errorBg: 'rgba(248, 113, 113, 0.08)',
  errorBorder: 'rgba(248, 113, 113, 0.20)',

  info: '#60A5FA',
  infoBg: 'rgba(96, 165, 250, 0.08)',

  // Chart Palette (Flame Superdesign dominant)
  chart: ['#FF4500', '#FFE0E0', '#34D399', '#FBBF24', '#60A5FA', '#C084FC', '#F472B6'],
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
 * EDITORIAL TYPOGRAPHY HIERARCHY
 * Editorial Serif headers paired with clean geometric monospace & sans-serif micro-labels.
 */
export const TYPOGRAPHY = {
  // Editorial Display Headers (Serif)
  displayLg: { fontFamily: SERIF_FONT, fontSize: 40, fontWeight: '600', letterSpacing: -0.5 },
  displayMd: { fontFamily: SERIF_FONT, fontSize: 32, fontWeight: '600', letterSpacing: -0.5 },
  displaySm: { fontFamily: SERIF_FONT, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },

  // Headings (Serif)
  h1: { fontFamily: SERIF_FONT, fontSize: 24, fontWeight: '600', lineHeight: 30 },
  h2: { fontFamily: SERIF_FONT, fontSize: 20, fontWeight: '600', lineHeight: 26 },
  h3: { fontFamily: SERIF_FONT, fontSize: 17, fontWeight: '600', lineHeight: 23 },

  // Body Text
  bodyLg: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: '400', lineHeight: 20 },

  // Micro Labels (Geometric / Monospace)
  label: { fontSize: 14, fontWeight: '600' },
  labelSm: { fontFamily: MONO_FONT, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  labelXs: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },

  // Overlines
  overline: { fontFamily: MONO_FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  // Tabular Numerics (Monospace)
  monoXl: { fontFamily: MONO_FONT, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monoLg: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mono: { fontFamily: MONO_FONT, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  monoSm: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
};

export const CARD_STYLES = {
  rounded3xl: {
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardFlame: {
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    backgroundColor: COLORS.accent,
  },
  pillBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
};

export const ELEVATION = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { friction: 8, tension: 65 },
  springBouncy: { friction: 6, tension: 80 },
};

export const TOUCH = {
  minTarget: 48,
};

// ─── Category System ─────────────────────────────────────────────
export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍔', color: '#FF4500' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#FBBF24' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#C084FC' },
  { id: 'bills', name: 'Bills', icon: '📄', color: '#60A5FA' },
  { id: 'education', name: 'Education', icon: '🎓', color: '#34D399' },
  { id: 'health', name: 'Health', icon: '💊', color: '#F472B6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#FB923C' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#38BDF8' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#A78BFA' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔄', color: '#FFE0E0' },
  { id: 'fees', name: 'Fees', icon: '🏦', color: '#94A3B8' },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👧', color: '#F9A8D4' },
  { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#FCD34D' },
  { id: 'other', name: 'Other', icon: '💳', color: '#888888' },
];

export const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI', icon: '📱' },
  { id: 'cash', name: 'Cash', icon: '💵' },
  { id: 'debit', name: 'Debit Card', icon: '💳' },
  { id: 'credit', name: 'Credit Card', icon: '💳' },
  { id: 'bank', name: 'Bank Transfer', icon: '🏦' },
  { id: 'other', name: 'Other', icon: '💰' },
];

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

