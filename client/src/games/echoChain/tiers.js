// Echo Chain's difficulty tiers — the ONE place their names and
// descriptions live. Rename a tier here and every screen follows: the
// settings cards, the game sheet / How to Play wording that's built from
// it, the in-game round line, the results and Tournament Mode summaries.
//
// `size` and `replay` are the rules. The server keeps its own copy of them
// (server/games/echoChainRules.js DIFFICULTIES — it can't import client
// code at runtime); server/echo-chain.selftest.mjs checks the two agree.
// Plain data, so node can import it too.

export const TIERS = {
  recall: {
    name: 'Recall',
    size: 3,
    replay: true,
    description: '3×3 grid. Miss, and the chain is replayed once for everyone.',
  },
  retain: {
    name: 'Retain',
    size: 4,
    replay: true,
    description: '4×4 grid. Miss, and the chain is replayed once for everyone.',
  },
  photographic: {
    name: 'Photographic',
    size: 5,
    replay: true,
    description: '5×5 grid. Miss, and the chain is replayed once for everyone.',
  },
  savant: {
    name: 'Savant',
    size: 5,
    replay: false,
    description: '5×5 grid. No replay, ever: the chain lives only in what you saw people tap.',
  },
}

export const TIER_KEYS = Object.keys(TIERS)
export const DEFAULT_TIER = 'recall'

// Rooms saved before the rename stored easy / medium / hard.
export const LEGACY_TIERS = { easy: 'recall', medium: 'retain', hard: 'photographic' }

// Any saved value -> a current tier key (unknown -> the default).
export function tierKey(value) {
  if (TIERS[value]) return value
  return LEGACY_TIERS[value] ?? DEFAULT_TIER
}

export const tierOf = (value) => TIERS[tierKey(value)]

// The small meta line on a tier's card: "5×5 · no replay".
export function tierMeta(value) {
  const t = tierOf(value)
  return `${t.size}×${t.size} · ${t.replay ? 'replay' : 'no replay'}`
}
