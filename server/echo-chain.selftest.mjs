// Echo Chain selftest.
//   (a) the sequence + turn engine
//   (b) taps and timers (latency grace)
//   (c) misses, the replay and elimination (incl. disconnects)
//   (d) rounds and scoring (the 3-player example), early end, tournament
//   (e) privacy + a 60-tile chain
//   (f) integrations + simulated games
// Run:  node server/echo-chain.selftest.mjs   (or npm run test:echo-chain)

import * as ec from "./games/echo-chain.js";
import { REPLAY, TIMERS, BEATS, replayIntervalMs, replayFlashMs, replayDurationMs, pointsFor } from "./games/echoChainRules.js";
import { activePlayers, nextActiveAfter } from "./games/turnCycle.js";
import { GAMES } from "./games/registry.js";
import { CATALOG, FILTERS } from "../client/src/games/catalog.js";
import { isChaosEligible } from "./chaosGames.js";
import { tournamentOptionsFor, finalStandingsOf, isGameOver, toTournamentPoints } from "./tournament.js";
import { fitError } from "./games/playerLimits.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);

const T0 = 1_000_000;
// A game with a FIXED order (the real one is shuffled), past its countdown.
function started(players, options = {}, { order = players, seq = [] } = {}) {
  const g = ec.createGame(players, options, T0);
  g.cycle = [...order];
  g.seq = [...seq];
  ec.tick(g, players, T0 + BEATS.countdownMs);
  return { g, t: T0 + BEATS.countdownMs };
}
// Echo the whole chain correctly, then add `tile`. Returns the time after.
function playTurn(g, present, t, tile = 0, step = 300) {
  const me = g.activeId;
  for (const x of [...g.seq]) {
    t += step;
    const r = ec.tap(g, me, x, present, { now: t });
    if (!r.ok || !r.correct) throw new Error(`echo failed: ${JSON.stringify(r)}`);
  }
  t += step;
  const r = ec.tap(g, me, tile, present, { now: t });
  if (!r.ok || !r.added) throw new Error(`add failed: ${JSON.stringify(r)}`);
  return t;
}
// Run the miss beat + replay through to the next turn.
function settle(g, present, t) {
  for (let i = 0; i < 5 && (g.phase === "miss" || g.phase === "replay"); i++) {
    t = g.beatEndsAt;
    ec.tick(g, present, t);
  }
  return t;
}
const wrongTile = (g) => (g.seq[g.echoPos] + 1) % g.tileCount;

