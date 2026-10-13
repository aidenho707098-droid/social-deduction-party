// Lenient word matching for Alphabet Soup — the same family of rules the
// other games use (emoji-movie.js / fake-artist.js / who-am-i.js /
// fibbage.js each carry their own copy): lowercase, strip accents, "&" ->
// "and", drop a leading article and anything that isn't a letter or digit,
// then allow a small edit distance that grows with length. On top of that
// this version folds simple plurals ("bears" == "bear", "berries" ==
// "berry", "boxes" == "box"), because a category-and-letter game compares
// free-text answers against EACH OTHER, not against one known target.
//
// The client mirrors this file for instant feedback
// (client/src/games/alphabetSoup/answerChecks.js). The server is the
// authority; server/alphabet-soup.selftest.mjs asserts the two agree.

const ARTICLE = /^(the|a|an)\s+/;

function baseFold(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/&/g, " and ")
    .trim();
}

// Plural folding on an already-collapsed (letters/digits only) string.
// Deliberately conservative: only touches words long enough that the
// suffix is very likely a plural ("bus" / "gas" / "iris" are left alone).
function singular(s) {
  if (s.length > 4 && s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && /(ches|shes|sses|xes|zes)$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith("s") && !/(ss|us|is)$/.test(s)) return s.slice(0, -1);
  return s;
}

// The comparison key for an answer: article-free, punctuation/space-free,
// singular. "The Bears", "bear", "BEAR!" -> "bear"; "ice-cream" and
// "ice cream" -> "icecream". Also used as the validation cache key.
export function canonicalAnswer(value) {
  const collapsed = baseFold(value).replace(ARTICLE, "").replace(/[^a-z0-9]/g, "");
  return singular(collapsed);
}

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

// Are two typed answers "the same answer"? Exact after canonicalising, or
// within a typo budget that grows with length. The budget is stricter than
// the guess-vs-target games (Fact or Fake's 4/8 tiers, not Crack the
// Code's 3/6) because here BOTH sides are free text that already share a
// first letter: "Iran" vs "Iraq" or "Mali" vs "Malta" must stay distinct.
// Numbers must match exactly ("7 up" vs "8 up" are different answers).
// Two answers with the same number of words are also compared word by
// word, so a one-letter change in a short word is a different answer, not
// a typo: "Horse fly" and "House fly" stay distinct (see sameWord()).
// With `sequels` on (Movies, TV Shows, Video Games...) both sides are
// compared with any trailing sequel number stripped — see stripSequel().
export function sameAnswer(a, b, { sequels = false } = {}) {
  const left = sequels ? stripSequel(a) : a;
  const right = sequels ? stripSequel(b) : b;
  const x = canonicalAnswer(left);
  const y = canonicalAnswer(right);
  if (!x || !y) return false;
  if (x === y) return true;
  const digitsOf = (s) => (s.match(/\d+/g) ?? []).join(",");
  if (digitsOf(x) !== digitsOf(y)) return false;
  const len = Math.min(x.length, y.length);
  const tolerance = len <= 4 ? 0 : len <= 8 ? 1 : 2;
  if (tolerance === 0 || editDistance(x, y) > tolerance) return false;
  const wx = significantWords(left);
  const wy = significantWords(right);
  if (wx.length > 1 && wx.length === wy.length) return wx.every((w, i) => sameWord(w, wy[i]));
  return true;
}

// ---- anti-farming rules (per-category flags in alphabetSoupBank.js) ----

