// "Who Am I?" — a deduction game where every player has a secret identity
// that everyone ELSE can see but they cannot. Players take turns asking
// yes/no questions out loud; the active player taps the group's spoken
// answer to record it, then either keeps asking (Yes) or passes the turn
// (No). On their own turn a player can instead type a guess at their
// identity; getting it right locks them in with a placement and reveals
// it to them.
//
//   phase:  turns -> reveal -> (turns -> ...) -> final
//
// PRIVATE INFORMATION: a player's own identity must never reach their own
// device before they've earned it (a correct guess) or the round ends.
// getPrivateState() below is the ONLY place that assembles a per-player
// view, and it is the one function in this file whose output must never be
// broadcast — see server/index.js's sendPrivateRoles, which addresses it to
// one socket at a time. It hands back a REDACTED list (every player's
// identity, except the requester's own row, which carries `identity: null`
// until they've correctly guessed) rather than the full assignment with the
// client expected to hide anything — the client never receives the secret
// in the first place.

import { shuffle, drawWithoutRepeats } from "./deck.js";
import { RANDOM_CATEGORY, CATEGORIES, CATEGORY_NAME, CATEGORY_KEYS, BANKS } from "./whoAmIBank.js";

export const id = "who-am-i";
export const name = "Who Am I?";
export const minPlayers = 2;
export const maxPlayers = 10;

export { CATEGORIES, CATEGORY_NAME, RANDOM_CATEGORY };

const QUESTION_MS = 30_000; // a question window, reset by each "Yes"
const GUESS_MS = 20_000; // the typing window once "Guess" is tapped
const QUESTION_CAP = 20; // Yes / No taps + wrong guesses, combined
const LATE_GRACE_MS = 1_500;

// Primary: placement by guess order. Secondary: an efficiency bonus for
// fewer questions used. Never-guessed (capped out) players score 0.
const PLACEMENT_POINTS = [5, 3, 2, 1];
const PLACEMENT_FLOOR = 1; // 5th correct guesser and later

function placementPointsFor(placement) {
  return PLACEMENT_POINTS[placement - 1] ?? PLACEMENT_FLOOR;
}

function efficiencyBonusFor(questionsAsked) {
  if (questionsAsked <= 5) return 3;
  if (questionsAsked <= 10) return 2;
  if (questionsAsked <= 15) return 1;
  return 0;
}

// ---------- lenient guess matching (mirrors emoji-movie.js / fake-artist.js) ----------

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^the/, "");
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function isCorrectGuess(rawGuess, entry) {
  const guess = normalize(rawGuess);
  if (guess.length < 2) return false;

  const targets = [entry.name, ...(entry.alts ?? [])].map(normalize).filter(Boolean);
  for (const target of targets) {
    if (guess === target) return true;
    const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
    if (tolerance > 0 && editDistance(guess, target) <= tolerance) return true;
    // Multi-word identities ("Harry Potter", "The Pentagon"): accept the
    // core name typed on its own ("potter", "harry").
    if (guess.length >= 4 && (target.includes(guess) || guess.includes(target))) return true;
  }
  return false;
}

// ---------- helpers ----------

const entryKey = (e) => `${e.category}|${e.name}`;

function activePlayerId(game) {
  return game.turnOrder[game.currentTurnIndex] ?? null;
}

// Hand the turn to the next player in the fixed round order who's neither
// done (guessed correctly / capped out) nor currently disconnected — never
// jumping further than the first such player, so a timeout or a pass never
// skips anyone out of turn. If everyone else is done/gone this lands back
// on the current (only remaining) player, which is correct: they keep going
// solo until they guess or cap out.
function advanceTurn(game, presentPlayerIds) {
  const n = game.turnOrder.length;
  if (n === 0) return;
  for (let step = 1; step <= n; step++) {
    const idx = (game.currentTurnIndex + step) % n;
    const pid = game.turnOrder[idx];
    if (!game.doneIds.has(pid) && presentPlayerIds.includes(pid)) {
      game.currentTurnIndex = idx;
      game.subPhase = "asking";
      game.deadline = Date.now() + QUESTION_MS;
      return;
    }
  }
  // Nobody eligible left to hand it to — the caller's checkRoundEnd (right
  // after) will close the round out.
}

