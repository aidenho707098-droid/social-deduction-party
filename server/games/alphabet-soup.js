// "Alphabet Soup" — a category-and-letter word game with two host modes.
//
// Every round deals a CATEGORY and a LETTER (letters come from a pool
// without Q/U/V/X/Y/Z, and each category only ever pairs with letters it
// has plenty of answers for — see alphabetSoupBank.js). Then:
//
//   TYPED  — everyone answers at once on their own phone: up to 5 answers
//            in 40s, each locked in the moment it's sent. Answers are
//            AI-checked in the background (server/categoryValidator.js),
//            then scored for RARITY across the room. Players may dispute
//            one rejected answer each; the room votes.
//   SPOKEN — turn-based elimination. Say an answer out loud and tap "Said
//            it" before the (shrinking) turn clock runs out; anyone may
//            challenge, and the room votes. 3 lives each, last one standing
//            wins the round.
//
//   phase:  intro -> answer -> checking -> review -> reveal   (typed)
//           intro -> turns -> reveal                           (spoken)
//           ... -> (intro ...) -> final
//
// "intro" is the letter-reveal animation. The server has ALREADY chosen
// the letter when it starts; every client animates toward it from the
// same room_update, and the answer / first-turn clock only starts once the
// server's own intro timer has run out — nobody loses answering time to
// the animation (or to a Chaos takeover played in front of it).
//
// HIDDEN INFORMATION (typed): while answering, nobody's answer text leaves
// the server except to its author via getPrivateState(). The public state
// carries COUNTS only ("Sam 3/5") plus who's done.
//
// This module is pure state + timestamps. Async validation is driven from
// outside (server/alphabetSoupRuntime.js) through takeValidationJobs() /
// recordValidation(), and clocks advance through tick().

import { shuffle } from "./deck.js";
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  CATEGORY_KEYS,
  LETTER_POOL,
  RANDOM_CATEGORY,
} from "./alphabetSoupBank.js";
import {
  canonicalAnswer,
  cleanAnswer,
  sameAnswer,
  startsWithLetter,
} from "./wordMatch.js";

export const id = "alphabet-soup";
export const name = "Alphabet Soup";
export const minPlayers = 3;
export const maxPlayers = 10;

export { CATEGORIES, RANDOM_CATEGORY, LETTER_POOL };
export const MODES = ["typed", "spoken"];

// ---- intro (letter reveal) ----
// Category chip slides in, then the soup swirls and lands. The client's
// animation is built from these same numbers (they're in the public state).
export const CATEGORY_MS = 1_000;
export const SWIRL_MS = 2_700;
const INTRO_SETTLE_MS = 400; // the landed tile holds a beat before the clock starts
export const INTRO_MS = CATEGORY_MS + SWIRL_MS + INTRO_SETTLE_MS;
// When a Chaos Event fires at round start its full-screen takeover plays
// FIRST (client/src/chaos/ChaosOverlay.jsx: 1400 buildup + 2500 reveal +
// 550 out, plus a 3200 wager beat for Risk It), then the soup.
const CHAOS_TAKEOVER_MS = 1_400 + 2_500 + 550;
const CHAOS_WAGER_MS = 3_200;

// ---- typed ----
export const ANSWER_MS = 40_000;
export const ANSWER_CAP = 5;
const LATE_GRACE_MS = 1_500; // the expiry auto-submit still lands
const CHECK_MAX_MS = 12_000; // hard cap on waiting for validation after time's up
const DISPUTE_WINDOW_MS = 20_000; // how long players have to raise a dispute
export const DISPUTE_VOTE_MS = 10_000;

// Scoring (tune after a playtest).
export const UNIQUE_POINTS = 2;
export const SHARED_POINTS = 1;
export const MOST_UNIQUE_BONUS = 2;

// ---- spoken ----
export const START_LIVES = 3;
const TURN_START_MS = 10_000;
const TURN_STEP_MS = 1_000; // shaved off after every full cycle of turns
const TURN_MIN_MS = 4_000;
export const CHALLENGE_WINDOW_MS = 5_000;
export const CHALLENGE_VOTE_MS = 5_000;
export const CHALLENGE_LIMIT = 2; // per player, per round
const TAP_GRACE_MS = 400; // a "Said it" racing the buzzer still counts
// A disconnected ACTIVE player's turn waits this long for them to come
// back (fresh clock on return); after that the turn is skipped, no life
// lost. A player gone for good (rejoin grace expired / kicked) is
// eliminated from the round instead.
export const RECONNECT_WAIT_MS = 15_000;
const PLACEMENT_POINTS = [5, 3, 2, 1];

// ---------- round content ----------

// Letters this category could still use. With Burned Letters on, a letter
// used by ANY earlier round is gone; otherwise only this exact
// category+letter pair is avoided (so a game never repeats a prompt).
function availableLetters(game, catKey) {
  const cat = CATEGORY_BY_KEY[catKey];
  if (!cat) return [];
  return cat.letters.filter((l) =>
    game.burnedOn ? !game.burned.includes(l) : !game.usedPairs.has(`${catKey}|${l}`),
  );
}

