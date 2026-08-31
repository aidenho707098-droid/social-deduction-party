// "Wavelength" — a spectrum-guessing game. Each round has a Clue-Giver who
// privately gets a scale (e.g. Quiet ↔ Loud) and a secret target NUMBER on
// it, and writes a short clue pointing at that number without naming a pole
// word or any digit. Everyone else then privately guesses; scoring is by
// closeness as a fraction of the scale's span, so every range size is fair.
//
// To cut mid-game waiting, ALL clue-writing happens up front, in parallel:
// at game start the full Clue-Giver-per-round sequence is fixed (players
// repeat if rounds > player count), and every Clue-Giver writes their
// clue(s) simultaneously, each with a private 60s-per-clue timer. Once
// every clue is in, the guess rounds run back-to-back with no more writing.
//
//   phase:  write -> guess -> reveal -> ( guess -> reveal ... ) -> final
//
// The rule check (wavelengthRules.js) and closeness scoring
// (wavelengthScoring.js) are separate, unit-tested modules. The scale bank
// lives in wavelengthScales.js.

import { shuffle, drawWithoutRepeats } from "./deck.js";
import { SCALES, scaleKey } from "./wavelengthScales.js";
import { checkClue } from "./wavelengthRules.js";
import { classifyGuess, scoreGuess, scoreClueGiver } from "./wavelengthScoring.js";

export const id = "wavelength";
export const name = "Wavelength";
export const minPlayers = 3;

// Each Clue-Giver's own per-clue writing window (all run in parallel), and
// the shared guessing window for each round.
const WRITE_MS = 60_000;
const GUESS_MS = 30_000;
const LATE_GRACE_MS = 2_000;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
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

  // Fix the whole Clue-Giver sequence now. Cycling a shuffled roster spreads
  // rounds evenly and only repeats a player once every seat is used.
  const order = shuffle(playerIds);
  const clueGiverByRound = Array.from(
    { length: totalRounds },
    (_, i) => order[i % order.length]
  );
  const targetByRound = items.map((s) => randInt(s.min, s.max));

  // Per-writer queue of round indices, in the order they'll write them.
  const writeQueueByPlayer = new Map(playerIds.map((pid) => [pid, []]));
  clueGiverByRound.forEach((pid, roundIdx) =>
    writeQueueByPlayer.get(pid).push(roundIdx)
  );

  const now = Date.now();
  const game = {
    id,
    phase: "write", // write -> guess -> reveal -> ... -> final
    totalRounds,
    roundIndex: 0,
    scales: items, // each { category, poleA, poleB, min, max, banned }
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js

    // --- writing phase (all Clue-Givers at once) ---
    clueGiverByRound, // [playerId] length totalRounds
    targetByRound, // [number] length totalRounds
    clueByRound: new Array(totalRounds).fill(null), // filled as clues land
    writeQueueByPlayer, // playerId -> [roundIdx, ...]
    writeProgress: new Map(playerIds.map((pid) => [pid, 0])), // clues done
    writeDeadlineByPlayer: new Map(
      playerIds.map((pid) => [pid, now + WRITE_MS])
    ),

    // --- the current guess round ---
    clueGiverId: null,
    target: 0,
    clue: null,
    guesses: new Map(), // playerId -> number

    scores: new Map(playerIds.map((pid) => [pid, 0])),
    deadline: 0,
    lastResult: null, // filled by finishRound()
  };
  return game;
}

// ---------- writing phase ----------

function advanceWriter(game, playerId) {
  const done = game.writeProgress.get(playerId) ?? 0;
  game.writeProgress.set(playerId, done + 1);
  game.writeDeadlineByPlayer.set(playerId, Date.now() + WRITE_MS);
}

function writingDone(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return false;
  return presentPlayerIds.every((pid) => {
    const queue = game.writeQueueByPlayer.get(pid) ?? [];
    return (game.writeProgress.get(pid) ?? 0) >= queue.length;
  });
}

function maybeStartGuessing(game, presentPlayerIds) {
  if (game.phase !== "write") return false;
  if (!writingDone(game, presentPlayerIds)) return false;
  advanceToRound(game, 0, presentPlayerIds);
  return true;
}

// A Clue-Giver submits one clue (their current queue slot). A pole/number
// violation, or an explicitly-empty clue while time remains, is REJECTED
// with a reason and they stay on the same clue to retry — exactly as
// before. A valid clue, or any submission once their clock has run out,
// advances them to their next clue (an unwritten round is skipped later).
export function submitClue(game, playerId, rawClue, presentPlayerIds) {
  if (game.phase !== "write") return { ok: false };

  const queue = game.writeQueueByPlayer.get(playerId);
  if (!queue) return { ok: false };
  const done = game.writeProgress.get(playerId) ?? 0;
  if (done >= queue.length) return { ok: false, alreadyDone: true };

  const roundIdx = queue[done];
  const scale = game.scales[roundIdx];
  const clue = String(rawClue ?? "").slice(0, 120).trim();
  const deadline = game.writeDeadlineByPlayer.get(playerId) ?? 0;
  const late = Date.now() > deadline + LATE_GRACE_MS;

  if (clue) {
    const verdict = checkClue(clue, scale.banned);
    if (verdict.ok) {
      game.clueByRound[roundIdx] = clue;
      advanceWriter(game, playerId);
      maybeStartGuessing(game, presentPlayerIds);
      return { ok: true };
    }
    if (!late) return { ok: false, reason: verdict.reason, term: verdict.term };
  } else if (!late) {
    return { ok: false, reason: "empty" };
  }

  // Clock ran out — drop whatever's here and move on.
  advanceWriter(game, playerId);
  maybeStartGuessing(game, presentPlayerIds);
  return { ok: true, skipped: true };
}

