// Per-game AI content generators. Each takes a host-typed name and returns
// a batch ready to drop onto room state as a new selectable pool /
// category / source. The OpenAI call, timeout and error handling are
// shared — see aiShared.js. index.js exposes ONE socket event
// ("ai_generate_content") that routes to these by gameId.

import {
  callJSON,
  badResponse,
  normalizeName,
  cleanPhrase,
  sanitizeWordList,
} from "./aiShared.js";

export { aiContentAvailable, hostFacingAiError } from "./aiShared.js";

// Batches aim for ~14 entries (in line with the built-in banks); anything
// from MIN up is accepted, fewer than MIN is treated as "the model
// couldn't do it" and the host is asked to retry / pick built-in content.
const TARGET = 14;
const MIN = 8;
const MAX = 15;

function requireName(raw) {
  const name = normalizeName(raw);
  if (name.length < 2) {
    const e = new Error("Name is too short");
    e.code = "bad_name";
    throw e;
  }
  return name;
}

// ─── Imposter — "Custom Category" ────────────────────────────────────────
// { name, words: string[] } — a pool of common words; the server draws one
// secret word per round, imposter only gets the category name.

const IMPOSTER_TARGET = 18;
const IMPOSTER_MIN = 10;

const IMPOSTER_SYSTEM = `You generate word lists for the party game "Imposter". \
The players share one secret word from a category; one player (the imposter) \
only knows the category and has to bluff. Given a category name, return \
common, widely-recognised examples that fit it.

Requirements:
- Return ${IMPOSTER_TARGET} items (a few less is fine ONLY if the category \
genuinely has fewer well-known examples).
- Each item: 1-3 words, Title Case, no leading articles ("the", "a").
- Everyday knowledge — things a typical adult at a party would recognise. \
No obscure, hyper-technical, regional, or brand-specific entries. Nothing \
offensive or adult.
- Single words or short proper names preferred. No descriptions, no \
numbering, no duplicates, no near-duplicates.

Respond with ONLY a JSON object: {"words": ["Item One", "Item Two", ...]}`;

export async function generateImposterCategory(rawName) {
  const name = requireName(rawName);
  const parsed = await callJSON({
    system: IMPOSTER_SYSTEM,
    user: `Category: ${name}`,
  });
  const words = sanitizeWordList(parsed?.words, { max: 20 });
  if (words.length < IMPOSTER_MIN) {
    badResponse(`Only got ${words.length} usable word(s) for "${name}"`);
  }
  return { name, words };
}

// ─── Crack the Code — "Custom Theme" ─────────────────────────────────────
// { name, entries: [{ emojis:[3], title, alts:[], difficulty }] }

const EMOJI_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const EMOJI_SYSTEM = `You generate emoji puzzles for the party game "Crack the Code". \
Each puzzle is a well-known title spelled out as exactly 3 emojis that hint at it \
(like a rebus). Given a theme, return puzzles for titles that fit the theme.

Requirements:
- Return ${TARGET} puzzles (a few less is fine for a narrow theme).
- Each: a real, widely-known title matching the theme, and exactly 3 emojis \
that evoke it. Prefer emojis that capture plot / imagery / wordplay, not just \
the first letter.
- "alts": optional short accepted alternative spellings/abbreviations (e.g. \
"lotr"); use [] if none.
- "difficulty": "easy" (almost anyone knows it), "medium", or "hard" (cult / \
tricky clue).
- No duplicates. Titles a typical adult would recognise — nothing obscure or adult.

Respond with ONLY a JSON object:
{"entries":[{"emojis":["🦁","👑","🌅"],"title":"The Lion King","alts":[],"difficulty":"easy"}, ...]}`;

function sanitizeEmojiEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    const title = cleanPhrase(e?.title);
    if (!title || title.length > 60 || title.split(" ").length > 8) continue;
    if (/[\n\r{}[\]<>]/.test(title)) continue;
    const emojis = Array.isArray(e?.emojis)
      ? e.emojis.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    if (emojis.length < 2 || emojis.length > 3) continue;
    if (emojis.some((x) => x.length > 12)) continue; // guard against words-as-emoji
    const difficulty = EMOJI_DIFFICULTIES.has(e?.difficulty) ? e.difficulty : "medium";
    const alts = Array.isArray(e?.alts)
      ? e.alts.map(cleanPhrase).filter((a) => a && a.length <= 40).slice(0, 4)
      : [];
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ emojis: emojis.slice(0, 3), title, alts, difficulty });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function generateEmojiTheme(rawName) {
  const name = requireName(rawName);
  const parsed = await callJSON({
    system: EMOJI_SYSTEM,
    user: `Theme: ${name}`,
  });
  const entries = sanitizeEmojiEntries(parsed?.entries);
  if (entries.length < MIN) {
    badResponse(`Only got ${entries.length} usable puzzle(s) for "${name}"`);
  }
  return { name, entries };
}

// ─── Fact or Fake — "Custom Topic" ──────────────────────────────────────
// { name, items: [{ prompt (contains "___"), answer }] }

const FIBBAGE_SYSTEM = `You generate trivia for the bluffing game "Fact or Fake". \
Each item is a genuinely SURPRISING true fact written as a sentence with a single \
blank "___" where the key word or short phrase goes, plus that answer. Given a \
topic, return facts about it.

Requirements:
- Return ${TARGET} facts (a few less is fine for a narrow topic).
- Every fact must be REAL and verifiable, and genuinely obscure — the kind of \
thing that makes people say "no way". NOT common knowledge.
- The blank's answer is a WORD or SHORT PHRASE (1-4 words), never a bare number.
- Exactly one "___" per prompt. Keep prompts to one sentence.
- No duplicates. Nothing offensive or adult.

Respond with ONLY a JSON object:
{"items":[{"prompt":"A group of flamingos is called a ___.","answer":"flamboyance"}, ...]}`;