// ===================================================================
section("(a) sequence + turn engine");
{
  let threw = 0;
  try { ec.createGame(["a"]); } catch { threw++; }
  try { ec.createGame(Array.from({ length: 11 }, (_, i) => `p${i}`)); } catch { threw++; }
  check("2–10 players enforced", threw === 2 && ec.minPlayers === 2 && ec.maxPlayers === 10);

  check("settings: defaults Easy / 2 lives", JSON.stringify(ec.resolveSettings({})) === '{"difficulty":"easy","lives":2}');
  check("settings: lives clamp to 1..3", ec.resolveSettings({ lives: 0 }).lives === 1 && ec.resolveSettings({ lives: 9 }).lives === 3);
  check("settings: unknown difficulty -> Easy", ec.resolveSettings({ difficulty: "nightmare" }).difficulty === "easy");
  const sizes = ["easy", "medium", "hard"].map((d) => ec.createGame(["a", "b"], { difficulty: d }).tileCount);
  check("boards: 9 / 16 / 25 tiles", sizes.join() === "9,16,25", sizes.join());

  const P = ["a", "b", "c", "d", "e", "f"];
  const orders = new Set();
  for (let i = 0; i < 200; i++) {
    const g = ec.createGame(P);
    orders.add(g.cycle.join(""));
    if ([...g.cycle].sort().join() !== P.join()) throw new Error("not a permutation");
  }
  check("turn order shuffled once per game (a permutation)", orders.size > 50, `${orders.size} distinct orders in 200`);

  const g0 = ec.createGame(["a", "b", "c"], {}, T0);
  check("starts with a 3-2-1 countdown, chain empty", g0.phase === "countdown" && g0.seq.length === 0 && g0.beatEndsAt === T0 + 3000);
  check("countdown holds until it ends", !ec.tick(g0, ["a", "b", "c"], T0 + 2999) && g0.phase === "countdown");

  const P3 = ["a", "b", "c"];
  const { g, t } = started(P3);
  check("first turn: first player in the order, round 1", g.activeId === "a" && g.round === 1);
  check("empty chain: straight to ADD with 5s", g.phase === "add" && g.turnMs === TIMERS.addMs);
  check("tap from a non-active player ignored", !ec.tap(g, "b", 3, P3, { now: t + 100 }).ok && g.seq.length === 0);
  check("tap off the board ignored", !ec.tap(g, "a", 9, P3, { now: t + 100 }).ok && !ec.tap(g, "a", -1, P3, { now: t + 100 }).ok && !ec.tap(g, "a", 1.5, P3, { now: t + 100 }).ok);
  const add = ec.tap(g, "a", 4, P3, { now: t + 200 });
  check("ADD: chain grows by one, the tap is returned for broadcast", add.ok && g.seq.join() === "4" && add.tap.tile === 4 && add.tap.kind === "add");
  check("turn passes to exactly the next player", g.activeId === "b" && g.phase === "echo" && g.turnMs === TIMERS.firstTapMs);
  check("a late double tap by the previous player is ignored", !ec.tap(g, "a", 4, P3, { now: t + 250 }).ok && g.seq.length === 1);
  check("a tap for an earlier turn (stale turnId) is refused", !ec.tap(g, "b", 4, P3, { turnId: g.turnId - 1, now: t + 300 }).ok);
  const e1 = ec.tap(g, "b", 4, P3, { turnId: g.turnId, now: t + 400 });
  check("ECHO: correct tap -> now add", e1.ok && e1.correct && g.phase === "add" && g.echoPos === 1 && g.turnMs === TIMERS.addMs);
  ec.tap(g, "b", 7, P3, { now: t + 600 });
  check("c echoes a 2-chain", g.activeId === "c" && g.seq.join() === "4,7");
  ec.tap(g, "c", 4, P3, { now: t + 900 });
  check("between echo taps: 4s", g.phase === "echo" && g.echoPos === 1 && g.turnMs === TIMERS.nextTapMs && g.deadline === t + 900 + 4000);

  // Never skipping anyone: 400 random turn endings in a 6-player game.
  const P6 = ["a", "b", "c", "d", "e", "f"];
  const r = started(P6, { lives: 3 });
  let tt = r.t;
  let bad = 0;
  let turns = 0;
  while (r.g.phase !== "final" && turns < 400) {
    const from = r.g.activeId;
    const expected = nextActiveAfter(r.g, from);
    const roll = Math.random();
    if (roll < 0.75) tt = playTurn(r.g, P6, tt, Math.floor(Math.random() * 9), 50);
    else if (roll < 0.88) { tt = r.g.deadline + TIMERS.graceMs + 1; ec.tick(r.g, P6, tt); }
    else if (r.g.phase === "echo") ec.tap(r.g, from, wrongTile(r.g), P6, { now: (tt += 50) });
    else { tt = r.g.deadline + TIMERS.graceMs + 1; ec.tick(r.g, P6, tt); }
    tt = settle(r.g, P6, tt);
    if (r.g.phase === "final") break;
    // `expected` was computed before the turn ended; if the ender just went
    // out, the walk still starts from their seat, so it's the same player.
    if (r.g.activeId !== expected) bad++;
    turns++;
  }
  check("every turn goes to exactly the next active player (random play)", bad === 0, `${turns} turns, ${bad} skips`);
}

// ===================================================================
section("(b) taps + timers");
{
  const P2 = ["a", "b"];
  const { g, t } = started(P2, {}, { seq: [1, 2, 3] });
  check("first echo tap: 5s window", g.phase === "echo" && g.deadline === t + 5000);
  check("no miss inside the 500ms grace", !ec.tick(g, P2, t + 5000 + 500) && g.phase === "echo");
  check("a tap sent at 4.9s arriving 400ms late still counts", ec.tap(g, "a", 1, P2, { now: t + 5300 }).correct);
  const d = g.deadline;
  check("next tap: 4s from the last one", d === t + 5300 + 4000);
  check("a tap past deadline + grace is refused", !ec.tap(g, "a", 2, P2, { now: d + 501 }).ok);
  check("...and the tick calls it a miss (timeout)", ec.tick(g, P2, d + 501) && g.phase === "miss" && g.miss.cause === "timeout");
  check("timeout costs one life, chain unchanged", g.lives.get("a") === 1 && g.seq.join() === "1,2,3");

  const r = started(P2, {}, { seq: [] });
  check("ADD timer: 5s, then a miss", !ec.tick(r.g, P2, r.t + 5500) && ec.tick(r.g, P2, r.t + 5501) && r.g.miss.cause === "timeout");
  check("timers live in one config object", TIMERS.firstTapMs === 5000 && TIMERS.nextTapMs === 4000 && TIMERS.addMs === 5000 && TIMERS.graceMs === 500);
}

