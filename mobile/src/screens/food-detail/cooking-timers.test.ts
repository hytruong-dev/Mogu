// Run: npx tsx --test src/screens/food-detail/cooking-timers.test.ts
// @ts-ignore -- test-only Node built-ins.
import { test } from 'node:test';
// @ts-ignore -- test-only Node built-ins.
import assert from 'node:assert/strict';
import { expireCookingTimers, timerRemaining, type CookingTimer } from './cooking-timers';

test('expires every timer exactly once, including non-current steps', () => {
  const timers: Record<number, CookingTimer> = {
    0: { endsAt: 1000, remainingSec: 5, running: true },
    2: { endsAt: 1500, remainingSec: 9, running: true },
    3: { endsAt: 3000, remainingSec: 2, running: true },
    4: { endsAt: null, remainingSec: 20, running: false },
  };
  assert.deepEqual(expireCookingTimers(timers, 1500), [0, 2]);
  assert.deepEqual(expireCookingTimers(timers, 1500), []);
  assert.deepEqual(timers[0], { endsAt: null, remainingSec: 0, running: false });
  assert.equal(timers[3].running, true);
  assert.equal(timers[4].remainingSec, 20);
  assert.deepEqual(expireCookingTimers(timers, 10000), [3]);
});
test('background expiry preserves the event until foreground consumption', () => {
  const timers: Record<number, CookingTimer> = {
    1: { endsAt: 1000, remainingSec: 1, running: true },
  };
  assert.deepEqual(expireCookingTimers(timers, 5000, false), []);
  assert.equal(timers[1].endsAt, 1000);
  assert.equal(timers[1].running, true);
  assert.deepEqual(expireCookingTimers(timers, 6000, true), [1]);
  assert.deepEqual(expireCookingTimers(timers, 7000, true), []);
});
test('remaining time uses deadline after backgrounding and never becomes negative', () => {
  const timer = { endsAt: 10000, remainingSec: 10, running: true };
  assert.equal(timerRemaining(timer, 8001), 2);
  assert.equal(timerRemaining(timer, 12000), 0);
  assert.equal(timerRemaining({ endsAt: null, remainingSec: 7, running: false }, 12000), 7);
});