// Pick the next round's category + letter. Categories rotate (least-used
// this game first, then ones not seen earlier this session) so a long game
// moves around the bank; the letter is uniform over what's left for it.
function pickRound(game) {
  const candidates = game.categories.filter((k) => availableLetters(game, k).length > 0);
  if (!candidates.length) return null;
  const uses = (k) => game.categoryUses.get(k) ?? 0;
  const fewest = Math.min(...candidates.map(uses));
  let pool = candidates.filter((k) => uses(k) === fewest);
  const fresh = pool.filter((k) => !game.sessionSeen.has(k));
  if (fresh.length) pool = fresh;
  const catKey = shuffle(pool)[0];
  const letters = availableLetters(game, catKey);
  const letter = shuffle(letters)[0];
  return { catKey, letter, eligibleLetters: letters };
}

// How many rounds can actually be dealt — Burned Letters caps the game at
// the number of distinct letters the chosen categories can use.
function roundCeiling(catKeys, burnedOn) {
  if (!burnedOn) return Infinity;
  const letters = new Set();
  for (const k of catKeys) for (const l of CATEGORY_BY_KEY[k]?.letters ?? []) letters.add(l);
  return letters.size;
}

// ---------- lifecycle ----------

export function createGame(playerIds, options = {}) {
  const { rounds, categories, memory } = options;
  if (playerIds.length < minPlayers) {
    throw new Error(`Alphabet Soup needs at least ${minPlayers} players.`);
  }
  if (playerIds.length > maxPlayers) {
    throw new Error(`Alphabet Soup supports at most ${maxPlayers} players.`);
  }
  const mode = options.mode === "spoken" ? "spoken" : "typed";
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const asked = Array.isArray(categories) ? categories : [];
  const randomMode = asked.includes(RANDOM_CATEGORY) || asked.length === 0;
  let catKeys = randomMode ? [...CATEGORY_KEYS] : asked.filter((k) => k in CATEGORY_BY_KEY);
  if (!catKeys.length) catKeys = [...CATEGORY_KEYS];
  const burnedOn = options.burnedLetters === true;

  const totalRounds = Math.min(requested, roundCeiling(catKeys, burnedOn));
  const seen = Array.isArray(memory?.seen) ? memory.seen : [];

  const game = {
    id,
    mode,
    phase: "intro",
    totalRounds,
    roundIndex: 0,
    categories: catKeys,
    randomMode,
    burnedOn,
    burned: [], // letters used so far (Burned Letters)
    usedPairs: new Set(), // "catKey|L" dealt this game
    categoryUses: new Map(),
    // Session no-repeat memory: categories seen in earlier games this room.
    // Restarts once the selected set has all been seen.
    sessionSeen: new Set(seen.filter((k) => catKeys.includes(k)).length >= catKeys.length ? [] : seen),
    deckMemory: { seen: [...seen] }, // server-only; harvested by index.js
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    seq: 0,
    lastResult: null,
  };
  if (!setupRound(game, 0, playerIds)) {
    throw new Error("No category and letter combinations available — pick more categories.");
  }
  return game;
}

function setupRound(game, roundIndex, presentPlayerIds, now = Date.now()) {
  const pick = pickRound(game);
  if (!pick) return false;

  const cat = CATEGORY_BY_KEY[pick.catKey];
  game.roundIndex = roundIndex;
  game.round = {
    categoryKey: cat.key,
    categoryName: cat.name,
    letter: pick.letter,
    // The letters the swirl may show: what this category could have landed
    // on (the chosen letter included), so the bowl never shows a letter
    // that was impossible this round.
    eligibleLetters: [...pick.eligibleLetters].sort(),
    burnedBefore: [...game.burned],
  };
  if (game.burnedOn) game.burned.push(pick.letter);
  game.usedPairs.add(`${cat.key}|${pick.letter}`);
  game.categoryUses.set(cat.key, (game.categoryUses.get(cat.key) ?? 0) + 1);
  game.sessionSeen.add(cat.key);
  if (!game.deckMemory.seen.includes(cat.key)) game.deckMemory.seen.push(cat.key);
  if (game.deckMemory.seen.length >= CATEGORY_KEYS.length) game.deckMemory.seen = [cat.key];

  // Everyone in the room when the round is dealt plays it (a disconnected
  // seat still in its rejoin grace included — they may be back any second).
  game.roundPlayers = [...presentPlayerIds];
  game.phase = "intro";
  game.introLeadMs = 0;
  game.introEndsAt = now + INTRO_MS;
  game.deadline = null;
  game.lastResult = null;

  // typed
  game.answers = new Map(game.roundPlayers.map((pid) => [pid, []]));
  game.doneIds = new Set();
  game.checkStartedAt = null;
  game.review = null;

  // spoken
  game.turnOrder = [];
  game.lives = new Map();
  game.eliminated = []; // playerIds, in elimination order
  game.challengesUsed = new Map();
  game.cycle = 0;
  game.cycleTurns = new Set();
  game.turnSeq = 0;
  game.currentTurnIndex = 0;
  game.subPhase = null;
  game.challenge = null;
  game.lastEvent = null;
  return true;
}

// Chaos layer hook (server/chaosRuntime.js calls this when an event is
// announced at the start of a round): the takeover plays in front of the
// soup, so push the intro — and therefore the answer clock — back by its
// length. Only ever applied once per round, and only during the intro.
export function onChaosAnnounced(game, modifier) {
  if (game.phase !== "intro" || game.introLeadMs > 0) return;
  const lead = CHAOS_TAKEOVER_MS + (modifier?.id === "risk-it" ? CHAOS_WAGER_MS : 0);
  game.introLeadMs = lead;
  game.introEndsAt += lead;
}

