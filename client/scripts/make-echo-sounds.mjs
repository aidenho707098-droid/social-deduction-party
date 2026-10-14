// Synthesises Echo Chain's tile notes into client/public/sounds as small
// 16-bit mono WAVs. Re-run after tweaking:
//
//   node client/scripts/make-echo-sounds.mjs
//
// Ten soft bells on a C major pentatonic scale across two octaves:
//   echo-note-0..4 = C5 D5 E5 G5 A5,  echo-note-5..9 = C6 D6 E6 G6 A6.
// Which tile plays which note is client/src/games/echoChain/board.js.
// Same bell / beep / arcade family as the rest of the app: a clean tone
// with two quiet partials and a short decay, no noise, no whooshes.

import { ad, mixInto, tone, writeWavs } from "./synth.mjs";

const SEMITONES = [0, 2, 4, 7, 9]; // major pentatonic
const C5 = 523.25;

export const NOTE_HZ = [0, 1].flatMap((oct) => SEMITONES.map((s) => C5 * 2 ** (oct + s / 12)));

function bell(hz) {
  const len = 0.42;
  const body = tone(len, () => hz, ad(0.004, 0.16));
  const second = tone(len, () => hz * 2, ad(0.003, 0.07)).map((v) => v * 0.28);
  const third = tone(len, () => hz * 3, ad(0.002, 0.035)).map((v) => v * 0.1);
  // A little quieter up high, so the top octave doesn't pierce.
  const level = 0.55 * (hz > 1000 ? 0.8 : 1);
  return mixInto(mixInto(body, second), third).map((v) => v * level);
}

writeWavs(NOTE_HZ.map((hz, i) => [`echo-note-${i}.wav`, bell(hz)]));
