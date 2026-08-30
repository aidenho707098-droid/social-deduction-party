// "Wavelength" — a spectrum-guessing game. Each round one player (the
// Clue-Giver, rotating) privately gets a scale (e.g. Quiet ↔ Loud), a
// secret target NUMBER on it, and writes a short clue that points at that
// number without naming a pole word or any number. Everyone else then
// privately guesses the number; scoring is by closeness as a fraction of
// the scale's span, so every range size feels fair.
//
//   phase:  clue -> guess -> reveal -> ( clue ... ) -> final
//
// The rule check (wavelengthRules.js) and the closeness scoring
// (wavelengthScoring.js) are separate, unit-tested modules. The scale bank
// lives in wavelengthScales.js.

import { shuffle, drawWithoutRepeats } from "./deck.js";
import { SCALES, scaleKey } from "./wavelengthScales.js";
import { checkClue } from "./wavelengthRules.js";
import { classifyGuess, scoreGuess, scoreClueGiver } from "./wavelengthScoring.js";

export const id = "wavelength";
export const name = "Wavelength";
export const minPlayers = 3;

// The Clue-Giver gets a longer window than guessers because a rule
// violation bounces them back to try again.
const CLUE_MS = 60_000;
const GUESS_MS = 30_000;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Which present player gives the clue for `roundIndex`: walk the shuffled
// rotation from that index, skipping anyone who's currently away.
function resolveClueGiver(game, roundIndex, presentPlayerIds) {
  const order = game.clueGiverOrder;
  const present = new Set(presentPlayerIds);
  for (let step = 0; step < order.length; step++) {
    const pid = order[(roundIndex + step) % order.length];
    if (present.has(pid)) return pid;
  }
  return order[roundIndex % order.length];
}

function startRound(game, presentPlayerIds) {
  const scale = game.scales[game.roundIndex];
  game.clueGiverId = resolveClueGiver(game, game.roundIndex, presentPlayerIds);
  game.target = randInt(scale.min, scale.max);
  game.clue = null;
  game.guesses = new Map();
  game.deadline = Date.now() + CLUE_MS;
  game.phase = "clue";
}

export function createGame(playerIds, { rounds, memory }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }
  if (playerIds.length < minPlayers) {
    throw new Error(`Wavelength needs at least ${minPlayers} players.`);
  }

  const totalRounds = Math.min(requested, SCALES.length);
  const { items, seenKeys } = drawWithoutRepeats(
    SCALES,
    totalRounds,
    memory?.seen ?? [],
    scaleKey
  );

  const game = {
    id,
    phase: "clue",
    totalRounds,
    roundIndex: 0,
    scales: items, // each { category, poleA, poleB, min, max, banned }
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
    clueGiverOrder: shuffle(playerIds), // rotation
    clueGiverId: null,
    target: 0, // secret
    clue: null,
    guesses: new Map(), // playerId -> number, current round
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    deadline: 0,
    lastResult: null, // filled by revealRound()
  };
  startRound(game, playerIds);
  return game;
}

// The Clue-Giver submits a phrase. Rejected (with a reason the client can
// show) if it names a pole word or any number — the round stays in "clue"
// so they can try again.
export function submitClue(game, playerId, rawClue) {
  if (game.phase !== "clue") return { ok: false };
  if (playerId !== game.clueGiverId) return { ok: false, notYou: true };

  const clue = String(rawClue ?? "").slice(0, 120).trim();
  if (!clue) return { ok: false, reason: "empty" };

  const scale = game.scales[game.roundIndex];
  const verdict = checkClue(clue, scale.banned);
  if (!verdict.ok) return { ok: false, reason: verdict.reason, term: verdict.term };

  game.clue = clue;
  game.guesses = new Map();
  game.deadline = Date.now() + GUESS_MS;
  game.phase = "guess";
  return { ok: true };
}

// A guesser locks in a number. Once every present guesser has, the round
// reveals itself.
export function submitGuess(game, playerId, rawGuess, presentPlayerIds) {
  if (game.phase !== "guess") return { ok: false };
  if (playerId === game.clueGiverId) return { ok: false, isClueGiver: true };

  const scale = game.scales[game.roundIndex];
  const n = Math.round(Number(rawGuess));
  if (!Number.isFinite(n) || n < scale.min || n > scale.max) return { ok: false };

  game.guesses.set(playerId, n);

  const guessers = presentPlayerIds.filter((pid) => pid !== game.clueGiverId);
  if (guessers.length > 0 && guessers.every((pid) => game.guesses.has(pid))) {
    revealRound(game, presentPlayerIds);
  }
  return { ok: true, guess: n };
}

