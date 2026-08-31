// Standalone check for the Chaos Events core. Run with:  node server/chaos.selftest.mjs
// Exercises every one of the 17 modifiers plus the frequency roll and the
// per-game modifier filter. No test runner needed — it prints a PASS/FAIL
// line per case and exits non-zero if anything failed.

import {
  FREQUENCIES,
  MODIFIERS,
  MODIFIERS_BY_ID,
  rollChaos,
  pickModifier,
  applyInstant,
  resolveRoundEnd,
  applyDisable,
} from "./chaos.js";
import { eligibleModifiers, CHAOS_GAMES } from "./chaosGames.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// Deterministic RNG so cases are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const M = (obj) => new Map(Object.entries(obj));
const sum = (map) => [...map.values()].reduce((a, b) => a + b, 0);

// --- pool sanity ---------------------------------------------------
check("17 modifiers in the pool", MODIFIERS.length === 17, `got ${MODIFIERS.length}`);
check(
  "every modifier has id/name/blurb/timing",
  MODIFIERS.every((m) => m.id && m.name && m.blurb && m.timing)
);
check(
  "timings are valid",
  MODIFIERS.every((m) => ["instant", "preround", "roundend"].includes(m.timing))
);

// --- frequency roll ---------------------------------------------------
check("OFF never fires", rollChaos("off", () => 0) === false);
check("HIGH fires at rng 0.30", rollChaos("high", () => 0.3) === true);
check("HIGH misses at rng 0.40", rollChaos("high", () => 0.4) === false);
check("LOW ~ 10%", Math.abs(FREQUENCIES.low - 0.1) < 1e-9);
check("MEDIUM ~ 20%", Math.abs(FREQUENCIES.medium - 0.2) < 1e-9);
check("HIGH ~ 35%", Math.abs(FREQUENCIES.high - 0.35) < 1e-9);
check("MAXIMUM = 100%", FREQUENCIES.maximum === 1);
check("MAXIMUM always fires (rng 0.999)", rollChaos("maximum", () => 0.999) === true);
check("MAXIMUM always fires (rng ~1)", rollChaos("maximum", () => 0.999999) === true);

// rough distribution: HIGH over 20k rolls lands near 35%
{
  const rng = seeded(42);
  let hits = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (rollChaos("high", rng)) hits++;
  const rate = hits / N;
  check("HIGH empirical rate ≈ 0.35", Math.abs(rate - 0.35) < 0.03, `rate=${rate.toFixed(3)}`);
}

// --- uniform pick ---------------------------------------------------
{
  const rng = seeded(7);
  const counts = {};
  const pool = MODIFIERS;
  const N = 34000;
  for (let i = 0; i < N; i++) {
    const m = pickModifier(pool, rng);
    counts[m.id] = (counts[m.id] ?? 0) + 1;
  }
  const expected = N / pool.length;
  const maxDev = Math.max(...Object.values(counts).map((c) => Math.abs(c - expected) / expected));
  check("pickModifier is ~uniform across 17", maxDev < 0.15, `maxDev=${maxDev.toFixed(3)}`);
}

// --- per-game filter ------------------------------------------------
{
  const emoji = eligibleModifiers("emoji-movie", MODIFIERS, { playerCount: 4, roundsLeft: 3 });
  check("emoji-movie pool has Speed Round", emoji.some((m) => m.id === "speed-round"));
  check("emoji-movie pool has Player Disable (rounds left)", emoji.some((m) => m.id === "player-disable"));

  const fib = eligibleModifiers("fibbage", MODIFIERS, { playerCount: 4, roundsLeft: 3 });
  check("fibbage pool EXCLUDES Speed Round", !fib.some((m) => m.id === "speed-round"));

  const bm = eligibleModifiers("black-magic", MODIFIERS, { playerCount: 4, roundsLeft: 3 });
  check("black-magic pool EXCLUDES Speed Round", !bm.some((m) => m.id === "speed-round"));

  const lastRound = eligibleModifiers("taboo", MODIFIERS, { playerCount: 4, roundsLeft: 0 });
  check("no rounds left EXCLUDES Player Disable", !lastRound.some((m) => m.id === "player-disable"));

  const twoP = eligibleModifiers("taboo", MODIFIERS, { playerCount: 2, roundsLeft: 3 });
  check("2 players still allows Score Swap", twoP.some((m) => m.id === "score-swap"));

  check("Imposter is chaos-ineligible", !CHAOS_GAMES["imposter"]);
  check(
    "Imposter yields an empty pool",
    eligibleModifiers("imposter", MODIFIERS, { playerCount: 5, roundsLeft: 5 }).length === 0
  );
}

