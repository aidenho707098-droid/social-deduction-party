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
import WhoAmISetup from './whoAmI/WhoAmISetup'
import WhoAmIGame from './whoAmI/WhoAmIGame'
import { rules as whoAmIRules } from './whoAmI/rules'
import AlphabetSoupSetup from './alphabetSoup/AlphabetSoupSetup'
import AlphabetSoupGame from './alphabetSoup/AlphabetSoupGame'
import { rules as alphabetSoupRules } from './alphabetSoup/rules'
import HotPotatoSetup from './hotPotato/HotPotatoSetup'
import HotPotatoGame from './hotPotato/HotPotatoGame'
import { rules as hotPotatoRules } from './hotPotato/rules'
import MemoryImposterSetup from './memoryImposter/MemoryImposterSetup'
import MemoryImposterGame from './memoryImposter/MemoryImposterGame'
import { rules as memoryImposterRules } from './memoryImposter/rules'

import { CATALOG } from './catalog'

// To add a game: its metadata goes in catalog.js (the single list every
// menu, catalogue and tournament screen reads); its Setup + Game components
// and rules.js are wired up here by id. `rules` feeds the shared
// <HowToPlay> content. Nothing else in the lobby/room framework changes.
const PARTS = {
  imposter: { Setup: ImposterSetup, Game: ImposterGame, rules: imposterRules },
  'would-you-rather': { Setup: WouldYouRatherSetup, Game: WouldYouRatherGame, rules: wouldYouRatherRules },
  'emoji-movie': { Setup: EmojiMovieSetup, Game: EmojiMovieGame, rules: emojiMovieRules },
  fibbage: { Setup: FibbageSetup, Game: FibbageGame, rules: fibbageRules },
  'black-magic': { Setup: BlackMagicSetup, Game: BlackMagicGame, rules: blackMagicRules },
  wavelength: { Setup: WavelengthSetup, Game: WavelengthGame, rules: wavelengthRules },
  taboo: { Setup: TabooSetup, Game: TabooGame, rules: tabooRules },
  'fake-artist': { Setup: FakeArtistSetup, Game: FakeArtistGame, rules: fakeArtistRules },
  'who-am-i': { Setup: WhoAmISetup, Game: WhoAmIGame, rules: whoAmIRules },
  'alphabet-soup': { Setup: AlphabetSoupSetup, Game: AlphabetSoupGame, rules: alphabetSoupRules },
  'hot-potato': { Setup: HotPotatoSetup, Game: HotPotatoGame, rules: hotPotatoRules },
  'memory-imposter': { Setup: MemoryImposterSetup, Game: MemoryImposterGame, rules: memoryImposterRules },
}

export const GAMES = CATALOG.map((entry) => ({ ...entry, ...PARTS[entry.id] }))

export function getGame(id) {
  return GAMES.find((g) => g.id === id)
}
