import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Short arcade-style UI cues (Coin Master-like slot feel) generated locally so the
// app bundles them without an audio CDN. Rebuild: node scripts/generate-food-reel-sounds.mjs
const output = join(process.cwd(), 'src', 'assets', 'audio', 'food-reel');
const sampleRate = 22050;
mkdirSync(output, { recursive: true });

function wave(name, seconds, synth) {
  const samples = Math.ceil(seconds * sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  let noiseState = 0x1234abcd;
  const noise = () => {
    noiseState = (1664525 * noiseState + 1013904223) >>> 0;
    return (noiseState / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < samples; i += 1) {
    const value = Math.max(-1, Math.min(1, synth(i / sampleRate, noise)));
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(output, name), Buffer.concat([header, pcm]));
}

const TAU = 2 * Math.PI;
const tone = (t, hz) => Math.sin(TAU * hz * t);
const decay = (t, rate) => Math.exp(-rate * t);
/** Local time inside an event window, or -1 outside it. */
const local = (t, at, duration) => (t >= at && t < at + duration ? t - at : -1);
/** Bright "chip-tune" voice: sine with a few odd harmonics. */
const bright = (t, hz) => tone(t, hz) + 0.3 * tone(t, hz * 3) + 0.12 * tone(t, hz * 5);
const attack = (t, seconds) => Math.min(1, t / seconds);

// Lever pull: ratchet clicks while pulling, heavy clunk, springy boing on return.
wave('pull.wav', 0.55, (t, noise) => {
  let v = 0;
  for (let k = 0; k < 5; k += 1) {
    const c = local(t, k * 0.035, 0.03);
    if (c >= 0) v += (0.18 * tone(c, 1500 + k * 180) + 0.14 * noise()) * decay(c, 140);
  }
  const clunk = local(t, 0.19, 0.3);
  if (clunk >= 0) {
    v += 0.5 * tone(clunk, 110 - 60 * clunk) * decay(clunk, 14);
    v += 0.22 * noise() * decay(clunk, 45);
    v += 0.1 * tone(clunk, 720) * decay(clunk, 22);
  }
  const boing = local(t, 0.27, 0.28);
  if (boing >= 0) {
    const vibrato = 1 + 0.06 * tone(boing, 18);
    v += 0.16 * tone(boing, 330 * vibrato + 160 * boing) * decay(boing, 11);
  }
  return v;
});

// Seamless spinning loop: 8 fast reel ticks + mechanical whirr (integer cycles, no fade).
wave('spin.wav', 0.6, (t, noise) => {
  const period = 0.075;
  const phase = t % period;
  const index = Math.floor(t / period);
  const tickHz = index % 2 === 0 ? 1250 : 1050;
  const tick = (0.16 * tone(phase, tickHz) + 0.1 * noise()) * decay(phase, 95);
  const whirr = 0.045 * tone(t, 100) + 0.03 * tone(t, 150) + 0.012 * noise();
  return tick + whirr;
});

// Single slow-down tick used when the last reel crawls to a stop.
wave('tick.wav', 0.08, (t, noise) => (0.3 * tone(t, 1400) + 0.18 * noise()) * decay(t, 90));

// Reel stop: wooden thunk + metallic ring.
wave('stop.wav', 0.32, (t, noise) => {
  const thunk = 0.45 * tone(t, 170 - 150 * t) * decay(t, 20);
  const knock = 0.2 * noise() * decay(t, 60);
  const ring = 0.1 * (tone(t, 1320) + 0.6 * tone(t, 1980)) * decay(t, 16);
  return thunk + knock + ring;
});

// Jackpot fanfare: rising arpeggio, sustained major chord with vibrato and sparkles.
wave('win.wav', 1.5, (t, noise) => {
  let v = 0;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((hz, k) => {
    const n = local(t, k * 0.09, 0.3);
    if (n >= 0) v += 0.13 * bright(n, hz) * attack(n, 0.005) * decay(n, 9);
  });
  const chord = local(t, 0.38, 1.12);
  if (chord >= 0) {
    const vib = 1 + 0.008 * tone(chord, 6);
    const env = attack(chord, 0.02) * decay(chord, 2.6);
    v += env * 0.09 * (bright(chord, 1046.5 * vib) + bright(chord, 1318.5 * vib) + bright(chord, 1568 * vib));
    v += env * 0.08 * tone(chord, 261.63);
  }
  // Sparkle shimmer: high blips scattered through the tail.
  for (let k = 0; k < 14; k += 1) {
    const at = 0.4 + k * 0.07;
    const s = local(t, at, 0.09);
    if (s >= 0) v += 0.05 * tone(s, 2800 + ((k * 733) % 1900)) * decay(s, 45);
  }
  return v + 0.004 * noise();
});

// Coin shower: bursts of bright two-partial clinks.
wave('coins.wav', 1.1, (t) => {
  let v = 0;
  const times = [0, 0.06, 0.11, 0.19, 0.24, 0.31, 0.37, 0.45, 0.52, 0.6, 0.69, 0.78, 0.88];
  times.forEach((at, k) => {
    const c = local(t, at, 0.22);
    if (c >= 0) {
      const base = 2400 + ((k * 389) % 1200);
      const gain = 0.16 * (1 - at * 0.6);
      v += gain * (tone(c, base) + 0.7 * tone(c, base * 1.49)) * decay(c, 28);
    }
  });
  return v;
});

// Legacy short success chime (kept for callers that still reference it).
wave('success.wav', 0.5, (t) => {
  const first = 0.16 * bright(t, 783.99) * decay(t, 9);
  const s = Math.max(0, t - 0.1);
  const second = t < 0.1 ? 0 : 0.18 * bright(s, 1046.5) * decay(s, 7);
  return first + second;
});

console.log(`Generated NOAN food reel sounds in ${output}`);