// --- INSTANT modifiers -------------------------------------------
{
  const rng = seeded(1);
  const totals = M({ a: 10, b: 4, c: 7, d: 0 });
  const before = sum(totals);
  const { totals: out } = applyInstant("score-swap", { totals, presentIds: ["a", "b", "c", "d"], rng });
  check("Score Swap conserves total points", sum(out) === before, `${sum(out)} vs ${before}`);
  check("Score Swap actually moved something", JSON.stringify([...out]) !== JSON.stringify([...totals]));
}
check("Steal / The Tyrant are no longer instant", MODIFIERS_BY_ID["steal"].timing === "roundend" && MODIFIERS_BY_ID["the-tyrant"].timing === "roundend");
check("applyInstant only handles Score Swap now", JSON.stringify([...applyInstant("steal", { totals: M({ a: 5, b: 1 }), presentIds: ["a", "b"] }).totals]) === JSON.stringify([...M({ a: 5, b: 1 })]));

// --- ROUND-END: Steal (percentage of first place's ROUND haul) ----
{
  // a leads on TOTAL; d trails. This round a earns 20, so last place skims 40%.
  const { totals, targets } = resolveRoundEnd("steal", {
    totalsBefore: M({ a: 20, b: 10, c: 10, d: 2 }),
    totalsAfter: M({ a: 40, b: 16, c: 14, d: 3 }), // round deltas 20 / 6 / 4 / 1
    presentIds: ["a", "b", "c", "d"],
    rng: seeded(2),
  });
  check("Steal: skim = round(20 * 40%) = 8", targets.find((t) => t.tag === "thief")?.amount === 8);
  check("Steal: first place a 40 -> 32", totals.get("a") === 32);
  check("Steal: last place d 3 -> 11", totals.get("d") === 11);
  check("Steal: bystanders keep their round points", totals.get("b") === 16 && totals.get("c") === 14);
  check("Steal conserves points (pure transfer)", sum(totals) === 40 + 16 + 14 + 3);
}
{
  // Scale check: same 40% lands proportionally in a big-number game.
  const { targets } = resolveRoundEnd("steal", {
    totalsBefore: M({ a: 900, b: 100 }),
    totalsAfter: M({ a: 1200, b: 140 }), // a earned 300 this round
    presentIds: ["a", "b"],
    rng: seeded(2),
  });
  check("Steal scales: round(300 * 40%) = 120", targets.find((t) => t.tag === "thief")?.amount === 120);
}
{
  // a earned nothing this round -> nothing to skim.
  const { totals } = resolveRoundEnd("steal", {
    totalsBefore: M({ a: 50, b: 5 }),
    totalsAfter: M({ a: 50, b: 9 }), // a delta 0
    presentIds: ["a", "b"],
    rng: seeded(2),
  });
  check("Steal: no round haul -> no steal", totals.get("a") === 50 && totals.get("b") === 9);
}

// --- ROUND-END: The Tyrant (percentage of each rival's ROUND points) --
{
  const { totals, targets } = resolveRoundEnd("the-tyrant", {
    totalsBefore: M({ a: 30, b: 5, c: 9, d: 1 }), // a leads on TOTAL
    totalsAfter: M({ a: 33, b: 15, c: 19, d: 3 }), // round deltas 3 / 10 / 10 / 2
    presentIds: ["a", "b", "c", "d"],
    rng: seeded(3),
  });
  check("Tyrant: seizes round(10*20%) + round(10*20%) + round(2*20%) = 2+2+0 = 4", totals.get("a") === 37);
  check("Tyrant: b 15 -> 13, c 19 -> 17, d 3 -> 3", totals.get("b") === 13 && totals.get("c") === 17 && totals.get("d") === 3);
  check("Tyrant: total seized reported", targets.find((t) => t.tag === "tyrant")?.amount === 4);
  check("Tyrant conserves points", sum(totals) === 33 + 15 + 19 + 3);
}
{
  const tyr = resolveRoundEnd("the-tyrant", {
    totalsBefore: M({ a: 100, b: 4, c: 7 }),
    totalsAfter: M({ a: 110, b: 24, c: 27 }),
    presentIds: ["a", "b", "c"],
    principal: { leaderId: "a" },
    rng: seeded(2),
  });
  check(
    "Tyrant targets: 1 tyrant + its victims",
    tyr.targets.some((t) => t.tag === "tyrant") && tyr.targets.some((t) => t.tag === "victim")
  );
}

// --- ROUND-END: multipliers ----------------------------------------
for (const [id, mult] of [["double-points", 2], ["triple-points", 3], ["quad-points", 4]]) {
  const before = M({ a: 5, b: 5, c: 5 });
  const after = M({ a: 15, b: 8, c: 5 }); // round deltas 10 / 3 / 0
  const res = resolveRoundEnd(id, {
    totalsBefore: before,
    totalsAfter: after,
    presentIds: ["a", "b", "c"],
    rng: seeded(9),
  });
  check(
    `${id}: deltas ×${mult}`,
    res.totals.get("a") === 5 + 10 * mult &&
      res.totals.get("b") === 5 + 3 * mult &&
      res.totals.get("c") === 5
  );
  check(`${id}: reports multiplier ${mult}`, res.multiplier === mult);
}

