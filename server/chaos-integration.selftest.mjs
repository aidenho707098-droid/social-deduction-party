// End-to-end Chaos integration check: drives a REAL game module (Crack the
// Code / emoji-movie) through several rounds with the REAL chaosTick glue,
// forcing specific modifiers, and asserts game.scores after each settle.
// This is the check the "multiplier sometimes doesn't apply" / "Risk It
// doesn't work" reports need — the pure-core selftest can't catch a
// round-boundary or snapshot-timing bug.
//
//   node server/chaos-integration.selftest.mjs

import * as emoji from "./games/emoji-movie.js";
import { chaosTick, recordWager } from "./chaosRuntime.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const IDS = ["a", "b", "c"];

function makeRoom({ present = IDS } = {}) {
  const game = emoji.createGame(IDS, {
    rounds: 6,
    difficulty: "mixed",
    categories: ["movies"],
  });
  const room = {
    code: "TEST",
    status: "in-game",
    chaosFrequency: "maximum",
    chaos: null,
    chaosCarry: null,
    game,
  };
  const deps = { connectedPlayerIds: () => present };
  return { room, game, deps };
}

// Solve the current round for a chosen subset, then reveal. Returns the
// raw (pre-chaos) per-player round deltas the game itself scored.
function playRound(game, present, solvers) {
  const before = new Map(game.scores);
  const title = game.entries[game.roundIndex].title;
  for (const pid of solvers) emoji.submitAnswer(game, pid, title, present);
  if (game.phase === "guess") emoji.revealRound(game, present);
  const raw = new Map();
  for (const pid of IDS) raw.set(pid, (game.scores.get(pid) ?? 0) - (before.get(pid) ?? 0));
  return raw;
}

function advance(game) {
  emoji.nextRound(game);
}

// ============================================================
// 1. Double Points applies on EVERY round, back-to-back (MAXIMUM)
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "double-points";
  const { room, game, deps } = makeRoom();

  let allDoubled = true;
  const detail = [];
  for (let r = 0; r < 4; r++) {
    // roll at the top of the scoring round
    chaosTick(room, deps);
    if (room.chaos?.modifier?.id !== "double-points") {
      allDoubled = false;
      detail.push(`round ${r}: modifier=${room.chaos?.modifier?.id ?? "none"}`);
    }
    const totalBefore = new Map(game.scores);
    // Solvers rotate so the raw deltas differ round to round.
    const solvers = r === 0 ? ["a"] : r === 1 ? ["a", "b"] : r === 2 ? ["b", "c"] : ["a", "b", "c"];
    const rawSolve = playRound(game, IDS, solvers);
    // settle
    chaosTick(room, deps);
    for (const pid of IDS) {
      const applied = (game.scores.get(pid) ?? 0) - (totalBefore.get(pid) ?? 0);
      const raw = rawSolve.get(pid) ?? 0;
      if (applied !== raw * 2) {
        allDoubled = false;
        detail.push(`round ${r} ${pid}: raw=${raw} applied=${applied} (want ${raw * 2})`);
      }
    }
    if (r < 3) advance(game);
  }
  check("Double Points doubles every round back-to-back at MAXIMUM", allDoubled, detail.join("; "));
  check(
    "public result carries multiplier:2 for the badge",
    room.chaos?.result?.multiplier === 2
  );
}

// ============================================================
// 2. Triple / Quadruple
// ============================================================
for (const [modId, mult] of [
  ["triple-points", 3],
  ["quad-points", 4],
]) {
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = modId;
  const { room, game, deps } = makeRoom();
  chaosTick(room, deps);
  const before = new Map(game.scores);
  const raw = playRound(game, IDS, ["a", "b"]);
  chaosTick(room, deps);
  let ok = room.chaos?.modifier?.id === modId && room.chaos?.result?.multiplier === mult;
  for (const pid of IDS) {
    const applied = (game.scores.get(pid) ?? 0) - (before.get(pid) ?? 0);
    if (applied !== (raw.get(pid) ?? 0) * mult) ok = false;
  }
  check(`${modId} multiplies round points ×${mult}`, ok);
}

