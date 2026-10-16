// Hot Potato selftest — drives the real game module with injected clocks
// (no sockets, no network), plus the Chaos / tournament glue.
//
//   node server/hot-potato.selftest.mjs
//
// Sections map to the separately-testable pieces:
//   (a) the turn engine + cycle — exact-next passing, turn ids, the pass
//       lock, double taps, deliberate timeouts never skipping anyone
//   (b) Sprint + Hidden Fuse timers — shrinking window, floor, reset per
//       potato, the secret fuse never leaving the module
//   (c) challenges + voting — freeze / resume, ties, upheld on the last two
//   (d) Short Rounds + Elimination — scoring, lives, placements, matches,
//       disconnects, force proceed
//   (e) integrations — Chaos (filter, Speed Round, intro delay,
//       participants), tournament, shared category bank

import * as hp from "./games/hot-potato.js";
import { CATEGORIES, CATEGORY_KEYS } from "./games/alphabetSoupBank.js";
import { GAMES } from "./games/registry.js";
import { MODIFIERS } from "./chaos.js";
import { eligibleModifiers, CHAOS_GAMES } from "./chaosGames.js";
import { chaosTick } from "./chaosRuntime.js";
import { tournamentOptionsFor, finalStandingsOf, isGameOver } from "./tournament.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);

const P3 = ["p1", "p2", "p3"];
const P4 = ["p1", "p2", "p3", "p4"];

// Start a game with a FIXED cycle (p1 -> p2 -> ...), p1 starting, and the
// intro already run. Returns the game and the time the first turn began.
function live(ids, opts = {}) {
  const g = hp.createGame(ids, { mode: "rounds", rounds: 3, timerMode: "sprint", ...opts });
  g.cycle = [...ids];
  g.potato.starterId = ids[0];
  if (opts.fuseMs != null) g.potato.fuseMs = opts.fuseMs;
  hp.tick(g, ids, g.introEndsAt);
  return { g, t: g.turnStartedAt };
}
// Pass as the current holder, `dt` ms into their turn.
const passAt = (g, ids, dt = 900) => hp.pass(g, g.holderId, g.turnId, ids, g.turnStartedAt + dt);

// ===================================================================
section("(a) turn engine + cycle");
{
  const { g, t } = live(P4);
  check("intro hands the potato to the starter", g.phase === "live" && g.holderId === "p1" && g.turnId === 1);
  const early = hp.pass(g, "p1", g.turnId, P4, t + 500);
  check("Pass is locked for 0.8s after receiving", !early.ok && early.reason === "locked");
  const r = hp.pass(g, "p1", 1, P4, t + 900);
  check("a pass goes to exactly the next player", r.ok && g.holderId === "p2" && g.turnId === 2);
  const dbl = hp.pass(g, "p1", 1, P4, t + 950);
  check("double tap (stale turn id, ex-holder) is ignored", !dbl.ok && g.holderId === "p2");
  const notMine = hp.pass(g, "p3", g.turnId, P4, t + 2000);
  check("a non-holder can't pass", !notMine.ok && notMine.reason === "notHolder" && g.holderId === "p2");
  const stale = hp.pass(g, "p2", 1, P4, t + 2000);
  check("the holder with a stale turn id can't pass", !stale.ok && stale.reason === "stale");
  // p2's double tap: first lands, second carries the old turn id.
  const a = hp.pass(g, "p2", 2, P4, t + 1800);
  const b = hp.pass(g, "p2", 2, P4, t + 1810);
  check("holder double tap passes through ONE player only", a.ok && !b.ok && g.holderId === "p3");
  // The new holder's own immediate tap is inside their lock.
  const c = hp.pass(g, "p3", g.turnId, P4, t + 1850);
  check("receiver's instant tap is inside the lock", !c.ok && c.reason === "locked" && g.holderId === "p3");
  passAt(g, P4);
  check("wraps around the cycle", g.holderId === "p4" && (passAt(g, P4), g.holderId === "p1"));
}
{
  const { g } = live(P4, { mode: "elimination", lives: 3 });
  g.lives.set("p2", 0); // p2 is out
  passAt(g, P4);
  check("passing skips only players who are out", g.holderId === "p3");
  check("nextActiveAfter from an out seat walks on from it", hp.nextActiveAfter(g, "p2") === "p3");
}
{
  // Deliberate timeouts: explode the holder, next potato starts at the next seat.
  const { g } = live(P4, { mode: "elimination", lives: 2 });
  passAt(g, P4); // p2 holds
  const deadline = g.deadline;
  check("no explosion inside the 300ms grace", !hp.tick(g, P4, deadline + 250) && g.phase === "live");
  const lateOk = hp.pass(g, "p2", g.turnId, P4, deadline + 280);
  check("a Pass in the grace window still counts", lateOk.ok && g.holderId === "p3");
  hp.tick(g, P4, g.deadline + 301);
  check("timeout explodes the holder (p3)", g.phase === "explode" && g.explosion.playerId === "p3" && g.explosion.cause === "timeout");
  hp.tick(g, P4, g.explodeEndsAt);
  hp.tick(g, P4, g.introEndsAt);
  check("next potato starts with the next player after the exploder", g.holderId === "p4");
  hp.tick(g, P4, g.deadline + 301); // p4 times out
  hp.tick(g, P4, g.explodeEndsAt);
  hp.tick(g, P4, g.introEndsAt);
  check("...and again: exactly one seat on (p1), never further", g.holderId === "p1");
  const lateNo = hp.pass(g, "p1", g.turnId, P4, g.deadline + 301);
  check("a Pass after the grace is rejected", !lateNo.ok && lateNo.reason === "late");
}

