// Memory Imposter (v2: look, bluff, vote) selftest.
//   (a) sequences — every type, every length: a repeat, nothing trivial,
//       pure types stay pure, Mixed always has all three kinds
//   (b) difficulty progression + scoring examples
//   (c) round types — the shuffle bag over the selected chips
//   (d) Imposter selection — never twice in a row, CAN repeat later
//   (e) privacy — no role before the look ends; the Imposter's sequence
//       never comes back; Witnesses get theirs back on reload
//   (f) the phase engine — discussion timer / skip, tied vote at 3,
//       disconnects during the look, cancelled + redone rounds
//   (g) integrations — Chaos audit, tournament, settings migration
//   (h) whole games: 3 / 4 / 6 players × chip sets × presets
// Run:  node server/memory-imposter.selftest.mjs   (or npm run test:memory-imposter)

import {
  SEQUENCE_TYPES,
  KINDS,
  PRESETS,
  DIFFICULTY,
  kindOf,
  hasRepeat,
  isTrivial,
  isValidSequence,
  generateSequence,
  progressFor,
  difficultyScore,
  evadePoints,
  nextRoundType,
} from "./games/memorySequence.js";
import * as mi from "./games/memory-imposter.js";
import { MODIFIERS } from "./chaos.js";
import { chaosGameConfig, eligibleModifiers } from "./chaosGames.js";
import { chaosTick } from "./chaosRuntime.js";
import { createTournament, eligibleGameIds, isGameOver, finalStandingsOf } from "./tournament.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);
const json = (x) => JSON.stringify(x);

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P3 = ["a", "b", "c"];
const P4 = ["a", "b", "c", "d"];
const P6 = ["a", "b", "c", "d", "e", "f"];
const T0 = 1_000_000;

// ===================================================================
section("(a) sequences");
{
  const bad = { len: 0, repeat: 0, trivial: 0, pure: 0, mixedKinds: 0, items: 0 };
  let n = 0;
  for (const type of SEQUENCE_TYPES) {
    for (let length = 4; length <= 12; length++) {
      for (let seed = 1; seed <= 300; seed++) {
        const seq = generateSequence(type, length, seeded(seed * 31 + length));
        n++;
        if (seq.length !== length) bad.len++;
        if (!hasRepeat(seq)) bad.repeat++;
        if (isTrivial(seq)) bad.trivial++;
        if (!seq.every((x) => KINDS[kindOf(x)]?.includes(x.slice(2)))) bad.items++;
        if (type !== "mixed" && new Set(seq.map(kindOf)).size !== 1) bad.pure++;
        if (type === "mixed" && new Set(seq.map(kindOf)).size !== 3) bad.mixedKinds++;
      }
    }
  }
  check(`${n} sequences: right length`, bad.len === 0, json(bad));
  check("every item is a real item", bad.items === 0);
  check("every sequence repeats an item (same kind + value)", bad.repeat === 0);
  check("nothing trivially patterned", bad.trivial === 0);
  check("Digits / Colors / Shapes rounds are pure", bad.pure === 0);
  check("every Mixed sequence has all three kinds", bad.mixedKinds === 0);
  check("Digits only use d:, Colors c:, Shapes s:", ["digits", "colors", "shapes"].every((t, i) => generateSequence(t, 8).every((x) => kindOf(x) === "dcs"[i])));
  check("6 colors, 6 shapes, 10 digits", KINDS.c.length === 6 && KINDS.s.length === 6 && KINDS.d.length === 10);

  // Mixed: each position's KIND is uniform (digits don't dominate).
  const counts = { d: 0, c: 0, s: 0 };
  const rng = seeded(99);
  for (let i = 0; i < 4000; i++) for (const x of generateSequence("mixed", 12, rng)) counts[kindOf(x)]++;
  const total = counts.d + counts.c + counts.s;
  check("Mixed: each kind ~1/3 of items", Object.values(counts).every((c) => Math.abs(c / total - 1 / 3) < 0.02), json(counts));

  check("isTrivial: ascending / all same / ABAB", isTrivial(["d:1", "d:2", "d:2", "d:5"]) && isTrivial(["c:blue", "c:blue", "c:blue", "c:blue"]) && isTrivial(["s:star", "s:heart", "s:star", "s:heart"]));
  check("isValidSequence: a mixed one missing a kind fails", !isValidSequence("mixed", ["d:1", "d:1", "c:blue", "d:4"]));
}

