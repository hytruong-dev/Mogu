/**
 * NOAN Brand Identity & Design Tokens (2026)
 * Reference: docs/NOAN_BRAND_DIRECTION_2026.md
 * Core palette: golden yellow #FFC928, deep brown #2A1A10, ivory #FFF7E8, coral #FF725E
 */
export const noanBrand = {
  color: {
    yellow: noanSemantic.primary,
    honey: noanPrimitive.gold[600],
    cream: noanSemantic.surfaceWarm,
    background: noanSemantic.background,
    surface: noanSemantic.surface,
    ink: noanSemantic.text,
    cocoa: noanPrimitive.brown[500],
    coral: noanSemantic.accent,
    muted: noanSemantic.textMuted,
    border: noanSemantic.border,
  },
  icon: {
    strokeWidth: 2.15,
    smallStrokeWidth: 2,
    corner: 'round' as const,
  },
} as const;

/** Alias for existing code backwards compatibility */
export const moguBrand = noanBrand;

export type NoanIconTone = 'ink' | 'muted' | 'yellow' | 'coral' | 'cream';
export type MoguIconTone = NoanIconTone;

export const noanIconTone: Record<NoanIconTone, string> = {
  ink: noanBrand.color.ink,
  muted: noanBrand.color.muted,
  yellow: noanBrand.color.yellow,
  coral: noanBrand.color.coral,
  cream: noanBrand.color.cream,
};

export const moguIconTone = noanIconTone;
import { noanPrimitive, noanSemantic } from './tokens';
