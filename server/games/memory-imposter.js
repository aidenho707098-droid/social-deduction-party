// "Memory Imposter" — a memory-flavoured social deduction game.
//
// Every round deals a secret SEQUENCE (digits, colored shapes or emoji).
// The Witnesses can see it for the whole round. The Imposter gets one
// brief look before it's hidden from them for good, and has to bluff as
// if they can still see it. Statements out loud, then private proof
// questions, then an evidence table, a discussion and a vote. The
// Imposter wins ONLY by evading the vote; memory just helps them survive.
//
//   phase:  roles -> memorize -> statements? -> questions -> evidence
//           -> discussion -> vote -> reveal -> (roles ...) -> final
//
// Every phase is server-timed: this module is pure state + timestamps and
// server/index.js drives tick() on a short interval.
//
// PRIVACY (verify in real traffic — hidden-data leaks have happened in
// other games):
//   * The sequence is in NO public state until the round's final reveal.
//   * getPrivateState() gives it to Witnesses all round, but to the
//     Imposter ONLY while their view window is running. Once it closes the
//     Imposter's payload carries the length and nothing else, every time,
//     including on reconnect.
//   * Correct answers to the proof questions, and everyone's answers, are
//     in no state (public or private) until the evidence reveal. Answer
//     correctness is computed here only.
//   * KNOWN LIMITS (by design, nothing to fix): a screenshot taken during
//     the view window, or a peek at a neighbour's phone, can't be
//     prevented by any server.

import { shuffle } from "./deck.js";
import {
  SEQUENCE_TYPES,
  DIFFICULTIES,
  CUSTOM_LENGTH,
  CUSTOM_VIEW_SEC,
  COUNT_MAX,
  generateRound,
  normalizeAnswer,
  promptOf,
} from "./memorySequence.js";

export const id = "memory-imposter";
// Working title — the client's catalogue entry mirrors it, and
// server/catalog.selftest.mjs keeps the two in sync.
export const name = "Memory Imposter";
export const minPlayers = 4;
export const maxPlayers = 10;

// ---- timings ----
export const ROLES_MS = 3_000;
export const TURN_MS = 15_000; // one spoken statement
export const EVIDENCE_MS = 9_000; // the animated table, before discussion opens
export const VOTE_MS = 20_000;
export const REVEAL_MS = 15_000; // the final reveal, before the next round deals
export const EXTEND_MS = 30_000;
const DISCUSSION_CAP_MS = 5 * 60_000;
const LATE_GRACE_MS = 500; // an answer/vote racing its clock still counts
const TWO_PASS_MAX_PLAYERS = 5; // 5 or fewer: two statement passes

// A Chaos takeover plays in front of the role reveal (client/src/chaos/
// ChaosOverlay.jsx: 1400 buildup + 2500 reveal + 550 out, + 3200 for a
// Risk It wager) — the role card waits for it, like Hot Potato's intro.
const CHAOS_TAKEOVER_MS = 1_400 + 2_500 + 550;
const CHAOS_WAGER_MS = 3_200;

// Chaos Speed Round, handled here rather than by the generic 10s clamp
// (the answer window is already under 10s): every clock in the round is
// cut short.
const SPEED = { answerMs: 5_000, turnMs: 8_000, discussionMs: 20_000, voteMs: 10_000 };

// ---- scoring (tune after a playtest) ----
export const CATCH_VOTER_POINTS = 3; // a Witness who voted for the Imposter
export const CATCH_OTHER_POINTS = 1; // every other Witness, when caught
export const EVADE_POINTS = 4; // the Imposter, when not caught

// ---- settings ----
export const QUESTIONS = { min: 3, max: 6, dflt: 4 };
export const ANSWER_SEC = { min: 6, max: 12, dflt: 8 };
export const DISCUSSION_SEC = { min: 30, max: 180, dflt: 60 };
export const ROUNDS = { min: 2, max: 20, dflt: 5 };