// ===================================================================
section("(b) difficulty progression + scoring");
{
  const log = (label, start) => {
    const rows = Array.from({ length: 12 }, (_, r) => progressFor(start, r));
    console.log(`      ${label.padEnd(18)} ${rows.map((p, r) => `R${r + 1}:${p.length}/${p.viewSec}s`).join(" ")}`);
    return rows;
  };
  const checkCurve = (label, start, rows) => {
    const capRound = rows.findIndex((p) => p.length === 12);
    const grows = rows.every((p, r) => p.length === Math.min(12, start.length + r));
    const flat = rows.every((p, r) => r > capRound || p.viewSec === start.viewSec);
    const drops = rows.every((p, r) => r <= capRound || p.viewSec === Math.max(3, start.viewSec - 0.5 * (r - capRound)));
    check(`${label}: +1 item a round to 12, view flat until the first 12-item round, then -0.5s a round`, grows && flat && drops);
  };
  for (const [k, start] of Object.entries(PRESETS)) {
    const rows = log(k, start);
    checkCurve(k, start, rows);
  }
  const easy = Array.from({ length: 12 }, (_, r) => progressFor(PRESETS.easy, r));
  check("Easy: 12 items first in round 9, 9.5s in round 10", easy[8].length === 12 && easy[8].viewSec === 10 && easy[9].viewSec === 9.5);
  const c12 = log("custom 12 / 5s", { length: 12, viewSec: 5 });
  check("start at 12: reductions begin in round 2, floor 3s", c12[0].viewSec === 5 && c12[1].viewSec === 4.5 && c12[4].viewSec === 3 && c12[11].viewSec === 3);
  const c3 = log("custom 4 / 3s", { length: 4, viewSec: 3 });
  check("start at the 3s floor: never below it", c3.every((p) => p.viewSec === 3));
  const long = Array.from({ length: 40 }, (_, r) => progressFor(PRESETS.hard, r));
  check("flat once 12 items + 3s", long.slice(30).every((p) => p.length === 12 && p.viewSec === 3));

  check("score formula", difficultyScore(4, 10) === 3 && difficultyScore(6, 15) === 4 && Math.abs(difficultyScore(12, 3) - 12.4) < 1e-9);
  check("evade: Easy R1 = 3", evadePoints(4, 10) === 3);
  check("evade: Medium R1 = 4", evadePoints(6, 15) === 4);
  check("evade: Hard R1 = 6", evadePoints(8, 15) === 6);
  const m7 = progressFor(PRESETS.medium, 6);
  check("evade: Medium round 7 (12 items, 15s) = 9", m7.length === 12 && m7.viewSec === 15 && evadePoints(12, 15) === 9);
  check("evade: Custom 12 items / 3s = 11", evadePoints(12, 3) === 11);
  check("catch points = 2, constants in one config", DIFFICULTY.catchPoints === 2 && DIFFICULTY.evadeFactor === 0.8);
}

// ===================================================================
section("(c) round types — shuffle bag");
{
  const run = (types, rounds, seed) => {
    const rng = seeded(seed);
    let bag = [];
    let last = null;
    const out = [];
    for (let i = 0; i < rounds; i++) {
      const r = nextRoundType(bag, types, last, rng);
      bag = r.bag;
      last = r.type;
      out.push(r.type);
    }
    return out;
  };
  let bagOk = true;
  let boundaryOk = true;
  let consecutive = 0;
  const combos = [["shapes", "colors"], ["digits", "mixed"], ["digits", "colors", "shapes", "mixed"], ["colors", "shapes", "mixed"]];
  for (const types of combos) {
    for (let seed = 1; seed <= 400; seed++) {
      const seqs = run(types, types.length * 6, seed);
      for (let i = 0; i < seqs.length; i += types.length) {
        const chunk = seqs.slice(i, i + types.length);
        if (new Set(chunk).size !== types.length) bagOk = false; // each once per bag
      }
      for (let i = types.length; i < seqs.length; i += types.length) if (seqs[i] === seqs[i - 1]) boundaryOk = false;
      for (let i = 1; i < seqs.length; i++) if (seqs[i] === seqs[i - 1]) consecutive++;
    }
  }
  check("every selected chip once before any repeats", bagOk);
  check("never the same chip on both sides of a reshuffle", boundaryOk);
  check("so never the same chip twice in a row", consecutive === 0);
  check("a single chip: every round uses it", run(["shapes"], 8, 3).every((t) => t === "shapes"));

  // Shapes + Colors over 6 rounds of a REAL game: each round purely one type.
  const g = mi.createGame(P4, { sequenceTypes: ["shapes", "colors"], difficulty: "easy", rounds: 6 }, seeded(5));
  const types = [];
  const pure = [];
  while (g.phase !== "final") {
    if (g.phase === "memorize") {
      types.push(g.round.type);
      pure.push(new Set(g.round.sequence.map(kindOf)).size === 1 && kindOf(g.round.sequence[0]) === (g.round.type === "shapes" ? "s" : "c"));
    }
    while (g.phase !== "reveal" && g.phase !== "final") mi.forceAdvance(g, P4);
    if (g.phase === "reveal") mi.forceAdvance(g, P4);
  }
  console.log(`      Shapes+Colors, 6 rounds: ${types.join(", ")}`);
  check("Shapes+Colors game: 6 rounds, each purely one type", types.length === 6 && pure.every(Boolean));
  check("...each bag of 2 uses both, never the same on a boundary", [0, 2, 4].every((i) => types[i] !== types[i + 1]) && [2, 4].every((i) => types[i] !== types[i - 1]));
}

