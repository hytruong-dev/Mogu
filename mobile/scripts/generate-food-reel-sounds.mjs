import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Short, quiet UI cues generated locally so the app bundles them without an audio CDN.
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

const tone = (t, hz) => Math.sin(2 * Math.PI * hz * t);
const decay = (t, rate) => Math.exp(-rate * t);
const hit = (t, at, duration) => (t >= at && t < at + duration ? (t - at) / duration : -1);

wave('pull.wav', 0.29, (t, noise) => {
  const wood = 0.22 * tone(t, 170 - 55 * t) * decay(t, 16);
  const click = 0.12 * noise() * decay(t, 36);
  const latchT = hit(t, 0.16, 0.13);
  const latch = latchT < 0 ? 0 : (0.16 * tone(latchT, 260) + 0.07 * noise()) * decay(latchT, 27);
  return wood + click + latch;
});

wave('spin.wav', 0.82, (t, noise) => {
  const phase = t % 0.205;
  const tick = (0.065 * tone(phase, 420) + 0.025 * noise()) * decay(phase, 52);
  const whirr = 0.035 * tone(t, 95) + 0.015 * tone(t, 144);
  const edge = Math.min(1, t * 30, (0.82 - t) * 30);
  return (tick + whirr) * Math.max(0, edge);
});

wave('stop.wav', 0.18, (t, noise) => (0.2 * tone(t, 310 - 80 * t) + 0.08 * noise()) * decay(t, 32));

wave('success.wav', 0.48, (t) => {
  const first = 0.14 * tone(t, 523.25) * decay(t, 9);
  const secondT = Math.max(0, t - 0.11);
  const second = t < 0.11 ? 0 : 0.17 * tone(secondT, 659.25) * decay(secondT, 8);
  return first + second;
});

console.log(`Generated four NOAN food reel sounds in ${output}`);
