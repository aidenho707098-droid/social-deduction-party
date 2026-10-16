// Content audit: every game's built-in content bank, its size, the target
// size, and duplicates. Prints a table; exits 1 if any bank is under target
// or has duplicates (so it can run as a check).
// Run:  node server/content-audit.mjs   (or npm run audit:content)

import * as wyr from "./games/would-you-rather.js";
import * as fib from "./games/fibbage.js";
import * as emoji from "./games/emoji-movie.js";
import * as imp from "./games/imposter.js";
import * as bm from "./games/black-magic.js";
import { SCALES } from "./games/wavelengthScales.js";
import { BANKS as TABOO } from "./games/tabooWords.js";
import { CATEGORIES as FAKE_ARTIST } from "./fakeArtistWords.js";
import { BANKS as WHO } from "./games/whoAmIBank.js";
import { CATEGORIES as SOUP } from "./games/alphabetSoupBank.js";
import { PROMPTS as HEIST } from "./games/wordHeistBank.js";

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rows = [];
function bank(game, name, items, target, keyOf = (x) => x) {
  const keys = items.map((x) => norm(keyOf(x)));
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  rows.push({ game, name, count: items.length, target, dupes: [...new Set(dupes)] });
}

bank("Majority Pick", "built-in questions", wyr.QUESTIONS, 120, (q) => `${q.prompt} ${q.options.join("|")}`);
bank("Majority Pick", "Custom Mode prompts", wyr.PROMPTS, null);
bank("Fact or Fake", "facts", fib.FACTS, 150, (f) => f.prompt);
const personal = Object.values(fib.PERSONAL_PROMPTS).flat();
bank("Fact or Fake", `Personal Mode prompts (${Object.entries(fib.PERSONAL_PROMPTS).map(([k, v]) => `${k} ${v.length}`).join(", ")})`, personal, 60, (p) => p.self);
for (const [key, list] of Object.entries(emoji.BANKS)) {
  const label = emoji.CATEGORIES.find((c) => c.key === key)?.name ?? key;
  bank("Crack the Code", label, list, key === "mashup" ? 100 : 80, (e) => e.title);
}
for (const [cat, words] of Object.entries(imp.CATEGORIES)) bank("Imposter", cat, words, 40);
for (const [cat, list] of Object.entries(TABOO)) bank("Taboo", cat, list, 40, (w) => w.word);
for (const [cat, words] of Object.entries(FAKE_ARTIST)) bank("Fake Artist", cat, words, 40);
bank("Black Magic", "Curses", bm.CURSES, 80, (c) => c.text);
bank("Wavelength", "scales", SCALES, 80, (s) => s.category);
for (const [cat, list] of Object.entries(WHO)) bank("Who Am I?", cat, list, 50, (w) => w.name);
bank("Alphabet Soup + Hot Potato", "categories (shared)", SOUP, 100, (c) => c.key);
bank("Word Heist", "prompts", HEIST, 80, (p) => p.text);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("Game", 28)}${pad("Bank", 52)}${pad("Count", 7)}${pad("Target", 8)}Status`);
console.log("-".repeat(108));
let bad = 0;
for (const r of rows) {
  const short = r.target != null && r.count < r.target;
  const status = [short ? `UNDER (+${r.target - r.count})` : r.target != null ? "ok" : "—", r.dupes.length ? `DUPES: ${r.dupes.join(", ")}` : ""].filter(Boolean).join("  ");
  if (short || r.dupes.length) bad++;
  console.log(`${pad(r.game, 28)}${pad(r.name.slice(0, 50), 52)}${pad(r.count, 7)}${pad(r.target ?? "—", 8)}${status}`);
}
console.log(`\n${rows.length} banks, ${bad} under target or with duplicates. (Word Jungle: no such game — skipped.)`);
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
process.exit(bad ? 1 : 0);