// The intro is over — open the round proper.
function startPlay(game, presentPlayerIds, now) {
  if (game.mode === "typed") {
    game.phase = "answer";
    game.deadline = now + ANSWER_MS;
    return;
  }
  game.phase = "turns";
  game.turnOrder = shuffle(game.roundPlayers);
  game.lives = new Map(game.roundPlayers.map((pid) => [pid, START_LIVES]));
  game.challengesUsed = new Map(game.roundPlayers.map((pid) => [pid, 0]));
  beginTurn(game, 0, presentPlayerIds, now);
}

export function nextRound(game, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds || !setupRound(game, game.roundIndex + 1, presentPlayerIds, now)) {
    game.totalRounds = Math.min(game.totalRounds, game.roundIndex + 1);
    game.phase = "final";
  }
}

// =====================================================================
// TYPED MODE
// =====================================================================

const REJECT_MESSAGES = {
  closed: "Answering is closed.",
  time: "Time's up.",
  done: "You've already finished this round.",
  full: `That's all ${ANSWER_CAP} answers.`,
  empty: "Type an answer first.",
  short: "That's too short to be an answer.",
  letter: "Doesn't start with the letter.",
  duplicate: "You already said that one.",
  notPlaying: "You're not in this round.",
};

function capped(game, pid) {
  return (game.answers.get(pid)?.length ?? 0) >= ANSWER_CAP;
}

function finishedTyping(game, pid) {
  return game.doneIds.has(pid) || capped(game, pid);
}

function checkAnswerEnd(game, presentPlayerIds, now) {
  if (game.phase !== "answer") return;
  const live = game.roundPlayers.filter((pid) => presentPlayerIds.includes(pid));
  if (live.length > 0 && live.every((pid) => finishedTyping(game, pid))) endAnswering(game, now);
}

// One answer, locked in on arrival. The instant checks (letter rule, a
// repeat of the player's OWN earlier answer) reject without using a slot;
// anything that passes takes a slot and is queued for category validation.
export function submitAnswer(game, playerId, rawText, presentPlayerIds, now = Date.now()) {
  const reject = (reason) => ({ ok: false, reason, message: REJECT_MESSAGES[reason] });
  if (game.mode !== "typed" || game.phase !== "answer") return reject("closed");
  if (!game.roundPlayers.includes(playerId)) return reject("notPlaying");
  if (now > game.deadline + LATE_GRACE_MS) return reject("time");
  if (game.doneIds.has(playerId)) return reject("done");
  const list = game.answers.get(playerId);
  if (list.length >= ANSWER_CAP) return reject("full");

  const text = cleanAnswer(rawText);
  if (!text) return reject("empty");
  if (canonicalAnswer(text).length < 2) return reject("short");
  if (!startsWithLetter(text, game.round.letter)) return reject("letter");
  if (list.some((a) => sameAnswer(a.text, text))) return reject("duplicate");

  game.seq += 1;
  const answer = {
    id: `a${game.seq}`,
    text,
    status: "pending", // pending | valid | invalid | unverified
    dispatched: false,
    retried: false,
    overturned: false,
  };
  list.push(answer);
  checkAnswerEnd(game, presentPlayerIds, now);
  return { ok: true, answer: { id: answer.id, text, status: answer.status }, count: list.length };
}

export function markDone(game, playerId, presentPlayerIds, now = Date.now()) {
  if (game.mode !== "typed" || game.phase !== "answer") return { ok: false };
  if (!game.roundPlayers.includes(playerId)) return { ok: false };
  game.doneIds.add(playerId);
  checkAnswerEnd(game, presentPlayerIds, now);
  return { ok: true };
}

function endAnswering(game, now) {
  game.phase = "checking";
  game.deadline = null;
  game.checkStartedAt = now;
  // An answer whose first check failed gets its one retry now.
  for (const list of game.answers.values()) {
    for (const a of list) {
      if (a.status === "unverified" && !a.retried) {
        a.status = "pending";
        a.retried = true;
        a.dispatched = false;
      }
    }
  }
}

// Validation jobs not yet sent — marks them dispatched. The runtime calls
// this after every submit and on every tick.
export function takeValidationJobs(game) {
  if (game.mode !== "typed" || (game.phase !== "answer" && game.phase !== "checking")) return [];
  const jobs = [];
  for (const [playerId, list] of game.answers) {
    for (const a of list) {
      if (a.status !== "pending" || a.dispatched) continue;
      a.dispatched = true;
      jobs.push({
        token: { roundIndex: game.roundIndex, playerId, answerId: a.id },
        categoryKey: game.round.categoryKey,
        categoryName: game.round.categoryName,
        letter: game.round.letter,
        answer: a.text,
      });
    }
  }
  return jobs;
}

// A validation came back. Returns true if it changed anything (so the
// runtime re-sends that player's private view). Stale results (a later
// round, an answer already settled) are ignored.
export function recordValidation(game, token, verdict) {
  if (game.mode !== "typed" || token?.roundIndex !== game.roundIndex) return false;
  if (game.phase !== "answer" && game.phase !== "checking") return false;
  const a = game.answers.get(token.playerId)?.find((x) => x.id === token.answerId);
  if (!a || a.status !== "pending") return false;
  a.dispatched = false;
  if (verdict === "valid" || verdict === "invalid") {
    a.status = verdict;
  } else if (game.phase === "checking" && !a.retried) {
    // Failed while time had already run out — this IS the round-end retry.
    a.retried = true; // stays "pending", re-queued
  } else {
    a.status = "unverified";
  }
  return true;
}

