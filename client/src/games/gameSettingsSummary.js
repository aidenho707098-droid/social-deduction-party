// A short human-readable summary of a game's createGame() options, shown
// next to a game in the Tournament lineup / "up next" screen so the host
// can see how each game is set up at a glance. Handles the option shapes
// of all games; unknown keys are ignored.
export function describeGameOptions(options) {
  if (!options || typeof options !== 'object') return null
  const o = options
  const parts = []

  if (o.mode === 'bank') parts.push('Standard')
  else if (o.mode === 'custom') parts.push('Custom Mode')
  else if (o.mode === 'personal') parts.push('Personal Mode')
  else if (o.mode === 'typed') parts.push('Typed')
  else if (o.mode === 'spoken') parts.push('Spoken')
  else if (o.mode) parts.push(String(o.mode))

  if (o.rounds && (!o.mode || ['bank', 'typed', 'spoken'].includes(o.mode))) {
    parts.push(`${o.rounds} rounds`)
  }
  if (o.burnedLetters) parts.push('burned letters')
  if (o.promptsPerPlayer) {
    parts.push(`${o.promptsPerPlayer} prompt${o.promptsPerPlayer === 1 ? '' : 's'}/player`)
  }
  if (o.imposterCount) {
    parts.push(`${o.imposterCount} imposter${o.imposterCount === 1 ? '' : 's'}`)
  }
  if (o.category) parts.push(o.category)
  if (Array.isArray(o.categories) && o.categories.includes('__random__')) {
    parts.push('random category')
  } else if (Array.isArray(o.categories)) {
    parts.push(`${o.categories.length} categor${o.categories.length === 1 ? 'y' : 'ies'}`)
  }
  if (o.difficulty && o.difficulty !== 'mixed') parts.push(o.difficulty)
  if (o.assignment === 'host') parts.push('host picks Witch')
  else if (o.assignment === 'rotation') parts.push('rotate Witch')

  return parts.length ? parts.join(' · ') : null
}