// ===================================================================
section("(c) misses, replay, elimination");
{
  const P3 = ["a", "b", "c"];
  const { g, t } = started(P3, { lives: 2 }, { seq: [5, 1, 8] });
  ec.tap(g, "a", 5, P3, { now: t + 300 });
  const w = ec.tap(g, "a", 2, P3, { now: t + 600 });
  check("wrong tile -> miss; the wrong TAP is broadcast, not the right tile", w.ok && !w.correct && w.tap.kind === "wrong" && w.tap.tile === 2);
  check("miss: one life off, chain does NOT grow", g.phase === "miss" && g.lives.get("a") === 1 && g.seq.join() === "5,1,8");
  const pubMiss = ec.getPublicState(g, P3, t + 700);
  check("miss beat names the player and lives left", pubMiss.miss.playerId === "a" && pubMiss.miss.livesLeft === 1 && !pubMiss.miss.eliminated);
  const replayAt = g.beatEndsAt;
  ec.tick(g, P3, replayAt);
  const pub = ec.getPublicState(g, P3, replayAt);
  check("then the CORRECT chain is replayed for everyone", g.phase === "replay" && pub.replay.tiles.join() === "5,1,8");
  check("replay timing: 600ms per tile, flash 70%", pub.replay.intervalMs === 600 && pub.replay.flashMs === 420 && pub.replay.msUntilStart === REPLAY.leadMs);
  ec.tick(g, P3, g.beatEndsAt);
  check("next player echoes the SAME chain", g.activeId === "b" && g.phase === "echo" && g.seq.join() === "5,1,8" && g.echoPos === 0);

  // Elimination at 0 lives; stays in the room (cycle) as a spectator.
  const e = started(P3, { lives: 1 }, { seq: [0] });
  ec.tap(e.g, "a", 3, P3, { now: e.t + 200 });
  check("0 lives -> eliminated, out of the turn order", e.g.miss.eliminated && !activePlayers(e.g).includes("a") && e.g.cycle.includes("a"));
  settle(e.g, P3, e.t + 200);
  check("eliminated player is skipped from then on", e.g.activeId === "b" && nextActiveAfter(e.g, "c") === "b");

  // Miss on the very first ADD (empty chain): nothing to replay.
  const f = started(P3, {}, { seq: [] });
  ec.tick(f.g, P3, f.t + 5501);
  ec.tick(f.g, P3, f.g.beatEndsAt);
  check("empty-chain miss: no replay, next player adds", f.g.phase === "add" && f.g.activeId === "b");

  // Replay schedule, chains of 1 to 30.
  const log = [];
  for (let n = 1; n <= 30; n++) log.push(`${n}:${(replayIntervalMs(n) / 1000).toFixed(2)}`);
  console.log(`      replay interval (s) by chain length: ${log.join(" ")}`);
  let sched = true;
  for (let n = 1; n <= 200; n++) {
    const want = n <= 5 ? 600 : Math.max(200, 600 - 30 * (n - 5));
    if (replayIntervalMs(n) !== want || replayFlashMs(n) !== Math.round(want * 0.7)) sched = false;
  }
  check("schedule: 0.6s up to 5, -0.03s per extra tile, floor 0.2s; flash 70%", sched && replayIntervalMs(6) === 570 && replayIntervalMs(18) === 210 && replayIntervalMs(19) === 200 && replayIntervalMs(30) === 200);

  // Active player disconnects mid-echo: frozen through the grace period.
  const P4 = ["a", "b", "c", "d"];
  const realNow = Date.now;
  let now = T0;
  Date.now = () => now;
  try {
    const d = started(P4, {}, { seq: [1, 2, 3, 4] });
    ec.tap(d.g, "a", 1, P4, { now: d.t + 1000 });
    const left = d.g.deadline - (d.t + 2000);
    now = d.t + 2000;
    const away = ["b", "c", "d"];
    ec.reconcilePresence(d.g, away, { final: false, roomPlayerIds: P4 });
    check("active drop mid-echo freezes the turn", d.g.frozen?.reason === "disconnect");
    check("frozen: no timeout however long", !ec.tick(d.g, away, d.t + 120_000) && d.g.phase === "echo");
    check("frozen: taps refused", !ec.tap(d.g, "a", 2, away, { now: d.t + 3000 }).ok);
    check("public timer holds at what was left", ec.getPublicState(d.g, away, d.t + 50_000).msLeft === left);
    ec.tick(d.g, P4, d.t + 130_000);
    check("reconnect -> resumes where it stopped, echo position kept", !d.g.frozen && d.g.deadline === d.t + 130_000 + left && d.g.echoPos === 1);

    // Gone for good: eliminated, chain replayed once, turn passes.
    now = d.t + 131_000;
    ec.reconcilePresence(d.g, away, { final: false, roomPlayerIds: P4 });
    ec.reconcilePresence(d.g, away, { final: true, roomPlayerIds: ["b", "c", "d"] });
    check("grace expired -> eliminated (cause: left)", d.g.phase === "miss" && d.g.miss.cause === "left" && d.g.miss.eliminated && d.g.removed.has("a"));
    settle(d.g, ["b", "c", "d"], now);
    check("...the chain is replayed, then b echoes it", d.g.activeId === "b" && d.g.phase === "echo" && d.g.seq.length === 4);

    // Someone else being removed must not knock out a player still in grace.
    const k = started(P4, {}, { seq: [1] });
    now = k.t + 500;
    ec.reconcilePresence(k.g, ["a", "b", "c"], { final: false, roomPlayerIds: P4 }); // d drops (grace)
    ec.reconcilePresence(k.g, ["a", "b"], { final: true, roomPlayerIds: ["a", "b", "d"] }); // c kicked
    check("kick removes only the kicked player, not one in grace", k.g.removed.has("c") && !k.g.removed.has("d") && activePlayers(k.g).includes("d"));
    check("a non-active removal needs no replay", k.g.phase === "echo" && k.g.activeId === "a");

    // Turn passes TO a disconnected player: frozen on them.
    const z = started(P4, {}, { seq: [] });
    now = z.t + 100;
    ec.tap(z.g, "a", 0, ["a", "c", "d"], { now });
    check("turn passing to a dropped player freezes on them", z.g.activeId === "b" && z.g.frozen?.reason === "disconnect");
    ec.forceAdvance(z.g, ["a", "c", "d"], now + 100);
    check("host force proceed = a miss for the idle active player", z.g.phase === "miss" && z.g.miss.playerId === "b" && z.g.miss.cause === "skipped" && z.g.lives.get("b") === 1);
  } finally {
    Date.now = realNow;
  }
}

