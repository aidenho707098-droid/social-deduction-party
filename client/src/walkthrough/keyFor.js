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
    case 'fibbage':
      return game.personal ? 'fibbage-personal' : null
    case 'would-you-rather':
      return game.custom ? 'would-you-rather-custom' : null
    default:
      return null
  }
}