const clampInt = (v, { min, max, dflt }) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// The host's options, cleaned up. Exported so the client's settings
// summary and the selftest agree with what a game actually runs with.
export function resolveSettings(options = {}) {
  const sequenceType = SEQUENCE_TYPES.includes(options.sequenceType) ? options.sequenceType : "digits";
  const difficulty = ["easy", "medium", "hard", "custom"].includes(options.difficulty) ? options.difficulty : "easy";
  const preset = DIFFICULTIES[difficulty];
  const length = preset
    ? preset.length
    : clampInt(options.customLength, { min: CUSTOM_LENGTH.min, max: CUSTOM_LENGTH.max, dflt: 8 });
  const viewMs = preset
    ? preset.viewMs
    : clampInt(options.customViewSec, { min: CUSTOM_VIEW_SEC.min, max: CUSTOM_VIEW_SEC.max, dflt: 6 }) * 1000;
  return {
    sequenceType,
    difficulty,
    length,
    viewMs,
    questionCount: clampInt(options.questions, QUESTIONS),
    answerMs: clampInt(options.answerSec, ANSWER_SEC) * 1000,
    statements: options.statements !== false,
    discussionMs: clampInt(options.discussionSec, DISCUSSION_SEC) * 1000,
    rounds: clampInt(options.rounds, ROUNDS),
  };
}

// =====================================================================
// roster
// =====================================================================

// Still in this game (not gone for good).
function activeIds(game) {
  return game.roster.filter((pid) => !game.removed.has(pid));
}

// Who has to act right now: still in the game AND connected.
function presentActive(game, presentPlayerIds) {
  return activeIds(game).filter((pid) => presentPlayerIds.includes(pid));
}

// The next Imposter: a shuffled bag of everyone, no repeats until the bag
// is empty. Prefers someone who's connected right now.
function drawImposter(game, presentPlayerIds) {
  const live = (pid) => !game.removed.has(pid);
  game.imposterBag = game.imposterBag.filter(live);
  if (!game.imposterBag.length) game.imposterBag = shuffle(activeIds(game));
  const here = game.imposterBag.findIndex((pid) => presentPlayerIds.includes(pid));
  const [pid] = game.imposterBag.splice(here >= 0 ? here : 0, 1);
  return pid;
}

// =====================================================================
// lifecycle
// =====================================================================