// ============================================================
// 3. A disconnected player still gets the multiplier applied
//    (mobile screen-lock drops the socket mid-round)
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "double-points";
  let present = [...IDS];
  const game = emoji.createGame(IDS, { rounds: 4, difficulty: "mixed", categories: ["movies"] });
  const room = { code: "T", status: "in-game", chaosFrequency: "maximum", chaos: null, chaosCarry: null, game };
  const deps = { connectedPlayerIds: () => present };

  chaosTick(room, deps); // roll — everyone present
  const before = new Map(game.scores);
  const title = game.entries[game.roundIndex].title;
  emoji.submitAnswer(game, "a", title, present);
  emoji.submitAnswer(game, "c", title, present);
  // 'c' backgrounds their phone right before the reveal broadcast.
  present = ["a", "b"];
  emoji.revealRound(game, IDS); // game still scores everyone who answered
  const rawC = (game.scores.get("c") ?? 0) - (before.get("c") ?? 0);
  chaosTick(room, deps); // settle — 'c' is not in connectedPlayerIds
  const appliedC = (game.scores.get("c") ?? 0) - (before.get("c") ?? 0);
  check(
    "disconnected mid-round player still gets points doubled",
    rawC > 0 && appliedC === rawC * 2,
    `raw=${rawC} applied=${appliedC}`
  );
}

// ============================================================
// 4. Risk It — wager doubles on a good round, is lost on a bad one
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "risk-it";
  const { room, game, deps } = makeRoom();

  // Give everyone a starting bank so there's something to wager.
  game.scores = new Map([["a", 10], ["b", 10], ["c", 10]]);

  chaosTick(room, deps); // roll risk-it
  check("Risk It rolled", room.chaos?.modifier?.id === "risk-it");
  check("wager window open in public slice", room.chaos && room.chaos.settled === false);

  const wa = recordWager(room, "a");
  const wc = recordWager(room, "c");
  check("a wagers half of 10 = 5", wa.ok && wa.amount === 5);
  check("c wagers 5", wc.ok && wc.amount === 5);

  // a solves (good round → top half), c does not (bad round → bottom half).
  const before = new Map(game.scores);
  const raw = playRound(game, IDS, ["a"]);
  chaosTick(room, deps); // settle

  const aApplied = (game.scores.get("a") ?? 0) - (before.get("a") ?? 0);
  const cApplied = (game.scores.get("c") ?? 0) - (before.get("c") ?? 0);
  check(
    "winner's wager: round points doubled + stake kept",
    aApplied === (raw.get("a") ?? 0) * 2 + 5,
    `raw=${raw.get("a")} applied=${aApplied}`
  );
  check("loser's wager: stake deducted from total", cApplied === -5, `applied=${cApplied}`);
  const t = room.chaos.result?.targets ?? [];
  check(
    "result names who cashed / busted",
    t.some((x) => x.playerId === "a" && x.tag === "cashed") &&
      t.some((x) => x.playerId === "c" && x.tag === "busted")
  );
}

// ============================================================
// 5. Risk It with a wager but ZERO score — server refuses, no crash
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "risk-it";
  const { room, game, deps } = makeRoom(); // scores all 0
  chaosTick(room, deps);
  const w = recordWager(room, "a");
  check("Risk It with 0 points: wager refused cleanly", !!w.error);
  const before = new Map(game.scores);
  const raw = playRound(game, IDS, ["a", "b"]);
  chaosTick(room, deps);
  let ok = true;
  for (const pid of IDS) {
    const applied = (game.scores.get(pid) ?? 0) - (before.get(pid) ?? 0);
    if (applied !== (raw.get(pid) ?? 0)) ok = false; // no wagers → raw points stand
  }
  check("Risk It with no valid wagers leaves scoring untouched", ok);
}

