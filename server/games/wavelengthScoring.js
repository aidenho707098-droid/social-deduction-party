// Wavelength — percentage-based closeness scoring.
//
// Guesses are scored by how close they land as a fraction of the scale's
// span, so a 0–10 scale and a 1–100 scale feel equally fair:
//   * exact match ............ 3 points
//   * within the close band ... 2 points
//   * otherwise .............. 0 points
//
// The close band is ~5% of the span, with a floor of 1 unit so the middle
// tier still means something on tiny scales (5% of a 0–10 span is only
// 0.5). e.g. span 10 -> ±1 ; span 23 -> ±1.15 ; span 99 -> ±4.95.
//
// The Clue-Giver earns, per OTHER player: +2 for an exact guess, +1 for a
// close-but-not-exact guess.

const CLOSE_FRACTION = 0.05;
export const EXACT_POINTS = 3;
export const CLOSE_POINTS = 2;
export const GIVER_EXACT_POINTS = 2;
export const GIVER_CLOSE_POINTS = 1;

// The absolute distance (in scale units) that still counts as "close".
export function closeThreshold(min, max) {
  const span = Math.abs((max ?? 0) - (min ?? 0));
  return Math.max(1, CLOSE_FRACTION * span);
}

// Classify one guess: "exact" | "close" | "miss".
export function classifyGuess(guess, target, min, max) {
  if (!Number.isFinite(guess)) return "miss";
  if (guess === target) return "exact";
  return Math.abs(guess - target) <= closeThreshold(min, max) ? "close" : "miss";
}

// Points a guesser earns for one guess.
export function scoreGuess(guess, target, min, max) {
  const cls = classifyGuess(guess, target, min, max);
  return cls === "exact" ? EXACT_POINTS : cls === "close" ? CLOSE_POINTS : 0;
}

// Points the Clue-Giver earns from the whole round, given every OTHER
// player's classification ("exact" | "close" | "miss").
export function scoreClueGiver(classifications) {
  let pts = 0;
  for (const cls of classifications) {
    if (cls === "exact") pts += GIVER_EXACT_POINTS;
    else if (cls === "close") pts += GIVER_CLOSE_POINTS;
  }
  return pts;
}