function anyPending(game) {
  for (const list of game.answers.values()) {
    if (list.some((a) => a.status === "pending")) return true;
  }
  return false;
}

// Is an answer accepted for scoring? Valid, or overturned on dispute, or
// never verifiable (the API failed twice) — the letter already matched, so
// benefit of the doubt.
function accepted(a) {
  return a.status === "valid" || a.status === "unverified" || a.overturned;
}

function finalizeChecking(game, presentPlayerIds, now) {
  for (const list of game.answers.values()) {
    for (const a of list) if (a.status === "pending") a.status = "unverified";
  }
  game.phase = "review";
  game.review = {
    startedAt: now,
    disputeDeadline: now + DISPUTE_WINDOW_MS,
    disputes: [],
    disputedBy: new Set(),
    settledIds: new Set(), // tapped "Looks good"
  };
  game.lastResult = computeTypedResult(game);
  checkReviewEnd(game, presentPlayerIds, now);
}

// Rarity scoring. Accepted answers are clustered across players with the
// shared fuzzy match (plurals, spacing/hyphens, small typos); a cluster
// given by ONE player is unique, by several is shared. Rejected answers get
// their own cards so everyone sees what bounced (and owners can dispute).
export function computeTypedResult(game) {
  const entries = [];
  for (const pid of game.roundPlayers) {
    for (const a of game.answers.get(pid) ?? []) {
      entries.push({ playerId: pid, answerId: a.id, text: a.text, ok: accepted(a), unverified: a.status === "unverified", overturned: a.overturned });
    }
  }

  const cluster = (list) => {
    const groups = [];
    for (const e of list) {
      const g = groups.find((grp) => grp.entries.some((x) => sameAnswer(x.text, e.text)));
      if (g) g.entries.push(e);
      else groups.push({ entries: [e] });
    }
    return groups;
  };

  const rows = new Map(
    game.roundPlayers.map((pid) => [pid, { playerId: pid, points: 0, unique: 0, shared: 0, invalid: 0, bonus: 0 }]),
  );
  const cards = [];

  for (const g of cluster(entries.filter((e) => e.ok))) {
    const playerIds = [...new Set(g.entries.map((e) => e.playerId))];
    const unique = playerIds.length === 1;
    const points = unique ? UNIQUE_POINTS : SHARED_POINTS;
    for (const pid of playerIds) {
      const r = rows.get(pid);
      r.points += points;
      if (unique) r.unique += 1;
      else r.shared += 1;
    }
    cards.push({
      key: canonicalAnswer(g.entries[0].text),
      text: g.entries[0].text,
      playerIds,
      answers: g.entries.map((e) => ({ playerId: e.playerId, answerId: e.answerId, text: e.text })),
      status: unique ? "unique" : "shared",
      points,
      overturned: g.entries.some((e) => e.overturned),
      unverified: g.entries.every((e) => e.unverified),
    });
  }

  for (const g of cluster(entries.filter((e) => !e.ok))) {
    for (const e of g.entries) rows.get(e.playerId).invalid += 1;
    cards.push({
      key: `x:${canonicalAnswer(g.entries[0].text)}`,
      text: g.entries[0].text,
      playerIds: [...new Set(g.entries.map((e) => e.playerId))],
      answers: g.entries.map((e) => ({ playerId: e.playerId, answerId: e.answerId, text: e.text })),
      status: "invalid",
      points: 0,
      overturned: false,
      unverified: false,
    });
  }

  // Most UNIQUE valid answers: +bonus each to everyone tied at the top.
  const topUnique = Math.max(0, ...[...rows.values()].map((r) => r.unique));
  const bonusIds = [];
  if (topUnique > 0) {
    for (const r of rows.values()) {
      if (r.unique === topUnique) {
        r.bonus = MOST_UNIQUE_BONUS;
        r.points += MOST_UNIQUE_BONUS;
        bonusIds.push(r.playerId);
      }
    }
  }

  const ORDER = { shared: 0, unique: 1, invalid: 2 };
  cards.sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.playerIds.length - a.playerIds.length);

  return {
    mode: "typed",
    cards,
    rows: [...rows.values()].sort((a, b) => b.points - a.points),
    bonusIds,
    topUnique,
  };
}

// ---- disputes ----

function rejectedAnswersOf(game, pid) {
  return (game.answers.get(pid) ?? []).filter((a) => !accepted(a));
}

function disputeVoters(game, dispute, presentPlayerIds) {
  return game.roundPlayers.filter((pid) => pid !== dispute.playerId && presentPlayerIds.includes(pid));
}

// Each player may dispute ONE of their own rejected answers, while the
// dispute window is open.
export function openDispute(game, playerId, answerId, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "review" || !game.review) return { ok: false, message: "Disputes are closed." };
  if (now > game.review.disputeDeadline) return { ok: false, message: "The dispute window has closed." };
  if (!game.roundPlayers.includes(playerId)) return { ok: false };
  if (game.review.disputedBy.has(playerId)) return { ok: false, message: "You've already used your dispute." };
  const a = (game.answers.get(playerId) ?? []).find((x) => x.id === answerId);
  if (!a || accepted(a)) return { ok: false, message: "Only your own rejected answers can be disputed." };

  game.seq += 1;
  const dispute = {
    id: `d${game.seq}`,
    playerId,
    answerId,
    text: a.text,
    votes: new Map(), // voterId -> true (overturn) | false (keep rejected)
    deadline: now + DISPUTE_VOTE_MS,
    resolved: false,
    overturned: null,
  };
  game.review.disputes.push(dispute);
  game.review.disputedBy.add(playerId);
  maybeResolveDispute(game, dispute, presentPlayerIds, now);
  return { ok: true, disputeId: dispute.id };
}

