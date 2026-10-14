import { useClock } from '../hotPotato/useClock'

// Plain data + hooks shared by the Memory Imposter screens (kept out of
// the component files so Fast Refresh keeps working).
//
// Items are "<kind>:<value>" strings from the server
// (server/games/memorySequence.js): "d:7", "c:violet", "s:star".

// Six plain swatches, picked so no two are confusable — also under
// protan / deutan / tritan colour blindness (palette.selftest.mjs checks
// it). The coral is the app's darker coral ink: the bright brand coral
// merges with mustard for deuteranopes.
export const COLORS = {
  violet: { hex: '#5b3e99', label: 'Violet' },
  coral: { hex: '#c24a24', label: 'Coral' },
  mustard: { hex: '#f0b429', label: 'Mustard' },
  green: { hex: '#1e8a6e', label: 'Green' },
  blue: { hex: '#56b4e9', label: 'Blue' },
  white: { hex: '#f4f1ea', label: 'White' },
}

export const SHAPE_LABELS = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  star: 'Star',
  diamond: 'Diamond',
  heart: 'Heart',
}

export const TYPE_LABELS = { digits: 'Digits', colors: 'Colors', shapes: 'Shapes', mixed: 'Mixed' }
export const SEQUENCE_TYPES = Object.keys(TYPE_LABELS)

// Two example lines per round type for the discussion hint card. Fixed
// per type, never drawn from the real sequence (the Imposter reads them too).
export const HINTS = {
  digits: ['"The third digit is 7."', '"Is the second one a 4?"'],
  colors: ['"The second one is blue."', '"Is the last one mustard?"'],
  shapes: ['"The last one is a star."', '"Is the fourth one a heart?"'],
  mixed: ['"The third one is the number 7."', '"Is the second one blue, or a star?"'],
}

export function itemLabel(item) {
  if (!item) return 'blank'
  const [kind, value] = [item.slice(0, 1), item.slice(2)]
  if (kind === 'c') return COLORS[value]?.label ?? value
  if (kind === 's') return SHAPE_LABELS[value] ?? value
  return value
}

// "15s", "14.5s".
export const seconds = (ms) => `${Number((ms / 1000).toFixed(1))}s`

// v1 saved settings (one `sequenceType`; Emoji is now Shapes) and v2's
// chip list, cleaned to just the fields this version uses. Mirrors the
// server's resolveSettings(); old options (questions, answer time,
// statements) are dropped.
const LEGACY_TYPE = { digits: 'digits', colors: 'colors', emoji: 'shapes', mixed: 'mixed' }
export function savedSequenceTypes(saved) {
  const list = Array.isArray(saved?.sequenceTypes)
    ? saved.sequenceTypes
    : LEGACY_TYPE[saved?.sequenceType]
      ? [LEGACY_TYPE[saved.sequenceType]]
      : []
  const types = SEQUENCE_TYPES.filter((t) => list.includes(t))
  return types.length ? types : ['digits']
}

// This device's private payload for the CURRENT deal, or null. `serial`
// changes on every deal (including a cancelled round's redo), so a stale
// sequence or role from the previous deal is never shown.
export function privateFor(game, myRole) {
  const p = myRole?.memoryImposter
  return p && p.serial === game.roundSerial ? p : null
}

// The phase clock, ticking locally between server pushes (paused while the
// look is on hold).
export function usePhaseClock(game) {
  const key = `${game.roundSerial}:${game.phase}`
  return useClock(game.msLeft ?? 0, key, game.msLeft != null && !game.hold)
}