// ============================================================
// 6. Multiplier + a player who scored 0 that round (no phantom points)
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "quad-points";
  const { room, game, deps } = makeRoom();
  chaosTick(room, deps);
  const before = new Map(game.scores);
  const raw = playRound(game, IDS, ["a"]); // only a scores
  chaosTick(room, deps);
  const bApplied = (game.scores.get("b") ?? 0) - (before.get("b") ?? 0);
  const cApplied = (game.scores.get("c") ?? 0) - (before.get("c") ?? 0);
  check("non-scorers stay at 0 under a multiplier", bApplied === 0 && cApplied === 0);
  check("the one scorer is quadrupled", (game.scores.get("a") ?? 0) - (before.get("a") ?? 0) === (raw.get("a") ?? 0) * 4);
}

// ============================================================
// 7. Steal — % of first place's ACTUAL round haul, resolved at round end,
//    with the principal named up front for the takeover.
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "steal";
  const { room, game, deps } = makeRoom();

  // Round 1: everyone tied at 0, so Steal no-ops. 'a' and 'b' solve (a first,
  // so a leads on total); 'c' never scores, so c is uniquely last.
  chaosTick(room, deps);
  playRound(game, IDS, ["a", "b"]);
  // nudge so a is strictly ahead of b on total (equal instant guesses tie)
  game.scores.set("a", (game.scores.get("a") ?? 0) + 1);
  chaosTick(room, deps);
  advance(game);

  // Round 2: Steal fires for real. a = total leader, c = total trailer.
  chaosTick(room, deps);
  check(
    "Steal names the principal on announcement (before the round scores)",
    room.chaos?.result?.targets?.find((t) => t.tag === "mark")?.playerId === "a" &&
      room.chaos?.result?.targets?.find((t) => t.tag === "thief")?.playerId === "c"
  );
  const beforeA = game.scores.get("a") ?? 0;
  const beforeC = game.scores.get("c") ?? 0;
  const raw = playRound(game, IDS, ["a", "b"]); // a earns the biggest haul
  chaosTick(room, deps); // settle

  const skim = Math.round((raw.get("a") ?? 0) * 0.4);
  check("Steal: skim is 40% of a's ACTUAL round haul", skim > 0);
  check(
    "Steal: first place a loses exactly the skim",
    (game.scores.get("a") ?? 0) === beforeA + (raw.get("a") ?? 0) - skim
  );
  check(
    "Steal: last place c gains exactly the skim",
    (game.scores.get("c") ?? 0) === beforeC + (raw.get("c") ?? 0) + skim
  );
  check("Steal: resolved result carries the amount", room.chaos.result.targets.find((t) => t.tag === "thief")?.amount === skim);
}

// ============================================================
// 8. Tax Collector — 20% of every other player's round points, scales with
//    the game's real magnitude (Crack the Code speed points are 100s).
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "tax-collector";
  const { room, game, deps } = makeRoom();

  chaosTick(room, deps);
  const before = new Map(game.scores);
  const raw = playRound(game, IDS, ["a", "b", "c"]); // everyone scores real points
  chaosTick(room, deps);

  // Read the ACTUAL round winner the runtime picked (instant test guesses can
  // tie, so the winner is chosen among the tied top by rng).
  const tgts = room.chaos.result.targets;
  const winner = tgts.find((t) => t.tag === "collector").playerId;
  const collected = tgts.find((t) => t.tag === "collector").amount;
  let expectedCollected = 0;
  for (const pid of IDS) {
    if (pid === winner) continue;
    expectedCollected += Math.round((raw.get(pid) ?? 0) * 0.2);
  }
  check("Tax Collector: collected = sum of 20%-of-round bites", collected === expectedCollected);
  check("Tax Collector: a meaningful, scaled amount is collected (>5, not a flat 1)", collected > 5);
  check(
    "Tax Collector: winner total = base + own round + collected",
    (game.scores.get(winner) ?? 0) ===
      (before.get(winner) ?? 0) + (raw.get(winner) ?? 0) + collected
  );
  for (const pid of IDS) {
    if (pid === winner) continue;
    const tax = Math.round((raw.get(pid) ?? 0) * 0.2);
    check(
      `Tax Collector: ${pid} paid 20% of their round (${tax})`,
      (game.scores.get(pid) ?? 0) === (before.get(pid) ?? 0) + (raw.get(pid) ?? 0) - tax
    );
  }
}