export function voteDispute(game, playerId, disputeId, overturn, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "review" || !game.review) return { ok: false };
  const d = game.review.disputes.find((x) => x.id === disputeId);
  if (!d || d.resolved) return { ok: false, message: "That vote has closed." };
  if (playerId === d.playerId) return { ok: false, message: "You can't vote on your own dispute." };
  if (!game.roundPlayers.includes(playerId)) return { ok: false };
  if (d.votes.has(playerId)) return { ok: false, message: "You've already voted." };
  d.votes.set(playerId, overturn === true);
  maybeResolveDispute(game, d, presentPlayerIds, now);
  checkReviewEnd(game, presentPlayerIds, now);
  return { ok: true };
}

// "Looks good" — a player with nothing to dispute (or who doesn't want to)
// says so, letting the review close early once everyone has.
export function settleReview(game, playerId, presentPlayerIds, now = Date.now()) {
  if (game.phase !== "review" || !game.review) return { ok: false };
  if (!game.roundPlayers.includes(playerId)) return { ok: false };
  game.review.settledIds.add(playerId);
  checkReviewEnd(game, presentPlayerIds, now);
  return { ok: true };
}

function resolveDispute(game, d) {
  if (d.resolved) return;
  const up = [...d.votes.values()].filter(Boolean).length;
  const down = d.votes.size - up;
  d.resolved = true;
  d.overturned = up > down; // a majority of votes cast; ties keep it rejected
  d.up = up;
  d.down = down;
  if (d.overturned) {
    const a = game.answers.get(d.playerId)?.find((x) => x.id === d.answerId);
    if (a) a.overturned = true;
    game.lastResult = computeTypedResult(game);
  }
}

function maybeResolveDispute(game, d, presentPlayerIds, now) {
  if (d.resolved) return;
  const voters = disputeVoters(game, d, presentPlayerIds);
  if (now >= d.deadline || voters.every((pid) => d.votes.has(pid))) resolveDispute(game, d);
}

// Has every present player either used their dispute, said "looks good",
// or got nothing to dispute?
function everyoneSettled(game, presentPlayerIds) {
  const r = game.review;
  return game.roundPlayers
    .filter((pid) => presentPlayerIds.includes(pid))
    .every((pid) => r.disputedBy.has(pid) || r.settledIds.has(pid) || rejectedAnswersOf(game, pid).length === 0);
}

function checkReviewEnd(game, presentPlayerIds, now) {
  if (game.phase !== "review" || !game.review) return;
  for (const d of game.review.disputes) maybeResolveDispute(game, d, presentPlayerIds, now);
  const windowClosed = now >= game.review.disputeDeadline || everyoneSettled(game, presentPlayerIds);
  const open = game.review.disputes.some((d) => !d.resolved);
  if (windowClosed && !open) finishReview(game);
}

// Disputes are done — the round's points are final. Fold them into the
// running scores (this is the moment the Chaos layer settles on).
function finishReview(game) {
  game.lastResult = computeTypedResult(game);
  for (const r of game.lastResult.rows) {
    if (r.points) game.scores.set(r.playerId, (game.scores.get(r.playerId) ?? 0) + r.points);
  }
  game.phase = "reveal";
}

// =====================================================================
// SPOKEN MODE
// =====================================================================

function turnWindowMs(game) {
  return Math.max(TURN_MIN_MS, TURN_START_MS - game.cycle * TURN_STEP_MS);
}

function isAlive(game, pid) {
  return (game.lives.get(pid) ?? 0) > 0;
}

function alivePlayers(game) {
  return game.turnOrder.filter((pid) => isAlive(game, pid));
}

function activePlayerId(game) {
  return game.turnOrder[game.currentTurnIndex] ?? null;
}

function beginTurn(game, index, presentPlayerIds, now) {
  game.currentTurnIndex = index;
  game.turnSeq += 1;
  game.challenge = null;
  const pid = activePlayerId(game);
  if (presentPlayerIds.includes(pid)) {
    game.subPhase = "turn";
    game.deadline = now + turnWindowMs(game);
  } else {
    game.subPhase = "waiting"; // their seat is held; see RECONNECT_WAIT_MS
    game.deadline = now + RECONNECT_WAIT_MS;
  }
}

function eliminate(game, pid) {
  game.lives.set(pid, 0);
  if (!game.eliminated.includes(pid)) game.eliminated.push(pid);
}