// Score the round and freeze a full breakdown for the reveal screen. If
// reached from "clue" (host forced past it, or the Clue-Giver left) the
// round is SKIPPED: no clue, no points.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "guess" && game.phase !== "clue") return;

  const scale = game.scales[game.roundIndex];
  const giverId = game.clueGiverId;
  const skipped = game.phase === "clue";
  const guessers = presentPlayerIds.filter((pid) => pid !== giverId);

  const rows = [];
  for (const pid of guessers) {
    const guess = game.guesses.has(pid) ? game.guesses.get(pid) : null;
    const cls =
      guess == null ? "miss" : classifyGuess(guess, game.target, scale.min, scale.max);
    const points =
      skipped || guess == null ? 0 : scoreGuess(guess, game.target, scale.min, scale.max);
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    rows.push({ playerId: pid, guess, cls, points });
  }

  const giverPoints = skipped ? 0 : scoreClueGiver(rows.map((r) => r.cls));
  if (giverPoints) game.scores.set(giverId, (game.scores.get(giverId) ?? 0) + giverPoints);

  const rank = (r) => (r.cls === "exact" ? 0 : r.cls === "close" ? 1 : 2);
  rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.guess == null) return 1;
    if (b.guess == null) return -1;
    return Math.abs(a.guess - game.target) - Math.abs(b.guess - game.target);
  });

  game.lastResult = {
    roundIndex: game.roundIndex,
    skipped,
    category: scale.category,
    poleA: scale.poleA,
    poleB: scale.poleB,
    min: scale.min,
    max: scale.max,
    target: game.target,
    clue: game.clue,
    clueGiverId: giverId,
    giverPoints,
    exactCount: rows.filter((r) => r.cls === "exact").length,
    closeCount: rows.filter((r) => r.cls === "close").length,
    rows, // [{ playerId, guess, cls, points }] sorted best-first
  };
  game.phase = "reveal";
}

export function nextRound(game, presentPlayerIds) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  startRound(game, presentPlayerIds ?? []);
}

// Optional framework hook: called when the connected-player set changes.
export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return;
  if (game.phase === "clue") {
    // Clue-Giver left mid-write — skip the round rather than hang on them.
    if (!presentPlayerIds.includes(game.clueGiverId)) {
      revealRound(game, presentPlayerIds);
    }
  } else if (game.phase === "guess") {
    const guessers = presentPlayerIds.filter((pid) => pid !== game.clueGiverId);
    if (guessers.length > 0 && guessers.every((pid) => game.guesses.has(pid))) {
      revealRound(game, presentPlayerIds);
    }
  }
}

// Host "Force proceed": from "clue" skips the round; from "guess" reveals
// and scores whatever guesses are in.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "clue" || game.phase === "guess") {
    revealRound(game, presentPlayerIds);
  }
}

// The PUBLIC view. During "clue" the scale itself is withheld from
// non-givers (they only learn the category + pole labels once a valid clue
// is in); the target number is never public until the reveal.
export function getPublicState(game, presentPlayerIds) {
  const scale = game.scales[game.roundIndex];
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const now = Date.now();

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    clueGiverId: game.clueGiverId,
    totalPlayers: presentPlayerIds.length,
    clueMs: CLUE_MS,
    guessMs: GUESS_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  };

  if (game.phase !== "clue") {
    state.scale = {
      category: scale.category,
      poleA: scale.poleA,
      poleB: scale.poleB,
      min: scale.min,
      max: scale.max,
    };
    state.clue = game.clue;
  }

  if (game.phase === "guess") {
    const guesserIds = presentPlayerIds.filter((pid) => pid !== game.clueGiverId);
    state.totalGuessers = guesserIds.length;
    state.guessedPlayerIds = guesserIds.filter((pid) => game.guesses.has(pid));
  }

  if (game.phase === "reveal") state.result = game.lastResult;

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// Per-player secret: the Clue-Giver's full scale + target during "clue",
// and just the target afterwards so their spectator view can show it.
export function getPrivateState(game, playerId) {
  if (playerId !== game.clueGiverId) return null;
  const scale = game.scales[game.roundIndex];

  if (game.phase === "clue") {
    return {
      wavelength: {
        role: "clue-giver",
        category: scale.category,
        poleA: scale.poleA,
        poleB: scale.poleB,
        min: scale.min,
        max: scale.max,
        target: game.target,
      },
    };
  }
  if (game.phase === "guess" || game.phase === "reveal") {
    return { wavelength: { role: "clue-giver", target: game.target } };
  }
  return null;
}

// --- Tournament Mode: default per-game config.
export function tournamentOptions() {
  return { rounds: 3 };
}
