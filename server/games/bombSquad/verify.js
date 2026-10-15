// The runtime safety check: before ANY bomb starts, the server plays every
// module through on a copy, using its own solver, and confirms that
//   * the manual chapter renders (every block and part is well formed),
//   * at each step EXACTLY ONE of the module's candidate actions is valid
//     (accepted, no strike, and — for modules with free moves — actually
//     progress), and it's the one the solver picks,
//   * following the solver solves the module with no strikes.
// The solvability harness (server/bomb-squad.solvability.mjs) runs the
// same check on 1,000s of variants, plus a literal reading of the manual.
//
// Module API used (see modules/index.js): solve, act, candidates, and the
// optional perform (a composite action, e.g. the button's press + release)
// and progress (free moves that don't count as "the" step, e.g. the maze).

import { flatten } from "./vocab.js";

const KNOWN_PARTS = new Set(["t", "b", "c", "d", "g", "k"]);
const KNOWN_BLOCKS = new Set(["rules", "note", "table", "glyphColumns", "maze", "mazeLookup"]);

export function checkParts(parts) {
  for (const p of parts) {
    const keys = Object.keys(p);
    if (keys.length !== 1 || !KNOWN_PARTS.has(keys[0])) throw new Error(`bad part ${JSON.stringify(p)}`);
  }
  return flatten(parts);
}

export function checkChapter(chapter) {
  if (!chapter?.title || !Array.isArray(chapter.blocks) || !chapter.blocks.length) throw new Error("empty chapter");
  JSON.parse(JSON.stringify(chapter));
  for (const bl of chapter.blocks) {
    if (!KNOWN_BLOCKS.has(bl.type)) throw new Error(`unknown block ${bl.type}`);
    if (bl.type === "rules") bl.items.forEach(checkParts);
    if (bl.type === "note") checkParts(bl.parts);
    if (bl.type === "table") bl.rows.forEach((row) => row.forEach(checkParts));
  }
}

// A pretend fuse for timing-based modules: counts down from 4:00.
export const fakeSecondsAt = (ms) => String(Math.ceil(Math.max(0, 240_000 - ms) / 1000) % 60).padStart(2, "0");

export const performAction = (mod, rules, state, a, ctx) => (mod.perform ? mod.perform(rules, state, a, ctx) : mod.act(rules, state, a, ctx));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One step's "exactly one valid action" check. Returns the accepted list.
export function validActions(mod, rules, state, ctx) {
  const want = mod.solve(rules, state, ctx);
  return {
    want,
    ok: mod.candidates(rules, state, want).filter((a) => {
      const copy = structuredClone(state);
      const r = performAction(mod, rules, copy, a, ctx);
      return r.valid && !r.strike && (mod.progress ? mod.progress(rules, state, copy) : true);
    }),
  };
}

// Play one module through. Throws on the first problem.
export function verifyModule(mod, rules, state, ctx, { maxSteps = 80 } = {}) {
  checkChapter(mod.renderManual(rules));
  const sim = structuredClone(state);
  for (let step = 0; step < maxSteps; step++) {
    const { want, ok } = validActions(mod, rules, sim, ctx);
    if (ok.length !== 1 || !same(ok[0], want)) throw new Error(`${mod.id}: ${ok.length} valid actions at step ${step}`);
    const r = performAction(mod, rules, sim, want, ctx);
    if (!r.valid || r.strike) throw new Error(`${mod.id}: the solver's action was refused at step ${step}`);
    if (r.solved) return step + 1;
  }
  throw new Error(`${mod.id}: not solved in ${maxSteps} steps`);
}
