// Selftest for the letter-reveal motion model (soupMotion.js).
// Run:  node client/src/games/alphabetSoup/soupMotion.selftest.mjs
// (also part of `npm run test:alphabet-soup` in server/).
import {
  PALETTE,
  R_MAX,
  LIFT_AT,
  TRAVEL_AT,
  buildSoup,
  heroFrame,
  stirProgress,
  tileCount,
  tileFrame,
} from './soupMotion.js'

let failures = 0
function check(name, cond, detail = '') {
  const ok = Boolean(cond)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const SWIRL_MS = 2700
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// --- tile count ---
check('small bowl -> 14 tiles', tileCount({ bowlPx: 236 }) === 14)
check('low-power phone -> 14 tiles', tileCount({ bowlPx: 290, cores: 4 }) === 14 && tileCount({ bowlPx: 290, memoryGb: 2 }) === 14)
const counts = new Set(Array.from({ length: 300 }, () => tileCount({ bowlPx: 290, cores: 8, memoryGb: 8 })))
check('normal phone -> 16–20 tiles', [...counts].every((n) => n >= 16 && n <= 20) && counts.size >= 4, [...counts].sort().join(','))

// --- layouts: 200 rounds ---
const signatures = new Set()
let chosenOk = true
let lettersOk = true
let coreOk = true
let coreDuringOk = true
let holeOk = true
let rangeOk = true
let paletteOk = true
for (let round = 0; round < 200; round++) {
  const letter = ALPHABET[round % 26]
  const n = 14 + (round % 7)
  const soup = buildSoup(letter, n)
  signatures.add(soup.map((t) => `${t.letter}${t.r0.toFixed(2)}`).join('|'))
  const chosen = soup.filter((t) => t.chosen)
  if (chosen.length !== 1 || chosen[0].letter !== letter) chosenOk = false
  if (new Set(soup.map((t) => t.letter)).size !== n) lettersOk = false
  if (soup.filter((t) => t.r0 < 0.13).length < 2) coreOk = false
  if (soup.some((t) => t.r0 > R_MAX + 1e-9)) rangeOk = false
  if (soup.some((t) => t.scale < 0.9 || t.scale > 1.1 || t.opacity < 0.8 || t.opacity > 1)) rangeOk = false
  if (soup.some((t) => !PALETTE.includes(t.color))) paletteOk = false
  // Throughout the stir there's always a tile near the middle (no hole).
  for (let u = 0; u <= 2500; u += 100) {
    const minR = Math.min(...soup.map((t) => { const f = tileFrame(t, u); return Math.hypot(f.x, f.y) }))
    if (minR > 0.14) coreDuringOk = false
  }
  // Radii aren't banded into rings: they spread across the bowl.
  const radii = soup.map((t) => t.r0).sort((a, b) => a - b)
  const bands = new Set(radii.map((r) => Math.floor((r / R_MAX) * 4)))
  if (bands.size < 3) holeOk = false
}
check('200 rounds: every layout is different', signatures.size === 200, `${signatures.size}`)
check('the chosen letter is always one of the tiles, exactly once', chosenOk)
check('tile letters are distinct', lettersOk)
check('at least two tiles start in the centre (no empty middle)', coreOk)
check('a tile stays near the centre throughout the stir', coreDuringOk)
check('tiles spread over 3+ radius bands (no rigid ring)', holeOk)
check('size 90–110%, opacity 80–100%, inside the bowl', rangeOk)
check('colours from the palette (violet, coral, mustard, light violet)', paletteOk)

// Even area coverage: with sqrt radii about a quarter of tiles sit in the
// inner half-radius (area 1/4) — rings would give 0 or all.
let inner = 0
let total = 0
for (let i = 0; i < 500; i++) {
  for (const t of buildSoup('A', 18)) {
    total++
    if (t.r0 < R_MAX / 2) inner++
  }
}
check('sqrt radii (+ the 2 centre tiles): ~25% of all tiles in the inner half-radius (even area coverage)', inner / total > 0.2 && inner / total < 0.32, `${((inner / total) * 100).toFixed(1)}%`)

// --- pacing ---
const speedAt = (u) => (stirProgress(u + 5) - stirProgress(u - 5)) / 10
check('ease in: slow at the start, fast by 0.5s', speedAt(50) < speedAt(500) * 0.3)
check('fast stir holds 0.5–1.7s', Math.abs(speedAt(800) - speedAt(1500)) < speedAt(800) * 0.02)
check('decelerates over 1.7–2.5s', speedAt(2400) < speedAt(1700) * 0.2)
check('stir progress is monotonic', Array.from({ length: 300 }, (_, i) => i * 10).every((u) => stirProgress(u + 10) >= stirProgress(u)))

// --- per-tile motion ---
{
  const soup = buildSoup('Q', 18)
  const inner = soup.reduce((a, b) => (a.r0 < b.r0 ? a : b))
  const outer = soup.reduce((a, b) => (a.r0 > b.r0 ? a : b))
  check('vortex: the innermost tile makes more turns than the outermost', inner.turns > outer.turns)
  const speeds = new Set(soup.map((t) => t.turns))
  check('each tile has its own angular speed', speeds.size === soup.length)
  let wobbleOk = true
  let bobOk = true
  let tiltOk = true
  for (const t of soup) {
    for (let u = 0; u <= 2700; u += 37) {
      const f = tileFrame(t, u)
      const r = Math.hypot(f.x, f.y)
      if (Math.abs(r / t.r0 - 1) > 0.0601) wobbleOk = false
      if (Math.abs(f.bobPx) > 2.0001) bobOk = false
      if (Math.abs(f.tilt) > 25.0001) tiltOk = false
    }
  }
  check('radius wobble within ±6%', wobbleOk)
  check('bob within ±2px', bobOk)
  check('tilt within ±25°', tiltOk)
  // Same direction for everyone: angle never goes backwards during the stir.
  let dirOk = true
  for (const t of soup) {
    let prev = t.theta0
    for (let u = 0; u <= 2500; u += 20) {
      const a = t.theta0 + Math.PI * 2 * t.turns * stirProgress(u)
      if (a < prev - 1e-9) dirOk = false
      prev = a
    }
  }
  check('every tile orbits the same direction', dirOk)

  // --- landing ---
  const chosen = soup.find((t) => t.chosen)
  const before = tileFrame(chosen, LIFT_AT - 50)
  const lifted = tileFrame(chosen, LIFT_AT + 400)
  check('chosen tile lifts: scales up ~30%', lifted.scale > before.scale * 1.25 && lifted.lift === 1)
  const other = soup.find((t) => !t.chosen)
  check('the others dim to ~40%', Math.abs(tileFrame(other, 2400).opacity / other.opacity - 0.4) < 0.01)
  check('no hero before the trip starts', heroFrame(chosen, TRAVEL_AT - 1, SWIRL_MS) === null)
  const start = heroFrame(chosen, TRAVEL_AT, SWIRL_MS)
  const startTile = tileFrame(chosen, TRAVEL_AT)
  check('trip starts exactly where the tile is', Math.hypot(start.x - startTile.x, start.y - startTile.y) < 1e-9)
  const end = heroFrame(chosen, SWIRL_MS, SWIRL_MS)
  check('trip ends dead centre, full size', Math.hypot(end.x, end.y) < 1e-9 && end.t === 1)
  // Curved, not straight: the midpoint is well off the start->centre line,
  // relative to how far out the tile started (a tile starting near the
  // centre has a short trip, so its bend is small in absolute terms).
  const mid = heroFrame(chosen, (TRAVEL_AT + SWIRL_MS) / 2, SWIRL_MS)
  const dist = Math.hypot(start.x, start.y)
  const bend = Math.abs(start.x * mid.y - start.y * mid.x) / (dist * dist)
  check('trip is a curve, not a straight line', dist < 1e-6 || bend > 0.2, bend.toFixed(3))
}

// Every round lands correctly, wherever the chosen tile starts.
let landOk = true
for (let i = 0; i < 200; i++) {
  const soup = buildSoup(ALPHABET[i % 26], 16)
  const c = soup.find((t) => t.chosen)
  const e = heroFrame(c, SWIRL_MS, SWIRL_MS)
  if (!e || Math.hypot(e.x, e.y) > 1e-9 || c.letter !== ALPHABET[i % 26]) landOk = false
}
check('200 rounds: the chosen letter always lands dead centre', landOk)

console.log(failures === 0 ? '\nALL SOUP MOTION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
