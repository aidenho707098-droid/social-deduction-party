import { useClock } from '../hotPotato/useClock'

// Plain data + hooks shared by the Memory Imposter screens (kept out of
// the component files so Fast Refresh keeps working).

// Colors are colored SHAPES (server ids in server/games/memorySequence.js).
export const COLOR_ITEMS = {
  red: { hex: '#d64545', shape: 'circle', label: 'Red circle' },
  blue: { hex: '#3a6fd8', shape: 'square', label: 'Blue square' },
  yellow: { hex: '#f0b429', shape: 'triangle', label: 'Yellow triangle' },
  green: { hex: '#3e9b57', shape: 'diamond', label: 'Green diamond' },
  purple: { hex: '#5b3e99', shape: 'star', label: 'Purple star' },
  orange: { hex: '#ff7a50', shape: 'hexagon', label: 'Orange hexagon' },
  pink: { hex: '#e06b93', shape: 'heart', label: 'Pink heart' },
  teal: { hex: '#2f9c9c', shape: 'plus', label: 'Teal plus' },
}

export function itemLabel(type, item) {
  if (item == null) return 'no answer'
  if (type === 'colors') return COLOR_ITEMS[item]?.label ?? String(item)
  return String(item)
}

// This device's private payload for the CURRENT deal, or null. `serial`
// changes on every deal (including a cancelled round's redo), so a stale
// role or sequence from the previous deal is never shown.
export function privateFor(game, myRole) {
  const p = myRole?.memoryImposter
  return p && p.serial === game.roundSerial ? p : null
}

// The phase clock, ticking locally between server pushes (paused while the
// Imposter's view window is on hold).
export function usePhaseClock(game, extraKey = '') {
  const key = `${game.roundSerial}:${game.phase}:${extraKey}`
  return useClock(game.msLeft ?? 0, key, game.msLeft != null && !game.hold)
}