// ===================================================================
section("(b) Sprint + Hidden Fuse timers");
{
  const { g } = live(P3);
  check("Sprint starts at 8s", g.turnWindow === 8000);
  passAt(g, P3);
  check("shrinks 0.25s after a pass", g.turnWindow === 7750);
  for (let i = 0; i < 40; i++) passAt(g, P3);
  check("floor of 2s", g.turnWindow === 2000, `${g.turnWindow}`);
  hp.tick(g, P3, g.deadline + 301);
  hp.tick(g, P3, g.explodeEndsAt);
  hp.tick(g, P3, g.introEndsAt);
  check("resets to 8s for the next potato", g.turnWindow === 8000);
  const pub = hp.getPublicState(g, P3, g.turnStartedAt + 1000);
  check("Sprint window is public", pub.turnMs === 8000 && pub.msLeft === 7000);
}
{
  const { g, t } = live(P3, { timerMode: "hidden", fuseMs: 23_456 });
  check("Hidden Fuse: 5s per-turn cap", g.turnWindow === 5000);
  check("fuse lit at the first turn", g.fuseDeadline === t + 23_456);
  // Pass every 1s: the cap never trips; the fuse does.
  let now = t;
  while (g.phase === "live") {
    now += 1000;
    if (hp.tick(g, P3, now)) break;
    hp.pass(g, g.holderId, g.turnId, P3, now);
  }
  check("the fuse explodes whoever holds it", g.phase === "explode" && g.explosion.cause === "fuse" && now >= t + 23_456);
}
{
  const fresh = hp.createGame(P3, { timerMode: "hidden" });
  const fuses = Array.from({ length: 200 }, () => hp.createGame(P3, { timerMode: "hidden" }).potato.fuseMs);
  check("fuse is 20–60s at random", fuses.every((f) => f >= 20_000 && f <= 60_000) && new Set(fuses).size > 50);
  check("no fuse on a Sprint potato", hp.createGame(P3, { timerMode: "sprint" }).potato.fuseMs === null && fresh.potato.fuseMs > 0);
  const { g, t } = live(P3, { timerMode: "hidden", fuseMs: 37_777 });
  hp.pass(g, "p1", g.turnId, P3, t + 900);
  hp.challenge(g, "p3", g.lastPass.seq, P3, t + 1000);
  const blobs = [];
  for (const now of [t + 1100, t + 2000]) {
    blobs.push(JSON.stringify(hp.getPublicState(g, P3, now)));
    for (const pid of P3) blobs.push(JSON.stringify(hp.getPrivateState(g, pid, now)));
  }
  const all = blobs.join("\n");
  const fuseLeft = String(g.frozen.fuseLeftMs);
  check("fuse length never appears in public or private state", !all.includes("37777") && !all.includes(fuseLeft) && !/fuse/i.test(all), "");
  const pub = hp.getPublicState(g, P3, t + 1100);
  check("Hidden Fuse: no public turn window at all", pub.msLeft === undefined && pub.turnMs === undefined);
  check("holder's private state carries only the 5s cap", JSON.stringify(Object.keys(hp.getPrivateState(g, "p2", t + 1100).hotPotato).sort()) === '["capMs","capMsLeft","turnId"]');
  check("non-holders get no timing at all", hp.getPrivateState(g, "p1", t + 1100).hotPotato.capMsLeft === undefined);
  // After the explosion too.
  hp.vote(g, "p2", false, P3, t + 1200); // 2 of 2 -> upheld
  const after = JSON.stringify(hp.getPublicState(g, P3, t + 1300));
  check("...nor after the explosion", !after.includes("37777") && !/fuse(Ms|Deadline|Left)/.test(after));
}
{
  const { g } = live(P3, { timerMode: "mixed" });
  const kinds = new Set();
  for (let i = 0; i < 60; i++) kinds.add(hp.createGame(P3, { timerMode: "mixed" }).potato.kind);
  check("Mixed picks Sprint or Hidden per potato", kinds.has("sprint") && kinds.has("hidden") && ["sprint", "hidden"].includes(g.potato.kind));
  check("intro shows the potato's mode", hp.getPublicState(hp.createGame(P3, { timerMode: "mixed" }), P3).potatoKind !== null);
}

