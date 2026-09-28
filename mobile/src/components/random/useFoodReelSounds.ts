import { useEffect, useRef } from 'react';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { REEL_STOP_TIMES } from './FoodReelMachine';

const PULL = require('../../assets/audio/food-reel/pull.wav');
const SPIN = require('../../assets/audio/food-reel/spin.wav');
const TICK = require('../../assets/audio/food-reel/tick.wav');
const STOP = require('../../assets/audio/food-reel/stop.wav');
const WIN = require('../../assets/audio/food-reel/win.wav');
const COINS = require('../../assets/audio/food-reel/coins.wav');

function safePause(player?: AudioPlayer | null) {
  if (!player) return;
  try {
    const result = (player as any).pause?.();
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  } catch {
    // Ignore error if shared object was already released
  }
}

function safeSet(player: AudioPlayer | null | undefined, apply: (p: AudioPlayer) => void) {
  if (!player) return;
  try {
    apply(player);
  } catch {
    // Ignore if released
  }
}

function safeRestart(player?: AudioPlayer | null) {
  if (!player) return;
  const play = () => {
    try {
      const playResult = (player as any).play?.();
      if (playResult && typeof playResult.catch === 'function') playResult.catch(() => undefined);
    } catch {
      // Ignore error
    }
  };
  try {
    const seekResult = (player as any).seekTo?.(0);
    if (seekResult && typeof seekResult.then === 'function') {
      seekResult.then(play).catch(() => undefined);
    } else {
      play();
    }
  } catch {
    // Ignore error
  }
}

const haptic = {
  light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  medium: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined),
  tick: () => void Haptics.selectionAsync().catch(() => undefined),
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
};

/**
 * Coin Master-style audio + haptics for the food reel:
 * lever clunk → looping reel whirr with rhythmic buzz → per-reel thunk → slowing ticks on the
 * last reel → jackpot fanfare + coin shower. Timings mirror REEL_STOP_TIMES in FoodReelMachine.
 */
export function useFoodReelSounds(running: boolean, finishing: boolean) {
  const pull = useAudioPlayer(PULL);
  const spin = useAudioPlayer(SPIN);
  const tickA = useAudioPlayer(TICK);
  const tickB = useAudioPlayer(TICK);
  const stop = useAudioPlayer(STOP);
  const win = useAudioPlayer(WIN);
  const coins = useAudioPlayer(COINS);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    safeSet(pull, (p) => (p.volume = 0.6));
    safeSet(spin, (p) => {
      p.volume = 0.32;
      p.loop = true;
    });
    safeSet(tickA, (p) => (p.volume = 0.45));
    safeSet(tickB, (p) => (p.volume = 0.45));
    safeSet(stop, (p) => (p.volume = 0.55));
    safeSet(win, (p) => (p.volume = 0.6));
    safeSet(coins, (p) => (p.volume = 0.45));
  }, [pull, spin, tickA, tickB, stop, win, coins]);

  // Lever pull + spinning loop with a rhythmic buzz.
  useEffect(() => {
    if (!running) return;
    safeRestart(pull);
    haptic.heavy();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let buzz: ReturnType<typeof setInterval> | null = null;
    timers.push(
      setTimeout(() => {
        if (!isMountedRef.current) return;
        safeSet(spin, (p) => (p.volume = 0.32));
        safeRestart(spin);
        haptic.medium();
        buzz = setInterval(haptic.tick, 140);
      }, 180),
    );
    return () => {
      timers.forEach(clearTimeout);
      if (buzz) clearInterval(buzz);
      if (!isMountedRef.current) return;
      safePause(spin);
      safePause(pull);
    };
  }, [running, pull, spin]);

  // Deceleration: reel thunks, slowing ticks before the last reel, jackpot.
  useEffect(() => {
    if (!finishing) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(
        setTimeout(() => {
          if (isMountedRef.current) fn();
        }, ms),
      );

    // Whirr fades as reels come to rest.
    at(REEL_STOP_TIMES[0], () => safeSet(spin, (p) => (p.volume = 0.2)));
    at(REEL_STOP_TIMES[1], () => safeSet(spin, (p) => (p.volume = 0.1)));
    at(REEL_STOP_TIMES[1] + 80, () => safePause(spin));

    REEL_STOP_TIMES.forEach((ms, index) =>
      at(ms, () => {
        safeRestart(stop);
        if (index === 2) haptic.heavy();
        else haptic.medium();
      }),
    );

    // Last reel crawls in: ticks with growing gaps (suspense).
    let t = REEL_STOP_TIMES[1] + 80;
    let gap = 55;
    let flip = false;
    while (t < REEL_STOP_TIMES[2] - 50) {
      const player = flip ? tickB : tickA;
      flip = !flip;
      at(t, () => {
        safeRestart(player);
        haptic.tick();
      });
      t += gap;
      gap *= 1.2;
    }

    at(REEL_STOP_TIMES[2] + 60, () => {
      safeRestart(win);
      haptic.success();
    });
    at(REEL_STOP_TIMES[2] + 200, () => safeRestart(coins));
    [320, 420].forEach((ms) => at(REEL_STOP_TIMES[2] + ms, haptic.light));

    return () => {
      timers.forEach(clearTimeout);
      if (isMountedRef.current) safePause(spin);
    };
  }, [finishing, spin, tickA, tickB, stop, win, coins]);
}

/** Sparkle + coin shower when the dish card is revealed on the result screen. */
export function useRewardRevealSound(active: boolean, key?: string | null) {
  const coins = useAudioPlayer(COINS);

  useEffect(() => {
    safeSet(coins, (p) => (p.volume = 0.4));
  }, [coins]);

  useEffect(() => {
    if (!active) return;
    const timers = [
      setTimeout(() => {
        safeRestart(coins);
        haptic.success();
      }, 120),
      setTimeout(haptic.light, 380),
      setTimeout(haptic.light, 560),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, key, coins]);
}
