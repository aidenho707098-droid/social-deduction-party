// "Echo Chain" — a competitive memory game on a grid of tiles.
//
// Players take turns in a fixed order (shuffled once, at the start). On
// your turn you ECHO the whole chain so far from memory, tile by tile, then
// ADD one tile of your own to the end. A wrong tile or a timer running out
// is a MISS: one life off, the chain does not grow, the CORRECT chain is
// replayed once for everyone, and the next player echoes that same chain.
// At 0 lives you're out (you stay in the room and watch). The last player
// standing wins. There is no cap on the chain's length.
//
//   phase: countdown -> echo -> add -> echo -> add -> ...    (turn by turn)
//                        \-> miss -> replay -> echo ...     (wrong / timeout)
//          ... -> final
//
// A tile's identity is its POSITION (0 .. size*size-1, row by row); colour
// and note are client-side decoration (client/src/games/echoChain/board.js).
//
// SERVER-AUTHORITATIVE. The chain lives only here, as an array of tile
// indices. Every tap is validated in order against it; taps from anyone but
// the active player are ignored. The public state never carries the chain
// or the next expected tile — only its LENGTH and how far the active player
// has echoed — except during the replay after a miss, which is the one time
// everyone is shown the chain again. Taps themselves are public (that's the
// game: everyone watches the echo live), and a wrong tap shows the tile
// that WAS tapped, never the one that was due.
//
// The turn engine, lives and elimination are Hot Potato's (turnCycle.js).
// This module is pure state + timestamps; server/index.js drives tick().

import { shuffle } from "./deck.js";
import { activePlayers, freezeClocks, isActive, loseLife, nextActiveAfter, resumeClocks, wrapsAround } from "./turnCycle.js";
import {
  BEATS,
  DIFFICULTIES,
  LIVES,
  REPLAY,
  TIMERS,
  clampInt,
  pointsFor,
  replayDurationMs,
  replayFlashMs,
  replayIntervalMs,
} from "./echoChainRules.js";

export const id = "echo-chain";
export const name = "Echo Chain";
export const minPlayers = 2;
export const maxPlayers = 10;

export { TIMERS, REPLAY, BEATS, LIVES, DIFFICULTIES };

const CLOCKS = { deadline: "turnLeftMs" };

export function resolveSettings(options = {}) {
  return {
    difficulty: DIFFICULTIES[options.difficulty] ? options.difficulty : "easy",
    lives: clampInt(options.lives, LIVES.min, LIVES.max, LIVES.dflt),
  };
}

// =====================================================================
// (a) lifecycle, sequence and turns
// =====================================================================