function checkRoundEnd(game, presentPlayerIds) {
  if (game.phase !== "turns") return;
  if (presentPlayerIds.length > 0 && presentPlayerIds.every((pid) => game.doneIds.has(pid))) {
    revealRound(game, presentPlayerIds);
  }
}

// A wrong (or auto-submitted-empty) guess, or a "No": one more question
// against the cap, then the turn always moves on.
function resolveWrongOrEmptyGuess(game, playerId, presentPlayerIds) {
  const count = (game.questionsAsked.get(playerId) ?? 0) + 1;
  game.questionsAsked.set(playerId, count);
  let capped = false;
  if (count >= QUESTION_CAP) {
    capped = true;
    game.doneIds.add(playerId);
    game.cappedIds.add(playerId);
  }
  advanceTurn(game, presentPlayerIds);
  return capped;
}

function setupRound(game, roundIndex, presentPlayerIds) {
  game.roundIndex = roundIndex;
  const chunk = shuffle(game.roundEntries[roundIndex] ?? []).slice(0, presentPlayerIds.length);
  game.turnOrder = shuffle(presentPlayerIds);
  game.currentTurnIndex = 0;
  game.assignment = new Map(game.turnOrder.map((pid, i) => [pid, chunk[i]]));
  game.questionsAsked = new Map(presentPlayerIds.map((pid) => [pid, 0]));
  game.doneIds = new Set();
  game.cappedIds = new Set();
  game.placements = []; // playerIds in the order they correctly guessed
  game.subPhase = "asking"; // "asking" | "guessing"
  game.deadline = Date.now() + QUESTION_MS;
  game.lastResult = null;
  game.phase = "turns";
}

// ---------- lifecycle ----------

// `customThemes` = this room's AI "Custom Theme" batches (aiContent.js):
// [{ name, identities: [{ name, alts }] }]. A theme's name is its category
// key; it's selectable like a built-in category and labelled with its name.
export function createGame(playerIds, { rounds, categories, memory, customThemes = [] } = {}) {
  if (playerIds.length < minPlayers) {
    throw new Error(`Who Am I? needs at least ${minPlayers} players.`);
  }
  if (playerIds.length > maxPlayers) {
    throw new Error(`Who Am I? supports at most ${maxPlayers} players.`);
  }
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const banks = { ...BANKS };
  const categoryNames = { ...CATEGORY_NAME };
  for (const t of customThemes) {
    if (!t?.name || !Array.isArray(t.identities) || t.identities.length === 0) continue;
    banks[t.name] = t.identities.map((e) => ({ name: e.name, alts: e.alts ?? [] }));
    categoryNames[t.name] = t.name;
  }
  const allKeys = Object.keys(banks);

  const asked = Array.isArray(categories) ? categories : [];
  const randomMode = asked.includes(RANDOM_CATEGORY);
  let catKeys = randomMode ? allKeys : asked.filter((c) => c in banks);
  if (catKeys.length === 0) catKeys = CATEGORY_KEYS;

  const pool = catKeys.flatMap((k) => banks[k].map((e) => ({ ...e, category: k })));
  if (pool.length < playerIds.length) {
    throw new Error("Pick more categories — not enough identities for this many players.");
  }

  // Each round's identities are unique within the round. Rounds draw one
  // after another without repeats, so an identity only comes back in a
  // later round once the enabled pool has been used up.
  const totalRounds = requested;
  const roundEntries = [];
  let seenKeys = memory?.seen ?? [];
  for (let i = 0; i < totalRounds; i++) {
    const draw = drawWithoutRepeats(pool, playerIds.length, seenKeys, entryKey);
    roundEntries.push(draw.items);
    seenKeys = draw.seenKeys;
  }

  const game = {
    id,
    phase: "turns",
    totalRounds,
    roundIndex: 0,
    categories: catKeys,
    categoryNames, // key -> display name, custom themes included
    randomMode,
    roundEntries,
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    lastResult: null,
  };
  setupRound(game, 0, playerIds);
  return game;
}