// An answer's words: folded, apostrophes dropped ("Bug's" -> "bugs"), any
// other punctuation treated as a space ("Kill Bill: Vol. 1" -> kill bill
// vol 1).
function wordsOf(value) {
  return baseFold(value)
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const ARTICLE_WORDS = new Set(["the", "a", "an"]);
// A lone I is left out ("Me, Myself and I"); V and X are in ("Rocky V").
const SEQUEL_NUMBER =
  /^(\d+|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)$/;
const SEQUEL_LABEL = /^(part|pt|vol|volume|chapter|episode|book)$/;

// NUMBERED SEQUEL rule: the comparison form of a title with ONE trailing
// sequel marker removed — a number, roman numeral or spelled number,
// optionally after "part" / "vol" / "chapter". "Avatar 2", "Avatar II" and
// "Avatar" all compare as "avatar"; "The Godfather Part II" as "the
// godfather". Only the END is touched ("21 Jump Street" is unchanged), and
// a title that is nothing but a number ("Seven") is kept as typed.
// Comparison only — answers are still displayed and validated as typed.
export function stripSequel(value) {
  const words = wordsOf(value);
  const minLen = ARTICLE_WORDS.has(words[0]) ? 3 : 2; // keep at least one real word
  if (words.length < minLen || !SEQUEL_NUMBER.test(words.at(-1))) return String(value ?? "");
  words.pop();
  if (words.length >= minLen && SEQUEL_LABEL.test(words.at(-1))) words.pop();
  return words.join(" ");
}

// An answer's words with a leading "the" / "a" / "an" skipped (as in the
// letter rule), each folded to its singular stem.
function significantWords(value) {
  const words = wordsOf(value);
  if (words.length > 1 && ARTICLE_WORDS.has(words[0])) words.shift();
  return words.map(singular);
}

// Is y just x with two neighbouring letters swapped ("baer" / "bear")?
function isSwap(x, y) {
  if (x.length !== y.length) return false;
  const diff = [];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && x[diff[0]] === y[diff[1]] && x[diff[1]] === y[diff[0]];
}

// Are two single (already stemmed) words the same word? A short word has no
// context to tell a typo from a real neighbour ("horse" / "house", "black"
// / "blank"), so up to 5 letters only a swapped pair counts as a typo;
// longer words get the usual small edit budget ("amazonain" == "amazonian").
function sameWord(x, y) {
  if (x === y) return true;
  if (/\d/.test(x) || /\d/.test(y)) return false;
  const len = Math.min(x.length, y.length);
  if (len <= 5) return len >= 3 && isSwap(x, y);
  return editDistance(x, y) <= (len <= 8 ? 1 : 2);
}

// REPEATED LEADING WORD rule: the first significant word of an answer,
// stemmed. "Amazonian fly" -> "amazonian", "Ants" -> "ant", "The Bear" ->
// "bear". Single-word answers count ("Ant" then "Ant lion").
export function leadWord(value) {
  return significantWords(value)[0] ?? "";
}

export function sameLeadWord(a, b) {
  const x = leadWord(a);
  const y = leadWord(b);
  return Boolean(x && y) && sameWord(x, y);
}

// Both rules against a player's OWN earlier answers this round (texts).
// Returns null, or { reason, prior, message } for the first rule broken.
// A plain repeat is the caller's "duplicate" check and is caught first.
export function farmingConflict(text, earlier, { blockNumberedSequels = false, blockRepeatedLeadWord = false } = {}) {
  if (blockNumberedSequels) {
    const prior = earlier.find((e) => sameAnswer(e, text, { sequels: true }));
    if (prior != null) return { reason: "sequel", prior, message: `Same title as your earlier answer '${prior}'.` };
  }
  if (blockRepeatedLeadWord) {
    const prior = earlier.find((e) => sameLeadWord(e, text));
    if (prior != null) {
      return { reason: "leadWord", prior, message: `Too similar to your earlier answer '${prior}': same first word.` };
    }
  }
  return null;
}

// The first letter of an answer, read two ways: as typed, and with a
// leading "the" / "a" / "an" dropped. Either reading may satisfy the
// round's letter ("The Office" counts for T or O; "A Bug's Life" for A or
// B). Leading quotes / punctuation are skipped.
export function firstLetters(value) {
  const folded = baseFold(value).replace(/^[^a-z0-9]+/, "");
  const out = new Set();
  const first = folded.match(/^[a-z]/)?.[0];
  if (first) out.add(first.toUpperCase());
  const stripped = folded.replace(ARTICLE, "").replace(/^[^a-z0-9]+/, "");
  if (stripped !== folded) {
    const second = stripped.match(/^[a-z]/)?.[0];
    if (second) out.add(second.toUpperCase());
  }
  return out;
}

export function startsWithLetter(value, letter) {
  return firstLetters(value).has(String(letter ?? "").toUpperCase());
}

// Display clean-up for a typed answer: trim, collapse whitespace, cap length.
export const MAX_ANSWER_LENGTH = 40;
export function cleanAnswer(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH);
}