// ===================================================================
section("(d) rounds + scoring");
{
  // The spec's example: order A, B, C, one life each. C goes out in round
  // 2, B in round 3, A wins in round 3 -> A 3, B 2, C 1.
  const P = ["A", "B", "C"];
  const { g } = started(P, { lives: 1 });
  let t = T0 + 3000;
  const rounds = [];
  t = playTurn(g, P, t, 0); rounds.push(g.round); // A adds (round 1)
  t = playTurn(g, P, t, 1); rounds.push(g.round); // B
  t = playTurn(g, P, t, 2); rounds.push(g.round); // C -> back to A
  check("round 1 -> 2 when the turn returns to the first player", rounds.join() === "1,1,2" && g.activeId === "A");
  t = playTurn(g, P, t, 3); // A, round 2
  t = playTurn(g, P, t, 4); // B, round 2
  ec.tap(g, "C", wrongTile(g), P, { now: (t += 100) }); // C misses in round 2
  check("C eliminated in round 2", g.miss.eliminated && g.eliminatedIn.get("C") === 2);
  t = settle(g, P, t);
  check("round 3 starts at A (C's seat skipped, count unaffected)", g.activeId === "A" && g.round === 3);
  t = playTurn(g, P, t, 5); // A, round 3
  ec.tick(g, P, (t = g.deadline + TIMERS.graceMs + 1)); // B times out in round 3
  t = settle(g, P, t);
  const pts = Object.fromEntries(g.result.rows.map((r) => [r.playerId, r.score]));
  check("scoring example: A 3, B 2, C 1", g.phase === "final" && pts.A === 3 && pts.B === 2 && pts.C === 1, JSON.stringify(pts));
  check("A is the winner; final chain length recorded", g.result.winnerIds.join() === "A" && g.result.chainLength === 6);
  const tp = toTournamentPoints(finalStandingsOf(GAMES["echo-chain"], g, P));
  check("tournament: 5 / 3 / 2 by rounds survived", tp.map((r) => `${r.playerId}${r.points}`).join() === "A5,B3,C2");
  check("tournament sees the game as over at final", isGameOver(GAMES["echo-chain"], g));

  // Same-round eliminations tie; tournament ties share the higher place.
  const s = started(["a", "b", "c", "d"], { lives: 1 });
  let ts = T0 + 3000;
  ts = playTurn(s.g, ["a", "b", "c", "d"], ts, 0); // a
  ec.tick(s.g, ["a", "b", "c", "d"], (ts = s.g.deadline + 501)); // b out, round 1
  ts = settle(s.g, ["a", "b", "c", "d"], ts);
  ec.tick(s.g, ["a", "b", "c", "d"], (ts = s.g.deadline + 501)); // c out, round 1
  ts = settle(s.g, ["a", "b", "c", "d"], ts);
  ec.endEarly(s.g, ts);
  const sp = Object.fromEntries(s.g.result.rows.map((r) => [r.playerId, r.score]));
  check("same-round eliminations tie (b = c = 0)", sp.b === 0 && sp.c === 0);
  check("host ends early in round 1: alive a, d score round - 1 = 0", s.g.result.endedEarly && sp.a === 0 && sp.d === 0);
  const s2 = started(["a", "b", "c"], { lives: 2 });
  let t2 = T0 + 3000;
  for (let i = 0; i < 7; i++) t2 = playTurn(s2.g, ["a", "b", "c"], t2, i % 9);
  ec.endEarly(s2.g, t2);
  const tp2 = toTournamentPoints(finalStandingsOf(GAMES["echo-chain"], s2.g, ["a", "b", "c"]));
  check("early end in round 3: everyone alive shares the top place on 2", s2.g.round === 3 && s2.g.result.rows.every((r) => r.score === 2) && tp2.every((r) => r.rank === 1 && r.points === 5));
  check("pointsFor: eliminated R -> R-1, winner R, early R-1",
    pointsFor({ eliminatedInRound: 4, round: 6 }) === 3 && pointsFor({ round: 6 }) === 6 && pointsFor({ round: 6, endedEarly: true }) === 5);
  check("difficulty and lives don't change scoring", (() => {
    const run = (o) => { const x = started(["a", "b"], o); ec.endEarly(x.g); return x.g.result.rows.map((r) => r.score).join(); };
    return run({ difficulty: "hard", lives: 3 }) === run({ difficulty: "easy", lives: 1 });
  })());
}