// Active player taps the group's spoken answer. "Yes" keeps their turn
// (and resets the question clock); "No" passes it on. Either way counts as
// one question against their cap of 20.
export function askQuestion(game, playerId, answer, presentPlayerIds) {
  if (game.phase !== "turns" || game.subPhase !== "asking") return { ok: false };
  if (playerId !== activePlayerId(game)) return { ok: false, notYourTurn: true };
  const ans = answer === "yes" ? "yes" : answer === "no" ? "no" : null;
  if (!ans) return { ok: false };

  const count = (game.questionsAsked.get(playerId) ?? 0) + 1;
  game.questionsAsked.set(playerId, count);

  let capped = false;
  if (count >= QUESTION_CAP) {
    capped = true;
    game.doneIds.add(playerId);
    game.cappedIds.add(playerId);
    advanceTurn(game, presentPlayerIds);
  } else if (ans === "yes") {
    game.deadline = Date.now() + QUESTION_MS; // keep the turn, fresh clock
  } else {
    advanceTurn(game, presentPlayerIds);
  }
  checkRoundEnd(game, presentPlayerIds);
  return { ok: true, questionsAsked: count, capped };
}

// Active player taps "Guess" — opens the 20s typing window. Doesn't cost a
// question by itself; the guess that follows (or a timeout) does.
export function startGuess(game, playerId) {
  if (game.phase !== "turns" || game.subPhase !== "asking") return { ok: false };
  if (playerId !== activePlayerId(game)) return { ok: false, notYourTurn: true };
  if (game.doneIds.has(playerId)) return { ok: false };
  game.subPhase = "guessing";
  game.deadline = Date.now() + GUESS_MS;
  return { ok: true };
}

export function submitGuess(game, playerId, rawGuess, presentPlayerIds) {
  if (game.phase !== "turns" || game.subPhase !== "guessing") return { ok: false };
  if (playerId !== activePlayerId(game)) return { ok: false, notYourTurn: true };
  if (game.deadline && Date.now() > game.deadline + LATE_GRACE_MS) {
    return { ok: false, timeUp: true };
  }

  const entry = game.assignment.get(playerId);
  const correct = entry ? isCorrectGuess(rawGuess, entry) : false;

  if (correct) {
    game.placements.push(playerId);
    game.doneIds.add(playerId);
    const placement = game.placements.length;
    advanceTurn(game, presentPlayerIds);
    checkRoundEnd(game, presentPlayerIds);
    return {
      ok: true,
      correct: true,
      placement,
      identity: { name: entry.name, category: entry.category },
    };
  }

  const capped = resolveWrongOrEmptyGuess(game, playerId, presentPlayerIds);
  checkRoundEnd(game, presentPlayerIds);
  return { ok: true, correct: false, capped };
}

// Server-interval hook (see server/index.js's who-am-i ticker): the active
// player's clock ran out. Asking-phase timeout just passes the turn (no
// question spent — nothing was tapped); a guessing-phase timeout auto-
// submits "nothing", which is a wrong guess (and so DOES cost a question) —
// this is only a backstop for a client that failed to auto-submit itself.
export function tick(game, presentPlayerIds) {
  if (game.phase !== "turns" || !game.deadline) return false;
  if (Date.now() <= game.deadline + LATE_GRACE_MS) return false;

  const pid = activePlayerId(game);
  if (pid == null) return false;

  if (game.subPhase === "asking") {
    advanceTurn(game, presentPlayerIds);
  } else {
    resolveWrongOrEmptyGuess(game, pid, presentPlayerIds);
  }
  checkRoundEnd(game, presentPlayerIds);
  return true;
}

// Score the round (placement + efficiency bonus) and freeze a full
// breakdown — including every identity — for the reveal screen.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "turns") return;

  const rows = presentPlayerIds.map((pid) => {
    const correct = game.placements.includes(pid);
    const placement = correct ? game.placements.indexOf(pid) + 1 : null;
    const questionsAsked = game.questionsAsked.get(pid) ?? 0;
    const placementPoints = correct ? placementPointsFor(placement) : 0;
    const efficiencyPoints = correct ? efficiencyBonusFor(questionsAsked) : 0;
    const points = placementPoints + efficiencyPoints;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);

    const entry = game.assignment.get(pid);
    return {
      playerId: pid,
      identity: entry ? { name: entry.name, category: entry.category } : null,
      questionsAsked,
      correct,
      capped: game.cappedIds.has(pid),
      placement,
      placementPoints,
      efficiencyPoints,
      points,
    };
  });

  rows.sort((a, b) => {
    const ra = a.correct ? a.placement : Infinity;
    const rb = b.correct ? b.placement : Infinity;
    if (ra !== rb) return ra - rb;
    return a.questionsAsked - b.questionsAsked;
  });

  game.lastResult = { roundIndex: game.roundIndex, rows };
  game.phase = "reveal";
}

