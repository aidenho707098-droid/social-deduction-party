// Bomb Squad solvability harness.
//
// For every module plug-in: VARIANTS manual variants x INSTANCES module
// instances each. For every instance it checks that
//   1. the manual renders without error (and every part is a known kind),
//   2. there is EXACTLY ONE valid next action (every alternative is tried
//      against the server's own act(): exactly one is accepted, the rest
//      are strikes),
//   3. a LITERAL READER — which sees only the rendered manual text and what
//      the Defuser sees, never the rules data — picks that same action, and
//      following it to the end solves the module with no strikes.
// The readers parse the manual's words (flatten()) with their own code, so
// a manual that says something different from what the checker does fails.
//
// Run:  npm run test:bomb-squad-solvability   [-- --variants N --instances N]

import { MODULES } from "./games/bombSquad/modules/index.js";
import { makeRng, hashSeed } from "./games/bombSquad/rng.js";
import { makeSerial, generalPage } from "./games/bombSquad/vocab.js";
import { READERS } from "./bombSquadReaders.mjs";
import { distances as mazeDistances } from "./games/bombSquad/modules/maze.js";
import { SIMON_COLORS } from "./games/bombSquad/modules/simon.js";
import { checkChapter, fakeSecondsAt, performAction, validActions, verifyModule } from "./games/bombSquad/verify.js";

const sameAction = (a, b) => JSON.stringify({ ...a, wrongDigit: undefined }) === JSON.stringify({ ...b, wrongDigit: undefined });

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const VARIANTS = arg("variants", 1000);
const INSTANCES = arg("instances", 200);
const DIFFS = ["easy", "medium", "hard"];

// Per-module checks over the whole run (beyond "solvable"): fed each
// variant's rules + difficulty, then asked for a verdict at the end.
const EXTRA = {
  maze: () => {
    let instances = 0;
    return {
      variant(rules) {
        const keys = rules.mazes.map((m) => [...m.markers].sort((x, y) => x - y).join("-"));
        if (rules.mazes.length !== 9) throw new Error("not nine layouts");
        if (new Set(keys).size !== 9) throw new Error("two layouts share a marker pair: the lookup is ambiguous");
        for (const m of rules.mazes) {
          // perfect: 36 cells, 35 passages, all connected
          const passages = m.open.reduce((n, bits) => n + [1, 2, 4, 8].filter((b) => bits & b).length, 0) / 2;
          if (passages !== 35 || mazeDistances(m.open, 0).some((d) => d < 0)) throw new Error("a maze isn't perfect");
        }
      },
      instance(rules, state, params) {
        instances++;
        const d = mazeDistances(rules.mazes[state.layout].open, state.pos)[state.target];
        if (d < params.min || d > params.max) throw new Error(`path of ${d} steps, outside ${params.min}-${params.max}`);
        if (state.markers.includes(state.pos) || state.markers.includes(state.target) || state.pos === state.target) throw new Error("dot/target on a marker or the same cell");
      },
      verdict() {
        return { problems: [], note: `lookup unambiguous in every variant; ${instances} dot-to-target paths all in range` };
      },
    };
  },
  simon: () => ({
    variant(rules) {
      if (rules.rows.length !== 6) throw new Error("not six rows");
      const combos = new Set(rules.rows.map((r) => `${r.vowel}:${r.strikes}`));
      if (combos.size !== 6) throw new Error("rows don't cover vowel x strikes");
      const perms = rules.rows.map((r) => SIMON_COLORS.map((c) => r.map[c]).join());
      if (!rules.rows.every((r) => [...new Set(Object.values(r.map))].length === 4 && SIMON_COLORS.every((c) => Object.values(r.map).includes(c)))) throw new Error("a row isn't a permutation");
      if (new Set(perms).size !== 6) throw new Error("two rows are identical");
    },
    verdict() {
      return { problems: [], note: "every row a permutation of the four colours, no two rows alike" };
    },
  }),
  memory: () => {
    const seen = { easy: 0, medium: 0, hard: 0 };
    const hardWith = { n: 0 };
    return {
      variant(rules, difficulty) {
        const labels = rules.stages.flat().filter((ins) => ins.type === "sameLabel").length;
        const refs = rules.stages.flat().filter((ins) => ins.stage != null);
        if (difficulty !== "hard" && labels) seen[difficulty] += 1;
        if (difficulty === "hard" && labels) hardWith.n += 1;
        // look-backs only to stages that already happened (none in stage 1)
        rules.stages.forEach((st, s) => st.forEach((ins) => {
          if (ins.stage != null && !(ins.stage < s)) throw new Error(`stage ${s + 1} refers to stage ${ins.stage + 1}`);
        }));
        if (rules.stages[0].some((ins) => ins.stage != null)) throw new Error("stage 1 looks back");
        return refs.length;
      },
      verdict(counts) {
        const out = [];
        if (seen.easy || seen.medium) out.push(`label-memory rules in ${seen.easy} Easy / ${seen.medium} Medium variants`);
        if (!hardWith.n) out.push("no Hard variant had a label-memory rule");
        return { problems: out, note: `label memory: Easy 0, Medium 0, Hard ${hardWith.n}/${counts.hard} variants` };
      },
    };
  },
};