// ===================================================================
// Driving helpers.
function playRound(g, present, { votes = "catch" } = {}) {
  // memorize -> roles -> discussion -> vote
  while (g.phase === "memorize" || g.phase === "roles" || g.phase === "discussion") mi.forceAdvance(g, present);
  if (g.phase !== "vote") return;
  const I = g.round.imposterId;
  const W = present.filter((p) => p !== I && g.roster.includes(p) && !g.removed.has(p));
  if (votes === "catch") {
    for (const p of W) mi.submitVote(g, p, I, present);
    mi.submitVote(g, I, W[0], present);
  }
  if (g.phase === "vote") mi.forceAdvance(g, present);
}

section("(d) Imposter selection");
{
  let back2back = 0;
  let repeats = 0;
  let firstCounts = { a: 0, b: 0, c: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const g = mi.createGame(P3, { rounds: 6 }, seeded(seed));
    firstCounts[g.round.imposterId]++;
    const imps = [];
    while (g.phase !== "final") {
      imps.push(g.round.imposterId);
      playRound(g, P3);
      mi.forceAdvance(g, P3);
    }
    for (let i = 1; i < imps.length; i++) if (imps[i] === imps[i - 1]) back2back++;
    if (new Set(imps).size < imps.length) repeats++;
  }
  check("300 games of 6 rounds at 3 players: never the same Imposter twice in a row", back2back === 0);
  check("...but players DO repeat later (no everyone-once cycle)", repeats === 300);
  check("round 1 is uniform over all players", Object.values(firstCounts).every((c) => c > 70), json(firstCounts));
  const g = mi.createGame(P6, { rounds: 8 }, seeded(77));
  const imps = [];
  while (g.phase !== "final") {
    imps.push(g.round.imposterId);
    playRound(g, P6);
    mi.forceAdvance(g, P6);
  }
  console.log(`      6 players, 8 rounds: ${imps.join(" ")}`);
  check("6-player game: no back-to-back Imposter", imps.every((p, i) => i === 0 || p !== imps[i - 1]));
}