export function nextRound(game, presentPlayerIds) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  setupRound(game, game.roundIndex + 1, presentPlayerIds);
}

// ---------- framework hooks ----------

// The connected-player set changed (a drop, a reconnect, or — `final` —
// a rejoin grace expiring or a host kick). The active player's turn is
// passed on if they're no longer present; a FINAL departure also purges
// that player's identity from the assignment so it can never surface in
// anyone else's redacted list again.
export function reconcilePresence(game, presentPlayerIds, { final = false } = {}) {
  if (game.phase !== "turns") return;

  if (final) {
    for (const pid of [...game.assignment.keys()]) {
      if (!presentPlayerIds.includes(pid)) game.assignment.delete(pid);
    }
  }

  const active = activePlayerId(game);
  if (active != null && (!presentPlayerIds.includes(active) || game.doneIds.has(active))) {
    advanceTurn(game, presentPlayerIds);
  }
  checkRoundEnd(game, presentPlayerIds);
}

// Host "Force proceed": skip whatever the active player hasn't finished
// (a question, or a guess-in-progress) and move on; from "reveal", go to
// the next round.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "turns") {
    const pid = activePlayerId(game);
    if (game.subPhase === "guessing" && pid != null) {
      resolveWrongOrEmptyGuess(game, pid, presentPlayerIds);
    } else {
      advanceTurn(game, presentPlayerIds);
    }
    checkRoundEnd(game, presentPlayerIds);
  } else if (game.phase === "reveal") {
    nextRound(game, presentPlayerIds);
  }
}

// PUBLIC view — identical for every player, and NEVER contains anyone's
// identity except once the round has actually ended (reveal/history).
export function getPublicState(game, presentPlayerIds) {
  const now = Date.now();
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    categories: game.categories,
    randomMode: game.randomMode,
    totalPlayers: presentPlayerIds.length,
    questionMs: QUESTION_MS,
    guessMs: GUESS_MS,
    questionCap: QUESTION_CAP,
    scores,
  };

  if (game.phase === "turns") {
    const active = activePlayerId(game);
    state.activePlayerId = active;
    state.subPhase = game.subPhase;
    state.msLeft = game.deadline ? Math.max(0, game.deadline - now) : 0;
    state.activeQuestionsAsked = active != null ? game.questionsAsked.get(active) ?? 0 : 0;
    state.doneIds = [...game.doneIds].filter((pid) => presentPlayerIds.includes(pid));
    state.cappedIds = [...game.cappedIds].filter((pid) => presentPlayerIds.includes(pid));
    state.turnOrder = game.turnOrder.filter((pid) => presentPlayerIds.includes(pid));
  }

  if (game.phase === "reveal" && game.lastResult) {
    state.result = {
      roundIndex: game.lastResult.roundIndex,
      rows: game.lastResult.rows.filter((r) => presentPlayerIds.includes(r.playerId)),
    };
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// PRIVATE view — the only place a per-player payload is assembled. Hands
// back a REDACTED copy of the round's identities: everyone else's, in
// full, and the requester's own row with `identity: null` until they've
// earned it with a correct guess (see the file header). Returns null once
// the round has moved past "turns" — by "reveal" every identity is public
// anyway (see getPublicState's `result`).
export function getPrivateState(game, playerId) {
  if (game.phase !== "turns" || !game.assignment.has(playerId)) return null;

  const revealedToSelf = game.placements.includes(playerId);
  const identities = [...game.assignment.entries()].map(([pid, entry]) => {
    const hidden = pid === playerId && !revealedToSelf;
    return {
      playerId: pid,
      identity: hidden ? null : { name: entry.name, category: entry.category },
      hidden,
    };
  });

  // The category alone is a safe narrowing hint (Imposter does the same for
  // its imposter role) — it doesn't identify the specific identity among
  // the 30+ in that category, so it's always shown, not gated on a guess.
  const mine = game.assignment.get(playerId);
  return {
    whoAmI: {
      identities,
      myCategory: mine ? game.categoryNames?.[mine.category] ?? CATEGORY_NAME[mine.category] ?? mine.category : null,
      myIdentity: revealedToSelf ? { name: mine.name, category: mine.category } : null,
    },
  };
}

// --- Tournament Mode: default per-game config.
export function tournamentOptions() {
  return { rounds: 4, categories: [...CATEGORY_KEYS] };
}