// ---- run -----------------------------------------------------------------
checkChapter(generalPage());
let totalFail = 0;
const report = [];
const notes = [];
for (const mod of Object.values(MODULES)) {
  const t0 = Date.now();
  let checked = 0;
  let steps = 0;
  const fails = [];
  const fail = (msg) => {
    if (fails.length < 5) fails.push(msg);
    else fails.push(null);
  };
  const extra = EXTRA[mod.id]?.() ?? null;
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (let v = 0; v < VARIANTS; v++) {
    const difficulty = DIFFS[v % 3]; // every difficulty, a third each
    counts[difficulty] += 1;
    const params = mod.params(makeRng(hashSeed(`${mod.id}:params:${v}`)), difficulty);
    const rules = mod.generateRules(hashSeed(`${mod.id}:variant:${v}`), params);
    let chapter;
    try {
      chapter = mod.renderManual(rules, params);
      checkChapter(chapter);
      extra?.variant(rules, difficulty, params);
    } catch (e) {
      fail(`variant ${v}: ${e.message}`);
      continue;
    }
    for (let i = 0; i < INSTANCES; i++) {
      const rng = makeRng(hashSeed(`${mod.id}:${v}:${i}`));
      let state;
      try {
        state = mod.createInstance(rng, rules, params);
        extra?.instance?.(rules, state, params);
      } catch (e) {
        fail(`variant ${v} instance ${i}: ${e.message}`);
        continue;
      }
      const ctx = { serial: makeSerial(rng), strikes: rng.int(0, 2), at: 0, secondsAt: fakeSecondsAt, timeAt: () => "0:00" };
      const memo = {};
      checked++;
      try {
        // The runtime safety check the server runs before every bomb.
        verifyModule(mod, rules, state, ctx);
        // Then step through again, following the LITERAL reading.
        for (let guard = 0; guard < 80; guard++) {
          const view = mod.view(state);
          const { want, ok } = validActions(mod, rules, state, ctx);
          const read = READERS[mod.id](chapter, view, ctx, memo)[0];
          if (!sameAction(read, want)) throw new Error(`reader says ${JSON.stringify(read)}, solve says ${JSON.stringify(want)}`);
          if (ok.length !== 1 || !sameAction(ok[0], want)) throw new Error(`${ok.length} valid actions: ${JSON.stringify(ok)}`);
          if (mod.id === "button" && want.kind === "hold") {
            const r = performAction(mod, rules, structuredClone(state), { ...want, wrongDigit: true }, ctx);
            if (!r.strike) throw new Error("letting go on the wrong seconds was not a strike");
          }
          const r = performAction(mod, rules, state, read, ctx);
          steps++;
          if (!r.valid || r.strike) throw new Error(`following the manual gave ${JSON.stringify(r)}`);
          if (r.solved) break;
          if (guard === 79) throw new Error("never solved");
        }
      } catch (e) {
        fail(`variant ${v} instance ${i}: ${e.message}`);
      }
    }
  }
  if (extra) {
    const { problems, note } = extra.verdict(counts);
    problems.forEach((p) => fail(p));
    if (note) notes.push(`${mod.id}: ${note}`);
  }
  totalFail += fails.length;
  report.push({ module: mod.id, variants: VARIANTS, instances: checked, steps, failures: fails.length, seconds: ((Date.now() - t0) / 1000).toFixed(1) });
  for (const f of fails.filter(Boolean)) console.log(`FAIL ${mod.id}: ${f}`);
}
console.table(report);
for (const n of notes) console.log(n);
console.log(totalFail ? `\n${totalFail} FAILURE(S)` : "\nALL MODULES SOLVABLE");
process.exit(totalFail ? 1 : 0);