// ============================================================
// 9. The Tyrant — points leader takes 20% of every other player's round.
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "the-tyrant";
  const { room, game, deps } = makeRoom();

  // Round 1: give 'a' a lead so a is the points leader for round 2.
  chaosTick(room, deps);
  playRound(game, IDS, ["a"]);
  chaosTick(room, deps);
  advance(game);

  chaosTick(room, deps);
  check("Tyrant names the leader up front", room.chaos?.result?.targets?.[0]?.tag === "tyrant" && room.chaos.result.targets[0].playerId === "a");
  const beforeA = game.scores.get("a") ?? 0;
  const beforeB = game.scores.get("b") ?? 0;
  const raw = playRound(game, IDS, ["b", "c"]); // rivals score, leader doesn't
  chaosTick(room, deps);

  const biteB = Math.round((raw.get("b") ?? 0) * 0.2);
  const biteC = Math.round((raw.get("c") ?? 0) * 0.2);
  const seized = biteB + biteC;
  check("Tyrant: seizes 20% of each rival's round haul", seized > 0);
  check("Tyrant: leader a gains the seized total", (game.scores.get("a") ?? 0) === beforeA + seized);
  check(
    "Tyrant: rival b keeps 80% of their round",
    (game.scores.get("b") ?? 0) === beforeB + (raw.get("b") ?? 0) - biteB
  );
}

// ============================================================
// 10. Rival — winner rips 45% of the LOSER's round haul (not the gap),
//     so it lands hard even when the two performed alike.
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "rival";
  const { room, game, deps } = makeRoom();

  chaosTick(room, deps); // rolls rival + picks the pair up front
  const pair = room.chaos.rivalPair;
  check("Rival: a pair is chosen at announcement", Array.isArray(pair) && pair.length === 2);
  const [p, q] = pair;
  const outsider = IDS.find((id) => id !== p && id !== q);

  const before = new Map(game.scores);
  // Both rivals solve (close performance); the outsider solves too.
  const raw = playRound(game, IDS, [p, q, outsider]);
  chaosTick(room, deps);

  const hi = (raw.get(p) ?? 0) >= (raw.get(q) ?? 0) ? p : q;
  const lo = hi === p ? q : p;
  const steal = Math.round((raw.get(lo) ?? 0) * 0.45);
  check("Rival: steal is 45% of the loser's OWN round haul", steal > 0);
  check(
    "Rival: winner total = base + own round + steal",
    (game.scores.get(hi) ?? 0) === (before.get(hi) ?? 0) + (raw.get(hi) ?? 0) + steal
  );
  check(
    "Rival: loser total = base + own round − steal",
    (game.scores.get(lo) ?? 0) === (before.get(lo) ?? 0) + (raw.get(lo) ?? 0) - steal
  );
  check(
    "Rival: the outsider is untouched",
    (game.scores.get(outsider) ?? 0) === (before.get(outsider) ?? 0) + (raw.get(outsider) ?? 0)
  );
}

// ============================================================
// 11. Underdog Boost — last place's round points ×3 (was ×2).
// ============================================================
{
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "underdog-boost";
  const { room, game, deps } = makeRoom();

  // Round 1: 'a' and 'b' score so 'c' is uniquely last on total.
  chaosTick(room, deps);
  playRound(game, IDS, ["a", "b"]);
  chaosTick(room, deps);
  advance(game);

  chaosTick(room, deps);
  const beforeC = game.scores.get("c") ?? 0;
  const raw = playRound(game, IDS, ["a", "b", "c"]); // everyone scores
  chaosTick(room, deps);

  check(
    "Underdog Boost: last place c's round ×3",
    (game.scores.get("c") ?? 0) === beforeC + (raw.get("c") ?? 0) * 3
  );
  check("Underdog Boost: it was NOT ×2", (raw.get("c") ?? 0) > 0 && (game.scores.get("c") ?? 0) !== beforeC + (raw.get("c") ?? 0) * 2);
}

delete process.env.CHAOS_FORCE;
delete process.env.CHAOS_FORCE_MODIFIER;

console.log(`\n${failures === 0 ? "ALL CHAOS INTEGRATION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
