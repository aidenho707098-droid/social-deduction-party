// Maps live room state to a WALKTHROUGHS key (see content.js), or null if
// the current mode isn't one of the seven complex-enough-to-guide modes.
// Two of the seven are conditional on a mode flag in the game's own public
// state rather than the game id alone (Fact or Fake's Personal Mode,
// Majority Pick's Custom Mode) — everything else always applies.
export function walkthroughKeyForGame(game) {
  if (!game) return null
  switch (game.id) {
    case 'taboo':
      return 'taboo'
    case 'black-magic':
      return 'black-magic'
    case 'wavelength':
      return 'wavelength'
    case 'fake-artist':
      return 'fake-artist'
    case 'who-am-i':
      return 'who-am-i'
    case 'alphabet-soup':
      return game.mode === 'spoken' ? 'alphabet-soup-spoken' : 'alphabet-soup-typed'
    case 'hot-potato':
      return 'hot-potato'
    case 'memory-imposter':
      return 'memory-imposter'
    case 'echo-chain':
      return 'echo-chain'
    case 'fibbage':
      return game.personal ? 'fibbage-personal' : null
    case 'would-you-rather':
      return game.custom ? 'would-you-rather-custom' : null
    default:
      return null
  }
}

// When the first-time walkthrough must NOT be on screen, because the
// overlay would eat time a player can't get back: Memory Imposter's look;
// Echo Chain while it's YOUR turn (or you're about to start it), and the
// replay after a miss for anyone still in (the only time the chain is shown
// again). It shows as soon as that's over instead.
export function walkthroughDeferred(game, myId) {
  if (game?.id === 'memory-imposter') return game.phase === 'memorize'
  if (game?.id === 'echo-chain') {
    const up = game.activeId ?? game.activeIds?.[0]
    if (game.phase === 'replay') return (game.activeIds ?? []).includes(myId)
    return up === myId && ['countdown', 'echo', 'add'].includes(game.phase)
  }
  return false
}
