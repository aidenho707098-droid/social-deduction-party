// "Taboo" — a free-for-all describing/guessing game. Each round one player
// is the DESCRIBER: they privately get a secret word (from a host-chosen
// category) plus a short list of forbidden related words. They describe it
// OUT LOUD, avoiding the forbidden words — honour system, no automated
// detection. Everyone else privately TYPES their guess; a lenient fuzzy
// match (shared with Crack the Code) forgives typos. Multiple guessers can
// score in one round: correct guesses are ranked by ORDER (1st is worth
// most, down to a floor). The Describer scores on how QUICKLY the first
// correct guess landed.
//
//   phase:  describe -> guess -> reveal -> ( describe -> guess ... ) -> final
//
// REVEAL TO START: at the top of a round the Describer sees only that they're
// up. Their word + forbidden list stay hidden until they tap "Reveal", which
// is also what starts the 180s clock — so they get a beat to prepare and
// don't bleed time before they've even seen the word.
//
// DYNAMIC TIMER: once running, each guesser's FIRST CORRECT answer shaves 30s
// off the shared deadline (once per guesser, down to a hard floor). Wrong
// guesses never touch the clock. Clients watch `timeDropCount` / `lastDropAt`
// in the public state to fire a brief "-30s" alert.

import { shuffle, drawWithoutRepeats } from "./deck.js";
import {
  BANKS,
  CATEGORIES,
  CATEGORY_NAME,
  RANDOM_CATEGORY,
} from "./tabooWords.js";

export const id = "taboo";
export const name = "Taboo";
export const minPlayers = 3;

const START_MS = 180_000; // 3:00 on the clock at the top of every round
const TIME_DROP_MS = 30_000; // shaved off per guesser's first answer
const MIN_ROUND_MS = 15_000; // the clock can never be cut below this
const LATE_GRACE_MS = 1_500; // accept an answer this far past the buzzer

// Ordered placing payout for correct guesses; anyone past the table gets
// the floor. "1st correct scores most, 2nd less, ... down to a minimum."
const PLACING_POINTS = [1000, 750, 550, 400, 300];
const MIN_PLACING_POINTS = 200;

function placingPoints(placing) {
  return PLACING_POINTS[placing - 1] ?? MIN_PLACING_POINTS;
}

const DESCRIBER_BASE = 900;
const DESCRIBER_MIN = 120;

// Faster first correct guess -> more Describer points. Measured against the
// full NOMINAL window so the dynamic-timer drops don't distort the payout.
function describerPointsFor(firstCorrectElapsedMs) {
  const frac = Math.max(0, Math.min(1, 1 - firstCorrectElapsedMs / START_MS));
  return Math.max(
    DESCRIBER_MIN,
    Math.round(DESCRIBER_MIN + (DESCRIBER_BASE - DESCRIBER_MIN) * frac)
  );
}

// ---------- lenient guess matching (mirrors emoji-movie.js) ----------

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^the/, "");
}