// ===================================================================
section("(c) challenges + voting");
{
  const { g, t } = live(P4);
  hp.pass(g, "p1", g.turnId, P4, t + 1000); // p1's answer -> p2 holds
  const deadlineBefore = g.deadline;
  check("the holder can't challenge (3+ players)", !hp.challenge(g, "p2", g.lastPass.seq, P4, t + 1500).ok);
  check("the passer can't challenge their own answer", !hp.challenge(g, "p1", g.lastPass.seq, P4, t + 1500).ok);
  const c = hp.challenge(g, "p3", g.lastPass.seq, P4, t + 2000);
  check("another active player can challenge", c.ok && g.vote && g.frozen?.reason === "vote");
  check("holder can't pass during a vote", !hp.pass(g, "p2", g.turnId, P4, t + 2500).ok);
  check("clocks frozen: no explosion while voting", !hp.tick(g, P4, t + 6900) && g.phase === "live");
  check("passer can't vote", !hp.vote(g, "p1", true, P4, t + 2600).ok);
  hp.vote(g, "p2", true, P4, t + 3000); // valid
  check("vote stays open until all voted / 5s", g.vote != null);
  hp.vote(g, "p4", true, P4, t + 3500); // 1 uphold vs 2 valid -> fails
  check("challenge fails on a majority of 'valid'", g.vote === null && g.phase === "live" && g.lastEvent.type === "overruled");
  check("turn window resumes exactly where it stopped", g.deadline === t + 3500 + (deadlineBefore - (t + 2000)));
  check("the same answer can't be challenged twice", !hp.challenge(g, "p4", g.lastPass.seq, P4, t + 3600).ok);
  hp.pass(g, "p2", g.turnId, P4, t + 3600);
  const stale = hp.challenge(g, "p4", 1, P4, t + 3700);
  check("the window closes when the next pass happens (stale seq)", !stale.ok);
}
{
  // Tie favours the passer: 4 players, voters p2 p3 p4 -> p3 challenges (yes), p2 no, p4 absent.
  const { g, t } = live(P4);
  hp.pass(g, "p1", g.turnId, P4, t + 1000);
  hp.challenge(g, "p3", g.lastPass.seq, P4, t + 1100);
  hp.vote(g, "p2", true, P4, t + 1200);
  hp.tick(g, P4, t + 1100 + hp.VOTE_MS);
  check("1–1 tie (time up) favours the passer", g.phase === "live" && g.lastEvent.type === "overruled");
}
{
  // Upheld: the PASSER explodes immediately, not the holder.
  const { g, t } = live(P4, { mode: "elimination", lives: 2 });
  hp.pass(g, "p1", g.turnId, P4, t + 1000);
  hp.challenge(g, "p3", g.lastPass.seq, P4, t + 1100);
  hp.vote(g, "p4", false, P4, t + 1200);
  hp.vote(g, "p2", true, P4, t + 1300); // 2 uphold (p3, p4) vs 1 valid
  check("upheld challenge explodes the passer", g.phase === "explode" && g.explosion.playerId === "p1" && g.explosion.cause === "challenge" && g.lives.get("p1") === 1);
}
{
  // Challenge budget: 2 per active player per potato.
  // p4 challenges every answer it can (each one fails), until it's tried 3.
  const { g, t } = live(P4);
  let now = t;
  const results = [];
  for (let i = 0; i < 12 && results.length < 3; i++) {
    now += 1000;
    hp.pass(g, g.holderId, g.turnId, P4, now);
    if (g.holderId === "p4" || g.lastPass.fromId === "p4") continue;
    results.push(hp.challenge(g, "p4", g.lastPass.seq, P4, now + 10).ok);
    if (g.vote) for (const p of P4) hp.vote(g, p, true, P4, now + 20); // "valid" -> fails, clocks resume
    now = Math.max(now, g.turnStartedAt);
  }
  check("2 challenges per player per potato", results.join() === "true,true,false", JSON.stringify(results));
}
{
  // Eliminated players vote but can't challenge.
  const { g, t } = live(P4, { mode: "elimination", lives: 1 });
  g.lives.set("p4", 0);
  g.eliminated.push("p4");
  hp.pass(g, "p1", g.turnId, P4, t + 1000);
  check("eliminated players can't challenge", !hp.challenge(g, "p4", g.lastPass.seq, P4, t + 1100).ok);
  hp.challenge(g, "p3", g.lastPass.seq, P4, t + 1100);
  check("...but they can vote", hp.vote(g, "p4", true, P4, t + 1200).ok);
}
{
  // Upheld challenge on the LAST TWO players: the holder may challenge
  // (nobody else could), eliminated players vote, the passer is knocked out.
  const { g, t } = live(P4, { mode: "elimination", lives: 1 });
  for (const out of ["p3", "p4"]) {
    g.lives.set(out, 0);
    g.eliminated.push(out);
  }
  const r = hp.pass(g, "p1", g.turnId, P4, t + 1000); // p1 -> p2
  check("two-player endgame: pass goes to the other survivor", r.ok && g.holderId === "p2");
  const c = hp.challenge(g, "p2", g.lastPass.seq, P4, t + 1100);
  check("two-player endgame: the holder may challenge", c.ok);
  hp.vote(g, "p3", false, P4, t + 1200);
  hp.vote(g, "p4", false, P4, t + 1300);
  check("upheld: the passer explodes and the match ends", g.phase === "explode" && g.explosion.playerId === "p1" && g.explosion.matchOver);
  check("placement: p2 1st (5), p1 2nd (3), p4 3rd (2), p3 4th (1)", g.placements.map((x) => `${x.playerId}:${x.points}`).join() === "p2:5,p1:3,p4:2,p3:1", JSON.stringify(g.placements));
}

