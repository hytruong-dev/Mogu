import { useEffect, useRef } from 'react';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { REEL_STOP_TIMES } from './FoodReelMachine';

const PULL = require('../../assets/audio/food-reel/pull.wav');
const SPIN = require('../../assets/audio/food-reel/spin.wav');
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
 * Lightweight, high-performance audio + haptics for the food reel.
 * Avoids aggressive tick loops and duplicate audio players so the Android
 * native audio subsystem and bridge stay buttery smooth without thread stalling.
 */
export function useFoodReelSounds(running: boolean, finishing: boolean) {
  const pull = useAudioPlayer(PULL);
  const spin = useAudioPlayer(SPIN);
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
    safeSet(pull, (p) => (p.volume = 0.55));
    safeSet(spin, (p) => {
      p.volume = 0.3;
      p.loop = true;
    });
    safeSet(stop, (p) => (p.volume = 0.5));
    safeSet(win, (p) => (p.volume = 0.6));
    safeSet(coins, (p) => (p.volume = 0.45));
  }, [pull, spin, stop, win, coins]);

  // Lever pull + start spinning
  useEffect(() => {
    if (!running) return;
    safeRestart(pull);
    haptic.heavy();
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;
      safeSet(spin, (p) => (p.volume = 0.3));
      safeRestart(spin);
      haptic.medium();
    }, 160);
    return () => {
      clearTimeout(timer);
      if (!isMountedRef.current) return;
      safePause(spin);
      safePause(pull);
    };
  }, [running, pull, spin]);

  // Deceleration: reel thunks on each stop, jackpot fanfare on reel 3.
  useEffect(() => {
    if (!finishing) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(
        setTimeout(() => {
          if (isMountedRef.current) fn();
        }, ms),
      );

    // Reel 1 lands
    at(REEL_STOP_TIMES[0], () => {
      safeSet(spin, (p) => (p.volume = 0.16));
      safeRestart(stop);
      haptic.medium();
    });

    // Reel 2 lands
    at(REEL_STOP_TIMES[1], () => {
      safePause(spin);
      safeRestart(stop);
      haptic.medium();
    });

    // Reel 3 lands on winning dish
    at(REEL_STOP_TIMES[2], () => {
      safeRestart(win);
      haptic.heavy();
    });

    // Celebratory coins fanfare
    at(REEL_STOP_TIMES[2] + 50, () => {
      safeRestart(coins);
      haptic.success();
    });

    return () => {
      timers.forEach(clearTimeout);
      if (isMountedRef.current) safePause(spin);
    };
  }, [finishing, spin, stop, win, coins]);
}

/** Subtle haptic tick when the result card pops open */
export function useRewardRevealSound(active: boolean, key?: string | null) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      haptic.light();
    }, 100);
    return () => clearTimeout(t);
  }, [active, key]);
}
