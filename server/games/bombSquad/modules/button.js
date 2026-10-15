// BUTTON — one big coloured button with a label and a lit strip: TAP it,
// or HOLD it and let go when the fuse timer's seconds show a certain digit.
//
// Manual: four ordered "tap or hold?" rules + a default, and a release
// table (strip colour -> digit). Every variant has that same shape.
//
// The release is judged on the SERVER's fuse clock: the engine passes
// `ctx.at` (when the player let go, latency-compensated) and
// `ctx.secondsAt(ms)` (the timer's two seconds digits at that server time).
import { CONFIG } from "../config.js";
import { makeRng } from "../rng.js";
import { SERIAL_FACTS, SERIAL_FACT_IDS, STRIKE_TEXT, action, b, chip, digit, t } from "../vocab.js";

export const BUTTON_COLORS = ["red", "blue", "yellow", "white"];
export const STRIP_COLORS = ["red", "blue", "yellow", "white", "green"];
export const LABELS = ["PUSH", "HOLD", "ABORT", "TAP", "SAFE", "ARM"];

const CONDS = {
  colorLabel: { test: (s, r) => s.color === r.color && s.label === r.label, parts: (r) => [t("the button is "), chip(r.color), t(" and its label says "), b(r.label)] },
  label: { test: (s, r) => s.label === r.label, parts: (r) => [t("the label says "), b(r.label)] },
  color: { test: (s, r) => s.color === r.color, parts: (r) => [t("the button is "), chip(r.color)] },
  colorFact: {
    test: (s, r, ctx) => s.color === r.color && SERIAL_FACTS[r.fact].test(ctx.serial),
    parts: (r) => [t("the button is "), chip(r.color), t(` and ${SERIAL_FACTS[r.fact].text}`)],
  },
  strikeLabel: { test: (s, r, ctx) => ctx.strikes >= 1 && s.label === r.label, parts: (r) => [t(`${STRIKE_TEXT} and the label says `), b(r.label)] },
  strip: { test: (s, r) => s.strip === r.strip, parts: (r) => [t("the strip is "), chip(r.strip)] },
};
const COND_IDS = Object.keys(CONDS);

// "release when the seconds show a 4": the last two digits of the timer.
export const secondsContain = (ss, d) => ss.includes(String(d));

export default {
  id: "button",
  name: "Button",
  icon: "button",
  weight: 1,

  params() {
    return {};
  },

  generateRules(seed) {
    const rng = makeRng(seed);
    const outcomes = rng.shuffle(["tap", "tap", "hold", "hold"]); // both always reachable
    const rules = rng.sample(COND_IDS, 4).map((type, i) => ({
      type,
      color: rng.pick(BUTTON_COLORS),
      label: rng.pick(LABELS),
      strip: rng.pick(STRIP_COLORS),
      fact: rng.pick(SERIAL_FACT_IDS),
      act: outcomes[i],
    }));
    const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], STRIP_COLORS.length);
    return {
      rules,
      otherwise: rng.pick(["tap", "hold"]),
      release: Object.fromEntries(STRIP_COLORS.map((c, i) => [c, digits[i]])),
    };
  },

  createInstance(rng) {
    return { color: rng.pick(BUTTON_COLORS), label: rng.pick(LABELS), strip: rng.pick(STRIP_COLORS), downAt: null };
  },

  // "tap", or "hold" and let go when the seconds show `digit`.
  solve(rules, state, ctx) {
    const hit = rules.rules.find((r) => CONDS[r.type].test(state, r, ctx));
    const act = hit ? hit.act : rules.otherwise;
    return act === "tap" ? { kind: "tap" } : { kind: "hold", digit: rules.release[state.strip] };
  },

  // press / release. A release after < holdMs is a tap.
  act(rules, state, a, ctx) {
    if (a.kind === "press") {
      if (state.downAt != null) return { valid: false };
      state.downAt = ctx.at;
      return { valid: true };
    }
    if (a.kind !== "release" || state.downAt == null) return { valid: false };
    const held = ctx.at - state.downAt;
    state.downAt = null;
    const want = this.solve(rules, state, ctx);
    const tapped = held < CONFIG.button.holdMs;
    if (want.kind === "tap") return tapped ? { valid: true, solved: true } : { valid: true, strike: true };
    if (tapped) return { valid: true, strike: true };
    const tol = CONFIG.button.releaseToleranceMs;
    for (let at = ctx.at - tol; at <= ctx.at + tol; at += 50) {
      if (secondsContain(ctx.secondsAt(at), want.digit)) return { valid: true, solved: true };
    }
    return { valid: true, strike: true };
  },

  // Strikes happen on the release: how long it was held, and when.
  describe(rules, before, a, ctx) {
    const want = this.solve(rules, before, ctx);
    const held = ctx.at - before.downAt;
    const did = held < CONFIG.button.holdMs ? [t("Tapped it")] : [t("Held it, let go at "), b(ctx.timeAt ? ctx.timeAt(ctx.at) : "?")];
    const expected = want.kind === "tap" ? [action("tap"), t(" it")] : [action("hold"), t(", let go when the seconds show "), digit(want.digit)];
    return { did, expected };
  },

  // Tap vs hold. (Letting go at the wrong moment is checked separately: a
  // given moment can show two digits, like "34".)
  candidates(rules, state, want) {
    return [{ kind: "tap" }, { kind: "hold", digit: want.kind === "hold" ? want.digit : 5 }];
  },

  // A whole tap or hold, as one step, on the clock `ctx.secondsAt`:
  // tap = press + let go 200ms later; hold = let go at a moment whose
  // seconds show the digit (or, with `wrongDigit`, a moment where nothing
  // within the tolerance does).
  perform(rules, state, a, ctx) {
    const at0 = 10_000;
    this.act(rules, state, { kind: "press" }, { ...ctx, at: at0 });
    if (a.kind === "tap") return this.act(rules, state, { kind: "release" }, { ...ctx, at: at0 + 200 });
    const shows = (ms) => ctx.secondsAt(ms).includes(String(a.digit));
    let at = at0 + 2000;
    if (a.wrongDigit) while ([-1200, -600, 0, 600, 1200].some((d) => shows(at + d))) at += 100;
    else while (!shows(at)) at += 100;
    return this.act(rules, state, { kind: "release" }, { ...ctx, at });
  },

  view(state) {
    return { color: state.color, label: state.label, strip: state.strip, held: state.downAt != null };
  },

  renderManual(rules) {
    return {
      id: "button",
      title: "Button",
      icon: "button",
      blocks: [
        {
          type: "note",
          parts: [
            action("tap"),
            t(" = press and let go straight away. "),
            action("hold"),
            t(" = keep it pressed, then let go when the timer's "),
            b("seconds"),
            t(" (its last two digits) show the digit for the strip's colour."),
          ],
        },
        {
          type: "rules",
          heading: "Tap or hold?",
          items: [
            ...rules.rules.map((r) => [t("If "), ...CONDS[r.type].parts(r), t(", "), action(r.act), t(" it.")]),
            [t("Otherwise, "), action(rules.otherwise), t(" it.")],
          ],
        },
        {
          type: "rules",
          heading: "Holding: when to let go",
          items: STRIP_COLORS.map((c) => [t("If the strip is "), chip(c), t(", let go when the seconds show a "), digit(rules.release[c]), t(".")]),
        },
      ],
    };
  },
};
