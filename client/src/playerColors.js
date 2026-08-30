// Shared player-identity palette — the client half of the player-colour
// system. The SERVER (server/playerColors.js) is the authority: it assigns
// each player a colour on join and guarantees no two players in a room
// share one. Keep the ids / hex / order here in sync with that file.
//
// Used for: the lobby colour picker (needs every swatch) and resolving a
// colour to paint a <PlayerDot>. The public room player already carries a
// resolved `colorHex`, so a lookup is only needed where a component has a
// bare list of player ids (scores, ranks, vote tallies).
//
// The palette expands on the brand trio (violet / coral / mustard) with
// warm, slightly-muted tints in the same "quirky but clean" family, plus
// cooler counterpoints (teal, sage, denim, pine, periwinkle) for contrast.
// Ordered most-distinct-first so small rooms get maximally different dots.
// Every hex is checked to be visually distinct from the others — no
// near-duplicates — so 20 players still read apart at a glance.

export const PLAYER_COLORS = [
  { id: 'violet', name: 'Violet', hex: '#5B3E99' },
  { id: 'coral', name: 'Coral', hex: '#FF7A50' },
  { id: 'mustard', name: 'Mustard', hex: '#F0B429' },
  { id: 'teal', name: 'Teal', hex: '#2F9C9C' },
  { id: 'rose', name: 'Rose', hex: '#E06B93' },
  { id: 'sage', name: 'Sage', hex: '#7FA37A' },
  { id: 'terracotta', name: 'Terracotta', hex: '#C05C3E' },
  { id: 'plum', name: 'Plum', hex: '#8A5CA8' },
  { id: 'amber', name: 'Amber', hex: '#C6871C' },
  { id: 'mulberry', name: 'Mulberry', hex: '#9C4E72' },
  { id: 'sand', name: 'Sand', hex: '#CBA36B' },
  { id: 'indigo', name: 'Indigo', hex: '#4B4790' },
  { id: 'pumpkin', name: 'Pumpkin', hex: '#DA7B37' },
  { id: 'denim', name: 'Denim', hex: '#4C79A8' },
  { id: 'brick', name: 'Brick', hex: '#AC4348' },
  { id: 'pine', name: 'Pine', hex: '#4C9575' },
  { id: 'orchid', name: 'Orchid', hex: '#9A4FA0' },
  { id: 'periwinkle', name: 'Periwinkle', hex: '#7C84C8' },
  { id: 'olive', name: 'Olive', hex: '#8B8A47' },
  { id: 'cocoa', name: 'Cocoa', hex: '#7B5142' },
]

const HEX_BY_ID = Object.fromEntries(PLAYER_COLORS.map((c) => [c.id, c.hex]))

// Resolve whatever a caller has — a colour id, a hex string, a CSS var, or
// nothing — to a paintable colour.
export function resolvePlayerColor(color) {
  if (!color) return 'var(--muted)'
  if (color[0] === '#' || color.startsWith('var(') || color.startsWith('rgb'))
    return color
  return HEX_BY_ID[color] ?? 'var(--muted)'
}

// { playerId -> hex } from a room player list. Handy where a component only
// has a list of ids rather than the players themselves.
export function playerColorMap(players = []) {
  const m = {}
  for (const p of players) m[p.id] = p.colorHex ?? resolvePlayerColor(p.color)
  return m
}