// ===================================================================
section("(e) privacy");
{
  const g = mi.createGame(P4, { difficulty: "medium" }, seeded(8));
  const t = Date.now();
  const I = g.round.imposterId;
  const seq = json(g.round.sequence);
  const payloads = P4.map((p) => mi.getPrivateState(g, p, t));
  check("memorize: every private payload is identical (no role, same shape)", payloads.every((x) => json(x) === json(payloads[0])), json(payloads[0]));
  check("memorize: it carries the sequence", json(payloads[0].memoryImposter.sequence) === seq);
  check("memorize: no role anywhere", !json(payloads).includes("role") && !json(payloads).includes("imposter"));
  const pub = json(mi.getPublicState(g, P4, t));
  check("memorize: public has no sequence, no Imposter", !pub.includes(seq) && !pub.includes('"imposterId"') && !pub.includes('"role"'));

  mi.tick(g, P4, g.deadline + 1); // look over -> roles
  check("-> roles", g.phase === "roles");
  const pi = mi.getPrivateState(g, I).memoryImposter;
  check("roles: Imposter told, no sequence", pi.role === "imposter" && pi.sequence === undefined && !json(pi).includes(seq));
  const W = P4.find((p) => p !== I);
  check("roles: Witness keeps the sequence", mi.getPrivateState(g, W).memoryImposter.role === "witness" && json(mi.getPrivateState(g, W).memoryImposter.sequence) === seq);
  // A reload = the same getPrivateState call; walk every later phase.
  let leaks = 0;
  let witnessOk = true;
  while (g.phase !== "reveal") {
    if (json(mi.getPrivateState(g, I)).includes(seq)) leaks++;
    if (json(mi.getPublicState(g, P4)).includes(seq) || json(mi.getPublicState(g, P4)).includes('"imposterId"')) leaks++;
    if (json(mi.getPrivateState(g, W).memoryImposter.sequence) !== seq) witnessOk = false;
    mi.forceAdvance(g, P4);
  }
  check("roles → vote: the Imposter (and the public) never get the sequence", leaks === 0);
  check("roles → vote: a Witness reload always gets it back", witnessOk);
  check("reveal: sequence + Imposter public now", json(mi.getPublicState(g, P4).result.sequence) === seq && mi.getPublicState(g, P4).result.imposterId === I);
  check("reveal / final: no private payload", mi.getPrivateState(g, I) === null);
}

