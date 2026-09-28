import { noanSemantic } from './tokens';

export const colors = {
  primary: noanSemantic.primary,
  primaryPressed: noanSemantic.primaryPressed,
  primarySoft: noanSemantic.primarySoft,
  onPrimary: noanSemantic.onPrimary,
  background: noanSemantic.background,
  surface: noanSemantic.surface,
  surfaceWarm: noanSemantic.surfaceWarm,
  surfaceMuted: noanSemantic.surfaceMuted,
  text: noanSemantic.text,
  textSecondary: noanSemantic.textSecondary,
  textMuted: noanSemantic.textMuted,
  border: noanSemantic.border,
  accent: noanSemantic.accent,
  success: noanSemantic.success,
  info: noanSemantic.info,
  warning: noanSemantic.warning,
  danger: noanSemantic.danger,

  // Compatibility aliases while older screens migrate to semantic names.
  cream: noanSemantic.surfaceWarm,
  yellow: noanSemantic.primary,
  ink: noanSemantic.text,
  honey: noanSemantic.primaryPressed,
  coral: noanSemantic.accent,
  muted: noanSemantic.textMuted,
} as const;
