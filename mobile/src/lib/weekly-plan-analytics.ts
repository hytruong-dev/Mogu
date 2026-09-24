/**
 * Analytics events for Weekly Plan Flow Redesign 2026
 * Tuân thủ mục "Event tracking" trong docs/MOBILE_WEEK_PLAN_FLOW_UX_REDESIGN_2026.md
 */

export type WeeklyPlanTrackingEvent =
  | { name: 'weekly_plan_config_viewed' }
  | {
    name: 'weekly_plan_value_changed';
    payload: { field: string; oldValue: unknown; newValue: unknown };
  }
  | {
    name: 'weekly_plan_create_requested';
    payload: { durationDays: number; budget: number; dailyCalories: number; mealSlots: string[] };
  }
  | {
    name: 'weekly_plan_create_failed';
    payload: { reason: string; suggestionCount: number };
  }
  | {
    name: 'weekly_plan_recovery_selected';
    payload: { type: string };
  }
  | {
    name: 'weekly_plan_created';
    payload: { planId: string; durationDays: number; mealCount: number };
  }
  | {
    name: 'weekly_plan_opened';
    payload: { planId: string };
  }
  | {
    name: 'weekly_plan_shared';
    payload: { planId: string };
  };

export function trackWeeklyPlanEvent(event: WeeklyPlanTrackingEvent) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[WeeklyPlanAnalytics] ${event.name}`, 'payload' in event ? event.payload : '');
  }
}
