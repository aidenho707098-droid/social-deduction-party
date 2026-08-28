import * as imposter from "./imposter.js";
import * as wouldYouRather from "./would-you-rather.js";
import * as emojiMovie from "./emoji-movie.js";
import * as fibbage from "./fibbage.js";
import * as blackMagic from "./black-magic.js";

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
};