export function createGame(playerIds, options = {}, now = Date.now()) {
  if (playerIds.length < minPlayers) throw new Error(`${name} needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`${name} supports at most ${maxPlayers} players.`);
  const { difficulty, lives } = resolveSettings(options);
  const size = DIFFICULTIES[difficulty].size;
  const cycle = shuffle([...playerIds]); // the fixed turn order, for the whole game
  return {
    id,
    difficulty,
    size,
    tileCount: size * size,
    startLives: lives,
    cycle,
    removed: new Set(),
    lives: new Map(playerIds.map((pid) => [pid, lives])),
    eliminated: [],
    eliminatedIn: new Map(), // pid -> the round they went out in
    seq: [], // THE CHAIN — tile indices. Never in a public payload outside the replay.
    round: 1,
    phase: "countdown",
    beatEndsAt: now + BEATS.countdownMs,
    activeId: null,
    turnId: 0,
    echoPos: 0, // correct echo taps so far this turn
    turnMs: null,
    deadline: null,
    frozen: null,
    tapSeq: 0,
    miss: null,
    missFrom: null, // whose seat the next turn walks on from
    replay: null,
    result: null,
  };
}

// A new turn for `pid`: echo the chain, or straight to adding when the
// chain is still empty (the very first turn).
function beginTurn(game, pid, presentPlayerIds, now) {
  game.turnId += 1;
  game.activeId = pid;
  game.echoPos = 0;
  game.frozen = null;
  game.miss = null;
  game.replay = null;
  game.phase = game.seq.length ? "echo" : "add";
  game.turnMs = game.phase === "echo" ? TIMERS.firstTapMs : TIMERS.addMs;
  game.deadline = now + game.turnMs;
  if (!presentPlayerIds.includes(pid)) freezeClocks(game, "disconnect", now, CLOCKS);
}

// Hand the turn to EXACTLY the next active player after `fromId`'s seat
// (`fromId` may just have gone out). Passing back over the start of the
// fixed order begins a new round.
function passTurn(game, fromId, presentPlayerIds, now) {
  const to = nextActiveAfter(game, fromId);
  if (!to) return finish(game, now);
  if (wrapsAround(game, fromId, to)) game.round += 1;
  beginTurn(game, to, presentPlayerIds, now);
}

function firstActive(game) {
  return game.cycle.find((pid) => isActive(game, pid)) ?? null;
}

function setTimer(game, ms, now) {
  game.turnMs = ms;
  game.deadline = now + ms;
}

// =====================================================================
// (b) taps — validated in order, broadcast live
// =====================================================================

const TAP_REJECT = {
  closed: "It's not tapping time.",
  notActive: "It's not your turn.",
  stale: "That tap was for an earlier turn.",
  frozen: "Hold on — the turn is paused.",
  bad: "That's not a tile.",
  late: "Too late — time ran out.",
};

// A tap is NOT kept in the state: it goes out once, as its own event
// (index.js emits the returned `tap` to the room), the moment it lands.
// Keeping recent taps in the public state would hand the NEXT player the
// tail of the chain while they echo it.
function tapEvent(game, playerId, tile, kind) {
  game.tapSeq += 1;
  return { n: game.tapSeq, tile, playerId, kind, turnId: game.turnId };
}

// `turnId` is optional: when given, a tap meant for an earlier turn is
// refused instead of landing on this one.
export function tap(game, playerId, tile, presentPlayerIds, { turnId = null, now = Date.now() } = {}) {
  const reject = (reason) => ({ ok: false, reason, message: TAP_REJECT[reason] });
  if (game.phase !== "echo" && game.phase !== "add") return reject("closed");
  if (playerId !== game.activeId) return reject("notActive");
  if (turnId != null && turnId !== game.turnId) return reject("stale");
  if (game.frozen) return reject("frozen");
  if (!Number.isInteger(tile) || tile < 0 || tile >= game.tileCount) return reject("bad");
  if (now > game.deadline + TIMERS.graceMs) return reject("late");

  if (game.phase === "echo") {
    if (tile !== game.seq[game.echoPos]) {
      const ev = tapEvent(game, playerId, tile, "wrong");
      miss(game, playerId, "wrong", now);
      return { ok: true, correct: false, tap: ev };
    }
    const ev = tapEvent(game, playerId, tile, "echo");
    game.echoPos += 1;
    if (game.echoPos === game.seq.length) {
      game.phase = "add";
      setTimer(game, TIMERS.addMs, now);
    } else {
      setTimer(game, TIMERS.nextTapMs, now);
    }
    return { ok: true, correct: true, tap: ev };
  }

  // ADD: the chain grows by exactly this tile, then the turn moves on.
  game.seq.push(tile);
  const ev = tapEvent(game, playerId, tile, "add");
  passTurn(game, playerId, presentPlayerIds, now);
  return { ok: true, added: true, tap: ev };
}

// =====================================================================
// (c) misses, replay and elimination
// =====================================================================

// `cause`: "wrong" | "timeout" | "skipped" (host force proceed) — one life
// off — or "left" (gone for good: out entirely).
function miss(game, playerId, cause, now) {
  let livesLeft;
  if (cause === "left") {
    livesLeft = 0;
    game.lives.set(playerId, 0);
    if (!game.eliminated.includes(playerId)) game.eliminated.push(playerId);
  } else {
    livesLeft = loseLife(game, playerId);
  }
  const out = livesLeft === 0;
  if (out && !game.eliminatedIn.has(playerId)) game.eliminatedIn.set(playerId, game.round);
  game.phase = "miss";
  game.miss = { playerId, cause, livesLeft, eliminated: out, chainLength: game.seq.length };
  game.missFrom = playerId;
  game.deadline = null;
  game.turnMs = null;
  game.frozen = null;
  game.beatEndsAt = now + BEATS.missMs;
}

// After the miss beat: the game may be over; otherwise replay the correct
// chain (if there is one) before the next player echoes it.
function afterMiss(game, presentPlayerIds, now) {
  if (activePlayers(game).length <= 1) return finish(game, now);
  if (!game.seq.length) return passTurn(game, game.missFrom, presentPlayerIds, now);
  startReplay(game, now);
}

function startReplay(game, now) {
  const n = game.seq.length;
  game.phase = "replay";
  game.replay = {
    startsAt: now + REPLAY.leadMs,
    intervalMs: replayIntervalMs(n),
    flashMs: replayFlashMs(n),
  };
  game.beatEndsAt = now + replayDurationMs(n);
}

// =====================================================================
// (d) rounds, scoring and the end
// =====================================================================

// Points = rounds survived (echoChainRules.pointsFor).
function pointsOf(game, pid, endedEarly) {
  return pointsFor({ eliminatedInRound: game.eliminatedIn.get(pid) ?? null, round: game.round, endedEarly });
}

function finish(game, now, { endedEarly = false } = {}) {
  game.phase = "final";
  game.activeId = null;
  game.deadline = null;
  game.frozen = null;
  game.replay = null;
  const alive = activePlayers(game);
  const rows = game.cycle
    .filter((pid) => !game.removed.has(pid))
    .map((pid) => ({ playerId: pid, score: pointsOf(game, pid, endedEarly), alive: alive.includes(pid) }))
    .sort((a, b) => b.score - a.score);
  const top = rows.length ? rows[0].score : 0;
  game.result = {
    endedEarly,
    chainLength: game.seq.length,
    round: game.round,
    rows,
    winnerIds: rows.filter((r) => r.score === top).map((r) => r.playerId),
    endedAt: now,
  };
}

// Host: stop here. Everyone still alive shares the top placement on the
// current round - 1.
export function endEarly(game, now = Date.now()) {
  if (game.phase === "final") return { ok: false };
  finish(game, now, { endedEarly: true });
  return { ok: true };
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// Server-interval hook (server/index.js). Returns true if state changed.
export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "countdown": {
      if (now < game.beatEndsAt) return false;
      const first = firstActive(game);
      if (!first) finish(game, now);
      else beginTurn(game, first, presentPlayerIds, now);
      return true;
    }
    case "echo":
    case "add":
      if (game.frozen) {
        if (game.frozen.reason === "disconnect" && presentPlayerIds.includes(game.activeId)) {
          resumeClocks(game, now, CLOCKS);
          return true;
        }
        return false;
      }
      if (now > game.deadline + TIMERS.graceMs) {
        miss(game, game.activeId, "timeout", now);
        return true;
      }
      return false;
    case "miss":
      if (now < game.beatEndsAt) return false;
      afterMiss(game, presentPlayerIds, now);
      return true;
    case "replay":
      if (now < game.beatEndsAt) return false;
      passTurn(game, game.missFrom, presentPlayerIds, now);
      return true;
    default:
      return false;
  }
}

// The connected set changed. `final` = a player is gone for good (rejoin
// grace expired, or kicked). `roomPlayerIds` (everyone still in the room,
// connected or not) tells who actually left; without it, anyone not
// connected is taken as gone.
export function reconcilePresence(game, presentPlayerIds, { final = false, roomPlayerIds = null } = {}) {
  const now = Date.now();
  if (final) {
    const inRoom = roomPlayerIds ?? presentPlayerIds;
    const gone = game.cycle.filter((pid) => !inRoom.includes(pid) && !game.removed.has(pid));
    for (const pid of gone) removeFromGame(game, pid, presentPlayerIds, now);
  }
  if (game.phase !== "echo" && game.phase !== "add") return;
  const here = presentPlayerIds.includes(game.activeId);
  if (!here) freezeClocks(game, "disconnect", now, CLOCKS);
  else if (game.frozen?.reason === "disconnect") resumeClocks(game, now, CLOCKS);
}

// Gone for good. The active player is eliminated, the chain is replayed
// once and the turn passes; anyone else just drops out of the order.
function removeFromGame(game, pid, presentPlayerIds, now) {
  const wasActive = isActive(game, pid);
  const wasTurn = pid === game.activeId && (game.phase === "echo" || game.phase === "add");
  if (wasTurn) {
    miss(game, pid, "left", now);
    game.removed.add(pid);
    return;
  }
  game.removed.add(pid);
  if (wasActive) {
    if (!game.eliminated.includes(pid)) game.eliminated.push(pid);
    if (!game.eliminatedIn.has(pid)) game.eliminatedIn.set(pid, game.round);
  }
  if (game.phase === "final") return;
  // The miss beat / replay finish first; afterMiss ends the game if needed.
  if (game.phase === "miss" || game.phase === "replay") return;
  if (activePlayers(game).length <= 1) finish(game, now);
}

// Host "Force proceed": a miss for the idle active player (frozen on a
// dropped player too); the countdown, miss beat and replay skip ahead.
export function forceAdvance(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "countdown":
      game.beatEndsAt = now;
      break;
    case "echo":
    case "add":
      miss(game, game.activeId, "skipped", now);
      break;
    case "miss":
    case "replay":
      game.beatEndsAt = now;
      break;
    default:
      return;
  }
  tick(game, presentPlayerIds, now);
}

// Tournament: game over at "final" (the default), standings = the points
// (rounds survived). Settings default to Easy with 2 lives.
export function tournamentOptions() {
  return { difficulty: "easy", lives: LIVES.dflt };
}

export function getFinalStandings(game) {
  if (game.result) return game.result.rows.map(({ playerId, score }) => ({ playerId, score }));
  return currentScores(game);
}

function currentScores(game) {
  return game.cycle
    .filter((pid) => !game.removed.has(pid))
    .map((pid) => ({ playerId: pid, score: pointsOf(game, pid, true) }))
    .sort((a, b) => b.score - a.score);
}

// =====================================================================
// views
// =====================================================================

// PUBLIC view — identical for every player, and the only view (there is no
// private state). It never carries the chain or the next expected tile,
// except `replay.tiles` while the replay is running.
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const state = {
    id: game.id,
    phase: game.phase,
    difficulty: game.difficulty,
    size: game.size,
    startLives: game.startLives,
    cycle: game.cycle,
    activeIds: activePlayers(game),
    removedIds: [...game.removed],
    lives: Object.fromEntries(game.lives),
    eliminated: [...game.eliminated],
    eliminatedIn: Object.fromEntries(game.eliminatedIn),
    round: game.round,
    chainLength: game.seq.length,
    turnId: game.turnId,
    activeId: game.activeId,
    nextId: game.activeId ? nextActiveAfter(game, game.activeId) : null,
    tapSeq: game.tapSeq,
    scores: game.result ? game.result.rows.map(({ playerId, score }) => ({ playerId, score })) : currentScores(game),
    timers: TIMERS,
  };

  if (game.phase === "countdown") {
    state.countdownMs = BEATS.countdownMs;
    state.msLeft = Math.max(0, game.beatEndsAt - now);
  }

  if (game.phase === "echo" || game.phase === "add") {
    state.echoPos = game.echoPos;
    state.turnMs = game.turnMs;
    state.msLeft = game.frozen ? game.frozen.turnLeftMs : Math.max(0, game.deadline - now);
    state.frozen = game.frozen ? game.frozen.reason : null;
  }

  if (game.phase === "miss") {
    state.miss = game.miss;
    state.msLeft = Math.max(0, game.beatEndsAt - now);
  }

  if (game.phase === "replay") {
    // The one time the chain leaves the server: the correct chain, replayed
    // once for everyone after a miss.
    state.miss = game.miss;
    state.replay = {
      tiles: [...game.seq],
      intervalMs: game.replay.intervalMs,
      flashMs: game.replay.flashMs,
      msUntilStart: game.replay.startsAt - now, // negative once it's under way
      msLeft: Math.max(0, game.beatEndsAt - now),
    };
  }

  if (game.phase === "final") {
    state.result = game.result;
    state.winnerIds = game.result.winnerIds;
  }
  return state;
}

export function getPrivateState() {
  return null;
}
