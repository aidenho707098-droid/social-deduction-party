// Synthesises Hot Potato's three sound effects into client/public/sounds
// as small 16-bit mono WAVs. Re-run after tweaking:
//
//   node client/scripts/make-potato-sounds.mjs
//
// All three stay in the app's bell / beep / arcade family: clean tones
// with short envelopes, no noise, no whooshes.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RATE = 44_100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

function wav(samples) {
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
function tone(seconds, freq, env, shape = (p) => Math.sin(p)) {
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

const mixInto = (a, b) => a.map((v, i) => v + (b[i] ?? 0));
// Soft square: a sine with its 3rd + 5th harmonics — arcade, not harsh.
const softSquare = (p) => Math.sin(p) + Math.sin(3 * p) / 4 + Math.sin(5 * p) / 10;
// Attack/decay envelope.
const ad = (attack, decay) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// tick — a 40ms dry blip at ~1.5kHz.
const tick = tone(0.04, () => 1480, ad(0.002, 0.009), softSquare).map((v) => v * 0.55);

// pass — a 90ms rising plip (520 -> 980 Hz) with a bell partial.
const passA = tone(0.09, (t) => 520 + 460 * Math.min(1, t / 0.05), ad(0.003, 0.03));
const passB = tone(0.09, (t) => 2 * (520 + 460 * Math.min(1, t / 0.05)), ad(0.002, 0.015)).map((v) => v * 0.25);
const pass = mixInto(passA, passB).map((v) => v * 0.7);

// pop — 320ms: a quick bright "bl" (900 -> 260 Hz pitch drop) over a round
// low body (170 -> 90 Hz), then a tiny bell sparkle. Soft attack, no crack.
const popA = tone(0.32, (t) => 260 + 640 * Math.exp(-t / 0.035), ad(0.004, 0.06));
const popB = tone(0.32, (t) => 90 + 80 * Math.exp(-t / 0.08), ad(0.006, 0.11)).map((v) => v * 0.8);
const sparkle = tone(0.32, () => 1320, (t) => (t < 0.06 ? 0 : ad(0.004, 0.05)(t - 0.06))).map((v) => v * 0.18);
const pop = mixInto(mixInto(popA, popB), sparkle).map((v) => v * 0.6);

for (const [name, samples] of [
  ["potato-tick.wav", tick],
  ["potato-pass.wav", pass],
  ["potato-pop.wav", pop],
]) {
  writeFileSync(join(OUT, name), wav(samples));
  console.log(`wrote ${name} (${samples.length} samples)`);
}