// Server-interval hook (see server/index.js): auto-skip the current clue of
// any present writer whose clock has run out, and start guessing if that
// clears the last thing everyone was waiting on. Returns true if anything
// changed so the caller re-broadcasts.
export function tickWrite(game, presentPlayerIds) {
  if (game.phase !== "write") return false;
  const now = Date.now();
  let changed = false;

  for (const pid of presentPlayerIds) {
    const queue = game.writeQueueByPlayer.get(pid) ?? [];
    const done = game.writeProgress.get(pid) ?? 0;
    if (done >= queue.length) continue;
    const deadline = game.writeDeadlineByPlayer.get(pid) ?? 0;
    if (now > deadline + LATE_GRACE_MS) {
      game.writeProgress.set(pid, done + 1); // time's up -> this round gets no clue
      game.writeDeadlineByPlayer.set(pid, now + WRITE_MS);
      changed = true;
    }
  }

  if (maybeStartGuessing(game, presentPlayerIds)) changed = true;
  return changed;
}

// ---------- guess rounds ----------

// Move to `roundIndex` and open its guess phase — or, if that round's clue
// was never written, go straight to a skipped reveal for it.
function advanceToRound(game, roundIndex, presentPlayerIds) {
  game.roundIndex = roundIndex;
  game.clueGiverId = game.clueGiverByRound[roundIndex];
  game.target = game.targetByRound[roundIndex];
  game.clue = game.clueByRound[roundIndex] ?? null;
  game.guesses = new Map();

  if (!game.clue) {
    finishRound(game, presentPlayerIds ?? [], true);
    return;
  }
  game.deadline = Date.now() + GUESS_MS;
  game.phase = "guess";
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
    finishRound(game, presentPlayerIds);
  }
  return { ok: true, guess: n };
}

// Score the current round and freeze a full breakdown for the reveal
// screen. `skipped` (no clue was written for it) means nobody scores.
function finishRound(game, presentPlayerIds, skipped = !game.clue) {
  const scale = game.scales[game.roundIndex];
  const giverId = game.clueGiverId;
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

// Host "Reveal now" during a guess round.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "guess") return;
  finishRound(game, presentPlayerIds);
}

export function nextRound(game, presentPlayerIds) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  advanceToRound(game, game.roundIndex + 1, presentPlayerIds ?? []);
}

// Framework hook: the connected-player set changed.
export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return;
  if (game.phase === "write") {
    // A writer may have dropped — see if everyone still here has finished.
    maybeStartGuessing(game, presentPlayerIds);
  } else if (game.phase === "guess") {
    const guessers = presentPlayerIds.filter((pid) => pid !== game.clueGiverId);
    if (guessers.length > 0 && guessers.every((pid) => game.guesses.has(pid))) {
      finishRound(game, presentPlayerIds);
    }
  }
}

// Host "Force proceed": from "write", stop waiting on stragglers and start
// guessing with whatever clues are in; from "guess", reveal now.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "write") {
    for (const [pid, queue] of game.writeQueueByPlayer) {
      game.writeProgress.set(pid, queue.length);
    }
    advanceToRound(game, 0, presentPlayerIds ?? []);
  } else if (game.phase === "guess") {
    finishRound(game, presentPlayerIds ?? []);
  }
}

// The PUBLIC view. During "write" the scales/clues are withheld (each
// Clue-Giver only sees their own, via getPrivateState); the target number
// is never public until the reveal.
export function getPublicState(game, presentPlayerIds) {
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
    guessMs: GUESS_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  };

  if (game.phase === "write") {
    const presentWriters = presentPlayerIds.filter(
      (pid) => (game.writeQueueByPlayer.get(pid) ?? []).length > 0
    );
    state.write = {
      totalRounds: game.totalRounds,
      cluesIn: game.clueByRound.filter((c) => c != null).length,
      writers: presentWriters.length,
      writersDone: presentWriters.filter(
        (pid) =>
          (game.writeProgress.get(pid) ?? 0) >=
          (game.writeQueueByPlayer.get(pid) ?? []).length
      ).length,
      writeMs: WRITE_MS,
    };
    return state;
  }

  const scale = game.scales[game.roundIndex];

  if (game.phase === "guess" || game.phase === "reveal") {
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

// Per-player secret. During "write" a Clue-Giver gets the scale + target
// for the clue they're currently on (plus their queue position / clock);
// during guess & reveal the round's Clue-Giver still gets the target so
// their spectator view can show the needle.
export function getPrivateState(game, playerId) {
  if (game.phase === "write") {
    const queue = game.writeQueueByPlayer.get(playerId) ?? [];
    if (queue.length === 0) return null; // not a Clue-Giver this game

    const done = game.writeProgress.get(playerId) ?? 0;
    if (done >= queue.length) {
      return {
        wavelength: { role: "writer", done: true, clueCount: queue.length },
      };
    }

    const roundIdx = queue[done];
    const scale = game.scales[roundIdx];
    const deadline = game.writeDeadlineByPlayer.get(playerId) ?? Date.now();
    return {
      wavelength: {
        role: "writer",
        done: false,
        clueNumber: done + 1,
        clueCount: queue.length,
        category: scale.category,
        poleA: scale.poleA,
        poleB: scale.poleB,
        min: scale.min,
        max: scale.max,
        target: game.targetByRound[roundIdx],
        writeMs: WRITE_MS,
        msLeft: Math.max(0, deadline - Date.now()),
      },
    };
  }

  if (game.phase === "guess" || game.phase === "reveal") {
    if (playerId !== game.clueGiverId) return null;
    return { wavelength: { role: "clue-giver", target: game.target } };
  }
  return null;
}

// --- Tournament Mode: default per-game config.
export function tournamentOptions() {
  return { rounds: 3 };
}
