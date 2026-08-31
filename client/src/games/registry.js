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
import WavelengthSetup from './wavelength/WavelengthSetup'
import WavelengthGame from './wavelength/WavelengthGame'
import { rules as wavelengthRules } from './wavelength/rules'
import TabooSetup from './taboo/TabooSetup'
import TabooGame from './taboo/TabooGame'
import { rules as tabooRules } from './taboo/rules'
import FakeArtistSetup from './fakeArtist/FakeArtistSetup'
import FakeArtistGame from './fakeArtist/FakeArtistGame'
import { rules as fakeArtistRules } from './fakeArtist/rules'

// To add a game: write its Setup + Game components and a rules.js, then
// add one entry here. Nothing else in the lobby/room framework needs to
// change. `rules` feeds the shared <HowToPlay> popup; `genre` is the short
// style tag shown in the menu meta line and the Game Catalogue.
export const GAMES = [
  { id: 'imposter', name: 'Imposter', minPlayers: 3, genre: 'social deduction', Setup: ImposterSetup, Game: ImposterGame, rules: imposterRules },
  { id: 'would-you-rather', name: 'Majority Pick', minPlayers: 2, genre: 'read the room', Setup: WouldYouRatherSetup, Game: WouldYouRatherGame, rules: wouldYouRatherRules },
  { id: 'emoji-movie', name: 'Crack the Code', minPlayers: 2, genre: 'emoji guessing', Setup: EmojiMovieSetup, Game: EmojiMovieGame, rules: emojiMovieRules },
  { id: 'fibbage', name: 'Fact or Fake', minPlayers: 3, genre: 'bluffing trivia', Setup: FibbageSetup, Game: FibbageGame, rules: fibbageRules },
  { id: 'black-magic', name: 'Black Magic', minPlayers: 3, genre: 'hidden behaviour', Setup: BlackMagicSetup, Game: BlackMagicGame, rules: blackMagicRules },
  { id: 'wavelength', name: 'Wavelength', minPlayers: 3, genre: 'spectrum guessing', Setup: WavelengthSetup, Game: WavelengthGame, rules: wavelengthRules },
  { id: 'taboo', name: 'Taboo', minPlayers: 3, genre: 'describe & guess', Setup: TabooSetup, Game: TabooGame, rules: tabooRules },
  { id: 'fake-artist', name: 'Fake Artist', minPlayers: 3, genre: 'draw & deduce', Setup: FakeArtistSetup, Game: FakeArtistGame, rules: fakeArtistRules },
]

export function getGame(id) {
  return GAMES.find((g) => g.id === id)
}
