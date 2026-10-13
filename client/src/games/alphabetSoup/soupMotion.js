// The letter-reveal swirl's motion model — pure maths, no DOM, so it can be
// checked in Node too. SoupReveal.jsx lays the tiles out once per round
// (buildSoup) and asks tileFrame / heroFrame where everything is at a
// given moment, writing the answers straight into CSS transforms.
//
// Coordinates are bowl-relative: (0, 0) is the bowl's centre and 1 is the
// bowl's full width, so a radius of 0.5 touches the rim.
//
// Timeline, in ms from the start of the swirl (`u`):
//   0 – 500      ease in: the stir picks up speed
//   500 – 1700   fast stir
//   1700 – 2500  decelerate (then a faint drift)
//   1800 – 2100  the chosen tile lifts (scale + glow); the rest dim to 40%
//   2050 – SWIRL its curved trip to the centre, growing into the big tile

export const PALETTE = ['violet', 'coral', 'gold', 'lilac']
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export const R_MAX = 0.39 // furthest tile centre from the middle (x bowl)
const CORE_R = 0.13 // "the centre": at least two tiles start inside this
const MIN_GAP = 0.12 // starting spacing between tile centres (x bowl)

const EASE_IN_MS = 500
const FAST_END_MS = 1700
const STIR_END_MS = 2500
const SLOW_SPEED = 0.06 // the drift left after the stir
export const LIFT_AT = 1800
export const LIFT_MS = 300
export const DIM_MS = 400
export const TRAVEL_AT = 2050

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

// Stir speed (0–1) at u ms.
function speed(u) {
  if (u <= 0) return 0
  if (u < EASE_IN_MS) return 0.08 + 0.92 * smooth(u / EASE_IN_MS)
  if (u < FAST_END_MS) return 1
  if (u < STIR_END_MS) return SLOW_SPEED + (1 - SLOW_SPEED) * (1 - smooth((u - FAST_END_MS) / (STIR_END_MS - FAST_END_MS)))
  return SLOW_SPEED
}

// Stir progress: the integral of speed, normalised so the whole stir
// (0 – STIR_END_MS) is 1. Precomputed at 10ms steps.
const STEP = 10
const PROGRESS = (() => {
  const table = [0]
  for (let u = STEP; u <= STIR_END_MS; u += STEP) table.push(table[table.length - 1] + speed(u - STEP / 2) * STEP)
  const total = table[table.length - 1]
  return { table: table.map((v) => v / total), total }
})()

export function stirProgress(u) {
  if (u <= 0) return 0
  if (u >= STIR_END_MS) return 1 + ((u - STIR_END_MS) * SLOW_SPEED) / PROGRESS.total
  const i = Math.floor(u / STEP)
  const f = (u - i * STEP) / STEP
  const a = PROGRESS.table[i]
  const b = PROGRESS.table[Math.min(i + 1, PROGRESS.table.length - 1)]
  return a + (b - a) * f
}

// How many tiles: 14 on small bowls or low-power phones, else 16–20.
export function tileCount({ bowlPx = 290, cores = 8, memoryGb = 8 } = {}, rng = Math.random) {
  if (bowlPx < 250 || cores <= 4 || memoryGb <= 3) return 14
  return 16 + Math.floor(rng() * 5)
}

