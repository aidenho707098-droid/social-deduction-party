// Wavelength — clue rule enforcement (fuzzy).
//
// A Clue-Giver's phrase is rejected if, after light normalisation, any of
// its words is:
//   * a digit / digit-containing token ("7", "7th", "3x"), OR
//   * a spelled-out number, allowing typos ("sevn" -> "seven"), OR
//   * one of the round's banned pole words, allowing typos and simple
//     morphological variants ("loudd", "louder", "loudest" -> "loud").
//
// This module is pure and self-contained so it can be unit-tested on its
// own: `checkClue(text, bannedWords) -> { ok } | { ok:false, reason, term }`.

// Cardinal + a few ordinal number words. "oh"/"a"/"an" deliberately left
// out — too common as normal words.
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty",
  "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
  "thousand", "million", "billion", "dozen", "couple",
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
  "eighth", "ninth", "tenth",
];

// Classic Levenshtein edit distance between two short strings.
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Split a clue into comparable lowercase word tokens. Keeps digits so the
// number check can see "7"; strips other punctuation.
export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// How many edits we tolerate for a word of length n. Short words must be
// exact (an edit-distance-1 match on a 4-letter word catches too many real
// words, e.g. "load" vs "loud"); the prefix rule below still catches
// double-letter and suffix variants like "loudd" / "louder".
function tol(n) {
  if (n <= 4) return 0;
  if (n <= 6) return 1;
  return 2;
}

// Is `token` a fuzzy hit for target word `word`? True on:
//   * small edit distance (typos: "loudd", "sevn"), OR
//   * `token` is `word` plus a short suffix ("louder", "loudest",
//     "loudly", "sevens"), OR
//   * `word` is `token` plus a short suffix (stem typed instead of the
//     listed form).
export function fuzzyWordMatch(token, word) {
  if (!token || !word) return false;
  if (token === word) return true;
  if (editDistance(token, word) <= tol(word.length)) return true;
  if (token.length >= 3 && token.startsWith(word) && token.length - word.length <= 4) {
    return true;
  }
  if (word.length >= 4 && word.startsWith(token) && word.length - token.length <= 3) {
    return true;
  }
  return false;
}

function looksNumeric(token) {
  if (/\d/.test(token)) return true; // "7", "7th", "3x"
  return NUMBER_WORDS.some((w) => fuzzyWordMatch(token, w));
}

// Validate a submitted clue against this round's banned pole words.
// `bannedWords` is a flat list of lowercase stems for THIS scale.
export function checkClue(text, bannedWords = []) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { ok: false, reason: "empty" };

  for (const token of tokens) {
    if (looksNumeric(token)) {
      return { ok: false, reason: "number", term: token };
    }
  }
  for (const token of tokens) {
    for (const banned of bannedWords) {
      if (fuzzyWordMatch(token, String(banned).toLowerCase())) {
        return { ok: false, reason: "pole", term: token };
      }
    }
  }
  return { ok: true };
}

export const _NUMBER_WORDS = NUMBER_WORDS; // exported for tests
