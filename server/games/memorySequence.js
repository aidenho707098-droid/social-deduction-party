// Memory Imposter — sequence generation, round types, difficulty
// progression and the difficulty score. Pure: no timers, no players, no
// sockets; every random function takes an optional `rng` so
// server/memory-imposter.selftest.mjs can drive it deterministically.
//
// ITEMS are strings "<kind>:<value>", the same in every sequence type, so
// a Mixed sequence needs nothing special and "the same item" always means
// the same kind AND the same value:
//   digits  "d:0" … "d:9"
//   colors  "c:violet" …  (plain swatches — client/src/games/memoryImposter/memoryData.js)
//   shapes  "s:circle" …  (one neutral color — the same file)

export const SEQUENCE_TYPES = ["digits", "colors", "shapes", "mixed"];

export const KINDS = {
  d: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  c: ["violet", "coral", "mustard", "green", "blue", "white"],
  s: ["circle", "square", "triangle", "star", "diamond", "heart"],
};
const KIND_OF_TYPE = { digits: "d", colors: "c", shapes: "s" };

export const LENGTH = { min: 4, max: 12 };
export const VIEW_SEC = { min: 3, max: 20 };

// Round 1 of each preset; every round after grows from here (progressFor).
export const PRESETS = {
  easy: { length: 4, viewSec: 10 },
  medium: { length: 6, viewSec: 15 },
  hard: { length: 8, viewSec: 15 },
};

// Progression + scoring knobs, all in one place to tune after a playtest.
export const DIFFICULTY = {
  lengthStep: 1, // items added every round…
  lengthCap: 12, // …up to this many
  viewStepSec: 0.5, // once at the cap, seconds off the view time every round…
  viewFloorSec: 3, // …down to this
  // difficultyScore = (length - lengthBase) + viewWeight * max(0, viewPivotSec - viewSeconds)
  lengthBase: 2,
  viewWeight: 0.2,
  viewPivotSec: 15,
  // An Imposter who evades earns evadeBase + round(score * evadeFactor).
  evadeBase: 1,
  evadeFactor: 0.8,
  // A Witness who voted for a caught Imposter earns this.
  catchPoints: 2,
};

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

export const kindOf = (item) => item.slice(0, 1);
export const valueOf = (item) => item.slice(2);

// =====================================================================
// difficulty progression
// =====================================================================

// Length and view time for round `roundIndex` (0-based). Length grows by
// one a round to the cap while the view time holds; from the round AFTER
// the first one at the cap, the view time drops 0.5s a round to the floor.
export function progressFor(start, roundIndex) {
  const D = DIFFICULTY;
  const length = Math.min(D.lengthCap, start.length + roundIndex * D.lengthStep);
  const capRound = Math.max(0, Math.ceil((D.lengthCap - start.length) / D.lengthStep));
  const drops = Math.max(0, roundIndex - capRound);
  const viewSec = Math.max(Math.min(D.viewFloorSec, start.viewSec), start.viewSec - drops * D.viewStepSec);
  return { length, viewSec };
}

export function difficultyScore(length, viewSec) {
  const D = DIFFICULTY;
  return length - D.lengthBase + D.viewWeight * Math.max(0, D.viewPivotSec - viewSec);
}

// Round half up (the epsilon keeps 2.5 from landing on 2.4999…).
const roundHalfUp = (x) => Math.floor(x + 0.5 + 1e-9);

export function evadePoints(length, viewSec) {
  const D = DIFFICULTY;
  return D.evadeBase + roundHalfUp(difficultyScore(length, viewSec) * D.evadeFactor);
}

// =====================================================================
// round types — a shuffle bag over the host's selected chips
// =====================================================================

// Every selected chip once before any repeats; a refilled bag never
// starts with the chip that ended the previous one (when there's a choice).
export function nextRoundType(bag, types, lastType, rng = Math.random) {
  let next = bag;
  if (!next.length) {
    next = shuffle(types, rng);
    if (types.length > 1 && next[0] === lastType) {
      const swap = 1 + Math.floor(rng() * (next.length - 1));
      [next[0], next[swap]] = [next[swap], next[0]];
    }
  }
  const [type, ...rest] = next;
  return { type, bag: rest };
}

// =====================================================================
// sequences
// =====================================================================

export function hasRepeat(seq) {
  return new Set(seq).size < seq.length;
}

// All the same, all ascending / descending (digits), or a strict 2-period
// alternation (ABAB…).
export function isTrivial(seq) {
  if (seq.every((x) => x === seq[0])) return true;
  if (seq.every((x) => kindOf(x) === "d")) {
    const n = seq.map((x) => Number(valueOf(x)));
    if (n.every((v, i) => i === 0 || v >= n[i - 1]) || n.every((v, i) => i === 0 || v <= n[i - 1])) return true;
  }
  if (seq.length >= 4 && seq.every((x, i) => i < 2 || x === seq[i - 2])) return true;
  return false;
}

function drawItem(type, rng) {
  // Mixed: the KIND first (uniform over three), then the value within it,
  // so the 10 digits don't outnumber the 6 colors / 6 shapes.
  const kind = type === "mixed" ? pick(["d", "c", "s"], rng) : KIND_OF_TYPE[type];
  return `${kind}:${pick(KINDS[kind], rng)}`;
}

export function isValidSequence(type, seq) {
  if (!hasRepeat(seq) || isTrivial(seq)) return false;
  if (type === "mixed" && seq.length >= 3 && new Set(seq.map(kindOf)).size < 3) return false;
  if (type !== "mixed" && !seq.every((x) => kindOf(x) === KIND_OF_TYPE[type])) return false;
  return true;
}

// Uniform draws, rejected until the sequence has a repeat, isn't trivial
// and (Mixed) has all three kinds. Rejection keeps every accepted sequence
// equally likely.
export function generateSequence(type, length, rng = Math.random) {
  const t = SEQUENCE_TYPES.includes(type) ? type : "digits";
  const L = Math.max(LENGTH.min, Math.min(LENGTH.max, Math.round(length)));
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const seq = Array.from({ length: L }, () => drawItem(t, rng));
    if (isValidSequence(t, seq)) return seq;
  }
  throw new Error(`Couldn't build a ${t} sequence of ${L}.`);
}
