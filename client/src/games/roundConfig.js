// Shared bounds for every game's "how many rounds?" setting. The server
// still clamps the request down to its content-pool size, so the real
// ceiling per game may be lower than ROUND_MAX.
export const ROUND_MIN = 2
export const ROUND_MAX = 20
export const ROUND_DEFAULT = 5

// Coerce a saved / arbitrary value to a valid round count.
export function clampRounds(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return ROUND_DEFAULT
  return Math.min(ROUND_MAX, Math.max(ROUND_MIN, v))
}