// ===================================================================
section("(f) phase engine");
{
  // Discussion runs to its timer; the host can skip it.
  const g = mi.createGame(P4, { discussionSec: 90 }, seeded(10));
  mi.tick(g, P4, g.deadline);
  mi.tick(g, P4, g.deadline);
  check("discussion: host's time (90s default)", g.phase === "discussion" && g.windowMs === 90_000);
  mi.tick(g, P4, g.deadline - 1);
  check("discussion: still running before its timer", g.phase === "discussion");
  mi.tick(g, P4, g.deadline);
  check("discussion: timer ends -> vote (20s)", g.phase === "vote" && g.windowMs === 20_000);
  const g2 = mi.createGame(P4, {}, seeded(11));
  mi.forceAdvance(g2, P4);
  mi.forceAdvance(g2, P4);
  check("skip: only during discussion", mi.skipDiscussion(g2).ok && g2.phase === "vote" && !mi.skipDiscussion(g2).ok);

  // Votes.
  const v = mi.createGame(P3, {}, seeded(12));
  while (v.phase !== "vote") mi.forceAdvance(v, P3);
  check("can't vote for yourself", !mi.submitVote(v, "a", "a", P3).ok);
  mi.submitVote(v, "a", "b", P3);
  mi.submitVote(v, "b", "c", P3);
  check("vote stays open until everyone's in", v.phase === "vote");
  check("voted indicator, no picks public", json(mi.getPublicState(v, P3).votedIds) === json(["a", "b"]) && !json(mi.getPublicState(v, P3)).includes('"votes"'));
  mi.submitVote(v, "c", "a", P3);
  const vr = v.round.result;
  const evade = evadePoints(v.round.length, v.round.viewSec);
  check("tied vote at 3 players: nobody out, Imposter evades", vr.tie && vr.eliminatedId === null && !vr.caught);
  check(`...Imposter +${evade}, everyone else 0`, vr.points[vr.imposterId] === evade && P3.filter((p) => p !== vr.imposterId).every((p) => vr.points[p] === 0), json(vr.points));
  check("reveal shows type + difficulty", vr.type && vr.length === 4 && vr.viewSec === 10 && vr.difficultyScore === 3);

  const c = mi.createGame(P4, {}, seeded(13));
  playRound(c, P4, { votes: "catch" });
  const cr = c.round.result;
  check("caught: voters for the Imposter +2, Imposter 0", cr.caught && cr.points[cr.imposterId] === 0 && P4.filter((p) => p !== cr.imposterId).every((p) => cr.points[p] === 2), json(cr.points));
  const w = mi.createGame(P4, {}, seeded(14));
  while (w.phase !== "vote") mi.forceAdvance(w, P4);
  const I = w.round.imposterId;
  const Ws = P4.filter((p) => p !== I);
  mi.submitVote(w, Ws[0], I, P4);
  mi.submitVote(w, Ws[1], I, P4);
  mi.submitVote(w, Ws[2], Ws[0], P4);
  mi.submitVote(w, I, Ws[1], P4);
  check("caught: a Witness who voted elsewhere gets 0", w.round.result.caught && w.round.result.points[Ws[2]] === 0 && w.round.result.points[Ws[0]] === 2);

  // A drop during the look pauses it for EVERYONE (no role leak), then:
  //   back in time -> resume with the time left
  const h = mi.createGame(P4, {}, seeded(15));
  const hi = h.round.imposterId;
  const away = P4.filter((p) => p !== hi);
  const t0 = h.deadline - 4000; // 6s into a 10s look
  mi.tick(h, P4, t0);
  mi.tick(h, away, t0);
  check("Imposter drops during the look -> held", h.round.hold?.playerId === hi && h.phase === "memorize");
  check("held: nobody gets the sequence", P4.every((p) => !mi.getPrivateState(h, p, t0 + 10).memoryImposter.sequence));
  check("held: no role leaks either", !json(P4.map((p) => mi.getPrivateState(h, p, t0 + 10))).includes("role"));
  mi.tick(h, P4, t0 + 30_000);
  check("back -> resumes with the 4s that were left", !h.round.hold && h.deadline === t0 + 30_000 + 4000);
  // A Witness dropping holds too (so the hold names nobody's role).
  const wh = mi.createGame(P4, {}, seeded(16));
  const wi = wh.round.imposterId;
  const wDrop = P4.find((p) => p !== wi);
  mi.reconcilePresence(wh, P4.filter((p) => p !== wDrop), { final: false });
  check("a Witness dropping during the look holds it too", wh.round.hold?.playerId === wDrop);
  mi.reconcilePresence(wh, P4.filter((p) => p !== wDrop), { final: true });
  check("...gone for good -> the look resumes without them, same round", !wh.round.hold && wh.phase === "memorize" && wh.roundSerial === 1);

  //   gone for good -> cancelled, redone: same type/length/view, new Imposter + sequence
  const x = mi.createGame(P4, { sequenceTypes: ["colors", "shapes"], difficulty: "hard", rounds: 4 }, seeded(17));
  playRound(x, P4);
  mi.forceAdvance(x, P4); // round 2
  const prevImp = x.history.at(-1).imposterId;
  const before = { type: x.round.type, length: x.round.length, viewSec: x.round.viewSec, seq: json(x.round.sequence), imp: x.round.imposterId, scores: json([...x.scores]) };
  const left = P4.filter((p) => p !== before.imp);
  mi.reconcilePresence(x, left, { final: false });
  mi.reconcilePresence(x, left, { final: true });
  check("Imposter gone for good -> redo of the SAME round", x.phase === "memorize" && x.roundIndex === 1 && x.roundSerial === 3 && x.lastEvent?.type === "cancelled");
  check("redo keeps type, length and view time", x.round.type === before.type && x.round.length === before.length && x.round.viewSec === before.viewSec, `${before.type}/${before.length}/${before.viewSec}`);
  check("redo: new Imposter from the players left (not last round's either)", x.round.imposterId !== before.imp && left.includes(x.round.imposterId) && (x.round.imposterId !== prevImp || left.filter((p) => p !== prevImp).length === 0));
  check("redo: no points changed", json([...x.scores].filter(([p]) => p !== before.imp)) === json(JSON.parse(before.scores).filter(([p]) => p !== before.imp)));
  check("redo: a fresh sequence", json(x.round.sequence) !== before.seq);
  // Host force-proceed past a look held for the Imposter = the same redo.
  const f = mi.createGame(P4, {}, seeded(18));
  const fi = f.round.imposterId;
  mi.reconcilePresence(f, P4.filter((p) => p !== fi), { final: false });
  mi.forceAdvance(f, P4.filter((p) => p !== fi));
  check("force proceed while held for the Imposter -> redo", f.phase === "memorize" && f.round.imposterId !== fi && f.roundSerial === 2);
  // At 3 players, losing one ends the game (below the minimum).
  const e = mi.createGame(P3, {}, seeded(19));
  mi.reconcilePresence(e, ["a", "b"], { final: true });
  check("3 players -> 2: game ends", e.phase === "final");
  // A Witness leaving drops out of the vote.
  const r = mi.createGame(P6, {}, seeded(20));
  while (r.phase !== "vote") mi.forceAdvance(r, P6);
  const ri = r.round.imposterId;
  const rw = P6.filter((p) => p !== ri);
  mi.submitVote(r, rw[0], rw[1], P6);
  const pres = P6.filter((p) => p !== rw[1]);
  mi.reconcilePresence(r, pres, { final: true });
  check("leaver: votes for them void, they can't be voted for", !r.round.votes.has(rw[0]) && !mi.submitVote(r, rw[0], rw[1], pres).ok && !mi.getPublicState(r, pres).participantIds.includes(rw[1]));
}

