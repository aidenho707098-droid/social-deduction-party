// No repeats within a session, for every expanded content bank: draw 30
// items through the games' REAL selection code, across as many back-to-back
// games as it takes, carrying the room's memory from one game to the next
// exactly like server/index.js does (room.itemMemory[gameId] =
// game.deckMemory -> the next createGame's `memory`). Prints the 30 draws
// per bank and fails on any repeat.
// Run:  node server/content-norepeat.selftest.mjs   (or npm run test:content)

import * as imposter from "./games/imposter.js";
import * as emoji from "./games/emoji-movie.js";
import * as taboo from "./games/taboo.js";
import * as fakeArtist from "./games/fake-artist.js";
import * as wavelength from "./games/wavelength.js";
import * as whoAmI from "./games/who-am-i.js";
import * as soup from "./games/alphabet-soup.js";
import * as potato from "./games/hot-potato.js";
import * as heist from "./games/word-heist.js";
import { CATEGORIES as FA_CATS } from "./fakeArtistWords.js";

let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const P3 = ["a", "b", "c"];
const P5 = ["a", "b", "c", "d", "e"];
const N = 30;

// Play games back to back (each new game gets the last one's memory) until
// `draw(game)` has produced N items.
function session(label, make, draw) {
  const got = [];
  let memory;
  let games = 0;
  while (got.length < N && games < 200) {
    const g = make(memory);
    games += 1;
    got.push(...draw(g));
    memory = g.deckMemory;
  }
  const items = got.slice(0, N);
  const dupes = items.filter((x, i) => items.indexOf(x) !== i);
  check(`${label}: ${N} draws over ${games} game(s), no repeats`, items.length === N && dupes.length === 0, dupes.length ? `repeats: ${[...new Set(dupes)].join(", ")}` : "");
  console.log(`      ${items.join(" · ")}`);
}

// Imposter: one word per game, so 30 games of the same category.
for (const cat of imposter.CATEGORY_NAMES) {
  session(`Imposter / ${cat}`, (memory) => imposter.createGame(P3, { imposterCount: 1, category: cat, memory }), (g) => [g.word]);
}

for (const c of emoji.CATEGORIES) {
  session(`Crack the Code / ${c.name}`, (memory) => emoji.createGame(P3, { rounds: 10, difficulty: "mixed", categories: [c.key], memory }), (g) => g.entries.map((e) => e.title));
}

for (const key of ["objects", "movies", "places", "food", "animals", "activities"]) {
  session(`Taboo / ${key}`, (memory) => taboo.createGame(P3, { rounds: 10, categories: [key], memory }), (g) => g.entries.map((e) => e.word));
}

for (const cat of Object.keys(FA_CATS)) {
  session(`Fake Artist / ${cat}`, (memory) => fakeArtist.createGame(P3, { rounds: 10, categories: [cat], memory }), (g) => g.entries.map((e) => e.word));
}

session("Wavelength / scales", (memory) => wavelength.createGame(P3, { rounds: 10, memory }), (g) => g.scales.map((s) => s.category));

for (const key of ["animals", "jobs", "fictional", "foods", "places", "objects"]) {
  session(`Who Am I? / ${key}`, (memory) => whoAmI.createGame(P5, { rounds: 2, categories: [key], memory }), (g) => g.roundEntries.flat().map((e) => e.name));
}

// Alphabet Soup: every round of a game, advanced the way the selftest does.
session(
  "Alphabet Soup / categories",
  (memory) => soup.createGame(P3, { rounds: 10, categories: [], memory }),
  (g) => {
    const cats = [g.round.categoryKey];
    while (g.phase !== "final") {
      g.phase = "reveal";
      soup.nextRound(g, P3);
      if (g.phase !== "final") cats.push(g.round.categoryKey);
    }
    return cats;
  },
);

// Hot Potato: a game's first potato (one category per potato).
session("Hot Potato / categories", (memory) => potato.createGame(P3, { categories: [], memory }), (g) => [g.potato.categoryKey]);

// Word Heist: the two prompts offered to each setter, every game.
session(
  "Word Heist / prompts offered",
  (memory) => heist.createGame(P5, { mode: "prompted", memory }),
  (g) => [...g.round.setters.values()].flatMap((s) => s.prompts),
);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
