// Client-side cosmetics for Chaos modifiers. The authoritative names +
// blurbs live server-side (server/chaos.js); CHAOS_MODIFIERS below mirrors
// them so the in-game reference guide can render without a round trip —
// keep the two lists in sync when either changes.

export const CHAOS_ICONS = {
  'double-points': '✦',
  'triple-points': '✸',
  'quad-points': '❋',
  'score-swap': '⇄',
  steal: '🤏',
  'underdog-boost': '🛡️',
  'all-or-nothing': '🎯',
  'speed-round': '⚡',
  'point-reversal': '🔃',
  'risk-it': '🎲',
  'countdown-chaos': '⏱️',
  kingbreaker: '👑',
  rival: '⚔️',
  'tax-collector': '💰',
  'half-reset': '➗',
  'player-disable': '🚫',
  'the-tyrant': '👑',
}

export const CHAOS_MODIFIERS = [
  { id: 'double-points', name: 'Double Points', blurb: 'Every point scored this round counts twice.' },
  { id: 'triple-points', name: 'Triple Points', blurb: 'Every point scored this round counts triple.' },
  { id: 'quad-points', name: 'Quadruple Points', blurb: 'Every point scored this round counts four times.' },
  { id: 'score-swap', name: 'Score Swap', blurb: 'Two random players trade their total scores. Right now.' },
  { id: 'steal', name: 'Steal', blurb: "Last place skims 40% of first place's haul this round." },
  { id: 'underdog-boost', name: 'Underdog Boost', blurb: "Whoever's in last place scores TRIPLE this round, no matter what." },
  { id: 'all-or-nothing', name: 'All or Nothing', blurb: 'Only the round winner scores. Everyone else gets nothing.' },
  { id: 'speed-round', name: 'Speed Round', blurb: 'Every timer this round is slashed to ten seconds. Go.' },
  { id: 'point-reversal', name: 'Point Reversal', blurb: 'Scoring is flipped — the lowest scorer takes the biggest reward.' },
  { id: 'risk-it', name: 'Risk It', blurb: "Wager your points now. Do well to double it — do badly and it's gone." },
  { id: 'countdown-chaos', name: 'Countdown Chaos', blurb: "The clock vanishes. A creeping pulse at the screen's edge is all the warning you get." },
  { id: 'kingbreaker', name: 'Kingbreaker', blurb: 'Every point earned this round is torn from the current points leader.' },
  { id: 'rival', name: 'Rival', blurb: "Two players are paired — the one who scores higher this round rips 45% of the other's round points." },
  { id: 'tax-collector', name: 'Tax Collector', blurb: "The round winner rakes in 20% of everyone else's round points." },
  { id: 'half-reset', name: 'Half Reset', blurb: 'Whoever scores least this round has their TOTAL score halved.' },
  { id: 'player-disable', name: 'Player Disable', blurb: "The round winner zeroes out one rival's points for the NEXT round." },
  { id: 'the-tyrant', name: 'The Tyrant', blurb: "The points leader seizes 20% of every rival's round score." },
]

export const FREQUENCY_LABELS = [
  { key: 'off', label: 'Off' },
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Med' },
  { key: 'high', label: 'High' },
  { key: 'maximum', label: 'Max' },
]

export const FREQUENCY_HINT = {
  off: 'No Chaos Events. (Default.)',
  low: 'A Chaos Event on roughly 1 in 10 rounds.',
  medium: 'A Chaos Event on roughly 1 in 5 rounds.',
  high: 'A Chaos Event on roughly 1 in 3 rounds. Buckle up.',
  maximum: 'A Chaos Event EVERY single round. Total anarchy.',
}