// The current turn is over. Optionally costs the active player a life, then
// hands the turn to EXACTLY the next player still alive in the fixed round
// order — never further (that's the timeout double-skip bug other games
// hit). A disconnected next player isn't skipped either: their turn opens
// in "waiting" and only passes on if they don't come back.
function endTurn(game, presentPlayerIds, now, { lifeLost = false } = {}) {
  const active = activePlayerId(game);
  if (active != null && lifeLost && isAlive(game, active)) {
    const left = (game.lives.get(active) ?? 0) - 1;
    if (left <= 0) eliminate(game, active);
    else game.lives.set(active, left);
  }

  // A cycle = every player still alive has had a turn since the last one.
  if (active != null) game.cycleTurns.add(active);
  const alive = alivePlayers(game);
  if (alive.length > 0 && alive.every((pid) => game.cycleTurns.has(pid))) {
    game.cycle += 1;
    game.cycleTurns = new Set();
  }

  if (alive.length <= 1) {
    finishSpokenRound(game);
    return;
  }
  const n = game.turnOrder.length;
  for (let step = 1; step <= n; step++) {
    const idx = (game.currentTurnIndex + step) % n;
    if (isAlive(game, game.turnOrder[idx])) {
      beginTurn(game, idx, presentPlayerIds, now);
      return;
    }
  }
}

function finishSpokenRound(game) {
  const survivors = alivePlayers(game);
  const order = [...survivors, ...[...game.eliminated].reverse()];
  const rows = order.map((pid, i) => {
    const placement = i + 1;
    const points = PLACEMENT_POINTS[i] ?? 0;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    return { playerId: pid, placement, points, lives: game.lives.get(pid) ?? 0 };
  });
  game.lastResult = { mode: "spoken", rows };
  game.phase = "reveal";
  game.subPhase = null;
  game.deadline = null;
  game.challenge = null;
}

function challengeVoters(game, presentPlayerIds) {
  const active = activePlayerId(game);
  return game.roundPlayers.filter((pid) => pid !== active && presentPlayerIds.includes(pid));
}

// The active player said their answer out loud — open the challenge window.
export function saidIt(game, playerId, turnSeq, presentPlayerIds, now = Date.now()) {
  if (game.mode !== "spoken" || game.phase !== "turns" || game.subPhase !== "turn") return { ok: false };
  if (playerId !== activePlayerId(game)) return { ok: false, message: "It's not your turn." };
  if (turnSeq != null && turnSeq !== game.turnSeq) return { ok: false };
  if (now > game.deadline + TAP_GRACE_MS) return { ok: false, message: "Too late!" };
  game.subPhase = "challenge";
  game.deadline = now + CHALLENGE_WINDOW_MS;
  game.challenge = { challengerId: null, votes: new Map() };
  return { ok: true };
}

// Any other player still in the round may challenge — at most
// CHALLENGE_LIMIT times a round, win or lose. The first challenge opens
// the vote; the challenger's own vote counts as "uphold".
export function challenge(game, playerId, turnSeq, presentPlayerIds, now = Date.now()) {
  if (game.mode !== "spoken" || game.phase !== "turns") return { ok: false };
  if (game.subPhase !== "challenge") {
    return { ok: false, message: game.subPhase === "vote" ? "Someone already challenged." : "Nothing to challenge." };
  }
  if (turnSeq != null && turnSeq !== game.turnSeq) return { ok: false };
  if (playerId === activePlayerId(game)) return { ok: false };
  if (!game.roundPlayers.includes(playerId) || !isAlive(game, playerId)) {
    return { ok: false, message: "Only players still in the round can challenge." };
  }
  const used = game.challengesUsed.get(playerId) ?? 0;
  if (used >= CHALLENGE_LIMIT) return { ok: false, message: "You're out of challenges this round." };
  game.challengesUsed.set(playerId, used + 1);
  game.subPhase = "vote";
  game.deadline = now + CHALLENGE_VOTE_MS;
  game.challenge = { challengerId: playerId, votes: new Map([[playerId, true]]) };
  maybeResolveChallenge(game, presentPlayerIds, now);
  return { ok: true };
}

// Everyone but the active player votes — including eliminated players.
export function voteChallenge(game, playerId, turnSeq, uphold, presentPlayerIds, now = Date.now()) {
  if (game.mode !== "spoken" || game.phase !== "turns" || game.subPhase !== "vote") return { ok: false };
  if (turnSeq != null && turnSeq !== game.turnSeq) return { ok: false };
  if (playerId === activePlayerId(game) || !game.roundPlayers.includes(playerId)) return { ok: false };
  if (game.challenge.votes.has(playerId)) return { ok: false, message: "You've already voted." };
  game.challenge.votes.set(playerId, uphold === true);
  maybeResolveChallenge(game, presentPlayerIds, now);
  return { ok: true };
}

function resolveChallenge(game, presentPlayerIds, now) {
  const votes = [...game.challenge.votes.values()];
  const up = votes.filter(Boolean).length;
  const down = votes.length - up;
  const upheld = up > down; // ties favour the active player
  game.lastEvent = {
    seq: game.turnSeq,
    type: upheld ? "upheld" : "overruled",
    playerId: activePlayerId(game),
    challengerId: game.challenge.challengerId,
    up,
    down,
  };
  endTurn(game, presentPlayerIds, now, { lifeLost: upheld });
}

function maybeResolveChallenge(game, presentPlayerIds, now) {
  if (game.subPhase !== "vote") return;
  const voters = challengeVoters(game, presentPlayerIds);
  if (now >= game.deadline || voters.every((pid) => game.challenge.votes.has(pid))) {
    resolveChallenge(game, presentPlayerIds, now);
  }
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// Server-interval hook (server/index.js's alphabet-soup ticker). Returns
// true if the state changed.
export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "intro":
      if (now < game.introEndsAt) return false;
      startPlay(game, presentPlayerIds, now);
      return true;

    case "answer":
      if (now <= game.deadline + LATE_GRACE_MS) return false;
      endAnswering(game, now);
      return true;

    case "checking":
      if (anyPending(game) && now < game.checkStartedAt + CHECK_MAX_MS) return false;
      finalizeChecking(game, presentPlayerIds, now);
      return true;

    case "review": {
      const before = JSON.stringify(reviewSnapshot(game));
      checkReviewEnd(game, presentPlayerIds, now);
      return game.phase !== "review" || JSON.stringify(reviewSnapshot(game)) !== before;
    }

    case "turns":
      return tickTurn(game, presentPlayerIds, now);

    default:
      return false;
  }
}

