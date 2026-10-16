// SWITCH BOARD — five toggle switches (random start) and five LEDs. Set the
// switches to the pattern the manual gives for the LEDs, then press LOCK.
//
// Manual: a table of eight LED patterns, each mapped to the switch pattern
// that disarms it. Every variant has eight distinct LED patterns and eight
// distinct switch patterns. A wrong LOCK is a strike; toggling is free.
import { CONFIG } from "../config.js";
import { makeRng } from "../rng.js";
import { b, t } from "../vocab.js";

const N = CONFIG.switches.count;
const ROWS = CONFIG.switches.patterns;
const ALL = Array.from({ length: 2 ** N }, (_, i) => i.toString(2).padStart(N, "0"));

// How the manual draws patterns: LEDs ○ lit / ● dark (the bomb draws them
// the same way), switches ▲ up / ▼ down. Rendering only: the rules data
// stays "1" = lit.
export const LIT = "○";
export const DARK = "●";
export const ledText = (p) => [...p].map((c) => (c === "1" ? LIT : DARK)).join(" ");
export const switchText = (p) => [...p].map((c) => (c === "1" ? "▲" : "▼")).join(" ");

export default {
  id: "switches",
  name: "Switch Board",
  icon: "switches",
  weight: 1,

  params() {
    return { switches: N };
  },

  generateRules(seed) {
    const rng = makeRng(seed);
    // No all-off LED row (it would look like a dead module).
    const leds = rng.sample(ALL.filter((p) => p.includes("1")), ROWS);
    const switches = rng.sample(ALL, ROWS);
    return { rows: leds.map((l, i) => ({ leds: l, switches: switches[i] })) };
  },

  createInstance(rng, rules) {
    const row = rng.pick(rules.rows);
    let start;
    do start = rng.pick(ALL);
    while (start === row.switches);
    return { leds: row.leds, switches: start };
  },

  target(rules, state) {
    return rules.rows.find((r) => r.leds === state.leds).switches;
  },

  // Next step: flip the first switch that's wrong, or LOCK when all match.
  solve(rules, state) {
    const want = this.target(rules, state);
    const i = [...state.switches].findIndex((c, k) => c !== want[k]);
    return i < 0 ? { kind: "lock" } : { kind: "toggle", switch: i };
  },

  // Live input is idempotent: a toggle says where the switch should END UP
  // (`to`), and LOCK says which pattern the Defuser saw (`pattern`). A
  // repeated toggle is a no-op; a LOCK on a pattern the server doesn't have
  // (a toggle still in flight or lost) is refused, not judged.
  gate(state, a) {
    if (a.kind === "toggle") {
      if (typeof a.to !== "boolean") return { reason: "stale" };
      return (state.switches[a.switch] === "1") === a.to ? { reason: "noop" } : null;
    }
    if (a.kind === "lock") return a.pattern === state.switches ? null : { reason: "stale" };
    return null;
  },

  act(rules, state, a) {
    if (a.kind === "toggle") {
      if (!Number.isInteger(a.switch) || a.switch < 0 || a.switch >= N) return { valid: false };
      const s = [...state.switches];
      s[a.switch] = s[a.switch] === "1" ? "0" : "1";
      state.switches = s.join("");
      return { valid: true };
    }
    if (a.kind !== "lock") return { valid: false };
    return state.switches === this.target(rules, state) ? { valid: true, solved: true } : { valid: true, strike: true };
  },

  describe(rules, before, a) {
    return { did: [t("Locked "), b(switchText(before.switches))], expected: [t("Lock "), b(switchText(this.target(rules, before)))] };
  },

  // Toggling is always allowed (it isn't a guess); what must be unique is
  // the step toward the answer — and LOCK only when it's right.
  candidates(rules, state, want) {
    return want.kind === "lock" ? [{ kind: "lock" }] : [want, { kind: "lock" }];
  },

  view(state) {
    return { leds: [...state.leds].map((c) => c === "1"), switches: [...state.switches].map((c) => c === "1") };
  },

  renderManual(rules) {
    return {
      id: "switches",
      title: "Switch Board",
      icon: "switches",
      blocks: [
        {
          type: "note",
          parts: [
            t("Find the row whose "),
            b("LEDs"),
            t(" match the bomb's, left to right. Set the five switches to that row's pattern, then press "),
            b("LOCK"),
            t(". Flipping switches is free; a wrong LOCK is a strike."),
          ],
        },
        { type: "note", parts: [b(`${LIT} lit, ${DARK} dark`), t(" · "), b("▲ up, ▼ down")] },
        {
          type: "table",
          columns: ["LEDs", "Switches"],
          rows: rules.rows.map((r) => [[t(ledText(r.leds))], [t(switchText(r.switches))]]),
        },
      ],
    };
  },
};
