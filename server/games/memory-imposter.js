// "Memory Imposter" — look, bluff, vote.
//
// Every round, EVERYONE memorizes the same secret sequence (digits, plain
// color swatches, neutral shapes, or a Mixed sequence of all three). Only
// when the look is over are roles dealt: one player is the Imposter, and
// their sequence is gone for good. Everyone else keeps theirs on screen.
// The room talks freely, out loud, then votes. The Imposter wins ONLY by
// evading the vote, and the harder the round, the more that's worth.
//
//   phase:  memorize -> roles -> discussion -> vote -> reveal
//           -> (memorize …) -> final
//
// Every phase is server-timed: this module is pure state + timestamps and
// server/index.js drives tick() on a short interval.
//
// PRIVACY (verify in real traffic — hidden-data leaks have happened in
// other games):
//   * During memorize, every player's private payload is identical in
//     shape (the sequence, nothing else) and NO role reaches any client.
//     The server picks the Imposter at round start but keeps it to itself
//     until the memorize phase ends.
//   * From the role reveal on, the Imposter's payload never carries the
//     sequence again, including on reconnect. Witnesses get theirs back on
//     a reload.
//   * The public state carries neither the sequence nor the Imposter
//     until the round's reveal.
//   * KNOWN LIMITS (by design, nothing to fix): the Imposter genuinely
//     SAW the sequence, so a screenshot taken during memorize, or a peek
//     at a neighbour's phone afterwards, can't be prevented by any server.

import { shuffle } from "./deck.js";
import {
  SEQUENCE_TYPES,
  PRESETS,
  LENGTH,
  VIEW_SEC,
  DIFFICULTY,
  progressFor,
  difficultyScore,
  evadePoints,
  nextRoundType,
  generateSequence,
} from "./memorySequence.js";

export const id = "memory-imposter";
// Working title — the client's catalogue entry mirrors it, and
// server/catalog.selftest.mjs keeps the two in sync.
export const name = "Memory Imposter";
export const minPlayers = 3;
export const maxPlayers = 10;

// ---- timings ----
export const ROLES_MS = 3_000;
export const VOTE_MS = 20_000;
export const REVEAL_MS = 15_000; // before the next round deals
const LATE_GRACE_MS = 500; // a vote racing its clock still counts

// A Chaos takeover plays at the start of a round (client/src/chaos/
// ChaosOverlay.jsx: 1400 buildup + 2500 reveal + 550 out, + 3200 for a
// Risk It wager). The sequence isn't shown until it's over, so nobody's
// look is spent under the overlay.
const CHAOS_TAKEOVER_MS = 1_400 + 2_500 + 550;
const CHAOS_WAGER_MS = 3_200;

// Chaos Speed Round, handled here (the generic 10s clamp would cut the
// look itself, which changes difficulty, not pace).
const SPEED = { discussionMs: 20_000, voteMs: 10_000 };

// ---- settings ----
export const DISCUSSION_SEC = { min: 30, max: 240, step: 15, dflt: 90 };
export const ROUNDS_MIN = 1;

// Old saved settings (v1) used a single `sequenceType`; Emoji is now
// Shapes. Anything else from v1 (questions, answerSec, statements) is
// simply ignored.
const LEGACY_TYPE = { digits: "digits", colors: "colors", emoji: "shapes", mixed: "mixed" };

const clampInt = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export function maxRoundsFor(playerCount) {
  return Math.max(ROUNDS_MIN, 2 * playerCount);
}

