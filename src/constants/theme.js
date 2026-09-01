import { Platform } from 'react-native';

export const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace' });

// Phase 1 Design Tokens
export const COLORS = {
  // Core palette
  background: '#eeebe3',
  surface: '#ffffff',
  card: '#ffffff',
  charcoal: '#171e19',
  accentRed: '#ca0013',
  accent: '#ca0013',
  sage: '#b7c6c2',
  sageLight: 'rgba(183, 198, 194, 0.25)',
  border: 'rgba(183, 198, 194, 0.35)',
  textPrimary: '#171e19',
  textMuted: '#6c7772',
  textSecondary: '#6c7772',
  textDim: '#8a9691',
  textDisabled: '#a0aaa5',
  textInverse: '#ffffff',

  // Background aliases
  bg: '#eeebe3',
  bgElevated: '#ffffff',
  cardElevated: '#ffffff',
  bgSurface: '#f4f1ea',
  bgSubtle: '#ebe7df',
  bgHover: '#e4e0d7',
  bgInput: '#ffffff',

  // Accents
  accentGlow: 'rgba(202, 0, 19, 0.25)',
  accentSecondary: '#fce8ea',
  accentMuted: 'rgba(202, 0, 19, 0.12)',
  accentStrong: '#ca0013',
  accentBg: 'rgba(202, 0, 19, 0.08)',

  // Borders
  borderSubtle: 'rgba(183, 198, 194, 0.20)',
  borderStrong: 'rgba(183, 198, 194, 0.60)',
  borderAccent: 'rgba(202, 0, 19, 0.35)',

  // Semantics
  success: '#16a34a',
  successMuted: '#15803d',
  successBg: 'rgba(22, 163, 74, 0.10)',
  successBorder: 'rgba(22, 163, 74, 0.25)',

  warning: '#d97706',
  warningMuted: '#b45309',
  warningBg: 'rgba(217, 119, 6, 0.10)',
  warningBorder: 'rgba(217, 119, 6, 0.25)',

  error: '#ca0013',
  errorMuted: '#99000e',
  errorBg: 'rgba(202, 0, 19, 0.10)',
  errorBorder: 'rgba(202, 0, 19, 0.25)',

  info: '#2563eb',
  infoBg: 'rgba(37, 99, 235, 0.10)',

  chart: ['#171e19', '#ca0013', '#b7c6c2', '#16a34a', '#d97706', '#2563eb', '#8b5cf6'],
};

export const colors = COLORS;

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
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  card: 40,
  item: 24,
  bento: 16,
  pill: 999,
};

export const radius = RADIUS;

export const SHADOWS = {
  card: {
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  fab: {
    shadowColor: '#ca0013',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sm: {
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const shadows = SHADOWS;

export const TYPOGRAPHY = {
  displayLg: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  displayMd: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  displaySm: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },

  h1: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '700', lineHeight: 23 },

  bodyLg: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: '400', lineHeight: 20 },

  label: { fontSize: 14, fontWeight: '700' },
  labelSm: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  labelXs: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },

  overline: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },

  monoXl: { fontFamily: MONO_FONT, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monoLg: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mono: { fontFamily: MONO_FONT, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  monoSm: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
};

export const CARD_STYLES = {
  hero: {
    borderRadius: RADIUS.card,
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  item: {
    borderRadius: RADIUS.item,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bento: {
    borderRadius: RADIUS.bento,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.sageLight,
  },
};

export const ELEVATION = SHADOWS;

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

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍔', color: '#ca0013' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#d97706' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#8b5cf6' },
  { id: 'bills', name: 'Bills', icon: '📄', color: '#2563eb' },
  { id: 'education', name: 'Education', icon: '🎓', color: '#16a34a' },
  { id: 'health', name: 'Health', icon: '💊', color: '#ec4899' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#ea580c' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#0284c7' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#7c3aed' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔄', color: '#ca0013' },
  { id: 'fees', name: 'Fees', icon: '🏦', color: '#64748b' },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👧', color: '#db2777' },
  { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#eab308' },
  { id: 'other', name: 'Other', icon: '💳', color: '#6c7772' },
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

export default {
  colors: COLORS,
  radius: RADIUS,
  shadows: SHADOWS,
  spacing: SPACING,
  typography: TYPOGRAPHY,
};


