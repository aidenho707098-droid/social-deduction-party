// SYMBOLS — four abstract glyphs; tap them in the right order.
//
// Manual: six columns of seven glyphs (from a pool of 24; the shapes live
// client-side in client/src/games/bombSquad/glyphs.jsx, the server only
// knows their ids). The four shown symbols all appear in exactly ONE
// column, and the order to tap them is their order in that column.
//
// Every variant has the same overlap structure: 42 slots, so 18 glyphs
// appear in two columns and 6 in one, never twice in a column.
import { CONFIG } from "../config.js";
import { makeRng } from "../rng.js";
import { b, glyph, t } from "../vocab.js";

const { pool: POOL, columns: COLS, perColumn: PER, shown: SHOWN } = CONFIG.symbols;
const ALL = Array.from({ length: POOL }, (_, i) => i);

function buildColumns(rng) {
  for (;;) {
    const items = rng.shuffle([...ALL, ...rng.sample(ALL, COLS * PER - POOL)]);
    const cols = Array.from({ length: COLS }, () => []);
    let ok = true;
    for (const g of items) {
      const open = cols.filter((c) => c.length < PER && !c.includes(g));
      if (!open.length) {
        ok = false;
        break;
      }
      // Fill the emptiest columns first so the deal doesn't dead-end.
      const least = Math.min(...open.map((c) => c.length));
      rng.pick(open.filter((c) => c.length === least)).push(g);
    }
    if (ok) return cols.map((c) => rng.shuffle(c));
  }
}

// Columns holding every one of `glyphs`.
export function columnsWithAll(columns, glyphs) {
  return columns.map((c, i) => (glyphs.every((g) => c.includes(g)) ? i : -1)).filter((i) => i >= 0);
}

export default {
  id: "symbols",
  name: "Symbols",
  icon: "symbols",
  weight: 1,

  params() {
    return { shown: SHOWN };
  },

  generateRules(seed) {
    return { columns: buildColumns(makeRng(seed)) };
  },

  createInstance(rng, rules) {
    for (let tries = 0; tries < 500; tries++) {
      const col = rng.int(0, COLS - 1);
      const pick = rng.sample(rules.columns[col], SHOWN);
      if (columnsWithAll(rules.columns, pick).length !== 1) continue;
      const order = [...pick].sort((x, y) => rules.columns[col].indexOf(x) - rules.columns[col].indexOf(y));
      return { shown: rng.shuffle(pick), order, progress: 0 };
    }
    throw new Error("symbols: no unique set found");
  },

  solve(rules, state) {
    return { kind: "tap", symbol: state.order[state.progress] };
  },

  // Live taps say which place in the order they're for (`index`), so a tap
  // that crossed a strike or another tap in flight is refused, not judged.
  gate(state, a) {
    return Number.isInteger(a.index) && a.index === state.progress ? null : { reason: "stale" };
  },

  act(rules, state, a) {
    if (a.kind !== "tap" || !state.shown.includes(a.symbol)) return { valid: false };
    if (state.order.slice(0, state.progress).includes(a.symbol)) return { valid: false }; // already tapped
    if (a.symbol !== state.order[state.progress]) return { valid: true, strike: true }; // progress is kept
    state.progress += 1;
    return { valid: true, solved: state.progress === state.order.length };
  },

  describe(rules, before, a) {
    return { did: [t("Tapped "), glyph(a.symbol)], expected: [t("Tap "), glyph(before.order[before.progress]), t(` (symbol ${before.progress + 1} of 4)`)] };
  },

  candidates(rules, state) {
    return state.shown.filter((g) => !state.order.slice(0, state.progress).includes(g)).map((g) => ({ kind: "tap", symbol: g }));
  },

  view(state) {
    return { shown: state.shown, tapped: state.order.slice(0, state.progress) };
  },

  renderManual(rules) {
    return {
      id: "symbols",
      title: "Symbols",
      icon: "symbols",
      blocks: [
        {
          type: "rules",
          heading: "What to do",
          items: [
            [t("The Defuser sees "), b("four symbols"), t(". Find the "), b("one column"), t(" below that has all four.")],
            [t("Tap the four in the order they appear in that column, "), b("top to bottom"), t(".")],
            [t("A wrong tap is a strike. Symbols already tapped stay tapped.")],
          ],
        },
        { type: "glyphColumns", columns: rules.columns },
      ],
    };
  },
};