// --- transparency: result.targets names WHO was hit ---------------
{
  const swap = applyInstant("score-swap", {
    totals: M({ a: 10, b: 4 }),
    presentIds: ["a", "b"],
    rng: seeded(1),
  });
  check("Score Swap targets both swapped players", (swap.targets ?? []).length === 2);
}
{
  const rv = resolveRoundEnd("rival", {
    totalsBefore: M({ a: 5, b: 5 }),
    totalsAfter: M({ a: 20, b: 16 }), // deltas 15 / 11 -> steal round(11*0.45)=5
    presentIds: ["a", "b"],
    rivalPair: ["a", "b"],
    rng: seeded(3),
  });
  check(
    "Rival targets name winner + loser",
    rv.targets.some((t) => t.tag === "rival-win") && rv.targets.some((t) => t.tag === "rival-lose")
  );
}
{
  const pd = resolveRoundEnd("player-disable", {
    totalsBefore: M({ a: 0, b: 0, c: 0 }),
    totalsAfter: M({ a: 8, b: 2, c: 1 }),
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Player Disable target names the chooser", pd.targets.some((t) => t.tag === "chooser"));
}

// --- ROUND-END: All or Nothing -----------------------------------
{
  const { totals } = resolveRoundEnd("all-or-nothing", {
    totalsBefore: M({ a: 0, b: 0, c: 0 }),
    totalsAfter: M({ a: 10, b: 7, c: 3 }),
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("All or Nothing: only round winner keeps points", totals.get("a") === 10 && totals.get("b") === 0 && totals.get("c") === 0);
}

// --- ROUND-END: Underdog Boost (×3 for last place) --------------
{
  const { totals } = resolveRoundEnd("underdog-boost", {
    totalsBefore: M({ a: 20, b: 3, c: 12 }), // b is last by total
    totalsAfter: M({ a: 24, b: 8, c: 12 }), // deltas 4 / 5 / 0
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Underdog Boost: last-place b's round TRIPLED (3 + 5*3)", totals.get("b") === 18);
  check("Underdog Boost: others unchanged", totals.get("a") === 24 && totals.get("c") === 12);
}

// --- ROUND-END: Point Reversal ---------------------------------
{
  const { totals } = resolveRoundEnd("point-reversal", {
    totalsBefore: M({ a: 0, b: 0, c: 0 }),
    totalsAfter: M({ a: 10, b: 6, c: 1 }), // deltas 10 / 6 / 1
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  // reversed: lowest raw (c) gets 10, b keeps 6, highest raw (a) gets 1
  check("Point Reversal flips rewards", totals.get("c") === 10 && totals.get("b") === 6 && totals.get("a") === 1);
  check("Point Reversal conserves the round pot", sum(totals) === 17);
}

// --- ROUND-END: Kingbreaker -----------------------------------
{
  const { totals } = resolveRoundEnd("kingbreaker", {
    totalsBefore: M({ a: 30, b: 5, c: 9 }), // a is leader
    totalsAfter: M({ a: 33, b: 12, c: 11 }), // round pot = 3 + 7 + 2 = 12
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Kingbreaker: players keep their round points", totals.get("b") === 12 && totals.get("c") === 11);
  check("Kingbreaker: leader a loses the whole pot (33 - 12)", totals.get("a") === 21);
}

// --- ROUND-END: Tax Collector (20% of each rival's ROUND points) --
{
  const { totals, targets } = resolveRoundEnd("tax-collector", {
    totalsBefore: M({ a: 5, b: 5, c: 5 }),
    totalsAfter: M({ a: 25, b: 15, c: 10 }), // a wins; round deltas 20 / 10 / 5
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Tax Collector: collects round(10*20%) + round(5*20%) = 2 + 1 = 3", totals.get("a") === 28);
  check("Tax Collector: b 15 -> 13, c 10 -> 9", totals.get("b") === 13 && totals.get("c") === 9);
  check("Tax Collector: amount reported on the collector target", targets.find((t) => t.tag === "collector")?.amount === 3);
  check("Tax Collector conserves points", sum(totals) === 25 + 15 + 10);
}
{
  // Scale check: 20% stays proportional when a correct answer is worth ~150.
  const { totals } = resolveRoundEnd("tax-collector", {
    totalsBefore: M({ a: 300, b: 300, c: 300 }),
    totalsAfter: M({ a: 600, b: 450, c: 400 }), // deltas 300 / 150 / 100
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Tax Collector scales: 30 + 20 = 50 collected", totals.get("a") === 650);
  check("Tax Collector scales: b 450 -> 420, c 400 -> 380", totals.get("b") === 420 && totals.get("c") === 380);
}

// --- ROUND-END: Half Reset ---------------------------------
{
  const { totals } = resolveRoundEnd("half-reset", {
    totalsBefore: M({ a: 10, b: 40, c: 10 }),
    totalsAfter: M({ a: 18, b: 44, c: 10 }), // c scored least this round (delta 0)
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Half Reset: least-scorer c total halved (10 -> 5)", totals.get("c") === 5);
  check("Half Reset: others keep round points", totals.get("a") === 18 && totals.get("b") === 44);
}

// --- ROUND-END: Rival (45% of the loser's OWN round, not the gap) --
{
  // Rivals performed CLOSE (deltas 100 vs 90 — old "steal the gap" = 10).
  const { totals, targets } = resolveRoundEnd("rival", {
    totalsBefore: M({ a: 20, b: 20 }),
    totalsAfter: M({ a: 120, b: 110 }), // deltas 100 / 90
    presentIds: ["a", "b"],
    rivalPair: ["a", "b"],
    rng: seeded(4),
  });
  const steal = targets.find((t) => t.tag === "rival-win")?.amount;
  check("Rival: steal = round(90 * 45%) = 41, NOT the 10-point gap", steal === 41);
  check("Rival: winner a 120 -> 161", totals.get("a") === 161);
  check("Rival: loser b 110 -> 69", totals.get("b") === 69);
  check("Rival conserves points", sum(totals) === 230);
}
{
  // Loser scored nothing this round -> nothing to take.
  const { totals } = resolveRoundEnd("rival", {
    totalsBefore: M({ a: 5, b: 5 }),
    totalsAfter: M({ a: 15, b: 5 }), // a delta 10, b delta 0
    presentIds: ["a", "b"],
    rivalPair: ["a", "b"],
    rng: seeded(4),
  });
  check("Rival: nothing to steal when loser earned 0", totals.get("a") === 15 && totals.get("b") === 5);
}

// --- ROUND-END: Risk It --------------------------------
{
  const { totals } = resolveRoundEnd("risk-it", {
    totalsBefore: M({ a: 20, b: 20, c: 20, d: 20 }),
    totalsAfter: M({ a: 30, b: 28, c: 22, d: 20 }), // deltas 10/8/2/0
    presentIds: ["a", "b", "c", "d"],
    wagers: { a: 10, d: 10 }, // a did well (top half), d did not
    rng: seeded(4),
  });
  check("Risk It: winner a doubled round + kept stake (20 + 10*2 + 10)", totals.get("a") === 50);
  check("Risk It: loser d lost the wager (20 - 10)", totals.get("d") === 10);
  check("Risk It: non-wagerers untouched", totals.get("b") === 28 && totals.get("c") === 22);
}

// --- ROUND-END: Player Disable (carryOut) -------------
{
  const res = resolveRoundEnd("player-disable", {
    totalsBefore: M({ a: 0, b: 0, c: 0 }),
    totalsAfter: M({ a: 10, b: 4, c: 2 }),
    presentIds: ["a", "b", "c"],
    rng: seeded(4),
  });
  check("Player Disable: round scores itself normally", res.totals.get("a") === 10 && res.totals.get("b") === 4);
  check("Player Disable: carryOut names the round winner as chooser", res.carryOut?.chooserId === "a");
  check("Player Disable: candidates are the other players", JSON.stringify(res.carryOut.candidates.sort()) === JSON.stringify(["b", "c"]));
}
{
  // The disable itself, applied to the following round.
  const nextBefore = M({ a: 10, b: 4, c: 2 });
  const nextAfter = M({ a: 12, b: 12, c: 5 }); // b scored 8 next round
  const out = applyDisable(nextBefore, nextAfter, "b");
  check("applyDisable: target b's next round contribution zeroed (back to 4)", out.get("b") === 4);
  check("applyDisable: others untouched", out.get("a") === 12 && out.get("c") === 5);
}

// --- no negative totals anywhere -----------------------------
{
  const ids = ["a", "b", "c", "d"];
  for (const m of MODIFIERS) {
    if (m.timing !== "roundend") continue;
    const { totals } = resolveRoundEnd(m.id, {
      totalsBefore: M({ a: 1, b: 0, c: 2, d: 0 }),
      totalsAfter: M({ a: 1, b: 0, c: 2, d: 0 }), // nobody scored — stress the clamps
      presentIds: ids,
      wagers: { a: 1 },
      rivalPair: ["a", "b"],
      rng: seeded(11),
    });
    check(`${m.id}: never produces a negative total`, [...totals.values()].every((v) => v >= 0));
  }
}

console.log(`\n${failures === 0 ? "ALL CHAOS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
