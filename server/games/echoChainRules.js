// Echo Chain's numbers, in one place: board sizes, turn timers, the replay
// schedule and scoring. Pure data + pure functions, so the selftest can log
// the schedule and the client can mirror the board without a server.

export const DIFFICULTIES = {
  easy: { size: 3 }, // 9 tiles
  medium: { size: 4 }, // 16 tiles
  hard: { size: 5 }, // 25 tiles
};
export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

export const LIVES = { min: 1, max: 3, dflt: 2 };

// Turn timers. A timer that runs out is a miss. `graceMs` is latency
// forgiveness: a tap that left the phone in time but landed a little after
// the deadline still counts, and the miss only fires after it.
export const TIMERS = {
  firstTapMs: 5_000, // to make the first echo tap
  nextTapMs: 4_000, // between echo taps
  addMs: 5_000, // to choose the tile to add
  graceMs: 500,
};

// Beats between turns.
export const BEATS = {
  countdownMs: 3_000, // 3-2-1 before the first turn
  missMs: 1_800, // "Missed! [Name] loses a life"
};

// The flash-through after a miss. Per-tile interval: 0.6s for chains of 1
// to 5, then 0.03s faster for every extra tile, never below 0.2s. A flash
// lasts 70% of its interval.
export const REPLAY = {
  baseMs: 600,
  baseUpTo: 5,
  stepMs: 30,
  floorMs: 200,
  flashFrac: 0.7,
  leadMs: 900, // "Watch the chain" on screen before the first flash
  tailMs: 500, // after the last flash, before the next turn
};

export function replayIntervalMs(chainLength) {
  const extra = Math.max(0, chainLength - REPLAY.baseUpTo);
  return Math.max(REPLAY.floorMs, REPLAY.baseMs - extra * REPLAY.stepMs);
}

export function replayFlashMs(chainLength) {
  return Math.round(replayIntervalMs(chainLength) * REPLAY.flashFrac);
}

// Total time of a replay phase, from its start to the next turn.
export function replayDurationMs(chainLength) {
  return REPLAY.leadMs + chainLength * replayIntervalMs(chainLength) + REPLAY.tailMs;
}

// POINTS = ROUNDS SURVIVED. Eliminated during round R: R - 1. The last one
// standing: the round the game ended in. Ended early by the host: everyone
// still alive scores the current round - 1.
export function pointsFor({ eliminatedInRound = null, round, endedEarly = false }) {
  if (eliminatedInRound != null) return eliminatedInRound - 1;
  return endedEarly ? round - 1 : round;
}

export const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