// The host's options, cleaned up (and migrated from v1).
export function resolveSettings(options = {}, playerCount = minPlayers) {
  let types = Array.isArray(options.sequenceTypes)
    ? options.sequenceTypes.filter((t) => SEQUENCE_TYPES.includes(t))
    : LEGACY_TYPE[options.sequenceType]
      ? [LEGACY_TYPE[options.sequenceType]]
      : [];
  types = SEQUENCE_TYPES.filter((t) => types.includes(t)); // dedupe, fixed order
  if (!types.length) types = ["digits"];

  const difficulty = ["easy", "medium", "hard", "custom"].includes(options.difficulty) ? options.difficulty : "easy";
  const preset = PRESETS[difficulty];
  const start = preset
    ? { ...preset }
    : {
        length: clampInt(options.customLength, LENGTH.min, LENGTH.max, 6),
        viewSec: clampInt(options.customViewSec, VIEW_SEC.min, VIEW_SEC.max, 15),
      };

  const discussionSec = clampInt(options.discussionSec, DISCUSSION_SEC.min, DISCUSSION_SEC.max, DISCUSSION_SEC.dflt);
  return {
    sequenceTypes: types,
    difficulty,
    start,
    rounds: clampInt(options.rounds, ROUNDS_MIN, maxRoundsFor(playerCount), playerCount),
    discussionMs: Math.round(discussionSec / DISCUSSION_SEC.step) * DISCUSSION_SEC.step * 1000,
  };
}

// =====================================================================
// roster
// =====================================================================

function activeIds(game) {
  return game.roster.filter((pid) => !game.removed.has(pid));
}

function presentActive(game, presentPlayerIds) {
  return activeIds(game).filter((pid) => presentPlayerIds.includes(pid));
}

// Uniform among everyone still in, except LAST round's Imposter. Anyone
// else may be picked again; there's no everyone-goes-once cycle. Prefers
// players who are connected right now.
function drawImposter(game, presentPlayerIds, exclude = []) {
  const active = activeIds(game).filter((pid) => !exclude.includes(pid));
  let pool = active.filter((pid) => pid !== game.lastImposterId);
  if (!pool.length) pool = active;
  const here = pool.filter((pid) => presentPlayerIds.includes(pid));
  const from = here.length ? here : pool;
  return from[Math.floor(game.rng() * from.length)];
}

// =====================================================================
// lifecycle
// =====================================================================