export function createGame(playerIds, options = {}, rng = Math.random) {
  if (playerIds.length < minPlayers) throw new Error(`${name} needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`${name} supports at most ${maxPlayers} players.`);
  const settings = resolveSettings(options);
  const game = {
    id,
    settings,
    totalRounds: settings.rounds,
    roundIndex: 0,
    roundSerial: 0, // bumps on every deal, including a cancelled round's redo
    roster: [...playerIds],
    removed: new Set(),
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    imposterBag: shuffle(playerIds),
    rng,
    lastEvent: null,
    history: [], // [{ roundIndex, imposterId, caught }]
  };
  dealRound(game, playerIds, Date.now());
  return game;
}

function dealRound(game, presentPlayerIds, now) {
  const s = game.settings;
  const content = generateRound({ type: s.sequenceType, length: s.length, questionCount: s.questionCount }, game.rng);
  game.roundSerial += 1;
  game.round = {
    serial: game.roundSerial,
    imposterId: drawImposter(game, presentPlayerIds),
    type: content.type,
    alphabet: content.alphabet,
    sequence: content.sequence,
    questions: content.questions,
    speed: false,
    // Per player, per question: { value, final }. Drafts count on expiry.
    answers: new Map(),
    votes: new Map(),
    turns: null,
    questionIndex: 0,
    viewLeftMs: null, // the Imposter's view window, frozen while they're away
    hold: false,
    result: null,
    evidence: null,
  };
  game.phase = "roles";
  game.leadMs = 0;
  game.windowMs = ROLES_MS;
  game.deadline = now + ROLES_MS;
}

// Chaos layer hook: the role card waits out the takeover; note Speed Round.
export function onChaosAnnounced(game, modifier) {
  if (game.phase !== "roles") return;
  if (modifier?.id === "speed-round") game.round.speed = true;
  if (game.leadMs > 0) return;
  const lead = CHAOS_TAKEOVER_MS + (modifier?.id === "risk-it" ? CHAOS_WAGER_MS : 0);
  game.leadMs = lead;
  game.deadline += lead;
}

const clockFor = (game, key) => (game.round.speed ? SPEED[key] : game.settings[key]);
const turnMsOf = (game) => (game.round.speed ? SPEED.turnMs : TURN_MS);
const voteMsOf = (game) => (game.round.speed ? SPEED.voteMs : VOTE_MS);

function setClock(game, ms, now) {
  game.windowMs = ms;
  game.deadline = now + ms;
}

// ---- memorize: the Imposter's view window -----------------------------

function startMemorize(game, presentPlayerIds, now) {
  game.phase = "memorize";
  game.leadMs = 0;
  setClock(game, game.settings.viewMs, now);
  game.round.viewLeftMs = null;
  game.round.hold = false;
  if (!presentPlayerIds.includes(game.round.imposterId)) holdMemorize(game, now);
}

// The Imposter dropped mid-look: freeze their window (everyone waits on a
// "waiting for them" screen) until they're back, or the rejoin grace runs
// out and the round is cancelled (reconcilePresence, final).
function holdMemorize(game, now) {
  if (game.round.hold) return;
  game.round.hold = true;
  game.round.viewLeftMs = Math.max(0, game.deadline - now);
  game.deadline = null;
}

function resumeMemorize(game, now) {
  if (!game.round.hold) return;
  game.round.hold = false;
  game.deadline = now + game.round.viewLeftMs;
  game.round.viewLeftMs = null;
}

// Window over: from here on the Imposter's private state never carries the
// sequence again (see getPrivateState).
function endMemorize(game, presentPlayerIds, now) {
  if (game.settings.statements) startStatements(game, presentPlayerIds, now);
  else startQuestions(game, now);
}

// ---- statements ------------------------------------------------------

function startStatements(game, presentPlayerIds, now) {
  const order = shuffle(activeIds(game));
  const passes = order.length <= TWO_PASS_MAX_PLAYERS ? 2 : 1;
  game.phase = "statements";
  game.round.turns = { order, passes, index: 0, turnId: 1, skipped: [] };
  setClock(game, turnMsOf(game), now);
  skipGoneSpeakers(game, now);
}

function turnSlots(game) {
  const t = game.round.turns;
  return t.order.length * t.passes;
}

function speakerAt(game, index) {
  const t = game.round.turns;
  return t.order[index % t.order.length];
}

// A player who left for good has no turn. (A momentary drop keeps theirs:
// they may still be in the room talking; their clock just runs out.)
function skipGoneSpeakers(game, now) {
  const t = game.round.turns;
  while (t.index < turnSlots(game) && game.removed.has(speakerAt(game, t.index))) t.index += 1;
  if (t.index >= turnSlots(game)) startQuestions(game, now);
}

// Exactly ONE step on: the current speaker's turn is over (Done, timeout,
// or a host skip). Never moves more than one live speaker per call.
function advanceTurn(game, now) {
  const t = game.round.turns;
  t.index += 1;
  t.turnId += 1;
  setClock(game, turnMsOf(game), now);
  skipGoneSpeakers(game, now);
}

export function statementDone(game, playerId, turnId, { asHost = false } = {}, now = Date.now()) {
  if (game.phase !== "statements") return { ok: false };
  const t = game.round.turns;
  if (turnId !== t.turnId) return { ok: false, stale: true };
  if (playerId !== speakerAt(game, t.index) && !asHost) return { ok: false };
  advanceTurn(game, now);
  return { ok: true };
}

// ---- proof questions -------------------------------------------------

function startQuestions(game, now) {
  game.phase = "questions";
  game.round.questionIndex = 0;
  setClock(game, clockFor(game, "answerMs"), now);
}

function answerRow(game, pid) {
  let row = game.round.answers.get(pid);
  if (!row) {
    row = game.round.questions.map(() => null);
    game.round.answers.set(pid, row);
  }
  return row;
}

// A tap is a DRAFT (counts if the clock runs out — "auto-submit on
// expiry"); `final` locks it in. Everyone present locking in moves on.
export function submitAnswer(game, playerId, qIndex, value, final, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "questions") return { ok: false };
  if (qIndex !== game.round.questionIndex) return { ok: false, stale: true };
  if (!activeIds(game).includes(playerId)) return { ok: false };
  if (game.deadline != null && now > game.deadline + LATE_GRACE_MS) return { ok: false, late: true };
  const q = game.round.questions[qIndex];
  const v = normalizeAnswer(q, value, game.round.alphabet);
  if (v == null) return { ok: false };
  const row = answerRow(game, playerId);
  if (row[qIndex]?.final) return { ok: false, locked: true };
  row[qIndex] = { value: v, final: final === true };
  maybeCloseQuestion(game, presentPlayerIds, now);
  return { ok: true };
}

function lockedIds(game) {
  const i = game.round.questionIndex;
  return activeIds(game).filter((pid) => game.round.answers.get(pid)?.[i]?.final);
}

function maybeCloseQuestion(game, presentPlayerIds, now) {
  const who = presentActive(game, presentPlayerIds);
  const locked = new Set(lockedIds(game));
  if (who.length && who.every((pid) => locked.has(pid))) closeQuestion(game, now);
}

function closeQuestion(game, now) {
  const r = game.round;
  if (r.questionIndex + 1 < r.questions.length) {
    r.questionIndex += 1;
    setClock(game, clockFor(game, "answerMs"), now);
  } else {
    startEvidence(game, now);
  }
}

// ---- evidence (correctness computed here, and only here) --------------

function buildEvidence(game) {
  const r = game.round;
  return {
    questions: r.questions.map((q, i) => publicQuestion(q, i, { withAnswer: true })),
    rows: activeIds(game).map((pid) => ({
      playerId: pid,
      answers: r.questions.map((q, i) => {
        const a = r.answers.get(pid)?.[i];
        const value = a ? a.value : null;
        return { value, correct: value != null && value === q.answer };
      }),
    })),
  };
}

function startEvidence(game, now) {
  game.phase = "evidence";
  game.round.evidence = buildEvidence(game);
  setClock(game, EVIDENCE_MS, now);
}

// ---- discussion -------------------------------------------------------

function startDiscussion(game, now) {
  game.phase = "discussion";
  setClock(game, clockFor(game, "discussionMs"), now);
}

export function extendDiscussion(game, now = Date.now()) {
  if (game.phase !== "discussion") return { ok: false };
  if (game.windowMs + EXTEND_MS > DISCUSSION_CAP_MS) return { ok: false, capped: true };
  game.windowMs += EXTEND_MS;
  game.deadline = Math.max(game.deadline, now) + EXTEND_MS;
  return { ok: true };
}

export function skipDiscussion(game, now = Date.now()) {
  if (game.phase !== "discussion") return { ok: false };
  startVote(game, now);
  return { ok: true };
}

// ---- vote ------------------------------------------------------------

function startVote(game, now) {
  game.phase = "vote";
  game.round.votes = new Map();
  setClock(game, voteMsOf(game), now);
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

// Plurality eliminates; a tie at the top (or no votes at all) means
// nobody is eliminated, so the Imposter evades.
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
    if (pid === r.imposterId) pts = caught ? 0 : EVADE_POINTS;
    else if (caught) pts = r.votes.get(pid) === r.imposterId ? CATCH_VOTER_POINTS : CATCH_OTHER_POINTS;
    points[pid] = pts;
    if (pts) game.scores.set(pid, (game.scores.get(pid) ?? 0) + pts);
  }
  r.result = {
    imposterId: r.imposterId,
    sequence: [...r.sequence],
    tally,
    votes: Object.fromEntries([...r.votes].filter(([v]) => active.includes(v))),
    eliminatedId,
    tie,
    caught,
    points,
  };
  game.history.push({ roundIndex: game.roundIndex, imposterId: r.imposterId, caught });
  game.phase = "reveal";
  setClock(game, REVEAL_MS, now);
}

// ---- next round / end ---------------------------------------------------

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

// The Imposter is gone for good (or the host forced past a held view
// window): no points for anyone, the same round number again with a fresh
// sequence and a NEW Imposter.
function cancelRound(game, reason, presentPlayerIds, now) {
  const leaver = game.round.imposterId;
  if (activeIds(game).length < 3) {
    game.lastEvent = { type: "cancelled", reason, playerId: leaver, serial: game.roundSerial };
    finish(game);
    return;
  }
  dealRound(game, presentPlayerIds, now);
  game.lastEvent = { type: "cancelled", reason, playerId: leaver, serial: game.roundSerial };
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// Server-interval hook (server/index.js). Returns true if state changed.
export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "roles":
      if (now < game.deadline) return false;
      startMemorize(game, presentPlayerIds, now);
      return true;
    case "memorize":
      if (game.round.hold) {
        if (!presentPlayerIds.includes(game.round.imposterId)) return false;
        resumeMemorize(game, now);
        return true;
      }
      if (!presentPlayerIds.includes(game.round.imposterId)) {
        holdMemorize(game, now);
        return true;
      }
      if (now < game.deadline) return false;
      endMemorize(game, presentPlayerIds, now);
      return true;
    case "statements":
      if (now < game.deadline) return false;
      advanceTurn(game, now); // timeout: exactly the next player
      return true;
    case "questions":
      if (now < game.deadline + LATE_GRACE_MS) return false;
      closeQuestion(game, now); // drafts stand as answers; nothing = no answer
      return true;
    case "evidence":
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
    if (!presentPlayerIds.includes(game.round.imposterId)) holdMemorize(game, now);
    else resumeMemorize(game, now);
  } else if (game.phase === "questions") {
    maybeCloseQuestion(game, presentPlayerIds, now);
  } else if (game.phase === "vote") {
    maybeCloseVote(game, presentPlayerIds, now);
  }
}

const ROUND_LIVE = new Set(["roles", "memorize", "statements", "questions", "evidence", "discussion", "vote"]);

function removeFromGame(game, pid, presentPlayerIds, now) {
  game.removed.add(pid);
  if (game.phase === "final") return;
  if (activeIds(game).length < 3) {
    finish(game);
    return;
  }
  const r = game.round;
  // The Imposter leaving ends the round: there's nobody left to catch.
  if (pid === r.imposterId && ROUND_LIVE.has(game.phase)) {
    cancelRound(game, "imposter-left", presentPlayerIds, now);
    return;
  }
  // A Witness leaving drops out of the questions and the vote: their row
  // leaves the evidence table, votes for them are void (re-vote), and the
  // statement order just skips them.
  if (r.evidence) r.evidence.rows = r.evidence.rows.filter((row) => row.playerId !== pid);
  r.votes.delete(pid);
  for (const [voter, target] of r.votes) if (target === pid) r.votes.delete(voter);
  if (game.phase === "statements" && speakerAt(game, r.turns.index) === pid) advanceTurn(game, now);
}

// Host "Force proceed": the current phase ends as if its clock ran out.
// A held view window (the Imposter dropped while memorizing) cancels the
// round and redeals with a new Imposter.
export function forceAdvance(game, presentPlayerIds) {
  const now = Date.now();
  switch (game.phase) {
    case "roles":
      startMemorize(game, presentPlayerIds, now);
      break;
    case "memorize":
      if (game.round.hold) cancelRound(game, "imposter-away", presentPlayerIds, now);
      else endMemorize(game, presentPlayerIds, now);
      break;
    case "statements":
      advanceTurn(game, now);
      break;
    case "questions":
      closeQuestion(game, now);
      break;
    case "evidence":
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
export function tournamentOptions() {
  return {
    rounds: 4,
    sequenceType: "digits",
    difficulty: "medium",
    questions: QUESTIONS.dflt,
    answerSec: ANSWER_SEC.dflt,
    statements: true,
    discussionSec: DISCUSSION_SEC.dflt,
  };
}

// =====================================================================
// views
// =====================================================================

// A question as anyone may see it. `answer` only with `withAnswer` (the
// evidence reveal onwards).
function publicQuestion(q, index, { withAnswer = false } = {}) {
  const out = { index, kind: q.kind, input: q.input, n: q.n, item: q.item, prompt: promptOf(q) };
  if (withAnswer) out.answer = q.answer;
  return out;
}

// PUBLIC view — identical for every player. Never the sequence (until the
// final reveal), never a correct answer or anyone's answer (until the
// evidence), never who the Imposter is (until the final reveal).
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const active = activeIds(game);
  const scores = active
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const r = game.round;
  const s = game.settings;

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    roundSerial: game.roundSerial,
    sequenceType: s.sequenceType,
    difficulty: s.difficulty,
    length: s.length,
    viewMs: s.viewMs,
    statementsOn: s.statements,
    questionCount: s.questionCount,
    participantIds: active,
    removedIds: [...game.removed],
    scores,
    speed: r?.speed ?? false,
    lastEvent: game.lastEvent,
    windowMs: game.windowMs,
    msLeft: game.deadline != null ? Math.max(0, game.deadline - now) : null,
  };

  if (game.phase === "roles") state.leadMs = game.leadMs;

  if (game.phase === "memorize") {
    state.hold = r.hold ? { playerId: r.imposterId } : null;
    if (r.hold) state.msLeft = r.viewLeftMs;
  }

  if (game.phase === "statements") {
    const t = r.turns;
    state.turns = {
      order: t.order,
      passes: t.passes,
      index: t.index,
      total: turnSlots(game),
      pass: Math.floor(t.index / t.order.length) + 1,
      turnId: t.turnId,
      speakerId: speakerAt(game, t.index),
      nextId: t.index + 1 < turnSlots(game) ? speakerAt(game, t.index + 1) : null,
    };
  }

  if (game.phase === "questions") {
    const i = r.questionIndex;
    state.question = publicQuestion(r.questions[i], i);
    state.answeredIds = lockedIds(game);
    state.waitingOn = presentActive(game, presentPlayerIds).length;
  }

  if (["questions", "evidence", "discussion", "vote", "reveal"].includes(game.phase)) {
    state.choices = r.type === "digits" ? null : [...r.alphabet];
    state.countMax = COUNT_MAX;
  }

  if (["evidence", "discussion", "vote", "reveal"].includes(game.phase)) {
    state.evidence = r.evidence;
  }

  if (game.phase === "vote") {
    state.votedIds = active.filter((pid) => r.votes.has(pid));
  }

  if (game.phase === "reveal") state.result = r.result;

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((x) => x.score === top).map((x) => x.playerId) : [];
    state.history = game.history;
  }
  return state;
}

// PRIVATE view. `serial` ties it to one deal, so a client never shows a
// stale role from a cancelled round.
export function getPrivateState(game, playerId, now = Date.now()) {
  if (game.phase === "final" || !game.round) return null;
  const r = game.round;
  if (!game.roster.includes(playerId) || game.removed.has(playerId)) return null;
  const isImposter = playerId === r.imposterId;
  const out = { serial: r.serial, role: isImposter ? "imposter" : "witness", length: r.sequence.length };

  if (!isImposter) {
    if (game.phase !== "roles") out.sequence = [...r.sequence];
  } else if (game.phase === "memorize" && !r.hold && game.deadline != null && now < game.deadline) {
    // The ONLY time the Imposter is sent the sequence.
    out.sequence = [...r.sequence];
    out.viewMs = game.settings.viewMs;
    out.viewMsLeft = game.deadline - now;
  }

  // My own answer to the current question (draft or locked), so a refresh
  // mid-question restores the selection. Never anyone else's.
  if (game.phase === "questions") {
    const a = r.answers.get(playerId)?.[r.questionIndex];
    out.myAnswer = a ? { qIndex: r.questionIndex, value: a.value, final: a.final } : null;
  }
  if (game.phase === "vote") out.myVote = r.votes.get(playerId) ?? null;
  return { memoryImposter: out };
}
