// Echo Chain's board decoration. A tile's identity is its POSITION
// (0 .. size*size-1, row by row) — that's all the server knows about it.
// Colour and note are decoration only: colour-blind players and muted
// phones lose nothing, because every tile is told apart by where it is.
// Plain data, so board.selftest.mjs can check it under node.

export const SIZES = { easy: 3, medium: 4, hard: 5 }

// Muted, so a flash (bright, near-white) stands out from every one of them.
// Easy: nine distinct colours, one per tile.
export const EASY_COLORS = [
  '#8d7cc0', // violet
  '#d08a72', // dusty coral
  '#d7b25e', // mustard
  '#86ad8a', // sage
  '#7393bd', // slate blue
  '#c48aa6', // rose
  '#6aa8a4', // teal
  '#bfa486', // sand
  '#a58bd0', // lilac
]

// Medium + Hard: six colours repeating so that no two touching tiles —
// side by side, above / below, or diagonal — share one. Colour (r, c) =
// (c + 3r) mod 6: neighbours differ by ±1, ±3 or ±2 / ±4, never 0 mod 6.
export const PATTERN_COLORS = ['#8d7cc0', '#d08a72', '#d7b25e', '#86ad8a', '#7393bd', '#c48aa6']

export function colorFor(size, tile) {
  if (size === 3) return EASY_COLORS[tile]
  const r = Math.floor(tile / size)
  const c = tile % size
  return PATTERN_COLORS[(c + 3 * r) % PATTERN_COLORS.length]
}

// Notes — indices into the ten echo-note-* bells (make-echo-sounds.mjs):
// 0..4 = C5 D5 E5 G5 A5, 5..9 = C6 D6 E6 G6 A6 (C major pentatonic).
//   Easy: nine distinct notes, rising from the bottom-left tile to the
//     top-right one.
//   Medium / Hard: the scale runs across the columns (4 or 5 notes), and
//     rows alternate octaves (top row high) — two octaves at most, so
//     notes repeat down the board. Sound helps; position decides.
export const NOTE_COUNT = 10

export function noteFor(size, tile) {
  const r = Math.floor(tile / size)
  const c = tile % size
  if (size === 3) return (size - 1 - r) * size + c
  return c + (r % 2 === 0 ? 5 : 0)
}

export const noteKey = (size, tile) => `echo-note-${noteFor(size, tile)}`

// "Row 2, tile 3" — the accessible name (position is the identity).
export function tileLabel(size, tile) {
  return `Row ${Math.floor(tile / size) + 1}, tile ${(tile % size) + 1}`
}