export function createGame(playerIds, options = {}, rng = Math.random) {
  if (playerIds.length < minPlayers) throw new Error(`${name} needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`${name} supports at most ${maxPlayers} players.`);
  const settings = resolveSettings(options, playerIds.length);
  const game = {
    id,
    settings,
    totalRounds: settings.rounds,
    roundIndex: 0,
    roundSerial: 0, // bumps on every deal, including a cancelled round's redo
    roster: [...playerIds],
    removed: new Set(),
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    typeBag: [],
    lastType: null,
    lastImposterId: null,
    rng,
    lastEvent: null,
    history: [], // [{ roundIndex, type, imposterId, caught }]
  };
  dealRound(game, playerIds, Date.now());
  return game;
}

// A fresh round: type from the bag, length + view time from the
// progression. `redo` (the Imposter left mid-round) keeps the type, length
// and view time and deals a new sequence + a new Imposter.
function dealRound(game, presentPlayerIds, now, redo = null) {
  let params;
  if (redo) {
    params = { type: redo.type, length: redo.length, viewSec: redo.viewSec };
  } else {
    const { type, bag } = nextRoundType(game.typeBag, game.settings.sequenceTypes, game.lastType, game.rng);
    game.typeBag = bag;
    game.lastType = type;
    params = { type, ...progressFor(game.settings.start, game.roundIndex) };
  }
  game.roundSerial += 1;
  game.round = {
    serial: game.roundSerial,
    ...params,
    viewMs: Math.round(params.viewSec * 1000),
    sequence: generateSequence(params.type, params.length, game.rng),
    // Chosen NOW, revealed to nobody until memorize ends.
    imposterId: drawImposter(game, presentPlayerIds, redo ? [redo.leaverId] : []),
    speed: false,
    votes: new Map(),
    lookStartsAt: now, // pushed back by a Chaos takeover
    shown: true, // false while a takeover delays the look
    hold: null, // { playerId, viewLeftMs } while someone who's memorizing is away
    watchers: presentActive(game, presentPlayerIds), // who the look waits for
    result: null,
  };
  game.phase = "memorize";
  game.windowMs = game.round.viewMs;
  game.deadline = now + game.round.viewMs;
}

// Chaos layer hook: the look waits out the takeover; note Speed Round.
export function onChaosAnnounced(game, modifier) {
  if (game.phase !== "memorize") return;
  if (modifier?.id === "speed-round") game.round.speed = true;
  if (game.round.lookStartsAt > Date.now() || game.round.leadApplied) return;
  const lead = CHAOS_TAKEOVER_MS + (modifier?.id === "risk-it" ? CHAOS_WAGER_MS : 0);
  game.round.leadApplied = true;
  game.round.shown = false;
  game.round.lookStartsAt += lead;
  game.deadline += lead;
}

function setClock(game, ms, now) {
  game.windowMs = ms;
  game.deadline = now + ms;
}

const looking = (game, now) => game.phase === "memorize" && !game.round.hold && now >= game.round.lookStartsAt;

// ---- memorize: everyone looks; a drop pauses the look for everyone ----

// Anyone who started the look and is away: freeze it (the sequence is
// hidden from everyone meanwhile) until they're back, or the rejoin grace
// runs out (reconcilePresence, final). The name shown is just "waiting for
// X", which says nothing about roles.
function holdMemorize(game, playerId, now) {
  if (game.round.hold) return;
  const started = now >= game.round.lookStartsAt;
  game.round.hold = {
    playerId,
    viewLeftMs: started ? Math.max(0, game.deadline - now) : game.round.viewMs,
    pushed: false, // the next tick re-sends private state, so clients drop their copy
  };
  game.deadline = null;
}

function resumeMemorize(game, now) {
  const h = game.round.hold;
  if (!h) return;
  game.round.hold = null;
  game.round.lookStartsAt = Math.min(game.round.lookStartsAt, now);
  game.deadline = now + h.viewLeftMs;
}

function missingWatcher(game, presentPlayerIds) {
  return game.round.watchers.find((pid) => !game.removed.has(pid) && !presentPlayerIds.includes(pid)) ?? null;
}

// ---- roles -> discussion -> vote ----------------------------------------

function startRoles(game, now) {
  game.phase = "roles";
  setClock(game, ROLES_MS, now);
}

function startDiscussion(game, now) {
  game.phase = "discussion";
  setClock(game, game.round.speed ? SPEED.discussionMs : game.settings.discussionMs, now);
}

export function skipDiscussion(game, now = Date.now()) {
  if (game.phase !== "discussion") return { ok: false };
  startVote(game, now);
  return { ok: true };
}

function startVote(game, now) {
  game.phase = "vote";
  game.round.votes = new Map();
  setClock(game, game.round.speed ? SPEED.voteMs : VOTE_MS, now);
}

// One vote each, never yourself, changeable until the vote closes.
export function submitVote(game, voterId, targetId, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "vote") return { ok: false };
  if (game.deadline != null && now > game.deadline + LATE_GRACE_MS) return { ok: false, late: true };
  const active = activeIds(game);
  if (!active.includes(voterId) || !active.includes(targetId)) return { ok: false };
  if (voterId === targetId) return { ok: false, self: true };
  game.round.votes.set(voterId, targetId);
  maybeCloseVote(game, presentPlayerIds, now);
  return { ok: true };
}

function maybeCloseVote(game, presentPlayerIds, now) {
  const who = presentActive(game, presentPlayerIds);
  if (who.length && who.every((pid) => game.round.votes.has(pid))) closeVote(game, now);
}

// Plurality eliminates; a tie at the top (or no votes) eliminates nobody,
// so the Imposter evades.
export function tallyVotes(votes, activePlayerIds) {
  const tally = Object.fromEntries(activePlayerIds.map((pid) => [pid, 0]));
  for (const [voter, target] of votes) {
    if (voter in tally && target in tally) tally[target] += 1;
  }
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((pid) => tally[pid] === top);
  const eliminatedId = top > 0 && leaders.length === 1 ? leaders[0] : null;
  return { tally, eliminatedId, tie: top > 0 && leaders.length > 1 };
}

function closeVote(game, now) {
  const r = game.round;
  const active = activeIds(game);
  const { tally, eliminatedId, tie } = tallyVotes(r.votes, active);
  const caught = eliminatedId === r.imposterId;
  const points = {};
  for (const pid of active) {
    let pts = 0;
    if (pid === r.imposterId) pts = caught ? 0 : evadePoints(r.length, r.viewSec);
    else if (caught && r.votes.get(pid) === r.imposterId) pts = DIFFICULTY.catchPoints;
    points[pid] = pts;
    if (pts) game.scores.set(pid, (game.scores.get(pid) ?? 0) + pts);
  }
  r.result = {
    imposterId: r.imposterId,
    sequence: [...r.sequence],
    type: r.type,
    length: r.length,
    viewSec: r.viewSec,
    difficultyScore: Math.round(difficultyScore(r.length, r.viewSec) * 100) / 100,
    evadeWorth: evadePoints(r.length, r.viewSec), // what getting away was (or would have been) worth
    tally,
    votes: Object.fromEntries([...r.votes].filter(([v]) => active.includes(v))),
    eliminatedId,
    tie,
    caught,
    points,
  };
  game.history.push({ roundIndex: game.roundIndex, type: r.type, imposterId: r.imposterId, caught });
  game.lastImposterId = r.imposterId;
  game.phase = "reveal";
  setClock(game, REVEAL_MS, now);
}

export function nextRound(game, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "reveal") return { ok: false };
  if (game.roundIndex + 1 >= game.totalRounds) {
    finish(game);
    return { ok: true };
  }
  game.roundIndex += 1;
  game.lastEvent = null;
  dealRound(game, presentPlayerIds, now);
  return { ok: true };
}

function finish(game) {
  game.phase = "final";
  game.deadline = null;
  game.windowMs = null;
}

// The Imposter is gone for good mid-round (or the host forced past a held
// look): no points, the same round again — same type, length and view time
// — with a new sequence and a new Imposter from the players left.
function cancelRound(game, reason, presentPlayerIds, now) {
  const r = game.round;
  if (activeIds(game).length < minPlayers) {
    finish(game);
    return;
  }
  dealRound(game, presentPlayerIds, now, { type: r.type, length: r.length, viewSec: r.viewSec, leaverId: r.imposterId });
  game.lastEvent = { type: "cancelled", reason, playerId: r.imposterId, serial: game.roundSerial };
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// Server-interval hook (server/index.js). Returns true if state changed —
// including the instant the look opens (the sequence goes out privately).
export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "memorize": {
      const r = game.round;
      const away = missingWatcher(game, presentPlayerIds);
      if (r.hold) {
        // A hold set by a disconnect (reconcilePresence) hasn't been pushed
        // privately yet: report a change so the sequence-free payload goes out.
        if (!r.hold.pushed) {
          r.hold.pushed = true;
          if (away) return true;
        }
        if (away) return false;
        resumeMemorize(game, now);
        return true;
      }
      if (away) {
        holdMemorize(game, away, now);
        return true;
      }
      // The look opening after a Chaos takeover is a private-state change.
      let changed = false;
      if (!r.shown && now >= r.lookStartsAt) {
        r.shown = true;
        changed = true;
      }
      if (now < game.deadline) return changed;
      startRoles(game, now);
      return true;
    }
    case "roles":
      if (now < game.deadline) return false;
      startDiscussion(game, now);
      return true;
    case "discussion":
      if (now < game.deadline) return false;
      startVote(game, now);
      return true;
    case "vote":
      if (now < game.deadline + LATE_GRACE_MS) return false;
      closeVote(game, now);
      return true;
    case "reveal":
      if (now < game.deadline) return false;
      nextRound(game, presentPlayerIds, now);
      return true;
    default:
      return false;
  }
}

// The connected set changed. `final` = somebody is gone for good (rejoin
// grace expired, or kicked).
export function reconcilePresence(game, presentPlayerIds, { final = false } = {}) {
  const now = Date.now();
  if (final) {
    const gone = game.roster.filter((pid) => !presentPlayerIds.includes(pid) && !game.removed.has(pid));
    for (const pid of gone) removeFromGame(game, pid, presentPlayerIds, now);
  }
  if (game.phase === "memorize") {
    const away = missingWatcher(game, presentPlayerIds);
    if (away && !game.round.hold) holdMemorize(game, away, now);
    else if (!away && game.round.hold) resumeMemorize(game, now);
    else if (away && game.round.hold) game.round.hold.playerId = away;
  } else if (game.phase === "vote") {
    maybeCloseVote(game, presentPlayerIds, now);
  }
}

const ROUND_LIVE = new Set(["memorize", "roles", "discussion", "vote"]);

function removeFromGame(game, pid, presentPlayerIds, now) {
  game.removed.add(pid);
  if (game.phase === "final") return;
  if (activeIds(game).length < minPlayers) {
    finish(game);
    return;
  }
  const r = game.round;
  // The Imposter leaving ends the round: there's nobody left to catch.
  if (pid === r.imposterId && ROUND_LIVE.has(game.phase)) {
    cancelRound(game, "imposter-left", presentPlayerIds, now);
    return;
  }
  // A Witness leaving drops out of the vote: votes for them are void.
  r.votes.delete(pid);
  for (const [voter, target] of r.votes) if (target === pid) r.votes.delete(voter);
}

// Host "Force proceed": the current phase ends as if its clock ran out. A
// look held for an absent Imposter cancels and redeals; held for anyone
// else, it just resumes without them.
export function forceAdvance(game, presentPlayerIds) {
  const now = Date.now();
  switch (game.phase) {
    case "memorize":
      if (game.round.hold?.playerId === game.round.imposterId) cancelRound(game, "imposter-away", presentPlayerIds, now);
      else startRoles(game, now);
      break;
    case "roles":
      startDiscussion(game, now);
      break;
    case "discussion":
      startVote(game, now);
      break;
    case "vote":
      closeVote(game, now);
      break;
    case "reveal":
      nextRound(game, presentPlayerIds, now);
      break;
    default:
      break;
  }
}

// Chaos: everyone still in the game plays every round.
export function chaosParticipants(game, roster) {
  return roster.filter((pid) => !game.removed.has(pid));
}

// Tournament: game over at "final" (default); standings = running scores.
export function tournamentOptions(playerIds = []) {
  return {
    sequenceTypes: ["digits"],
    difficulty: "medium",
    rounds: Math.max(minPlayers, playerIds.length),
    discussionSec: DISCUSSION_SEC.dflt,
  };
}

// =====================================================================
// views
// =====================================================================

// PUBLIC view — identical for every player. Never the sequence and never
// the Imposter until the round's reveal.
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const active = activeIds(game);
  const scores = active
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const r = game.round;

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    roundSerial: game.roundSerial,
    roundType: r?.type ?? null,
    length: r?.length ?? null,
    viewMs: r?.viewMs ?? null,
    difficulty: game.settings.difficulty,
    participantIds: active,
    removedIds: [...game.removed],
    scores,
    speed: r?.speed ?? false,
    lastEvent: game.lastEvent,
    windowMs: game.windowMs,
    msLeft: game.deadline != null ? Math.max(0, game.deadline - now) : null,
  };

  if (game.phase === "memorize") {
    state.hold = r.hold ? { playerId: r.hold.playerId } : null;
    if (r.hold) state.msLeft = r.hold.viewLeftMs;
    state.leadMsLeft = Math.max(0, r.lookStartsAt - now);
  }
  if (game.phase === "vote") state.votedIds = active.filter((pid) => r.votes.has(pid));
  if (game.phase === "reveal") state.result = r.result;
  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((x) => x.score === top).map((x) => x.playerId) : [];
    state.history = game.history;
  }
  return state;
}

// PRIVATE view. `serial` ties it to one deal, so a client never shows a
// stale sequence or role from a cancelled round.
//   memorize — { serial, sequence } for EVERYONE alike while the look is
//              open; no role, no hint of one.
//   roles … vote — { serial, role, sequence? }: the sequence for Witnesses
//              only. The Imposter's payload never carries it again.
export function getPrivateState(game, playerId, now = Date.now()) {
  if (game.phase === "final" || game.phase === "reveal" || !game.round) return null;
  if (!game.roster.includes(playerId) || game.removed.has(playerId)) return null;
  const r = game.round;
  if (game.phase === "memorize") {
    return { memoryImposter: looking(game, now) && now < game.deadline ? { serial: r.serial, sequence: [...r.sequence] } : { serial: r.serial } };
  }
  const isImposter = playerId === r.imposterId;
  const out = { serial: r.serial, role: isImposter ? "imposter" : "witness" };
  if (!isImposter) out.sequence = [...r.sequence];
  if (game.phase === "vote") out.myVote = r.votes.get(playerId) ?? null;
  return { memoryImposter: out };
}
