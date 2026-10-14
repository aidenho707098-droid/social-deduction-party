// "Hot Potato" — a fast spoken passing game.
//
// A category is dealt, players sit in a fixed CYCLE, and a potato (a fuse)
// passes around it. The holder says something that fits the category OUT
// LOUD and taps Pass; whoever holds the potato when it blows takes the hit.
// Passing is spoken, so the app never checks answers — the room polices
// them with Challenges.
//
// Two host modes:
//   SHORT ROUNDS — one potato per round; the first explosion ends it. The
//                  exploder scores 0, everyone else +2.
//   ELIMINATION  — every explosion costs a life; at 0 you're out of the
//                  cycle (you still vote). Last one standing wins the match;
//                  5 / 3 / 2 / 1 by reverse elimination order. Several
//                  matches accumulate.
//
// Two timer modes (Mixed picks one per potato):
//   SPRINT       — the holder's turn window starts at 8s and loses 0.25s
//                  after EVERY pass (floor 2s); reset per potato.
//   HIDDEN FUSE  — a secret 20–60s fuse per potato, plus a 5s per-turn cap
//                  so nobody stalls. The fuse NEVER leaves this module: not
//                  in the public state, not in any private state, not after
//                  the explosion. Nothing a client shows or plays can be
//                  driven by it. Only the holder sees the 5s cap, privately.
//
//   phase:  intro -> live -> explode -> intro ...           (one potato each)
//           ... explode (matchOver, Elimination) -> intro    (host: next match)
//           ... -> final
//
// SERVER-AUTHORITATIVE TURNS. Every turn has a `turnId`. A Pass only counts
// from the CURRENT holder carrying the CURRENT turnId, and not inside the
// 0.8s lock after they received it — so a double tap can never pass
// through two players. A pass or a timeout moves the potato to EXACTLY the
// next active player in the cycle, never further.
//
// This module is pure state + timestamps; server/index.js drives tick().

import { shuffle } from "./deck.js";
import { activePlayers, freezeClocks, isActive, loseLife, nextActiveAfter, resumeClocks } from "./turnCycle.js";
import { CATEGORY_KEYS, RANDOM_CATEGORY } from "./alphabetSoupBank.js";
import { categoryMapFor, deckCandidates, deckTake, newCategoryDeck, resolveSelection } from "./categorySelection.js";

export const id = "hot-potato";
export const name = "Hot Potato";
export const minPlayers = 3;
export const maxPlayers = 10;

export { RANDOM_CATEGORY };
export const GAME_MODES = ["rounds", "elimination"];
export const TIMER_MODES = ["sprint", "hidden", "mixed"];

// ---- intro (category reveal, then 3-2-1) ----
export const CATEGORY_MS = 2_400;
export const COUNTDOWN_MS = 3_000;
export const INTRO_MS = CATEGORY_MS + COUNTDOWN_MS;
// A Chaos takeover plays in front of the intro (client/src/chaos/
// ChaosOverlay.jsx: 1400 buildup + 2500 reveal + 550 out, + 3200 for a
// Risk It wager) — the intro waits for it, same as Alphabet Soup.
const CHAOS_TAKEOVER_MS = 1_400 + 2_500 + 550;
const CHAOS_WAGER_MS = 3_200;

// ---- turns ----
export const SPRINT_START_MS = 8_000;
export const SPRINT_STEP_MS = 250; // shaved off after every pass
export const SPRINT_MIN_MS = 2_000;
export const HIDDEN_CAP_MS = 5_000;
export const FUSE_MIN_MS = 20_000;
export const FUSE_MAX_MS = 60_000;
export const PASS_LOCK_MS = 800; // after receiving the potato
export const PASS_GRACE_MS = 300; // a Pass racing the turn window still counts
const SPEED_WINDOW_MS = SPRINT_MIN_MS; // Chaos Speed Round: every window at the floor

// ---- challenges ----
export const VOTE_MS = 5_000;
export const CHALLENGE_LIMIT = 2; // per active player, per potato