// ===================================================================
section("(g) integrations");
{
  const cfg = chaosGameConfig("memory-imposter");
  check("Chaos: rolls at memorize, settles at reveal", cfg.rollPhases.join() === "memorize" && cfg.scoredPhases.includes("reveal"));
  const pool3 = eligibleModifiers("memory-imposter", MODIFIERS, { playerCount: 3, roundsLeft: 2, game: mi.createGame(P3, {}) }).map((m) => m.id);
  const pool6 = eligibleModifiers("memory-imposter", MODIFIERS, { playerCount: 6, roundsLeft: 2, game: mi.createGame(P6, {}) }).map((m) => m.id);
  console.log(`      pool at 3: ${pool3.join(", ")}`);
  console.log(`      pool at 6: ${pool6.join(", ")}`);
  const out3 = ["rival", "score-swap", "steal", "tax-collector", "the-tyrant", "risk-it", "point-reversal", "all-or-nothing"];
  check("Chaos at 3: Rival, Score Swap, Steal, Tax Collector, The Tyrant (+ Risk It, Point Reversal, All or Nothing) excluded", out3.every((id) => !pool3.includes(id)));
  check("Chaos at 6: Rival / Score Swap / Steal / Risk It back in", ["rival", "score-swap", "steal", "risk-it"].every((id) => pool6.includes(id)));

  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "speed-round";
  const g = mi.createGame(P4, { difficulty: "medium" }, seeded(21));
  const room = { code: "T", status: "in-game", chaosFrequency: "low", chaos: null, chaosCarry: null, game: g };
  const look = g.round.viewMs;
  chaosTick(room, { connectedPlayerIds: () => P4 });
  check("Chaos: the look waits out the takeover (no sequence under the overlay)", g.round.lookStartsAt > Date.now() && !mi.getPrivateState(g, "a").memoryImposter.sequence);
  check("Chaos: the look itself isn't shortened", g.deadline - g.round.lookStartsAt === look);
  mi.forceAdvance(g, P4);
  mi.forceAdvance(g, P4);
  check("Speed Round: 20s discussion", g.phase === "discussion" && g.windowMs === 20_000);
  mi.forceAdvance(g, P4);
  check("Speed Round: 10s vote", g.windowMs === 10_000);

  process.env.CHAOS_FORCE_MODIFIER = "double-points";
  const g2 = mi.createGame(P4, {}, seeded(22));
  const room2 = { code: "T", status: "in-game", chaosFrequency: "low", chaos: null, chaosCarry: null, game: g2 };
  chaosTick(room2, { connectedPlayerIds: () => P4 });
  playRound(g2, P4, { votes: "catch" });
  chaosTick(room2, { connectedPlayerIds: () => P4 });
  const I2 = g2.round.imposterId;
  check("Chaos: Double Points doubles a caught round (2 -> 4)", P4.filter((p) => p !== I2).every((p) => g2.scores.get(p) === 4), json([...g2.scores]));
  delete process.env.CHAOS_FORCE;
  delete process.env.CHAOS_FORCE_MODIFIER;

  const manual = createTournament({ mode: "manual", lineup: ["memory-imposter", "taboo"], lineupSettings: [{ sequenceTypes: ["shapes"], difficulty: "hard", rounds: 2 }, {}] }, P3);
  check("tournament: manual lineup at 3 players, with settings", manual.lineupSettings[0].sequenceTypes[0] === "shapes");
  let err = "";
  try { createTournament({ mode: "manual", lineup: ["memory-imposter", "taboo"] }, ["a", "b"]); } catch (e) { err = e.message; }
  check("tournament: refused at 2 players", /at least 3/.test(err), err);
  check("tournament: on the wheel at 3, not at 2", eligibleGameIds(3).includes("memory-imposter") && !eligibleGameIds(2).includes("memory-imposter"));
  const tg = mi.createGame(P3, { ...mi.tournamentOptions(P3), ...manual.lineupSettings[0] });
  check("tournament: slot settings reach the game", tg.settings.sequenceTypes.join() === "shapes" && tg.round.length === 8 && tg.totalRounds === 2);
  while (tg.phase !== "final") mi.forceAdvance(tg, P3);
  check("tournament: force proceed reaches final; standings from scores", isGameOver(mi, tg) && finalStandingsOf(mi, tg, P3).length === 3);

  // Settings: defaults, limits, v1 migration.
  const d = mi.resolveSettings({}, 5);
  check("defaults: Digits only, Easy, rounds = players, 90s", d.sequenceTypes.join() === "digits" && d.difficulty === "easy" && d.rounds === 5 && d.discussionMs === 90_000);
  check("rounds max = 2 × players", mi.resolveSettings({ rounds: 99 }, 4).rounds === 8);
  check("discussion 30–240 in 15s steps", mi.resolveSettings({ discussionSec: 10 }).discussionMs === 30_000 && mi.resolveSettings({ discussionSec: 999 }).discussionMs === 240_000 && mi.resolveSettings({ discussionSec: 98 }).discussionMs === 105_000);
  const custom = mi.resolveSettings({ difficulty: "custom", customLength: 40, customViewSec: 1 });
  check("custom clamps: 4–12 items, 3–20s", custom.start.length === 12 && custom.start.viewSec === 3);
  const v1 = mi.resolveSettings({ sequenceType: "emoji", difficulty: "medium", questions: 6, answerSec: 9, statements: false, discussionSec: 60 });
  check("v1 settings migrate: Emoji -> Shapes, removed options ignored", v1.sequenceTypes.join() === "shapes" && v1.start.length === 6 && v1.discussionMs === 60_000 && !("questionCount" in v1));
  check("v1 Digits / Colors / Mixed map to their chips", ["digits", "colors", "mixed"].every((t) => mi.resolveSettings({ sequenceType: t }).sequenceTypes.join() === t));
  check("an empty / junk chip list falls back to Digits", mi.resolveSettings({ sequenceTypes: ["emoji", "nope"] }).sequenceTypes.join() === "digits");
  check("min 3 / max 10 enforced", (() => {
    try { mi.createGame(["a", "b"], {}); return false; } catch { /* expected */ }
    try { mi.createGame(Array.from({ length: 11 }, (_, i) => `p${i}`), {}); return false; } catch { /* expected */ }
    return true;
  })());
}

