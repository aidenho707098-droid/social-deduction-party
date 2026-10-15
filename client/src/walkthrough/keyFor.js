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
    case 'word-heist':
      return 'word-heist'
    case 'bomb-squad':
      return 'bomb-squad'
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
// and Echo Chain, for anyone still in, during every turn and replay —
// watching other players tap is how you learn the chain (in Savant, the
// ONLY way) — plus the countdown when you start. It shows in the beats
// between (the 3-2-1, a miss) or once you're out, and steps aside again
// when the next turn begins.
export function walkthroughDeferred(game, myId) {
  if (game?.id === 'memory-imposter') return game.phase === 'memorize'
  // Bomb Squad: never over a live bomb for the team on it (it eats fuse).
  if (game?.id === 'bomb-squad') {
    if (game.phase !== 'live') return false
    if (game.style === 'together') {
      const b = (game.bombs ?? []).find((x) => x.defuserId === myId || x.expertIds.includes(myId))
      return !!b && b.status === 'live'
    }
    const t = game.turn
    return !!t && (t.defuserId === myId || t.expertIds.includes(myId))
  }
  if (game?.id === 'echo-chain') {
    const playing = (game.activeIds ?? []).includes(myId)
    if (!playing) return false
    if (['echo', 'add', 'replay'].includes(game.phase)) return true
    return game.phase === 'countdown' && game.activeIds?.[0] === myId
  }
  return false
}
