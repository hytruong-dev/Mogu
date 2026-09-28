import { useEffect, useRef } from 'react';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';

const PULL = require('../../assets/audio/food-reel/pull.wav');
const SPIN = require('../../assets/audio/food-reel/spin.wav');
const STOP = require('../../assets/audio/food-reel/stop.wav');
const SUCCESS = require('../../assets/audio/food-reel/success.wav');

function safePause(player?: AudioPlayer | null) {
  if (!player) return;
  try {
    const result = (player as any).pause?.();
    if (result && typeof result.catch === 'function') {
      result.catch(() => undefined);
    }
  } catch {
    // Ignore error if shared object was already released
  }
}

function safeRestart(player?: AudioPlayer | null) {
  if (!player) return;
  try {
    const seekResult = (player as any).seekTo?.(0);
    if (seekResult && typeof seekResult.then === 'function') {
      seekResult
        .then(() => {
          try {
            const playResult = (player as any).play?.();
            if (playResult && typeof playResult.catch === 'function') {
              playResult.catch(() => undefined);
            }
          } catch {
            // Ignore error
          }
        })
        .catch(() => undefined);
    } else {
      try {
        const playResult = (player as any).play?.();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch(() => undefined);
        }
      } catch {
        // Ignore error
      }
    }
  } catch {
    // Ignore error
  }
}

/** Local, short UI sounds. The audio players are released with the overlay. */
export function useFoodReelSounds(running: boolean, finishing: boolean) {
  const pull = useAudioPlayer(PULL);
  const spin = useAudioPlayer(SPIN);
  const stop = useAudioPlayer(STOP);
  const success = useAudioPlayer(SUCCESS);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      pull.volume = 0.45;
      spin.volume = 0.16;
      spin.loop = true;
      stop.volume = 0.34;
      success.volume = 0.35;
    } catch {
      // Ignore if released
    }
  }, [pull, spin, stop, success]);

  useEffect(() => {
    if (!running) return;
    safeRestart(pull);
    safeRestart(spin);
    return () => {
      if (!isMountedRef.current) return;
      safePause(spin);
      safePause(pull);
    };
  }, [running, pull, spin]);

  useEffect(() => {
    if (!finishing) return;
    safePause(spin);
    const timers = [720, 1060, 1400].map((delay) =>
      setTimeout(() => {
        if (!isMountedRef.current) return;
        safeRestart(stop);
      }, delay)
    );
    timers.push(
      setTimeout(() => {
        if (!isMountedRef.current) return;
        safeRestart(success);
      }, 1420)
    );
    return () => {
      timers.forEach(clearTimeout);
      if (isMountedRef.current) {
        safePause(spin);
      }
    };
  }, [finishing, spin, stop, success]);
}