// ===================================================================
section("(h) whole games — players × chip sets × presets");
{
  const chipSets = [["digits"], ["colors"], ["shapes"], ["mixed"], ["shapes", "colors"], ["digits", "mixed"], ["digits", "colors", "shapes", "mixed"]];
  const presets = ["easy", "medium", "hard"];
  let games = 0;
  const problems = [];
  for (const players of [P3, P4, P6]) {
    for (const chips of chipSets) {
      for (const difficulty of presets) {
        const rounds = players.length * 2;
        const g = mi.createGame(players, { sequenceTypes: chips, difficulty, rounds }, seeded(games + 1));
        games++;
        let r = 0;
        let prevImp = null;
        let prevType = null;
        while (g.phase !== "final" && r < 40) {
          const round = g.round;
          const exp = progressFor(PRESETS[difficulty], g.roundIndex);
          if (round.length !== exp.length || round.viewSec !== exp.viewSec) problems.push(`len/view ${chips}/${difficulty} r${g.roundIndex}`);
          if (!chips.includes(round.type)) problems.push(`type ${round.type} not in ${chips}`);
          if (!isValidSequence(round.type, round.sequence)) problems.push(`bad seq ${round.type}`);
          if (round.imposterId === prevImp) problems.push("back-to-back imposter");
          if (chips.length > 1 && round.type === prevType) problems.push(`same type twice ${chips}`);
          prevImp = round.imposterId;
          prevType = round.type;
          // Alternate outcomes: evade (tie / nobody) and caught.
          playRound(g, players, { votes: r % 2 ? "catch" : "none" });
          mi.forceAdvance(g, players);
          r++;
        }
        if (g.phase !== "final" || r !== rounds) problems.push(`didn't finish ${chips}/${difficulty}/${players.length}: ${r}`);
        const pub = mi.getPublicState(g, players);
        if (pub.scores.length !== players.length || !pub.winnerIds.length) problems.push("no standings");
      }
    }
  }
  check(`${games} full games (3/4/6 players × 7 chip sets × 3 presets) play clean`, problems.length === 0, problems.slice(0, 5).join("; "));
}

console.log(failures === 0 ? "\nALL MEMORY IMPOSTER CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