// ---- results ----
export const EXPLODE_MS = 4_500; // the pop + result beat before the next potato
export const ROUND_POINTS = 2; // Short Rounds: everyone but the exploder
const PLACEMENT_POINTS = [5, 3, 2, 1];
export const LIVES_MIN = 1;
export const LIVES_MAX = 5;
export const MATCHES_MAX = 5;

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

// =====================================================================
// (a) the cycle — the shared engine in turnCycle.js (Echo Chain uses it
// too): isActive / activePlayers / nextActiveAfter walk the fixed cycle,
// loseLife handles lives + elimination, freeze/resume hold the clocks.
// =====================================================================

export { activePlayers, nextActiveAfter };

// Both clocks a potato can have, and where each one's ms left sits while
// frozen.
const CLOCKS = { deadline: "turnLeftMs", fuseDeadline: "fuseLeftMs" };

// =====================================================================
// lifecycle
// =====================================================================

export function createGame(playerIds, options = {}) {
  if (playerIds.length < minPlayers) throw new Error(`Hot Potato needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`Hot Potato supports at most ${maxPlayers} players.`);

  const mode = options.mode === "elimination" ? "elimination" : "rounds";
  const timerMode = TIMER_MODES.includes(options.timerMode) ? options.timerMode : "sprint";
  // Shared bank + this room's custom categories (narrow ones excluded: they
  // run dry in a lap or two), and the host's selection out of them.
  const catMap = categoryMapFor(options.customCategories, { game: "hot-potato" });
  const catKeys = resolveSelection(options.categories, catMap);
  const randomMode = catKeys.length === CATEGORY_KEYS.length && CATEGORY_KEYS.every((k) => catKeys.includes(k));
  const seen = Array.isArray(options.memory?.seen) ? options.memory.seen : [];

  const game = {
    id,
    mode,
    timerMode,
    randomMode, // true = the whole bank is selected ("All")
    categories: catKeys,
    catMap,
    totalRounds: mode === "rounds" ? clampInt(options.rounds, 1, 20, 5) : null,
    totalMatches: mode === "elimination" ? clampInt(options.matches, 1, MATCHES_MAX, 1) : 1,
    startLives: mode === "elimination" ? clampInt(options.lives, LIVES_MIN, LIVES_MAX, 1) : 1,
    matchIndex: 0,
    roundIndex: -1, // potato counter for the whole game (Chaos keys rounds on it)
    roster: [...playerIds], // everyone dealt in; eliminated players stay here (they vote)
    removed: new Set(), // gone for good (rejoin grace expired / kicked)
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    // Category draw bag: uniform, no repeats until the selection is used up
    // (first cycle skips ones this room already met this session).
    catDeck: newCategoryDeck(catKeys, seen),
    deckMemory: { seen: [...seen] }, // server-only; harvested by index.js
    turnId: 0,
    passSeq: 0,
    lastEvent: null,
  };
  startMatch(game, playerIds);
  return game;
}

// A fresh cycle order, full lives, and a random starter.
function startMatch(game, presentPlayerIds, now = Date.now()) {
  game.cycle = shuffle(game.roster.filter((pid) => !game.removed.has(pid)));
  game.lives = new Map(game.cycle.map((pid) => [pid, game.startLives]));
  game.eliminated = []; // this match, in elimination order
  game.placements = null;
  const live = game.cycle.filter((pid) => presentPlayerIds.includes(pid));
  const starter = shuffle(live.length ? live : game.cycle)[0];
  startPotato(game, starter, now);
}

// A fresh category for every potato (each Short Round; after every
// explosion in Elimination) — see categorySelection.js for the draw rules.
function pickCategory(game) {
  const { keys, refill } = deckCandidates(game.catDeck);
  const key = keys[Math.floor(Math.random() * keys.length)];
  deckTake(game.catDeck, key, refill);
  if (!game.deckMemory.seen.includes(key)) game.deckMemory.seen.push(key);
  if (game.deckMemory.seen.length >= CATEGORY_KEYS.length) game.deckMemory.seen = [key];
  return game.catMap[key];
}

// A new potato: new category, timer mode (Mixed rolls here), fuse, and an
// intro before the first turn. The starter holds it once the intro ends.
function startPotato(game, starterId, now) {
  const cat = pickCategory(game);
  const kind = game.timerMode === "mixed" ? shuffle(["sprint", "hidden"])[0] : game.timerMode;
  game.roundIndex += 1;
  game.phase = "intro";
  game.introLeadMs = 0;
  game.introEndsAt = now + INTRO_MS;
  game.potato = {
    categoryKey: cat.key,
    categoryName: cat.name,
    kind,
    starterId,
    speed: false, // Chaos Speed Round
    passes: 0,
    // SECRET (Hidden Fuse). Read only by fuseLeft()/tick() below.
    fuseMs: kind === "hidden" ? FUSE_MIN_MS + Math.floor(Math.random() * (FUSE_MAX_MS - FUSE_MIN_MS + 1)) : null,
    challengesUsed: new Map(),
  };
  game.holderId = null;
  game.deadline = null; // turn window end
  game.fuseDeadline = null; // hidden fuse end (secret)
  game.frozen = null; // { turnLeftMs, fuseLeftMs, reason }
  game.vote = null;
  game.lastPass = null;
  game.explosion = null;
  game.explodeEndsAt = null;
}

// Chaos layer hook: push the intro back by the takeover, and note Speed Round.
export function onChaosAnnounced(game, modifier) {
  if (game.phase !== "intro") return;
  if (modifier?.id === "speed-round" && game.potato) game.potato.speed = true;
  if (game.introLeadMs > 0) return;
  const lead = CHAOS_TAKEOVER_MS + (modifier?.id === "risk-it" ? CHAOS_WAGER_MS : 0);
  game.introLeadMs = lead;
  game.introEndsAt += lead;
}

// =====================================================================
// (b) timers
// =====================================================================

// The holder's turn window for the CURRENT pass count.
export function turnWindowMs(game) {
  const p = game.potato;
  if (p.speed) return SPEED_WINDOW_MS;
  if (p.kind === "hidden") return HIDDEN_CAP_MS;
  return Math.max(SPRINT_MIN_MS, SPRINT_START_MS - p.passes * SPRINT_STEP_MS);
}

function beginTurn(game, holderId, now) {
  game.turnId += 1;
  game.holderId = holderId;
  game.turnStartedAt = now;
  game.lockUntil = now + PASS_LOCK_MS;
  game.turnWindow = turnWindowMs(game);
  game.deadline = now + game.turnWindow;
  game.frozen = null;
}

// The intro is over: the starter takes the potato and the fuse is lit.
function lightPotato(game, presentPlayerIds, now) {
  game.phase = "live";
  let starter = game.potato.starterId;
  if (!isActive(game, starter)) starter = nextActiveAfter(game, starter);
  if (game.potato.kind === "hidden") game.fuseDeadline = now + game.potato.fuseMs;
  beginTurn(game, starter, now);
  if (!presentPlayerIds.includes(starter)) freeze(game, "disconnect", now);
}

// Stop both clocks where they are (a challenge vote, or a holder who
// dropped). Idempotent; the first reason wins.
function freeze(game, reason, now) {
  freezeClocks(game, reason, now, CLOCKS);
}

// Pick both clocks up exactly where they stopped.
function resume(game, now) {
  resumeClocks(game, now, CLOCKS);
}

function turnLeft(game, now) {
  if (game.frozen) return game.frozen.turnLeftMs;
  return Math.max(0, game.deadline - now);
}

// =====================================================================
// passing
// =====================================================================

const PASS_REJECT = {
  closed: "The potato isn't live.",
  notHolder: "You're not holding the potato.",
  stale: "That pass was for an earlier turn.",
  locked: "Too fast — you only just caught it.",
  frozen: "Hold on — the potato's on pause.",
  late: "Too late — BOOM!",
};

export function pass(game, playerId, turnId, presentPlayerIds, now = Date.now()) {
  const reject = (reason) => ({ ok: false, reason, message: PASS_REJECT[reason] });
  if (game.phase !== "live") return reject("closed");
  if (playerId !== game.holderId) return reject("notHolder");
  if (turnId == null || turnId !== game.turnId) return reject("stale");
  if (game.frozen) return reject("frozen");
  if (now < game.lockUntil) return reject("locked");
  // Latency forgiveness on the VISIBLE turn window. The hidden fuse gets
  // none: nobody can see it, so nobody was racing it — and a pass that
  // arrived after it went off would only blow up the receiver instead.
  if (now > game.deadline + PASS_GRACE_MS) return reject("late");
  if (game.fuseDeadline != null && now >= game.fuseDeadline) return reject("late");

  const to = nextActiveAfter(game, playerId);
  if (!to) return reject("closed");
  game.passSeq += 1;
  game.potato.passes += 1;
  game.lastPass = { seq: game.passSeq, fromId: playerId, toId: to, at: now, challenged: false };
  beginTurn(game, to, now);
  if (!presentPlayerIds.includes(to)) freeze(game, "disconnect", now);
  return { ok: true, toId: to, turnId: game.turnId };
}

// =====================================================================
// (c) challenges
// =====================================================================

// Who may challenge right now: an active player who isn't the passer of
// the challenged answer. The holder may not — EXCEPT in a two-player
// endgame, where the holder is the only other active player and nobody
// else could ever challenge.
function canChallenge(game, pid) {
  if (!isActive(game, pid) || !game.lastPass) return false;
  if (pid === game.lastPass.fromId) return false;
  if (pid === game.holderId && activePlayers(game).length > 2) return false;
  return true;
}

function voters(game, presentPlayerIds) {
  const passer = game.vote?.passerId;
  return game.roster.filter((pid) => pid !== passer && !game.removed.has(pid) && presentPlayerIds.includes(pid));
}

export function challenge(game, playerId, passSeq, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "live") return { ok: false, message: "Nothing to challenge." };
  if (game.vote) return { ok: false, message: "A vote is already running." };
  const lp = game.lastPass;
  if (!lp || (passSeq != null && passSeq !== lp.seq)) {
    return { ok: false, message: "Too late — the potato has moved on." };
  }
  if (lp.challenged) return { ok: false, message: "That answer was already challenged." };
  if (!isActive(game, playerId)) return { ok: false, message: "Only players still in can challenge." };
  if (!canChallenge(game, playerId)) return { ok: false, message: "You can't challenge that one." };
  const used = game.potato.challengesUsed.get(playerId) ?? 0;
  if (used >= CHALLENGE_LIMIT) return { ok: false, message: "You're out of challenges for this potato." };

  game.potato.challengesUsed.set(playerId, used + 1);
  lp.challenged = true;
  // A holder who dropped is already frozen; the vote takes over the freeze.
  if (game.frozen) game.frozen.reason = "vote";
  else freeze(game, "vote", now);
  game.vote = {
    passSeq: lp.seq,
    passerId: lp.fromId,
    challengerId: playerId,
    votes: new Map([[playerId, true]]), // the challenger counts as a yes
    deadline: now + VOTE_MS,
  };
  maybeResolveVote(game, presentPlayerIds, now);
  return { ok: true };
}

// `valid` = "was that a valid answer?" — false upholds the challenge.
export function vote(game, playerId, valid, presentPlayerIds, now = Date.now()) {
  const v = game.vote;
  if (game.phase !== "live" || !v) return { ok: false, message: "That vote has closed." };
  if (playerId === v.passerId) return { ok: false, message: "You can't vote on your own answer." };
  if (!game.roster.includes(playerId) || game.removed.has(playerId)) return { ok: false };
  if (v.votes.has(playerId)) return { ok: false, message: "You've already voted." };
  v.votes.set(playerId, valid !== true);
  maybeResolveVote(game, presentPlayerIds, now);
  return { ok: true };
}

function maybeResolveVote(game, presentPlayerIds, now) {
  const v = game.vote;
  if (!v) return;
  const everyone = voters(game, presentPlayerIds).every((pid) => v.votes.has(pid));
  if (now >= v.deadline || everyone) resolveVote(game, presentPlayerIds, now);
}

function resolveVote(game, presentPlayerIds, now) {
  const v = game.vote;
  const tally = [...v.votes.values()];
  const up = tally.filter(Boolean).length;
  const down = tally.length - up;
  const upheld = up > down; // a tie favours the passer
  game.vote = null;
  game.lastEvent = { type: upheld ? "upheld" : "overruled", playerId: v.passerId, challengerId: v.challengerId, up, down, turnId: game.turnId };
  if (upheld) {
    explode(game, v.passerId, "challenge", now);
    game.explosion.challengerId = v.challengerId;
    return;
  }
  // Failed: both clocks carry on from exactly where they stopped — unless
  // the holder has dropped meanwhile, in which case it stays frozen for them.
  if (presentPlayerIds.includes(game.holderId)) resume(game, now);
  else game.frozen.reason = "disconnect";
}

// =====================================================================
// (d) explosions, Short Rounds and Elimination
// =====================================================================

function explode(game, playerId, cause, now) {
  game.phase = "explode";
  game.vote = null;
  game.frozen = null;
  game.deadline = null;
  game.fuseDeadline = null;
  game.explodeEndsAt = now + EXPLODE_MS;
  const result = { playerId, cause, kind: game.potato.kind, passes: game.potato.passes, points: {} };

  if (game.mode === "rounds") {
    for (const pid of game.cycle) {
      if (game.removed.has(pid)) continue;
      const pts = pid === playerId ? 0 : ROUND_POINTS;
      result.points[pid] = pts;
      if (pts) game.scores.set(pid, (game.scores.get(pid) ?? 0) + pts);
    }
    result.gameOver = game.roundIndex + 1 >= game.totalRounds;
  } else {
    const left = loseLife(game, playerId);
    result.livesLeft = left;
    if (left === 0) result.eliminated = true;
    if (activePlayers(game).length <= 1) finishMatch(game, result);
  }
  game.explosion = result;
  game.lastEvent = null;
}

// One player left: place everyone by reverse elimination order and bank
// the placement points.
function finishMatch(game, result) {
  const order = [...activePlayers(game), ...[...game.eliminated].reverse()];
  game.placements = order.map((pid, i) => {
    const points = PLACEMENT_POINTS[i] ?? 0;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    return { playerId: pid, place: i + 1, points };
  });
  result.matchOver = true;
  result.gameOver = game.matchIndex + 1 >= game.totalMatches;
}

// After the explosion beat: next potato, next match (host), or the end.
function afterExplosion(game, presentPlayerIds, now) {
  const r = game.explosion;
  if (r.gameOver) {
    game.phase = "final";
    game.explodeEndsAt = null;
    return;
  }
  if (r.matchOver) return; // the host starts the next match
  startPotato(game, nextActiveAfter(game, r.playerId) ?? activePlayers(game)[0], now);
}

export function nextMatch(game, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "explode" || !game.explosion?.matchOver || game.explosion.gameOver) return { ok: false };
  game.matchIndex += 1;
  startMatch(game, presentPlayerIds, now);
  return { ok: true };
}

// Not enough players left to keep passing (people left for good).
function collapse(game, now) {
  const left = activePlayers(game);
  if (game.mode === "elimination") {
    const result = { playerId: null, cause: "left", kind: game.potato?.kind, passes: game.potato?.passes ?? 0, points: {} };
    finishMatch(game, result);
    game.phase = "explode";
    game.vote = null;
    game.frozen = null;
    game.explosion = result;
    game.explodeEndsAt = now + EXPLODE_MS;
  } else if (left.length < 2) {
    game.phase = "final";
  }
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// Server-interval hook (server/index.js). Returns true if state changed.
export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "intro":
      if (now < game.introEndsAt) return false;
      lightPotato(game, presentPlayerIds, now);
      return true;

    case "live": {
      if (game.vote) {
        const before = game.vote;
        maybeResolveVote(game, presentPlayerIds, now);
        return game.vote !== before;
      }
      if (game.frozen) {
        // A frozen-for-disconnect holder who's back picks up where they were.
        if (game.frozen.reason === "disconnect" && presentPlayerIds.includes(game.holderId)) {
          resume(game, now);
          return true;
        }
        return false;
      }
      if (game.fuseDeadline != null && now >= game.fuseDeadline) {
        explode(game, game.holderId, "fuse", now);
        return true;
      }
      if (now > game.deadline + PASS_GRACE_MS) {
        explode(game, game.holderId, "timeout", now);
        return true;
      }
      return false;
    }

    case "explode":
      if (game.explodeEndsAt == null || now < game.explodeEndsAt) return false;
      if (game.explosion?.matchOver && !game.explosion.gameOver) return false; // host starts the next match
      afterExplosion(game, presentPlayerIds, now);
      return true;

    default:
      return false;
  }
}

// The connected set changed. `final` = a player is gone for good.
export function reconcilePresence(game, presentPlayerIds, { final = false } = {}) {
  const now = Date.now();
  if (final) {
    const gone = game.roster.filter((pid) => !presentPlayerIds.includes(pid) && !game.removed.has(pid));
    for (const pid of gone) removeFromGame(game, pid, presentPlayerIds, now);
  }
  if (game.phase !== "live") return;
  if (game.vote) {
    maybeResolveVote(game, presentPlayerIds, now);
    if (game.phase !== "live" || game.vote) return;
  }
  const holderHere = presentPlayerIds.includes(game.holderId);
  if (!holderHere) freeze(game, "disconnect", now);
  else if (game.frozen?.reason === "disconnect") resume(game, now);
}

// Gone for good: out of the cycle. Holding the potato? It moves on to the
// next active player with no penalty, fuse untouched.
function removeFromGame(game, pid, presentPlayerIds, now) {
  const wasActive = isActive(game, pid);
  game.removed.add(pid);
  if (game.mode === "elimination" && wasActive && !game.eliminated.includes(pid)) game.eliminated.push(pid);
  if (game.phase !== "live" && game.phase !== "intro") return;

  if (activePlayers(game).length < 2) {
    collapse(game, now);
    return;
  }
  if (game.phase === "intro") {
    if (game.potato.starterId === pid) game.potato.starterId = nextActiveAfter(game, pid);
    return;
  }
  // Their answer can't be challenged any more (they can't take a hit).
  if (game.vote?.passerId === pid) {
    game.vote = null;
    if (game.frozen?.reason === "vote") game.frozen.reason = "disconnect";
  }
  if (game.lastPass?.fromId === pid) game.lastPass = null;
  if (game.holderId === pid) {
    const fuseLeft = game.frozen?.fuseLeftMs ?? (game.fuseDeadline != null ? game.fuseDeadline - now : null);
    const to = nextActiveAfter(game, pid);
    game.lastPass = null;
    game.vote = null;
    beginTurn(game, to, now);
    if (fuseLeft != null) game.fuseDeadline = now + Math.max(0, fuseLeft);
    game.lastEvent = { type: "left", playerId: pid, turnId: game.turnId };
    if (!presentPlayerIds.includes(to)) freeze(game, "disconnect", now);
  }
}

// Host "Force proceed": an idle holder's potato moves on with NO penalty
// (a fresh turn for the next player); a running vote closes on the votes
// cast; the intro / explosion beats skip ahead; a finished match starts
// the next one.
export function forceAdvance(game, presentPlayerIds) {
  const now = Date.now();
  switch (game.phase) {
    case "intro":
      lightPotato(game, presentPlayerIds, now);
      break;
    case "live": {
      if (game.vote) {
        resolveVote(game, presentPlayerIds, now);
        break;
      }
      const from = game.holderId;
      const to = nextActiveAfter(game, from);
      if (!to) break;
      const fuseLeft = game.frozen?.fuseLeftMs ?? (game.fuseDeadline != null ? game.fuseDeadline - now : null);
      game.lastPass = null; // nothing was said, so nothing to challenge
      beginTurn(game, to, now);
      if (fuseLeft != null) game.fuseDeadline = now + Math.max(0, fuseLeft);
      game.lastEvent = { type: "skipped", playerId: from, turnId: game.turnId };
      if (!presentPlayerIds.includes(to)) freeze(game, "disconnect", now);
      break;
    }
    case "explode":
      if (game.explosion?.matchOver && !game.explosion.gameOver) nextMatch(game, presentPlayerIds, now);
      else afterExplosion(game, presentPlayerIds, now);
      break;
    default:
      break;
  }
}

// Chaos: only players still in the cycle are active participants.
export function chaosParticipants(game, roster) {
  return roster.filter((pid) => isActive(game, pid));
}

// Tournament: game over once the final phase is reached (default), and
// standings are the running scores.
export function tournamentOptions() {
  return { mode: "rounds", rounds: 5, timerMode: "mixed", categories: [...CATEGORY_KEYS] };
}

// =====================================================================
// views
// =====================================================================

// PUBLIC view — identical for every player. It never carries the fuse,
// the fuse deadline, or anything computed from them. In a Hidden Fuse
// potato it doesn't even carry the turn window: only the holder sees that
// (privately, below).
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const scores = game.roster
    .filter((pid) => !game.removed.has(pid))
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const p = game.potato;

  const state = {
    id: game.id,
    mode: game.mode,
    timerMode: game.timerMode,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    matchIndex: game.matchIndex,
    totalMatches: game.totalMatches,
    startLives: game.startLives,
    cycle: game.cycle,
    activeIds: activePlayers(game),
    lives: Object.fromEntries(game.lives),
    eliminated: [...game.eliminated],
    removedIds: [...game.removed],
    challengeLimit: CHALLENGE_LIMIT,
    scores,
    category: p ? { key: p.categoryKey, name: p.categoryName } : null,
    potatoKind: p?.kind ?? null, // "sprint" | "hidden"
    speed: p?.speed ?? false,
    passes: p?.passes ?? 0,
    lastEvent: game.lastEvent,
  };

  if (game.phase === "intro") {
    state.starterId = p.starterId;
    state.introLeadMs = game.introLeadMs;
    state.categoryMs = CATEGORY_MS;
    state.countdownMs = COUNTDOWN_MS;
    state.introMs = INTRO_MS + game.introLeadMs;
    state.introMsLeft = Math.max(0, game.introEndsAt - now);
  }

  if (game.phase === "live") {
    state.holderId = game.holderId;
    state.nextId = nextActiveAfter(game, game.holderId);
    state.turnId = game.turnId;
    state.frozen = game.frozen ? game.frozen.reason : null;
    state.passLockMs = PASS_LOCK_MS;
    state.challengesUsed = Object.fromEntries(p.challengesUsed);
    state.lastPass = game.lastPass
      ? { seq: game.lastPass.seq, fromId: game.lastPass.fromId, toId: game.lastPass.toId, challenged: game.lastPass.challenged }
      : null;
    if (p.kind === "sprint") {
      state.turnMs = game.turnWindow;
      state.msLeft = turnLeft(game, now);
    }
    state.vote = game.vote
      ? {
          passerId: game.vote.passerId,
          challengerId: game.vote.challengerId,
          votedIds: [...game.vote.votes.keys()],
          voterCount: voters(game, presentPlayerIds).length,
          msLeft: Math.max(0, game.vote.deadline - now),
          voteMs: VOTE_MS,
        }
      : null;
  }

  if (game.phase === "explode") {
    state.explosion = game.explosion;
    state.explodeMsLeft = game.explodeEndsAt != null ? Math.max(0, game.explodeEndsAt - now) : null;
    state.placements = game.placements;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
    state.placements = game.placements;
  }
  return state;
}

// PRIVATE view. The holder of a Hidden Fuse potato gets their own 5s cap
// here — the only timing a Hidden Fuse potato ever shows anyone. Everyone
// gets their own vote, so the overlay can show it.
export function getPrivateState(game, playerId, now = Date.now()) {
  if (game.phase !== "live") return null;
  const out = { turnId: game.turnId };
  if (game.holderId === playerId && game.potato.kind === "hidden") {
    out.capMs = game.turnWindow;
    out.capMsLeft = turnLeft(game, now);
  }
  if (game.vote?.votes.has(playerId)) out.myVote = !game.vote.votes.get(playerId); // true = "valid"
  return { hotPotato: out };
}