function reviewSnapshot(game) {
  return game.review?.disputes.map((d) => d.resolved) ?? [];
}

function tickTurn(game, presentPlayerIds, now) {
  const active = activePlayerId(game);
  switch (game.subPhase) {
    case "turn":
      if (now <= game.deadline + TAP_GRACE_MS) return false;
      game.lastEvent = { seq: game.turnSeq, type: "timeout", playerId: active };
      endTurn(game, presentPlayerIds, now, { lifeLost: true });
      return true;
    case "waiting":
      if (presentPlayerIds.includes(active)) {
        game.subPhase = "turn";
        game.deadline = now + turnWindowMs(game);
        return true;
      }
      if (now <= game.deadline) return false;
      game.lastEvent = { seq: game.turnSeq, type: "skipped", playerId: active };
      endTurn(game, presentPlayerIds, now);
      return true;
    case "challenge":
      if (now <= game.deadline) return false;
      game.lastEvent = { seq: game.turnSeq, type: "accepted", playerId: active };
      endTurn(game, presentPlayerIds, now);
      return true;
    case "vote":
      if (now < game.deadline) return false;
      resolveChallenge(game, presentPlayerIds, now);
      return true;
    default:
      return false;
  }
}

// The connected set changed. `final` = a player is gone for good (rejoin
// grace expired, or kicked).
export function reconcilePresence(game, presentPlayerIds, { final = false } = {}) {
  const now = Date.now();
  if (game.phase === "answer") checkAnswerEnd(game, presentPlayerIds, now);
  if (game.phase === "review") checkReviewEnd(game, presentPlayerIds, now);
  if (game.phase !== "turns") return;

  if (final) {
    // Gone for good mid-round: out of the rotation, placed as eliminated now.
    const active = activePlayerId(game);
    for (const pid of game.turnOrder) {
      if (!presentPlayerIds.includes(pid) && isAlive(game, pid) && pid !== active) eliminate(game, pid);
    }
    if (active != null && !presentPlayerIds.includes(active) && isAlive(game, active)) {
      eliminate(game, active);
      game.lastEvent = { seq: game.turnSeq, type: "left", playerId: active };
      endTurn(game, presentPlayerIds, now);
      return;
    }
    if (alivePlayers(game).length <= 1) {
      finishSpokenRound(game);
      return;
    }
  }

  const active = activePlayerId(game);
  if (game.subPhase === "turn" && !presentPlayerIds.includes(active)) {
    game.subPhase = "waiting";
    game.deadline = now + RECONNECT_WAIT_MS;
  } else if (game.subPhase === "waiting" && presentPlayerIds.includes(active)) {
    game.subPhase = "turn";
    game.deadline = now + turnWindowMs(game); // fresh clock on return
  } else if (game.subPhase === "vote") {
    maybeResolveChallenge(game, presentPlayerIds, now);
  }
}

// Host "Force proceed": push whatever's running forward, as if whoever
// hasn't acted gave no input (the app-wide meaning). A live spoken turn
// therefore counts as a TIMEOUT (a life lost) — which is also what lets a
// host drive a Spoken round to its end. A turn waiting on a disconnected
// player is skipped with no penalty, same as its reconnect window running
// out; an open challenge window closes with the answer accepted.
export function forceAdvance(game, presentPlayerIds) {
  const now = Date.now();
  switch (game.phase) {
    case "intro":
      startPlay(game, presentPlayerIds, now);
      break;
    case "answer":
      endAnswering(game, now);
      break;
    case "checking":
      finalizeChecking(game, presentPlayerIds, now);
      break;
    case "review":
      for (const d of game.review.disputes) resolveDispute(game, d);
      finishReview(game);
      break;
    case "turns":
      if (game.subPhase === "vote") {
        resolveChallenge(game, presentPlayerIds, now);
      } else {
        const type = { turn: "timeout", challenge: "accepted", waiting: "skipped" }[game.subPhase] ?? "skipped";
        game.lastEvent = { seq: game.turnSeq, type, playerId: activePlayerId(game) };
        endTurn(game, presentPlayerIds, now, { lifeLost: type === "timeout" });
      }
      break;
    case "reveal":
      nextRound(game, presentPlayerIds, now);
      break;
    default:
      break;
  }
}

// Chaos: only this round's players are active participants (anyone who
// wasn't dealt in sits it out).
export function chaosParticipants(game, roster) {
  const playing = game.roundPlayers ?? [];
  return roster.filter((pid) => playing.includes(pid));
}

// ---------- views ----------

