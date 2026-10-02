// Run: npx tsx --test src/screens/food-detail/voice/cooking-voice-edge-cases.test.ts
// @ts-ignore -- node:test is test-only.
import { test } from 'node:test';
// @ts-ignore -- node assertions.
import assert from 'node:assert/strict';
import { parseCookingIntent, validateCookingAction } from './cooking-intents';
import { expireCookingTimers, timerRemaining } from '../cooking-timers';

test('validateCookingAction bounds check for GOTO and SET_TIMER', () => {
  // GOTO stepIndex bounds
  assert.deepEqual(validateCookingAction({ type: 'GOTO', stepIndex: 0 }, 5), {
    type: 'GOTO',
    stepIndex: 0,
  });
  assert.deepEqual(validateCookingAction({ type: 'GOTO', stepIndex: 4 }, 5), {
    type: 'GOTO',
    stepIndex: 4,
  });
  assert.equal(validateCookingAction({ type: 'GOTO', stepIndex: 5 }, 5), null);
  assert.equal(validateCookingAction({ type: 'GOTO', stepIndex: -1 }, 5), null);
  assert.equal(validateCookingAction({ type: 'GOTO', stepIndex: 1.5 }, 5), null);

  // SET_TIMER seconds bounds (max 86400 = 24h)
  assert.deepEqual(validateCookingAction({ type: 'SET_TIMER', seconds: 60 }, 5), {
    type: 'SET_TIMER',
    seconds: 60,
  });
  assert.deepEqual(validateCookingAction({ type: 'SET_TIMER', seconds: 86400 }, 5), {
    type: 'SET_TIMER',
    seconds: 86400,
  });
  assert.equal(validateCookingAction({ type: 'SET_TIMER', seconds: 0 }, 5), null);
  assert.equal(validateCookingAction({ type: 'SET_TIMER', seconds: -10 }, 5), null);
  assert.equal(validateCookingAction({ type: 'SET_TIMER', seconds: 86401 }, 5), null);

  // Simple action types
  assert.deepEqual(validateCookingAction({ type: 'NEXT' }, 5), { type: 'NEXT' });
  assert.deepEqual(validateCookingAction({ type: 'PREV' }, 5), { type: 'PREV' });
  assert.deepEqual(validateCookingAction({ type: 'REPEAT' }, 5), { type: 'REPEAT' });
  assert.deepEqual(validateCookingAction({ type: 'START_TIMER' }, 5), { type: 'START_TIMER' });
  assert.deepEqual(validateCookingAction({ type: 'PAUSE_TIMER' }, 5), { type: 'PAUSE_TIMER' });
  assert.deepEqual(validateCookingAction({ type: 'READ_INGREDIENTS' }, 5), { type: 'READ_INGREDIENTS' });
});

test('offline fallback: all core cooking intents parse locally without network', () => {
  const offlineCommands = [
    { speech: 'NOAN bắt đầu', expected: 'START' },
    { speech: 'NOAN bước tiếp', expected: 'NEXT' },
    { speech: 'NOAN quay lại', expected: 'PREV' },
    { speech: 'NOAN đọc lại', expected: 'REPEAT' },
    { speech: 'NOAN nguyên liệu', expected: 'READ_INGREDIENTS' },
    { speech: 'NOAN dừng', expected: 'PAUSE' },
    { speech: 'NOAN tiếp tục', expected: 'RESUME' },
    { speech: 'NOAN hoàn thành', expected: 'FINISH' },
    { speech: 'NOAN bước 3', expected: 'GOTO' },
  ];

  for (const { speech, expected } of offlineCommands) {
    const result = parseCookingIntent(speech);
    assert.equal(result.type, expected);
  }
});

test('Android 12- version boundary: SDK <= 32 requires manual click-to-speak mode', () => {
  const checkMode = (os: string, version: number) => {
    if (os === 'android' && version <= 32) return 'manual';
    return 'continuous';
  };

  assert.equal(checkMode('android', 31), 'manual'); // Android 12
  assert.equal(checkMode('android', 32), 'manual'); // Android 12L
  assert.equal(checkMode('android', 33), 'continuous'); // Android 13
  assert.equal(checkMode('android', 34), 'continuous'); // Android 14
  assert.equal(checkMode('ios', 16), 'continuous');
});

test('background timer deadline resilience during long suspension', () => {
  const now = 100000;
  const timers = {
    0: { endsAt: now + 300000, remainingSec: 300, running: true }, // 5 min timer
  };

  // App is sent to background for 10 minutes (600,000 ms)
  const resumeTime = now + 600000;

  // In background, expireCookingTimers is called with active=false: no alert fired
  const backgroundResult = expireCookingTimers(timers, resumeTime, false);
  assert.deepEqual(backgroundResult, []);

  // When foregrounded, expireCookingTimers is called with active=true: alert fired immediately
  const foregroundResult = expireCookingTimers(timers, resumeTime, true);
  assert.deepEqual(foregroundResult, [0]);
  assert.equal(timers[0].running, false);
  assert.equal(timerRemaining(timers[0], resumeTime), 0);
});
