// Tiny WAV synth shared by the sound scripts (make-potato-sounds.mjs,
// make-echo-sounds.mjs): 16-bit mono PCM, clean tones with short envelopes —
// the app's bell / beep / arcade family, no noise, no whooshes.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const RATE = 44_100;
export const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

export function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32_000), i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

// A tone whose frequency follows freq(t) and amplitude env(t), t in seconds.
export function tone(seconds, freq, env, shape = (p) => Math.sin(p)) {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * freq(t)) / RATE;
    out[i] = shape(phase) * env(t);
  }
  return out;
}

export const mixInto = (a, b) => a.map((v, i) => v + (b[i] ?? 0));
// Soft square: a sine with its 3rd + 5th harmonics — arcade, not harsh.
export const softSquare = (p) => Math.sin(p) + Math.sin(3 * p) / 4 + Math.sin(5 * p) / 10;
// Attack/decay envelope.
export const ad = (attack, decay) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

export function writeWavs(files) {
  for (const [name, samples] of files) {
    writeFileSync(join(OUT, name), wav(samples));
    console.log(`wrote ${name} (${samples.length} samples)`);
  }
}