// ===================================================================
section("(e) privacy + long chains");
{
  // Two games identical in every way except WHAT the chain holds: outside
  // the replay, every public payload must be byte-identical.
  const P = ["a", "b", "c"];
  const A = started(P, {}, { seq: [1, 2, 3, 4, 5, 6, 7, 8] });
  const B = started(P, {}, { seq: [8, 7, 6, 5, 4, 3, 2, 1] });
  let same = true;
  let snaps = 0;
  const snap = (now) => {
    snaps++;
    const pa = JSON.stringify(ec.getPublicState(A.g, P, now));
    const pb = JSON.stringify(ec.getPublicState(B.g, P, now));
    if (pa !== pb) same = false;
    if (/seq|"tiles"/.test(pa)) same = false;
  };
  let t = A.t;
  snap(t);
  for (let i = 0; i < 5; i++) {
    t += 200;
    ec.tap(A.g, "a", A.g.seq[i], P, { now: t });
    ec.tap(B.g, "a", B.g.seq[i], P, { now: t });
    snap(t);
  }
  t += 4500;
  ec.tick(A.g, P, t + 1); // both time out at echo 5 of 8
  ec.tick(B.g, P, t + 1);
  snap(t + 2);
  check("outside the replay the payload doesn't depend on the chain at all", same && A.g.phase === "miss", `${snaps} snapshots`);
  check("no private state to leak through", ec.getPrivateState(A.g, "a") === null);
  const rAt = A.g.beatEndsAt;
  ec.tick(A.g, P, rAt);
  check("the replay is the one payload that carries it", ec.getPublicState(A.g, P, rAt).replay.tiles.join() === "1,2,3,4,5,6,7,8");
  ec.tick(A.g, P, A.g.beatEndsAt);
  check("...and the next turn's payload drops it again", !("replay" in ec.getPublicState(A.g, P, A.g.beatEndsAt)) && A.g.phase === "echo");

  // A 60-tile chain: echo all of it, then miss + replay.
  const seq60 = Array.from({ length: 60 }, (_, i) => (i * 7) % 25);
  const L = started(["a", "b"], { difficulty: "hard" }, { seq: seq60 });
  const t0 = performance.now();
  let tl = L.t;
  for (const x of seq60) ec.tap(L.g, "a", x, ["a", "b"], { now: (tl += 150) });
  ec.tap(L.g, "a", 24, ["a", "b"], { now: (tl += 150) });
  const pubBytes = JSON.stringify(ec.getPublicState(L.g, ["a", "b"], tl)).length;
  for (let i = 0; i < 3; i++) ec.tap(L.g, "b", L.g.seq[i], ["a", "b"], { now: (tl += 150) });
  ec.tap(L.g, "b", (L.g.seq[3] + 1) % 25, ["a", "b"], { now: (tl += 150) });
  const lAt = L.g.beatEndsAt;
  ec.tick(L.g, ["a", "b"], lAt);
  const rp = ec.getPublicState(L.g, ["a", "b"], lAt);
  const ms = performance.now() - t0;
  check("61-tile chain echoes and grows", L.g.seq.length === 61 && L.g.phase === "replay");
  check("public payload stays small during play", pubBytes < 1500, `${pubBytes} bytes at 61 tiles`);
  check("61-tile replay: all tiles, 0.2s each", rp.replay.tiles.length === 61 && rp.replay.intervalMs === 200 && rp.replay.flashMs === 140);
  console.log(`      61-tile replay lasts ${(replayDurationMs(61) / 1000).toFixed(1)}s; engine time for the whole run ${ms.toFixed(1)}ms`);
  check("replay payload stays small", JSON.stringify(rp).length < 2000, `${JSON.stringify(rp).length} bytes`);
}