// One round's soup: random polar positions with sqrt-distributed radii
// (even coverage, centre included — and at least two tiles start inside
// the core), the chosen letter on one random tile, distinct random letters
// on the rest, and per-tile speed / wobble / bob / tilt / size / opacity.
export function buildSoup(letter, count, rng = Math.random) {
  const rand = (a, b) => a + (b - a) * rng()
  const spots = []
  for (let i = 0; i < count; i++) {
    // Two tiles in the core, one mid-bowl and one near the rim (so a layout
    // can never collapse into a ring), the rest anywhere.
    const [minR, maxR] =
      i < 2 ? [0, CORE_R]
      : i === 2 ? [0.55 * R_MAX, 0.7 * R_MAX]
      : i === 3 ? [0.8 * R_MAX, R_MAX]
      : [0, R_MAX]
    let best = null
    for (let attempt = 0; attempt < 40; attempt++) {
      const r = Math.sqrt(minR * minR + (maxR * maxR - minR * minR) * rng())
      const theta = rng() * Math.PI * 2
      const x = r * Math.cos(theta)
      const y = r * Math.sin(theta)
      const gap = Math.min(Infinity, ...spots.map((s) => Math.hypot(s.x - x, s.y - y)))
      if (!best || gap > best.gap) best = { r, theta, x, y, gap }
      if (gap >= MIN_GAP) break
    }
    spots.push(best)
  }
  const others = ALPHABET.filter((l) => l !== letter).sort(() => rng() - 0.5)
  const chosenIndex = Math.floor(rng() * count)
  const shift = Math.floor(rng() * PALETTE.length)
  return spots.map((s, i) => {
    // Vortex: tiles nearer the centre complete more turns.
    const turns = (1.5 + 0.8 * (1 - s.r / R_MAX)) * rand(0.96, 1.04)
    return {
      letter: i === chosenIndex ? letter : others[i - (i > chosenIndex ? 1 : 0)],
      chosen: i === chosenIndex,
      color: PALETTE[(i + shift) % PALETTE.length],
      r0: s.r,
      theta0: s.theta,
      turns,
      wobblePhase: rand(0, Math.PI * 2),
      wobbleHz: rand(0.5, 1.0),
      bobPhase: rand(0, Math.PI * 2),
      bobHz: rand(1.2, 2.0),
      tilt0: rand(-12, 12),
      tiltPhase: rand(0, Math.PI * 2),
      tiltHz: rand(0.25, 0.5),
      scale: rand(0.9, 1.1),
      opacity: rand(0.8, 1),
    }
  })
}

// Where one tile is at u ms: bowl-relative x / y, a pixel bob, tilt in
// degrees, scale and opacity (incl. the lift / dim of the landing).
export function tileFrame(tile, u) {
  const s = u / 1000
  const angle = tile.theta0 + Math.PI * 2 * tile.turns * stirProgress(u)
  const r = tile.r0 * (1 + 0.06 * Math.sin(tile.wobblePhase + Math.PI * 2 * tile.wobbleHz * s))
  const lift = tile.chosen ? smooth((u - LIFT_AT) / LIFT_MS) : 0
  const dim = tile.chosen ? 1 : 1 - 0.6 * smooth((u - LIFT_AT) / DIM_MS)
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
    bobPx: 2 * Math.sin(tile.bobPhase + Math.PI * 2 * tile.bobHz * s),
    tilt: tile.tilt0 + 13 * Math.sin(tile.tiltPhase + Math.PI * 2 * tile.tiltHz * s),
    scale: tile.scale * (1 + 0.3 * lift),
    opacity: tile.opacity * dim + (tile.chosen ? (1 - tile.opacity) * lift : 0),
    lift,
  }
}

// The chosen tile's trip to the centre, from TRAVEL_AT to `swirlMs`: a
// quadratic Bézier from wherever the stir left it, bending the way the
// soup turns (the control point is the start rotated ahead and pulled in),
// so it spirals in rather than flying straight. Returns null before it
// starts; `t` 0–1 drives the size + crossfade into the big tile.
export function heroFrame(tile, u, swirlMs) {
  if (u < TRAVEL_AT) return null
  const p0 = tileFrame(tile, TRAVEL_AT)
  const t = easeInOutCubic(Math.min(1, (u - TRAVEL_AT) / (swirlMs - TRAVEL_AT)))
  const ahead = Math.PI / 3
  const cx = 0.7 * (p0.x * Math.cos(ahead) - p0.y * Math.sin(ahead))
  const cy = 0.7 * (p0.x * Math.sin(ahead) + p0.y * Math.cos(ahead))
  const k = 1 - t
  return {
    x: k * k * p0.x + 2 * k * t * cx,
    y: k * k * p0.y + 2 * k * t * cy,
    t,
    startScale: p0.scale,
    tilt: p0.tilt * k,
  }
}
