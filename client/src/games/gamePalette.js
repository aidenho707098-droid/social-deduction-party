import { GAMES } from './registry'

// Each game's accent from the locked palette, cycling violet → coral → gold
// by its position in the registry — the same identity the menu, the
// tournament wheel and the tournament breakdowns all share.
export const ACCENT_HEX = {
  violet: '#5b3e99',
  coral: '#ff7a50',
  gold: '#f0b429',
}

const CYCLE = ['violet', 'coral', 'gold']

export function accentName(gameId) {
  const i = GAMES.findIndex((g) => g.id === gameId)
  return CYCLE[(i < 0 ? 0 : i) % CYCLE.length]
}

export function accentHex(gameId) {
  return ACCENT_HEX[accentName(gameId)]
}
