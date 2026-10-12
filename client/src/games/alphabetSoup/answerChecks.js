// CLIENT MIRROR of server/games/wordMatch.js — the same answer rules, run
// on the phone for instant feedback (wrong letter / repeat of your own
// answer) before anything is sent. The server re-checks everything and is
// the authority; server/alphabet-soup.selftest.mjs asserts this file and
// the server copy agree on a fixture set. Change both together.

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
export function sameAnswer(a, b) {
  const x = canonicalAnswer(a);
  const y = canonicalAnswer(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const digitsOf = (s) => (s.match(/\d+/g) ?? []).join(",");
  if (digitsOf(x) !== digitsOf(y)) return false;
  const len = Math.min(x.length, y.length);
  const tolerance = len <= 4 ? 0 : len <= 8 ? 1 : 2;
  return tolerance > 0 && editDistance(x, y) <= tolerance;
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
