// Echo Chain board decoration checks: colours never repeat on touching
// tiles, notes stay within two octaves, and every board size's tiles stay
// at least 44px wide on a 320px phone (same layout maths as index.css:
// .ec-board fills the screen width, 6px gaps, capped at 360px).
// Run:  node client/src/games/echoChain/board.selftest.mjs

import { EASY_COLORS, NOTE_COUNT, PATTERN_COLORS, SIZES, colorFor, noteFor } from './board.js'

let failures = 0
function check(name, cond, detail = '') {
  const ok = Boolean(cond)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

check('Easy: nine distinct colours', new Set(EASY_COLORS).size === 9)
check('Medium/Hard: six colours', new Set(PATTERN_COLORS).size === 6)

for (const [name, size] of Object.entries(SIZES)) {
  let clash = 0
  for (let t = 0; t < size * size; t++) {
    const r = Math.floor(t / size)
    const c = t % size
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const rr = r + dr
      const cc = c + dc
      if (rr >= size || cc < 0 || cc >= size) continue
      if (colorFor(size, t) === colorFor(size, rr * size + cc)) clash++
    }
  }
  check(`${name}: no two touching tiles share a colour (incl. diagonals)`, clash === 0, `${clash} clashes`)

  const notes = Array.from({ length: size * size }, (_, t) => noteFor(size, t))
  check(`${name}: notes are valid bells`, notes.every((n) => Number.isInteger(n) && n >= 0 && n < NOTE_COUNT))
  if (size === 3) check('easy: nine distinct notes', new Set(notes).size === 9)
  else {
    const rowsOk = Array.from({ length: size }, (_, r) => notes.slice(r * size, r * size + size)).every(
      (row, r) => row.every((n, c) => n === c + (r % 2 === 0 ? 5 : 0)),
    )
    check(`${name}: pentatonic across columns, rows alternate octave`, rowsOk)
  }
}

// Layout maths for the tile size at a given viewport width.
const GAP = 6
const GUTTER = 20 // .screen side padding, each side
const MAX_BOARD = 360
function tilePx(viewport, size) {
  const board = Math.min(viewport - 2 * GUTTER, MAX_BOARD)
  return (board - (size - 1) * GAP) / size
}
const rows = []
for (const w of [320, 375, 390, 430]) {
  rows.push(`${w}px: ${Object.entries(SIZES).map(([n, s]) => `${n} ${tilePx(w, s).toFixed(0)}`).join(', ')}`)
}
console.log(`      tile sizes — ${rows.join(' | ')}`)
check('every tile >= 44px at 320px wide', Object.values(SIZES).every((s) => tilePx(320, s) >= 44))
check('roughly 90 / 65 / 52px at 320px', Math.abs(tilePx(320, 3) - 90) < 4 && Math.abs(tilePx(320, 4) - 65) < 4 && Math.abs(tilePx(320, 5) - 52) < 3)

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
process.exit(failures ? 1 : 0)