function editDistance(a, b) {
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

function isCorrectGuess(rawGuess, entry) {
  const guess = normalize(rawGuess);
  if (guess.length < 2) return false;

  const targets = [entry.word, ...(entry.alts ?? [])]
    .map(normalize)
    .filter(Boolean);
  for (const target of targets) {
    if (guess === target) return true;
    const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
    if (tolerance > 0 && editDistance(guess, target) <= tolerance) return true;
  }
  return false;
}

// ---------- round bank ----------

const entryKey = (e) => `${e.category}|${e.word}`;

// Pick the whole game's word list up front. In fixed-category mode this is
// a plain no-repeat draw from the pooled enabled banks (like Crack the
// Code). In "random category" mode each round first picks a random category
// that still has unseen words, then a random word from it.
function buildEntries(catKeys, totalRounds, seen, randomMode) {
  if (!randomMode) {
    const pool = catKeys.flatMap((k) => BANKS[k]);
    return drawWithoutRepeats(pool, totalRounds, seen, entryKey);
  }

  const seenSet = new Set(seen);
  const remaining = Object.fromEntries(
    catKeys.map((k) => [k, BANKS[k].filter((e) => !seenSet.has(entryKey(e)))])
  );
  const items = [];
  for (let i = 0; i < totalRounds; i++) {
    let live = catKeys.filter((k) => remaining[k].length > 0);
    if (live.length === 0) {
      // Room memory has drained every bank — forget it and start over.
      seenSet.clear();
      for (const k of catKeys) remaining[k] = [...BANKS[k]];
      live = [...catKeys];
    }
    const cat = live[Math.floor(Math.random() * live.length)];
    const idx = Math.floor(Math.random() * remaining[cat].length);
    const [entry] = remaining[cat].splice(idx, 1);
    seenSet.add(entryKey(entry));
    items.push(entry);
  }
  return { items, seenKeys: [...seenSet] };
}

// ---------- lifecycle ----------

function currentEntry(game) {
  return game.entries[game.roundIndex] ?? null;
}

function currentDescriber(game) {
  return game.describerByRound[game.roundIndex] ?? null;
}

function resetRound(game) {
  game.roundStartedAt = null;
  game.deadline = null;
  game.guesses = new Map(); // playerId -> { guess, correct, elapsedMs, placing?, points? }
  game.correctOrder = []; // guesserIds in the order they got it right
  game.firstCorrectElapsedMs = null;
  game.timeDropCount = 0;
  game.lastDropAt = 0;
}

export function createGame(playerIds, { rounds, categories, memory } = {}) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }
  if (playerIds.length < minPlayers) {
    throw new Error(`Taboo needs at least ${minPlayers} players.`);
  }

  const asked = Array.isArray(categories) ? categories : [];
  const randomMode = asked.includes(RANDOM_CATEGORY);
  let catKeys = randomMode
    ? CATEGORIES.map((c) => c.key)
    : asked.filter((c) => c in BANKS);
  if (catKeys.length === 0) catKeys = CATEGORIES.map((c) => c.key);

  const available = catKeys.reduce((n, k) => n + BANKS[k].length, 0);
  const totalRounds = Math.min(requested, available);

  const { items, seenKeys } = buildEntries(
    catKeys,
    totalRounds,
    memory?.seen ?? [],
    randomMode
  );

  // Fixed Describer-per-round order: cycle a shuffled roster so it's an
  // even spread and only repeats a player once everyone has had a turn.
  const order = shuffle(playerIds);
  const describerByRound = Array.from(
    { length: items.length },
    (_, i) => order[i % order.length]
  );

  const game = {
    id,
    phase: "describe", // describe -> guess -> reveal -> ... -> final
    totalRounds: items.length,
    roundIndex: 0,
    randomMode,
    categories: catKeys,
    entries: items, // [{ word, taboo, alts?, category }]
    describerByRound,
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
    startMs: START_MS,
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    lastResult: null,
  };
  resetRound(game);
  return game;
}

// The Describer taps "Reveal" to uncover their word + forbidden list AND
// start the shared clock in one go; the host may also nudge it (opts.asHost)
// if they're slow.
export function startRound(game, playerId, opts = {}) {
  if (game.phase !== "describe") return { ok: false };
  if (!opts.asHost && playerId !== currentDescriber(game)) {
    return { ok: false, notDescriber: true };
  }
  const now = Date.now();
  resetRound(game);
  game.roundStartedAt = now;
  game.deadline = now + START_MS;
  game.phase = "guess";
  return { ok: true };
}

// A guesser locks in a typed guess. Wrong guesses cost nothing and don't
// lock you out; a correct one locks you in with a placing for the round.
export function submitGuess(game, playerId, rawGuess, presentPlayerIds) {
  if (game.phase !== "guess") return { ok: false };
  const describerId = currentDescriber(game);
  if (playerId === describerId) return { ok: false, isDescriber: true };

  const now = Date.now();
  if (now > game.deadline + LATE_GRACE_MS) return { ok: false, timeUp: true };

  const prev = game.guesses.get(playerId);
  if (prev?.correct) {
    return { ok: false, lockedIn: true, placing: prev.placing, points: prev.points };
  }

  const entry = currentEntry(game);
  const elapsedMs = now - game.roundStartedAt;
  const correct = isCorrectGuess(rawGuess, entry);
  const cleanGuess = String(rawGuess ?? "").trim().slice(0, 80);

  let placing = null;
  let points = 0;
  let timeDropped = false;

  if (correct) {
    game.correctOrder.push(playerId);
    placing = game.correctOrder.length;
    points = placingPoints(placing);
    if (game.firstCorrectElapsedMs == null) game.firstCorrectElapsedMs = elapsedMs;
    game.guesses.set(playerId, {
      guess: cleanGuess,
      correct: true,
      elapsedMs,
      placing,
      points,
    });

    // DYNAMIC TIMER — each guesser's FIRST CORRECT answer (validated above,
    // after fuzzy matching) shaves 30s off the shared clock, down to the
    // floor. A correct guess locks the player in and they can't guess
    // again, so this fires at most once per player. Wrong guesses do
    // nothing to the clock.
    const floor = game.roundStartedAt + MIN_ROUND_MS;
    const next = Math.max(floor, game.deadline - TIME_DROP_MS);
    if (next < game.deadline) {
      game.deadline = next;
      game.timeDropCount += 1;
      game.lastDropAt = now;
      timeDropped = true;
    }
  } else {
    game.guesses.set(playerId, { guess: cleanGuess, correct: false, elapsedMs });
  }

  // Everyone present bar the Describer has it right -> end the round early.
  const guessers = presentPlayerIds.filter((pid) => pid !== describerId);
  if (guessers.length > 0 && guessers.every((pid) => game.guesses.get(pid)?.correct)) {
    revealRound(game, presentPlayerIds);
  }

  return {
    ok: true,
    correct,
    lockedIn: correct,
    placing,
    points,
    timeDropped,
    msLeft: Math.max(0, game.deadline - Date.now()),
  };
}

