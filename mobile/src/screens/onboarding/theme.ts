import type { LucideIcon } from '@/components/icons';
import {
  Compass,
  Dumbbell,
  Leaf,
  Salad,
  Scale,
  Target,
  Wallet,
} from '@/components/icons';
import { noanPrimitive as p, noanSemantic as c } from '@/theme/tokens';

/** Onboarding palette — derived from NOAN semantic tokens (theme/tokens.ts). */
export const ob = {
  bg: c.background,
  surface: c.surface,
  surfaceWarm: c.surfaceWarm,
  ink: c.text,
  sub: c.textSecondary,
  muted: c.textMuted,
  border: c.border,
  primary: c.primary,
  primaryPressed: c.primaryPressed,
  primarySoft: c.primarySoft,
  gold50: p.gold[50],
  gold700: p.gold[700],
  danger: c.danger,
  dangerSoft: c.dangerSoft,
  success: c.success,
  successSoft: c.successSoft,
  disabled: c.disabled,
  shadow: '#6B4A32',
} as const;

export const cardShadow = {
  shadowColor: ob.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/** Icon theo goal.code trong catalog (BALANCE, LOSE_WEIGHT, ...). */
export const GOAL_ICONS: Record<string, LucideIcon> = {
  BALANCE: Salad,
  LOSE_WEIGHT: Scale,
  BUILD_MUSCLE: Dumbbell,
  EAT_HEALTHY: Leaf,
  SAVE_MONEY: Wallet,
  EXPLORE: Compass,
};
export const goalIcon = (code: string): LucideIcon => GOAL_ICONS[code] ?? Target;

export const MASCOT = {
  welcome: require('../../assets/images/noan/noan-mascot-master-v1.png'),
  thinking: require('../../assets/images/noan/noan-thinking-v1.png'),
  serving: require('../../assets/images/noan/noan-serving-v1.png'),
  celebrate: require('../../assets/images/noan/noan-celebrate-v1.png'),
};

/** Giới hạn khớp DTO backend (save-step-body.dto). */
export const BODY_LIMITS = {
  height: { min: 80, max: 250, step: 1 },
  weight: { min: 20, max: 350, step: 0.5 },
} as const;
