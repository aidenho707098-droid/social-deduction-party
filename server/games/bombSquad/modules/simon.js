// SIMON LIGHTS — four lights (red, blue, green, yellow, each with its own
// shape) flash a sequence; the Defuser presses the TRANSLATED colours.
//
// Three stages: 3 flashes, then 4, then 5 (each extending the last). The
// manual has six rows — serial has a vowel (yes / no) x strikes so far (0,
// 1, 2 or more) — each mapping every flashed colour to the colour to press.
// Every row is a permutation of the four colours and no two rows match.
// A wrong press is a strike: the stage's flashes replay and its progress
// resets (and with a new strike count, a different row may apply).
//
// The flashes are part of the bomb (Defuser + spectators); the Expert only
// ever hears them described.
import { makeRng } from "../rng.js";
import { b, chip, hasVowel, t } from "../vocab.js";

export const SIMON_COLORS = ["red", "blue", "green", "yellow"];
export const LENGTHS = [3, 4, 5];
const KEYS = [];
for (const vowel of [true, false]) for (const strikes of [0, 1, 2]) KEYS.push({ vowel, strikes });

const strikeLabel = (n) => (n >= 2 ? "2 or more" : String(n));

function rowFor(rules, ctx) {
  const vowel = hasVowel(ctx.serial);
  const strikes = Math.min(2, ctx.strikes ?? 0);
  return rules.rows.find((r) => r.vowel === vowel && r.strikes === strikes);
}

export default {
  id: "simon",
  name: "Simon Lights",
  icon: "simon",
  weight: 1,

  params() {
    return { lengths: LENGTHS };
  },

  generateRules(seed) {
    const rng = makeRng(seed);
    const seen = new Set();
    const rows = KEYS.map((key) => {
      let perm;
      do perm = rng.shuffle(SIMON_COLORS);
      while (seen.has(perm.join()));
      seen.add(perm.join());
      return { ...key, map: Object.fromEntries(SIMON_COLORS.map((c, i) => [c, perm[i]])) };
    });
    return { rows };
  },

  createInstance(rng) {
    return { seq: Array.from({ length: LENGTHS.at(-1) }, () => rng.pick(SIMON_COLORS)), stage: 0, progress: 0, replay: 0 };
  },

  // The colour to press next: the flashed colour, translated by the row for
  // this serial and the strikes right now.
  solve(rules, state, ctx) {
    return { kind: "press", color: rowFor(rules, ctx).map[state.seq[state.progress]] };
  },

  act(rules, state, a, ctx) {
    if (a.kind !== "press" || !SIMON_COLORS.includes(a.color)) return { valid: false };
    if (a.color !== this.solve(rules, state, ctx).color) {
      state.progress = 0;
      state.replay += 1; // the stage's flashes play again
      return { valid: true, strike: true };
    }
    state.progress += 1;
    if (state.progress === LENGTHS[state.stage]) {
      state.stage += 1;
      state.progress = 0;
      state.replay += 1; // the next, longer sequence plays
    }
    return { valid: true, solved: state.stage === LENGTHS.length };
  },

  candidates() {
    return SIMON_COLORS.map((color) => ({ kind: "press", color }));
  },

  describe(rules, before, a, ctx) {
    const want = this.solve(rules, before, ctx);
    return {
      did: [t("Pressed "), chip(a.color)],
      expected: [t("Press "), chip(want.color), t(` (stage ${before.stage + 1}, flash ${before.progress + 1})`)],
    };
  },

  view(state) {
    const s = Math.min(state.stage, LENGTHS.length - 1);
    return { stage: state.stage, stages: LENGTHS.length, flashes: state.seq.slice(0, LENGTHS[s]), progress: state.progress, replay: state.replay };
  },

  renderManual(rules) {
    return {
      id: "simon",
      title: "Simon Lights",
      icon: "simon",
      blocks: [
        {
          type: "note",
          parts: [
            t("The Defuser reads out the "),
            b("flashes"),
            t(" in order. Find the row for the serial number and the strikes "),
            b("right now"),
            t(", translate each flashed colour, and tell them what to press. Three stages: 3, 4, then 5 flashes. A wrong press is a strike and the stage starts over."),
          ],
        },
        {
          type: "table",
          columns: ["Vowel?", "Strikes", "Flash → press"],
          rows: rules.rows.map((r) => [
            [b(r.vowel ? "Yes" : "No")],
            [t(strikeLabel(r.strikes))],
            SIMON_COLORS.flatMap((c, i) => [...(i ? [t(" · ")] : []), chip(c), t(" → "), chip(r.map[c])]),
          ]),
        },
      ],
    };
  },
};
