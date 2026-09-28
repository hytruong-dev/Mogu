/**
 * NOAN design tokens — single TypeScript source of truth for React Native UI.
 * Components should consume semantic/component tokens, not primitive values.
 */
export const noanPrimitive = {
  gold: {
    50: '#FFF9E6',
    100: '#FFF1B8',
    300: '#FFDD67',
    500: '#FFC928',
    600: '#E6AC00',
    700: '#B98500',
  },
  brown: {
    50: '#FFF7E8',
    100: '#F5E9D5',
    200: '#E9DEC9',
    500: '#6B4A32',
    700: '#49301F',
    900: '#2A1A10',
  },
  coral: {
    100: '#FFE2DC',
    500: '#FF725E',
    600: '#E85B48',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FFF9EE',
    100: '#F7F2E9',
    400: '#91877F',
    600: '#6B625B',
    900: '#2A1A10',
  },
  green: { 100: '#DDF5E8', 600: '#2E9D63' },
  blue: { 100: '#E0ECFF', 600: '#3B82F6' },
  red: { 100: '#FFE3E4', 600: '#E5484D' },
} as const;

export const noanSemantic = {
  primary: noanPrimitive.gold[500],
  primaryPressed: noanPrimitive.gold[600],
  primarySoft: noanPrimitive.gold[100],
  onPrimary: noanPrimitive.brown[900],

  background: noanPrimitive.neutral[50],
  surface: noanPrimitive.neutral[0],
  surfaceWarm: noanPrimitive.brown[50],
  surfaceMuted: noanPrimitive.neutral[100],

  text: noanPrimitive.brown[900],
  textSecondary: noanPrimitive.neutral[600],
  textMuted: noanPrimitive.neutral[400],
  textInverse: noanPrimitive.neutral[0],

  border: noanPrimitive.brown[200],
  borderStrong: noanPrimitive.brown[100],
  focus: noanPrimitive.gold[600],

  accent: noanPrimitive.coral[500],
  accentSoft: noanPrimitive.coral[100],
  success: noanPrimitive.green[600],
  successSoft: noanPrimitive.green[100],
  info: noanPrimitive.blue[600],
  infoSoft: noanPrimitive.blue[100],
  warning: noanPrimitive.gold[700],
  warningSoft: noanPrimitive.gold[100],
  danger: noanPrimitive.red[600],
  dangerSoft: noanPrimitive.red[100],

  disabled: '#D8D0C5',
  overlay: 'rgba(42, 26, 16, 0.48)',
  shadow: 'rgba(42, 26, 16, 0.12)',
} as const;

export const noanComponent = {
  buttonPrimary: {
    background: noanSemantic.primary,
    backgroundPressed: noanSemantic.primaryPressed,
    foreground: noanSemantic.onPrimary,
    disabled: noanSemantic.disabled,
  },
  card: {
    background: noanSemantic.surface,
    border: noanSemantic.border,
    shadow: noanSemantic.shadow,
  },
  input: {
    background: noanSemantic.surface,
    border: noanSemantic.border,
    borderFocus: noanSemantic.focus,
    placeholder: noanSemantic.textMuted,
  },
  bottomNav: {
    background: noanSemantic.surface,
    active: noanSemantic.primary,
    foreground: noanSemantic.text,
    muted: noanSemantic.textMuted,
  },
} as const;

export const noanTokens = {
  primitive: noanPrimitive,
  semantic: noanSemantic,
  component: noanComponent,
} as const;
