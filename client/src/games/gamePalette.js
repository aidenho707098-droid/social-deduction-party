import { accentOf } from './catalog'

// Each game's accent from the locked palette, cycling violet → coral →
// mustard → light violet by its position in the catalogue: the same identity the
// menu, the tournament wheel and the tournament breakdowns all share.
export const ACCENT_HEX = {
  violet: '#5b3e99',
  coral: '#ff7a50',
  gold: '#f0b429',
  lilac: '#9a82db',
}

// The line-art colour on each accent (near-white on the purples, dark on
// coral and mustard).
export const ICON_ON = {
  violet: '#f7f4fb',
  coral: '#2b1008',
  gold: '#3a2a00',
  lilac: '#f7f4fb',
}

export function accentName(gameId) {
  return accentOf(gameId)
}

export function accentHex(gameId) {
  return ACCENT_HEX[accentName(gameId)]
}
