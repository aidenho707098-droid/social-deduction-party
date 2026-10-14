// Memory Imposter — (a) sequence + proof-question generation. Pure: no
// timers, no players, no sockets; every function takes an optional `rng`
// so server/memory-imposter.selftest.mjs can drive it deterministically.
//
// THE SEQUENCE is built from a fixed SHAPE rather than drawn at random, so
// every guarantee holds by construction instead of by luck:
//   * exactly ONE item appears exactly twice (so "which item appears
//     exactly twice?" always has one answer, and there's always a repeat),
//   * `triples` items appear three times (more for long sequences, so a
//     12-item Colors strip still fits the 8-item palette),
//   * everything else appears once (at least 2 singletons, so "what comes
//     right after X?" always has an X that occurs once and isn't last),
//   * at least one alphabet item is ABSENT (a decoy, and the answer-0
//     "how many times?" trick question).
// The shuffle then rejects runs of three identical items and the trivial
// patterns (all the same, all ascending/descending, a 2-period repeat).
//
// THE QUESTIONS each have exactly one correct answer. `answerOf()` below
// recomputes it from the sequence alone, and the selftest brute-forces
// every alphabet item / count against each question to prove uniqueness.
// Formats never repeat back to back ("Nth item" and "Nth from the end"
// count as the same format), and a few TRICKY ones (late positions,
// counting from the end, a count of 3 or 0) are mixed in so honest
// Witnesses slip occasionally and one error isn't proof of guilt.

export const SEQUENCE_TYPES = ["digits", "colors", "emoji"];

// Colors are colored SHAPES — the shape alone identifies the item, so
// colour-blind players can tell every one apart. The client draws them
// (client/src/games/memoryImposter/items.jsx); ids must match.
export const COLOR_ITEMS = ["red", "blue", "yellow", "green", "purple", "orange", "pink", "teal"];

// Visually distinct at a glance (no two fruits of the same colour, etc.).
// Rendered as Twemoji on the client.
export const EMOJI_POOL = [
  "🍎", "🍌", "🍇", "🥕", "🐶", "🐸", "🦊", "🐙",
  "⭐", "🌙", "⚽", "🎈", "🍩", "🚗", "🌵", "🔔",
];

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const EMOJI_ALPHABET_SIZE = 8; // per round, drawn from EMOJI_POOL

export const DIFFICULTIES = {
  easy: { length: 6, viewMs: 8_000 },
  medium: { length: 8, viewMs: 6_000 },
  hard: { length: 10, viewMs: 5_000 },
};
export const CUSTOM_LENGTH = { min: 5, max: 12 };
export const CUSTOM_VIEW_SEC = { min: 3, max: 12 };

// Count questions offer 0..COUNT_MAX on a number picker.
export const COUNT_MAX = 5;

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const randInt = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

// =====================================================================
// alphabet + sequence
// =====================================================================

// Every item a round of this type may use — and, for Colors / Emoji, the
// option buttons every proof question offers (in one fixed order for the
// whole round, so nobody hunts for a button). Digits use a keypad instead.
export function alphabetFor(type, rng = Math.random) {
  if (type === "colors") return shuffle(COLOR_ITEMS, rng);
  if (type === "emoji") return shuffle(EMOJI_POOL, rng).slice(0, EMOJI_ALPHABET_SIZE);
  return [...DIGITS];
}