function sanitizeFacts(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const it of raw) {
    const prompt = cleanPhrase(it?.prompt);
    const answer = cleanPhrase(it?.answer);
    if (!prompt || !answer) continue;
    if (prompt.length > 240 || answer.length > 40) continue;
    if ((prompt.match(/___/g) ?? []).length !== 1) continue;
    if (answer.split(" ").length > 4) continue;
    if (/^\d+$/.test(answer.replace(/[,\s]/g, ""))) continue; // no bare numbers
    if (/[\n\r{}[\]<>]/.test(prompt + answer)) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ prompt, answer });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function generateFibbageTopic(rawName) {
  const name = requireName(rawName);
  const parsed = await callJSON({
    system: FIBBAGE_SYSTEM,
    user: `Topic: ${name}`,
  });
  const items = sanitizeFacts(parsed?.items);
  if (items.length < MIN) {
    badResponse(`Only got ${items.length} usable fact(s) for "${name}"`);
  }
  return { name, items };
}

// ─── Taboo — "Custom Category" ──────────────────────────────────────────
// { name, entries: [{ word, taboo:[4-6], alts:[] }] }

const TABOO_SYSTEM = `You generate cards for the party game "Taboo". Each card is a \
secret WORD to describe out loud, plus 4-6 "taboo" words the describer may NOT say \
(the most obvious related terms). Given a category, return cards that fit it.

Requirements:
- Return ${TARGET} cards (a few less is fine for a narrow category).
- "word": a common, guessable thing in the category — 1-3 words, Title Case.
- "taboo": 4-6 lowercase single words most people would naturally use to \
describe it (the ones that make it too easy).
- "alts": optional extra accepted spellings/synonyms for guess-matching; [] if none.
- No duplicates. Nothing obscure, offensive, or adult.

Respond with ONLY a JSON object:
{"entries":[{"word":"Umbrella","taboo":["rain","cover","open","handle","wet"],"alts":[]}, ...]}`;

function sanitizeTabooEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    const word = cleanPhrase(e?.word);
    if (!word || word.length > 40 || word.split(" ").length > 3) continue;
    if (/[\n\r{}[\]<>]/.test(word)) continue;
    const taboo = sanitizeWordList(e?.taboo, { max: 6, maxWords: 2 })
      .map((w) => w.toLowerCase())
      .filter((w) => w.toLowerCase() !== word.toLowerCase());
    if (taboo.length < 3) continue;
    const alts = Array.isArray(e?.alts)
      ? e.alts.map(cleanPhrase).filter((a) => a && a.length <= 40).slice(0, 4)
      : [];
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, taboo: taboo.slice(0, 6), alts });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function generateTabooCategory(rawName) {
  const name = requireName(rawName);
  const parsed = await callJSON({
    system: TABOO_SYSTEM,
    user: `Category: ${name}`,
  });
  const entries = sanitizeTabooEntries(parsed?.entries);
  if (entries.length < MIN) {
    badResponse(`Only got ${entries.length} usable card(s) for "${name}"`);
  }
  return { name, entries };
}

// ─── Fake Artist — "Custom Theme" ──────────────────────────────────────
// { name, entries: [{ word, category }] } — category is a SHORT general
// hint shown to the Fake Artist (e.g. "Animal", "Vehicle").

const FAKE_ARTIST_SYSTEM = `You generate secret words for the drawing game "Fake Artist". \
Everyone draws one small piece of a shared picture of the word — except the faker, \
who is only told a general category hint. Given a theme, return drawable words that \
fit it.

Requirements:
- Return ${TARGET} words (a few less is fine for a narrow theme).
- "word": a concrete, ICONIC noun a group could recognisably sketch together — \
1-3 words, Title Case. No abstractions.
- "category": a SHORT general hint (1-2 words, Title Case) that fits the word but \
doesn't give it away, e.g. "Animal", "Food", "Vehicle", "Building".
- No duplicates. Nothing obscure, offensive, or adult.

Respond with ONLY a JSON object:
{"entries":[{"word":"Reindeer","category":"Animal"},{"word":"Sleigh","category":"Vehicle"}, ...]}`;

function sanitizeFakeArtistEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    const word = cleanPhrase(e?.word);
    const category = cleanPhrase(e?.category);
    if (!word || !category) continue;
    if (word.length > 40 || word.split(" ").length > 3) continue;
    if (category.length > 24 || category.split(" ").length > 2) continue;
    if (/[\n\r{}[\]<>]/.test(word + category)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, category });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function generateFakeArtistTheme(rawName) {
  const name = requireName(rawName);
  const parsed = await callJSON({
    system: FAKE_ARTIST_SYSTEM,
    user: `Theme: ${name}`,
  });
  const entries = sanitizeFakeArtistEntries(parsed?.entries);
  if (entries.length < MIN) {
    badResponse(`Only got ${entries.length} usable word(s) for "${name}"`);
  }
  return { name, entries };
}

// Registry: gameId -> how to generate a batch and what host-facing noun to
// use in error copy. index.js's single socket handler reads this.
export const AI_GENERATORS = {
  imposter: {
    generate: generateImposterCategory,
    fallbackNoun: "a built-in category",
  },
  "emoji-movie": {
    generate: generateEmojiTheme,
    fallbackNoun: "the built-in categories",
  },
  fibbage: {
    generate: generateFibbageTopic,
    fallbackNoun: "the trivia bank",
  },
  taboo: {
    generate: generateTabooCategory,
    fallbackNoun: "the built-in categories",
  },
  "fake-artist": {
    generate: generateFakeArtistTheme,
    fallbackNoun: "the built-in categories",
  },
};
