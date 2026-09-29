export type CookingTimer = { endsAt: number | null; remainingSec: number; running: boolean };
export function timerRemaining(timer: CookingTimer, now = Date.now()): number {
  return timer.running && timer.endsAt != null
    ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
    : timer.remainingSec;
}
/** Mutate every due timer once; paused and already expired timers are untouched. */
export function expireCookingTimers(
  timers: Record<number, CookingTimer>,
  now = Date.now(),
  foreground = true,
): number[] {
  if (!foreground) return [];
  const expired: number[] = [];
  Object.entries(timers).forEach(([key, timer]) => {
    if (timer.running && timer.endsAt != null && timer.endsAt <= now) {
      timer.running = false;
      timer.remainingSec = 0;
      timer.endsAt = null;
      expired.push(Number(key));
    }
  });
  return expired;
}