export function countsOf(seq) {
  const m = new Map();
  for (const x of seq) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

// All the same, monotone, or a strict 2-period alternation.
export function isTrivial(seq) {
  if (seq.length < 3) return true;
  if (seq.every((x) => x === seq[0])) return true;
  const nums = seq.map(Number);
  if (nums.every((n) => Number.isFinite(n))) {
    const up = nums.every((n, i) => i === 0 || n >= nums[i - 1]);
    const down = nums.every((n, i) => i === 0 || n <= nums[i - 1]);
    if (up || down) return true;
  }
  if (seq.every((x, i) => i < 2 || x === seq[i - 2])) return true;
  return false;
}

function hasRunOf3(seq) {
  return seq.some((x, i) => i >= 2 && x === seq[i - 1] && x === seq[i - 2]);
}

// How many items appear three times for a sequence of `length` over an
// alphabet of `alphabetSize`: enough that at least one item stays absent,
// never so many that fewer than 2 singletons are left.
export function tripleRange(length, alphabetSize) {
  const min = Math.max(0, Math.ceil((length - alphabetSize) / 2));
  const max = Math.max(min, Math.min(2, Math.floor((length - 4) / 3)));
  return { min, max };
}

export function generateSequence(length, alphabet, rng = Math.random) {
  const L = Math.max(CUSTOM_LENGTH.min, Math.min(CUSTOM_LENGTH.max, Math.round(length)));
  const { min, max } = tripleRange(L, alphabet.length);
  const triples = L >= 8 ? randInt(min, max, rng) : min;
  const singles = L - 2 - 3 * triples;
  const items = shuffle(alphabet, rng);
  const doubled = items[0];
  const tripled = items.slice(1, 1 + triples);
  const single = items.slice(1 + triples, 1 + triples + singles);
  const bag = [doubled, doubled, ...tripled.flatMap((t) => [t, t, t]), ...single];

  for (let attempt = 0; attempt < 500; attempt++) {
    const seq = shuffle(bag, rng);
    if (hasRunOf3(seq) || isTrivial(seq)) continue;
    return seq;
  }
  // Unreachable in practice (the bag always has 3+ distinct items); keep
  // a valid answer anyway rather than throwing mid-game.
  return bag;
}

// =====================================================================
// questions
// =====================================================================

// family = what "the same format twice in a row" means.
//   input: "item" (keypad / option buttons) | "count" (number picker)
export const FORMATS = {
  position: { family: "position", input: "item" },
  fromEnd: { family: "position", input: "item" },
  last: { family: "last", input: "item" },
  count: { family: "count", input: "count" },
  twice: { family: "twice", input: "item" },
  after: { family: "after", input: "item" },
};
const FAMILY_FORMATS = {
  position: ["position", "fromEnd"],
  last: ["last"],
  count: ["count"],
  twice: ["twice"],
  after: ["after"],
};

// The one correct answer, recomputed from the sequence alone.
export function answerOf(seq, q) {
  switch (q.kind) {
    case "position":
      return seq[q.n - 1];
    case "fromEnd":
      return seq[seq.length - q.n];
    case "last":
      return seq[seq.length - 1];
    case "count":
      return seq.filter((x) => x === q.item).length;
    case "twice": {
      const twos = [...countsOf(seq)].filter(([, c]) => c === 2).map(([x]) => x);
      return twos.length === 1 ? twos[0] : null;
    }
    case "after": {
      const i = seq.indexOf(q.item);
      return i >= 0 && i === seq.lastIndexOf(q.item) && i < seq.length - 1 ? seq[i + 1] : null;
    }
    default:
      return null;
  }
}

// Does `value` satisfy `q` on `seq`? Used by the selftest to prove each
// question has exactly one answer among every possible input.
export function satisfies(seq, q, value) {
  const a = answerOf(seq, q);
  return a != null && a === value;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Plain-language prompt. The client renders `item` as a token (colored
// shape / emoji / digit) in place of {item}.
export function promptOf(q) {
  switch (q.kind) {
    case "position":
      return `What is the ${ordinal(q.n)} item?`;
    case "fromEnd":
      return `What is the ${ordinal(q.n)} item from the END?`;
    case "last":
      return "What is the LAST item?";
    case "count":
      return "How many times does {item} appear?";
    case "twice":
      return "Which item appears EXACTLY twice?";
    case "after":
      return "What comes right AFTER {item}?";
    default:
      return "";
  }
}

// One concrete question of `kind`, or null if this sequence can't support
// it without ambiguity / a duplicate of one already asked.
function makeQuestion(kind, seq, alphabet, asked, rng) {
  const L = seq.length;
  const counts = countsOf(seq);
  const used = (q) => asked.some((a) => a.kind === q.kind && a.n === q.n && a.item === q.item);
  const doubled = [...counts].find(([, c]) => c === 2)?.[0];
  let candidates = [];

  if (kind === "position") {
    // 2nd .. second-to-last (the 1st and last are too easy / their own format).
    candidates = Array.from({ length: L - 2 }, (_, i) => ({ kind, n: i + 2, tricky: i + 2 >= 5 }));
  } else if (kind === "fromEnd") {
    candidates = Array.from({ length: Math.min(4, L - 1) - 1 }, (_, i) => ({ kind, n: i + 2, tricky: true }));
  } else if (kind === "last") {
    candidates = [{ kind, tricky: false }];
  } else if (kind === "count") {
    // Never the doubled item: that would hand out the "twice" answer.
    const absent = alphabet.filter((x) => !counts.has(x));
    const triple = [...counts].filter(([, c]) => c === 3).map(([x]) => x);
    const single = [...counts].filter(([, c]) => c === 1).map(([x]) => x);
    candidates = [
      ...absent.map((item) => ({ kind, item, tricky: true })),
      ...triple.map((item) => ({ kind, item, tricky: true })),
      ...single.map((item) => ({ kind, item, tricky: false })),
    ];
    // Don't count the same item twice in one round.
    candidates = candidates.filter((c) => !asked.some((a) => a.kind === "count" && a.item === c.item));
  } else if (kind === "twice") {
    candidates = doubled != null ? [{ kind, tricky: false }] : [];
  } else if (kind === "after") {
    candidates = seq
      .slice(0, -1)
      .filter((x) => counts.get(x) === 1)
      .map((item) => ({ kind, item, tricky: counts.get(seq[seq.indexOf(item) + 1]) > 1 }));
  }
  candidates = candidates.filter((c) => !used(c) && answerOf(seq, c) != null);
  if (!candidates.length) return null;
  // Lean on the tricky end when asked for one.
  return pick(candidates, rng);
}

// `count` questions for `seq`: no format twice in a row, every family used
// before any repeats, and at least one tricky question from 4 up.
export function generateQuestions(seq, alphabet, count, rng = Math.random) {
  const n = Math.max(1, Math.round(count));
  for (let attempt = 0; attempt < 200; attempt++) {
    const out = [];
    let families = [];
    let prevFamily = null;
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      if (!families.length) families = shuffle(Object.keys(FAMILY_FORMATS), rng);
      // Take the first family in the bag that isn't the previous one.
      const fi = families.findIndex((f) => f !== prevFamily);
      if (fi < 0) {
        ok = false;
        break;
      }
      const family = families.splice(fi, 1)[0];
      const kinds = shuffle(FAMILY_FORMATS[family], rng);
      let q = null;
      for (const k of kinds) {
        q = makeQuestion(k, seq, alphabet, out, rng);
        if (q) break;
      }
      if (!q) {
        ok = false;
        break;
      }
      out.push(q);
      prevFamily = family;
    }
    if (!ok || out.length !== n) continue;
    if (n >= 4 && !out.some((q) => q.tricky)) continue;
    return out.map((q) => ({
      kind: q.kind,
      family: FORMATS[q.kind].family,
      input: FORMATS[q.kind].input,
      n: q.n ?? null,
      item: q.item ?? null,
      tricky: Boolean(q.tricky),
      answer: answerOf(seq, q),
    }));
  }
  throw new Error("Couldn't build proof questions for this sequence.");
}

// The whole round's content: alphabet (= option buttons for Colors /
// Emoji), sequence, and questions.
export function generateRound({ type, length, questionCount }, rng = Math.random) {
  const kind = SEQUENCE_TYPES.includes(type) ? type : "digits";
  const alphabet = alphabetFor(kind, rng);
  const sequence = generateSequence(length, alphabet, rng);
  const questions = generateQuestions(sequence, alphabet, questionCount, rng);
  return { type: kind, alphabet, sequence, questions };
}

// Normalise a submitted answer to the question's input type, or null if
// it isn't a legal answer at all (wrong type, not an item of this round).
export function normalizeAnswer(q, value, alphabet) {
  if (value == null) return null;
  if (q.input === "count") {
    const v = Number(value);
    return Number.isInteger(v) && v >= 0 && v <= COUNT_MAX ? v : null;
  }
  const s = String(value);
  return alphabet.includes(s) ? s : null;
}
