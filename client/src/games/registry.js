import ImposterSetup from './imposter/ImposterSetup'
import ImposterGame from './imposter/ImposterGame'
import { rules as imposterRules } from './imposter/rules'
import WouldYouRatherSetup from './wouldYouRather/WouldYouRatherSetup'
import WouldYouRatherGame from './wouldYouRather/WouldYouRatherGame'
import { rules as wouldYouRatherRules } from './wouldYouRather/rules'
import EmojiMovieSetup from './emojiMovie/EmojiMovieSetup'
import EmojiMovieGame from './emojiMovie/EmojiMovieGame'
import { rules as emojiMovieRules } from './emojiMovie/rules'
import FibbageSetup from './fibbage/FibbageSetup'
import FibbageGame from './fibbage/FibbageGame'
import { rules as fibbageRules } from './fibbage/rules'
import BlackMagicSetup from './blackMagic/BlackMagicSetup'
import BlackMagicGame from './blackMagic/BlackMagicGame'
import { rules as blackMagicRules } from './blackMagic/rules'

// To add a game: write its Setup + Game components and a rules.js, then
// add one entry here. Nothing else in the lobby/room framework needs to
// change. `rules` feeds the shared <HowToPlay> popup.
export const GAMES = [
  { id: 'imposter', name: 'Imposter', minPlayers: 3, Setup: ImposterSetup, Game: ImposterGame, rules: imposterRules },
  { id: 'would-you-rather', name: 'Would You Rather', minPlayers: 2, Setup: WouldYouRatherSetup, Game: WouldYouRatherGame, rules: wouldYouRatherRules },
  { id: 'emoji-movie', name: 'Emoji Movie Guess', minPlayers: 2, Setup: EmojiMovieSetup, Game: EmojiMovieGame, rules: emojiMovieRules },
  { id: 'fibbage', name: 'Fact or Fake', minPlayers: 3, Setup: FibbageSetup, Game: FibbageGame, rules: fibbageRules },
  { id: 'black-magic', name: 'Black Magic', minPlayers: 3, Setup: BlackMagicSetup, Game: BlackMagicGame, rules: blackMagicRules },
]

export function getGame(id) {
  return GAMES.find((g) => g.id === id)
}
