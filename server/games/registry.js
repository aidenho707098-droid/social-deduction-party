import * as imposter from "./imposter.js";
import * as wouldYouRather from "./would-you-rather.js";
import * as emojiMovie from "./emoji-movie.js";
import * as fibbage from "./fibbage.js";
import * as blackMagic from "./black-magic.js";
import * as wavelength from "./wavelength.js";
import * as taboo from "./taboo.js";
import * as fakeArtist from "./fake-artist.js";
import * as whoAmI from "./who-am-i.js";
import * as alphabetSoup from "./alphabet-soup.js";
import * as hotPotato from "./hot-potato.js";
import * as memoryImposter from "./memory-imposter.js";
import * as echoChain from "./echo-chain.js";
import * as wordHeist from "./word-heist.js";

// Every game module exports the same shape: id, name, minPlayers,
// createGame(), getPublicState(), getPrivateState(). index.js and rooms.js
// only ever talk to games through this registry — they don't know
// game-specific details.
export const GAMES = {
  [imposter.id]: imposter,
  [wouldYouRather.id]: wouldYouRather,
  [emojiMovie.id]: emojiMovie,
  [fibbage.id]: fibbage,
  [blackMagic.id]: blackMagic,
  [wavelength.id]: wavelength,
  [taboo.id]: taboo,
  [fakeArtist.id]: fakeArtist,
  [whoAmI.id]: whoAmI,
  [alphabetSoup.id]: alphabetSoup,
  [hotPotato.id]: hotPotato,
  [memoryImposter.id]: memoryImposter,
  [echoChain.id]: echoChain,
  [wordHeist.id]: wordHeist,
};