// ===================================================================
section("(d) Short Rounds + Elimination");
{
  const { g } = live(P4, { mode: "rounds", rounds: 2 });
  passAt(g, P4); // p2 holds
  hp.tick(g, P4, g.deadline + 301);
  check("Short Rounds: exploder 0, everyone else +2", g.scores.get("p2") === 0 && ["p1", "p3", "p4"].every((p) => g.scores.get(p) === 2));
  const cat1 = g.potato.categoryKey;
  hp.tick(g, P4, g.explodeEndsAt);
  check("new category each round", g.phase === "intro" && g.potato.categoryKey !== cat1);
  hp.tick(g, P4, g.introEndsAt);
  check("next round starts with the player after the exploder", g.holderId === "p3");
  hp.tick(g, P4, g.deadline + 301);
  check("last round's explosion flags game over", g.explosion.gameOver === true);
  hp.tick(g, P4, g.explodeEndsAt);
  check("-> final, highest total wins", g.phase === "final" && hp.getPublicState(g, P4).winnerIds.sort().join() === "p1,p4");
}
{
  const g = hp.createGame(P3, { mode: "elimination", lives: 2, matches: 2, timerMode: "sprint" });
  check("lives / matches from settings", g.startLives === 2 && g.totalMatches === 2 && [...g.lives.values()].every((l) => l === 2));
  check("cycle is a shuffle of everyone", [...g.cycle].sort().join() === "p1,p2,p3");
  const settings = hp.createGame(P3, { mode: "elimination", lives: 99, matches: 0 });
  check("lives clamp to 1–5, matches to at least 1", settings.startLives === 5 && settings.totalMatches === 1);
  const dflt = hp.createGame(P3, { mode: "elimination" });
  check("defaults: 1 life, 1 match", dflt.startLives === 1 && dflt.totalMatches === 1);

  // Play match 1 to the end by timeouts.
  let now = g.introEndsAt;
  const step = () => {
    now = Math.max(now, g.introEndsAt ?? 0, g.explodeEndsAt ?? 0);
    if (g.phase === "intro") hp.tick(g, P3, (now = g.introEndsAt));
    else if (g.phase === "live") hp.tick(g, P3, (now = g.deadline + 301));
    else if (g.phase === "explode") hp.tick(g, P3, (now = g.explodeEndsAt));
  };
  let guard = 0;
  while (!(g.phase === "explode" && g.explosion.matchOver) && guard++ < 50) step();
  check("match ends with one player left", g.explosion.matchOver && hp.activePlayers(g).length === 1);
  check("an eliminated player is out of the cycle but still in the roster", g.eliminated.length === 2 && g.roster.length === 3);
  const before = new Map(g.scores);
  check("placements 5/3/2 by reverse elimination order", g.placements.map((x) => x.points).join() === "5,3,2");
  hp.tick(g, P3, g.explodeEndsAt + 10_000);
  check("between matches waits for the host", g.phase === "explode");
  hp.nextMatch(g, P3, g.explodeEndsAt + 10_000);
  check("next match: fresh lives, new potato", g.phase === "intro" && g.matchIndex === 1 && [...g.lives.values()].every((l) => l === 2));
  guard = 0;
  now = g.introEndsAt;
  while (g.phase !== "final" && guard++ < 50) step();
  const total = [...g.scores.values()].reduce((a, b) => a + b, 0);
  check("scores accumulate across matches", total === 20 && [...before.values()].every((v, i) => v <= [...g.scores.values()][i]), JSON.stringify([...g.scores]));
}
{
  // Holder disconnect: freeze during grace, resume on return.
  const { g, t } = live(P4, { timerMode: "hidden", fuseMs: 30_000 });
  hp.pass(g, "p1", g.turnId, P4, t + 1000); // p2 holds
  const left = g.deadline - (t + 2000);
  const fuseLeft = g.fuseDeadline - (t + 2000);
  const away = ["p1", "p3", "p4"];
  g.__now = t + 2000;
  const realNow = Date.now;
  Date.now = () => g.__now;
  hp.reconcilePresence(g, away, { final: false });
  check("holder drop freezes both clocks", g.frozen?.reason === "disconnect");
  check("frozen: no explosion however long", !hp.tick(g, away, t + 200_000) && g.phase === "live");
  check("frozen: the holder's pass is refused", !hp.pass(g, "p2", g.turnId, away, t + 2500).ok);
  hp.tick(g, P4, t + 300_000); // back
  check("holder back -> clocks resume where they stopped", !g.frozen && g.deadline === t + 300_000 + left && g.fuseDeadline === t + 300_000 + fuseLeft);
  // Gone for good: potato moves on, no penalty, out of the cycle.
  g.__now = t + 300_100;
  hp.reconcilePresence(g, away, { final: false });
  hp.reconcilePresence(g, away, { final: true });
  check("holder gone for good: potato to the next player, no explosion", g.phase === "live" && g.holderId === "p3" && g.removed.has("p2"));
  check("...removed from the cycle", !hp.activePlayers(g).includes("p2") && hp.nextActiveAfter(g, "p1") === "p3");
  check("...fuse untouched", g.fuseDeadline === t + 300_000 + fuseLeft);
  Date.now = realNow;
}
{
  // The potato passed TO a disconnected player freezes on them.
  const { g, t } = live(P4);
  const away = ["p1", "p3", "p4"];
  hp.pass(g, "p1", g.turnId, away, t + 1000);
  check("passing to a disconnected player freezes on them", g.holderId === "p2" && g.frozen?.reason === "disconnect");
  hp.forceAdvance(g, away);
  check("host force proceed passes it on, no penalty", g.holderId === "p3" && g.phase === "live" && !g.frozen && g.lastEvent.type === "skipped");
  check("nothing to challenge after a forced pass", g.lastPass === null);
}
{
  // Kicked / gone in Elimination down to one -> match ends.
  const realNow = Date.now;
  const { g } = live(P3, { mode: "elimination", lives: 1 });
  Date.now = () => g.turnStartedAt + 100;
  hp.reconcilePresence(g, ["p1", "p2"], { final: true });
  hp.reconcilePresence(g, ["p1"], { final: true });
  Date.now = realNow;
  check("players leaving for good can end the match", g.phase === "explode" && g.explosion.matchOver && g.placements[0].playerId === "p1");
}
{
  const { g } = live(P3);
  hp.forceAdvance(g, P3);
  check("force proceed in live: idle holder passes on", g.holderId === "p2");
  hp.tick(g, P3, g.deadline + 301);
  hp.forceAdvance(g, P3);
  check("force proceed skips the explosion beat", g.phase === "intro");
  hp.forceAdvance(g, P3);
  check("force proceed skips the intro", g.phase === "live");
}

