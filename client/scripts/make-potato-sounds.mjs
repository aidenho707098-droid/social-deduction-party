// Synthesises Hot Potato's three sound effects into client/public/sounds
// as small 16-bit mono WAVs. Re-run after tweaking:
//
//   node client/scripts/make-potato-sounds.mjs
//
// All three stay in the app's bell / beep / arcade family: clean tones
// with short envelopes, no noise, no whooshes.

import { ad, mixInto, softSquare, tone, writeWavs } from "./synth.mjs";

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

writeWavs([
  ["potato-tick.wav", tick],
  ["potato-pass.wav", pass],
  ["potato-pop.wav", pop],
]);