// ===================================================================
section("(f) integrations + simulated games");
{
  const entry = CATALOG.find((g) => g.id === "echo-chain");
  check("registry + catalogue: 2–10, tags Memory + Quick", GAMES["echo-chain"] === ec && entry?.minPlayers === 2 && entry?.maxPlayers === 10 && entry?.tags.join() === "memory,quick");
  check("Memory and Quick filter chips exist", ["memory", "quick"].every((k) => FILTERS.some((f) => f.key === k)));
  check("Chaos Events don't apply", !isChaosEligible("echo-chain"));
  check("tournament defaults: Easy, 2 lives", JSON.stringify(tournamentOptionsFor("echo-chain", ["a", "b"])) === '{"difficulty":"easy","lives":2}');
  check("fit: 1 player refused, 2 and 10 fine", fitError(ec, 1) && !fitError(ec, 2) && !fitError(ec, 10) && fitError(ec, 11));

  // Simulated games: players who remember with some accuracy.
  let ok = 0;
  let total = 0;
  const lengths = [];
  for (const n of [2, 3, 4, 6, 10]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (const lives of [1, 2, 3]) {
        total++;
        const P = Array.from({ length: n }, (_, i) => `p${i}`);
        const g = ec.createGame(P, { difficulty, lives }, T0);
        let t = T0;
        ec.tick(g, P, (t += 3000));
        let guard = 0;
        while (g.phase !== "final" && guard++ < 5000) {
          if (g.phase === "miss" || g.phase === "replay") { t = settle(g, P, t); continue; }
          const acc = 0.985;
          if (g.phase === "echo") {
            const right = Math.random() < acc;
            ec.tap(g, g.activeId, right ? g.seq[g.echoPos] : wrongTile(g), P, { now: (t += 120) });
          } else {
            ec.tap(g, g.activeId, Math.floor(Math.random() * g.tileCount), P, { now: (t += 120) });
          }
        }
        const rows = g.result?.rows ?? [];
        const winner = rows.find((r) => r.alive);
        const valid =
          g.phase === "final" &&
          activePlayers(g).length === 1 &&
          winner?.score === g.round &&
          rows.filter((r) => !r.alive).every((r) => r.score === g.eliminatedIn.get(r.playerId) - 1);
        if (valid) ok++;
        lengths.push(g.seq.length);
      }
    }
  }
  check("simulated games end with one winner on the final round, the rest on rounds survived", ok === total, `${ok}/${total}`);
  console.log(`      final chain lengths: ${lengths.join(" ")}`);
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