// PUBLIC view — identical for every player. During "answer" it carries
// per-player COUNTS only; answer text appears once the round has closed
// (review / reveal).
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const state = {
    id: game.id,
    mode: game.mode,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    randomMode: game.randomMode,
    burnedOn: game.burnedOn,
    letterPool: LETTER_POOL,
    category: game.round ? { key: game.round.categoryKey, name: game.round.categoryName } : null,
    letter: game.round?.letter ?? null,
    burnedLetters: game.burnedOn ? game.round?.burnedBefore ?? [] : [],
    roundPlayerIds: game.roundPlayers ?? [],
    scores,
  };

  if (game.phase === "intro") {
    state.eligibleLetters = game.round.eligibleLetters;
    state.introLeadMs = game.introLeadMs;
    state.categoryMs = CATEGORY_MS;
    state.swirlMs = SWIRL_MS;
    state.introMs = INTRO_MS + game.introLeadMs;
    state.introMsLeft = Math.max(0, game.introEndsAt - now);
  }

  if (game.mode === "typed") {
    state.answerCap = ANSWER_CAP;
    if (game.phase === "answer") {
      state.answerMs = ANSWER_MS;
      state.msLeft = Math.max(0, game.deadline - now);
      state.progress = game.roundPlayers.map((pid) => ({
        playerId: pid,
        count: game.answers.get(pid)?.length ?? 0,
        done: finishedTyping(game, pid),
      }));
    }
    if (game.phase === "checking") {
      state.progress = game.roundPlayers.map((pid) => ({
        playerId: pid,
        count: game.answers.get(pid)?.length ?? 0,
        done: true,
      }));
    }
    if ((game.phase === "review" || game.phase === "reveal") && game.lastResult) {
      state.result = game.lastResult;
    }
    if (game.phase === "review" && game.review) {
      const r = game.review;
      state.disputeVoteMs = DISPUTE_VOTE_MS;
      state.disputeMsLeft = Math.max(0, r.disputeDeadline - now);
      state.disputedIds = [...r.disputedBy];
      state.settledIds = [...r.settledIds];
      state.disputes = r.disputes.map((d) => ({
        id: d.id,
        playerId: d.playerId,
        answerId: d.answerId,
        text: d.text,
        msLeft: d.resolved ? 0 : Math.max(0, d.deadline - now),
        votedIds: [...d.votes.keys()],
        voterCount: disputeVoters(game, d, presentPlayerIds).length,
        resolved: d.resolved,
        overturned: d.overturned,
        up: d.resolved ? d.up : null,
        down: d.resolved ? d.down : null,
      }));
    }
    if (game.phase === "reveal" && game.review) {
      state.disputes = game.review.disputes.map((d) => ({
        id: d.id,
        playerId: d.playerId,
        text: d.text,
        overturned: d.overturned,
        up: d.up,
        down: d.down,
        resolved: true,
      }));
    }
  }

  if (game.mode === "spoken") {
    state.startLives = START_LIVES;
    state.challengeLimit = CHALLENGE_LIMIT;
    if (game.phase === "turns") {
      const windowMs =
        game.subPhase === "turn"
          ? turnWindowMs(game)
          : game.subPhase === "challenge"
            ? CHALLENGE_WINDOW_MS
            : game.subPhase === "vote"
              ? CHALLENGE_VOTE_MS
              : RECONNECT_WAIT_MS;
      state.subPhase = game.subPhase;
      state.turnSeq = game.turnSeq;
      state.turnOrder = game.turnOrder;
      state.activePlayerId = activePlayerId(game);
      state.turnMs = windowMs; // the running window's full length
      state.turnWindowMs = turnWindowMs(game); // this cycle's turn length
      state.cycle = game.cycle;
      state.msLeft = Math.max(0, game.deadline - now);
      state.lives = Object.fromEntries(game.lives);
      state.challengesUsed = Object.fromEntries(game.challengesUsed);
      state.eliminated = [...game.eliminated];
      state.challenge = game.challenge
        ? {
            challengerId: game.challenge.challengerId,
            votedIds: [...game.challenge.votes.keys()],
            voterCount: challengeVoters(game, presentPlayerIds).length,
          }
        : null;
    }
    if (game.phase === "reveal" && game.lastResult) state.result = game.lastResult;
    state.lastEvent = game.lastEvent;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// PRIVATE view — the ONLY place a player's own typed answers (and their
// validation status) are assembled. Sent to one socket at a time.
export function getPrivateState(game, playerId) {
  if (game.mode === "typed") {
    if (game.phase !== "answer" && game.phase !== "checking" && game.phase !== "review") return null;
    const list = game.answers?.get(playerId);
    if (!list) return null;
    const myVotes = {};
    for (const d of game.review?.disputes ?? []) {
      if (d.votes.has(playerId)) myVotes[d.id] = d.votes.get(playerId);
    }
    return {
      alphabetSoup: {
        roundIndex: game.roundIndex,
        answers: list.map((a) => ({
          id: a.id,
          text: a.text,
          // "unverified" reads as still-checking to the player until the
          // round closes and it's accepted on the benefit of the doubt.
          status: a.overturned ? "valid" : a.status === "unverified" && game.phase !== "review" ? "pending" : a.status,
          overturned: a.overturned,
        })),
        done: game.doneIds.has(playerId),
        myVotes,
      },
    };
  }

  if (game.mode === "spoken" && game.phase === "turns" && game.challenge) {
    const v = game.challenge.votes.get(playerId);
    return { alphabetSoup: { turnSeq: game.turnSeq, myVote: v === undefined ? null : v } };
  }
  return null;
}

// Tournament Mode default config.
export function tournamentOptions() {
  return { mode: "typed", rounds: 3, categories: [RANDOM_CATEGORY], burnedLetters: false };
}