// Score the round and freeze a full breakdown for the reveal screen.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "guess") return;

  const entry = currentEntry(game);
  const describerId = currentDescriber(game);
  const guessers = presentPlayerIds.filter((pid) => pid !== describerId);

  const rows = guessers.map((pid) => {
    const g = game.guesses.get(pid);
    const correct = !!g?.correct;
    const points = correct ? g.points : 0;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    return {
      playerId: pid,
      guess: g?.guess ?? null,
      correct,
      placing: correct ? g.placing : null,
      points,
      elapsedMs: g?.elapsedMs ?? null,
    };
  });

  const anyCorrect = game.firstCorrectElapsedMs != null;
  const describerPoints = anyCorrect
    ? describerPointsFor(game.firstCorrectElapsedMs)
    : 0;
  if (describerPoints) {
    game.scores.set(
      describerId,
      (game.scores.get(describerId) ?? 0) + describerPoints
    );
  }

  const rank = (r) => (r.correct ? r.placing : Infinity);
  rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity);
  });

  game.lastResult = {
    roundIndex: game.roundIndex,
    word: entry.word,
    taboo: entry.taboo,
    category: entry.category,
    categoryName: CATEGORY_NAME[entry.category] ?? "",
    describerId,
    describerPoints,
    anyCorrect,
    firstCorrectElapsedMs: game.firstCorrectElapsedMs,
    rows, // [{ playerId, guess, correct, placing, points, elapsedMs }] best-first
  };
  game.phase = "reveal";
}

export function nextRound(game) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  resetRound(game);
  game.phase = "describe";
}

// Framework hook: the connected-player set changed.
export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return;
  if (game.phase === "guess") {
    const describerId = currentDescriber(game);
    const guessers = presentPlayerIds.filter((pid) => pid !== describerId);
    if (
      guessers.length > 0 &&
      guessers.every((pid) => game.guesses.get(pid)?.correct)
    ) {
      revealRound(game, presentPlayerIds);
    }
  }
}

// Host "Force proceed": from "describe", start the clock even if the
// Describer hasn't tapped ready; from "guess", reveal now.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "describe") {
    startRound(game, null, { asHost: true });
  } else if (game.phase === "guess") {
    revealRound(game, presentPlayerIds);
  }
}

// PUBLIC view — the secret word is NEVER in here, only the category name.
export function getPublicState(game, presentPlayerIds) {
  const now = Date.now();
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const describerId = currentDescriber(game);
  const entry = currentEntry(game);
  const guesserIds = presentPlayerIds.filter((pid) => pid !== describerId);

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    describerId,
    categoryName: entry ? CATEGORY_NAME[entry.category] ?? "" : "",
    randomMode: game.randomMode,
    totalPlayers: presentPlayerIds.length,
    guesserCount: guesserIds.length,
    startMs: START_MS,
    timeDropCount: game.timeDropCount,
    lastDropAt: game.lastDropAt,
    msLeft:
      game.phase === "guess" && game.deadline
        ? Math.max(0, game.deadline - now)
        : START_MS,
    scores,
  };

  if (game.phase === "guess") {
    state.guessedPlayerIds = guesserIds.filter((pid) => game.guesses.has(pid));
    state.solvedPlayerIds = game.correctOrder.filter((pid) =>
      guesserIds.includes(pid)
    );
  }

  if (game.phase === "reveal") state.result = game.lastResult;

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// Per-player secret: only the round's Describer gets anything, and the word
// itself only AFTER they've tapped "Reveal" — i.e. once the round has moved
// into the "guess" phase and the clock is running.
export function getPrivateState(game, playerId) {
  if (game.phase !== "describe" && game.phase !== "guess") return null;
  if (playerId !== currentDescriber(game)) return null;
  const entry = currentEntry(game);
  if (!entry) return null;

  if (game.phase === "describe") {
    return { taboo: { role: "describer", revealed: false } };
  }

  return {
    taboo: {
      role: "describer",
      revealed: true,
      word: entry.word,
      forbidden: entry.taboo,
      category: entry.category,
      categoryName: CATEGORY_NAME[entry.category] ?? "",
    },
  };
}

// --- Tournament Mode: default per-game config.
export function tournamentOptions() {
  return { rounds: 4, categories: CATEGORIES.map((c) => c.key) };
}