// ===================================================================
section("(e) integrations");
{
  check("registered with the server", GAMES["hot-potato"] === hp || GAMES["hot-potato"]?.id === "hot-potato");
  check("shares Alphabet Soup's 100+ category bank", CATEGORIES.length >= 100 && CATEGORY_KEYS.includes(hp.createGame(P3, {}).potato.categoryKey));
  const fewCats = hp.createGame(P3, { categories: ["animals", "foods"] });
  check("category toggles respected", ["animals", "foods"].includes(fewCats.potato.categoryKey));

  const rounds = hp.createGame(P4, { mode: "rounds" });
  const elim = hp.createGame(P4, { mode: "elimination" });
  const ids = (g) => eligibleModifiers("hot-potato", MODIFIERS, { playerCount: 4, roundsLeft: 2, game: g }).map((m) => m.id);
  check("Elimination: only Speed Round + Countdown Chaos", ids(elim).sort().join() === "countdown-chaos,speed-round", ids(elim).join());
  check("Short Rounds: tie-blind modifiers filtered out", !["all-or-nothing", "tax-collector", "the-tyrant", "rival", "risk-it", "point-reversal"].some((m) => ids(rounds).includes(m)));
  check("Short Rounds: scoring modifiers kept", ["double-points", "steal", "half-reset", "speed-round", "countdown-chaos"].every((m) => ids(rounds).includes(m)));
  check("chaos rolls per potato on the intro", CHAOS_GAMES["hot-potato"].rollPhases.join() === "intro");

  // Speed Round through the real glue.
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "speed-round";
  const g = hp.createGame(P4, { mode: "rounds", timerMode: "sprint" });
  const room = { status: "in-game", game: g, chaosFrequency: "high" };
  const introBefore = g.introEndsAt;
  chaosTick(room, { connectedPlayerIds: () => P4 });
  check("Chaos delays the intro by the takeover", g.introEndsAt > introBefore);
  hp.tick(g, P4, g.introEndsAt);
  check("Speed Round pins the turn window to 2s", g.turnWindow === 2000);
  const h = hp.createGame(P4, { mode: "rounds", timerMode: "hidden" });
  chaosTick({ status: "in-game", game: h, chaosFrequency: "high" }, { connectedPlayerIds: () => P4 });
  hp.tick(h, P4, h.introEndsAt);
  check("Speed Round caps the Hidden Fuse turn at 2s too", h.turnWindow === 2000);
  delete process.env.CHAOS_FORCE;
  delete process.env.CHAOS_FORCE_MODIFIER;

  const e = hp.createGame(P4, { mode: "elimination" });
  e.lives.set("p3", 0);
  check("chaos participants = players still in the cycle", hp.chaosParticipants(e, P4).join() === "p1,p2,p4");

  const opts = tournamentOptionsFor("hot-potato", P4);
  const tg = hp.createGame(P4, opts);
  check("tournament defaults start a game", tg.mode === "rounds" && tg.totalRounds === 5);
  tg.phase = "final";
  tg.scores.set("p3", 6);
  check("reports final standings", isGameOver(hp, tg) && finalStandingsOf(hp, tg, P4)[0].playerId === "p3");
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures ? 1 : 0);
