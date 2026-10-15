// WIRES — 3 to 6 coloured wires; cut exactly one.
//
// Manual: for EACH wire count, three ordered "if … cut …" rules and an
// "Otherwise" default. Every variant has the same shape (3 rules + a
// default per count, conditions drawn from the same template pool), only
// the colours, templates and targets differ.
import { CONFIG } from "../config.js";
import { COLORS, ORDINALS, SERIAL_FACTS, SERIAL_FACT_IDS, SHORT_ORD, STRIKE_TEXT, b, chip, t } from "../vocab.js";
import { makeRng } from "../rng.js";

const COUNTS = [];
for (let n = CONFIG.wires.min; n <= CONFIG.wires.max; n++) COUNTS.push(n);

// Condition templates. `guarantees` = the wire colour is certainly present
// when the condition holds, so a "cut the last <colour> wire" target is safe.
const CONDS = {
  none: { guarantees: false, test: (w, c) => w.filter((x) => x === c).length === 0, parts: (c) => [t("there are no "), chip(c), t(" wires")] },
  many: { guarantees: true, test: (w, c) => w.filter((x) => x === c).length > 1, parts: (c) => [t("there is more than one "), chip(c), t(" wire")] },
  one: { guarantees: true, test: (w, c) => w.filter((x) => x === c).length === 1, parts: (c) => [t("there is exactly one "), chip(c), t(" wire")] },
  lastIs: { guarantees: true, test: (w, c) => w[w.length - 1] === c, parts: (c) => [t("the last wire is "), chip(c)] },
  firstIs: { guarantees: true, test: (w, c) => w[0] === c, parts: (c) => [t("the first wire is "), chip(c)] },
  fact: {
    guarantees: true,
    test: (w, c, ctx, fact) => SERIAL_FACTS[fact].test(ctx.serial) && w.includes(c),
    parts: (c, fact) => [t(`${SERIAL_FACTS[fact].text} and there is at least one `), chip(c), t(" wire")],
  },
  strike: {
    guarantees: false,
    test: (w, c, ctx) => ctx.strikes >= 1 && !w.includes(c),
    parts: (c) => [t(`${STRIKE_TEXT} and there are no `), chip(c), t(" wires")],
  },
};
const COND_IDS = Object.keys(CONDS);

function targetIndex(cut, wires) {
  if (cut.type === "pos") return cut.n - 1;
  if (cut.type === "last") return wires.length - 1;
  if (cut.type === "firstColor") return wires.indexOf(cut.color);
  if (cut.type === "lastColor") return wires.lastIndexOf(cut.color);
  throw new Error(`bad cut ${cut.type}`);
}

function targetParts(cut) {
  if (cut.type === "pos") return [b(`${ORDINALS[cut.n - 1]} wire`)];
  if (cut.type === "last") return [b("last wire")];
  return [b(cut.type === "firstColor" ? "first " : "last "), chip(cut.color), b(" wire")];
}

export default {
  id: "wires",
  name: "Wires",
  icon: "wires",
  weight: 1, // every module is worth the same 1 point in the scoring formula

  // Same for every pair in a round: how many wires.
  params(rng) {
    return { count: rng.int(CONFIG.wires.min, CONFIG.wires.max) };
  },

  generateRules(seed) {
    const rng = makeRng(seed);
    const byCount = {};
    for (const n of COUNTS) {
      // Three different templates per count, in a random order.
      const rules = rng.sample(COND_IDS, 3).map((type) => {
        const cond = { type, color: rng.pick(COLORS), fact: type === "fact" ? rng.pick(SERIAL_FACT_IDS) : null };
        const options = [{ type: "pos", n: rng.int(1, n) }, { type: "last" }];
        if (CONDS[type].guarantees) options.push({ type: rng.chance(0.5) ? "firstColor" : "lastColor", color: cond.color });
        return { cond, cut: rng.pick(options) };
      });
      byCount[n] = { rules, otherwise: { type: "pos", n: rng.int(1, n) } };
    }
    return { byCount };
  },

  createInstance(rng, rules, params) {
    return { wires: Array.from({ length: params.count }, () => rng.pick(COLORS)), cut: [] };
  },

  // The one wire to cut, by the first rule that applies.
  solve(rules, state, ctx) {
    const list = rules.byCount[state.wires.length];
    for (const r of list.rules) {
      if (CONDS[r.cond.type].test(state.wires, r.cond.color, ctx, r.cond.fact)) {
        return { kind: "cut", wire: targetIndex(r.cut, state.wires) };
      }
    }
    return { kind: "cut", wire: targetIndex(list.otherwise, state.wires) };
  },

  act(rules, state, a, ctx) {
    if (a.kind !== "cut" || !Number.isInteger(a.wire) || a.wire < 0 || a.wire >= state.wires.length) return { valid: false };
    if (state.cut.includes(a.wire)) return { valid: false };
    const want = this.solve(rules, state, ctx);
    if (a.wire !== want.wire) return { valid: true, strike: true }; // the wrong wire stays uncut
    state.cut.push(a.wire);
    return { valid: true, solved: true };
  },

  // A strike entry: what was cut vs. what should have been.
  describe(rules, before, a, ctx) {
    const want = this.solve(rules, before, ctx);
    const wire = (i) => [b(SHORT_ORD[i]), t(" wire ("), chip(before.wires[i]), t(")")];
    return { did: [t("Cut the "), ...wire(a.wire)], expected: [t("Cut the "), ...wire(want.wire)] };
  },

  candidates(rules, state) {
    return state.wires.map((_, i) => (state.cut.includes(i) ? null : { kind: "cut", wire: i })).filter(Boolean);
  },

  view(state) {
    return { wires: state.wires.map((color, i) => ({ color, cut: state.cut.includes(i) })) };
  },

  renderManual(rules) {
    return {
      id: "wires",
      title: "Wires",
      icon: "wires",
      blocks: [
        {
          type: "note",
          parts: [t("Count the wires, find the list for that count, and cut "), b("exactly one"), t(" wire. Wires are counted from the top.")],
        },
        ...COUNTS.map((n) => ({
          type: "rules",
          heading: `${n} wires`,
          items: [
            ...rules.byCount[n].rules.map((r) => [t("If "), ...CONDS[r.cond.type].parts(r.cond.color, r.cond.fact), t(", cut the "), ...targetParts(r.cut), t(".")]),
            [t("Otherwise, cut the "), ...targetParts(rules.byCount[n].otherwise), t(".")],
          ],
        })),
      ],
    };
  },
};
