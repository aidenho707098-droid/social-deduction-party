// The "ink limit" for a Fake Artist turn. A player's contribution is capped
// by the CUMULATIVE LENGTH of their strokes (in canvas-logical pixels), not
// by time alone — so nobody can scribble the whole answer in one frantic
// turn. This module is pure geometry so it can be unit-tested on its own
// (see inkModel.selftest.mjs); the drawing component just wires pointer
// events into it and renders the meter from `inkFraction`.

// Logical canvas is DRAW_W x DRAW_H; the ink budget is about one full
// diagonal (~770px) — room for two or three short, deliberate marks.
export const DRAW_W = 640
export const DRAW_H = 420
export const INK_LIMIT = 800

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)

// A stroke is { color, width, points: [{x, y}, ...] }.
export function strokeLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}

export function totalInk(strokes) {
  let total = 0
  for (const s of strokes) total += strokeLength(s.points ?? [])
  return total
}

// 1 = full, 0 = empty. Clamped.
export function inkFraction(strokes, limit = INK_LIMIT) {
  return Math.max(0, Math.min(1, 1 - totalInk(strokes) / limit))
}

export function inkExhausted(strokes, limit = INK_LIMIT) {
  return totalInk(strokes) >= limit
}

// Given the ink already spent and a proposed move `from -> to`, return the
// furthest point along that segment the player can actually reach:
//   { point, exhausted }
// `exhausted` is true when the budget ran out partway (or was already gone),
// in which case `point` sits exactly on the limit so the meter reads 0.
export function clampMove(strokes, from, to, limit = INK_LIMIT) {
  const spent = totalInk(strokes)
  if (spent >= limit) return { point: { ...from }, exhausted: true }
  const budget = limit - spent
  const segLen = dist(from, to)
  if (segLen <= budget) return { point: { ...to }, exhausted: false }
  const t = budget / segLen
  return {
    point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    exhausted: true,
  }
}
