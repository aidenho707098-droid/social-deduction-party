// "Fake Artist" — a collaborative-drawing deduction game. One player is
// secretly the Fake Artist: they DON'T get the secret word, only its
// category ("it's an animal"). Everyone takes exactly one turn adding a
// small contribution to ONE shared, growing canvas — capped by both a
// short timer AND an ink budget so nobody can just draw the whole thing.
// After every turn the merged image is broadcast so suspicions build.
// Then a vote (can't vote yourself, Imposter-style), a reveal, and the
// Fake Artist gets one shot at guessing the real word for a bonus point.
//
//   phase:  brief -> draw -> gallery -> vote -> reveal -> (brief -> ...) -> final
//
// TURN-BASED SNAPSHOTS, not live streaming: each device draws privately on
// its own canvas (with the current shared image locked underneath), and
// submits the whole composited PNG when done / timed out / out of ink. The
// server just stores that string and relays it — no server-side image
// work. The ink meter is enforced entirely on the drawing device.

import { shuffle, drawWithoutRepeats } from "./deck.js";
import { CATEGORIES, CATEGORY_NAMES, RANDOM_CATEGORY } from "../fakeArtistWords.js";

export const id = "fake-artist";
export const name = "Fake Artist";
export const minPlayers = 3;

const TURN_MS = 25_000; // per player's drawing turn
const VOTE_MS = 45_000;
const GUESS_MS = 30_000; // the Fake Artist's one word-guess after the reveal
const LATE_GRACE_MS = 2_000;

const DETECTIVE_POINTS = 2; // for a non-imposter who voted the actual imposter
const EVASION_POINTS = 3; // for the imposter if they aren't caught
const GUESS_BONUS = 1; // for the imposter guessing the real word

// A submitted data URL bigger than this is dropped (the turn contributes
// nothing). ~2MB of actual image after base64 — a hand drawing is a tiny
// fraction of that, this is just a sanity ceiling.
const MAX_IMAGE_BYTES = 3_000_000;

const SCORED_PHASES = new Set(["reveal", "final"]);

// ---- lenient word matching (shared with Taboo / Crack the Code) ----

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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

function isCorrectGuess(rawGuess, word) {
  const guess = normalize(rawGuess);
  if (guess.length < 2) return false;
  const target = normalize(word);
  if (!target) return false;
  if (guess === target) return true;
  const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
  if (tolerance > 0 && editDistance(guess, target) <= tolerance) return true;
  // Multi-word answers ("Ice Cream Cone"): accept the core noun.
  if (guess.length >= 4 && (target.includes(guess) || guess.includes(target))) return true;
  return false;
}

// ---- helpers ----

const entryKey = (e) => `${e.category}|${e.word}`;
const currentEntry = (game) => game.entries[game.roundIndex] ?? null;
const currentImposter = (game) => game.imposterByRound[game.roundIndex] ?? null;

function setupRound(game, roundIndex, present) {
  game.roundIndex = roundIndex;

  // The scheduled imposter may have left — hand the role to someone here.
  let imp = game.imposterByRound[roundIndex];
  if (!present.includes(imp)) {
    imp = present[Math.floor(Math.random() * present.length)] ?? imp;
    game.imposterByRound[roundIndex] = imp;
  }

  game.turnOrder = shuffle(present);
  game.currentTurn = 0;
  game.canvas = null;
  game.canvasRev = 0;
  game.votes = new Map();
  game.imposterGuess = null;
  game.turnDeadline = null;
  game.voteDeadline = null;
  game.guessDeadline = null;
  game.phase = "brief";
}

// ---- lifecycle ----

export function createGame(playerIds, { rounds, categories, memory } = {}) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }
  if (playerIds.length < minPlayers) {
    throw new Error(`Fake Artist needs at least ${minPlayers} players.`);
  }

  const asked = Array.isArray(categories) ? categories : [];
  const randomMode = asked.includes(RANDOM_CATEGORY) || asked.length === 0;
  let catKeys = randomMode
    ? [...CATEGORY_NAMES]
    : asked.filter((c) => c in CATEGORIES);
  if (catKeys.length === 0) catKeys = [...CATEGORY_NAMES];

  const pool = catKeys.flatMap((c) =>
    CATEGORIES[c].map((word) => ({ word, category: c }))
  );
  const { items, seenKeys } = drawWithoutRepeats(
    pool,
    requested,
    memory?.seen ?? [],
    entryKey
  );

  // Fixed imposter-per-round order: cycle a shuffled roster so it's spread
  // evenly and only repeats a player once everyone's had the role.
  const order = shuffle(playerIds);
  const imposterByRound = Array.from(
    { length: items.length },
    (_, i) => order[i % order.length]
  );

  const game = {
    id,
    phase: "brief",
    totalRounds: items.length,
    roundIndex: 0,
    categories: catKeys,
    entries: items, // [{ word, category }]
    imposterByRound,
    turnOrder: [],
    currentTurn: 0,
    canvas: null, // data URL of the shared drawing; null = blank
    canvasRev: 0,
    turnDeadline: null,
    voteDeadline: null,
    guessDeadline: null,
    votes: new Map(), // voterId -> targetId
    imposterGuess: null, // null | { text, correct }
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    deckMemory: { seen: seenKeys },
    lastResult: null,
  };
  setupRound(game, 0, playerIds);
  return game;
}

// Host taps "Start drawing" once everyone's read their role.
export function startDrawing(game) {
  if (game.phase !== "brief") return { ok: false };
  game.phase = "draw";
  game.currentTurn = 0;
  game.turnDeadline = Date.now() + TURN_MS;
  return { ok: true };
}

// Move the baton to the next present drawer; end the drawing phase once
// everyone still here has had their turn.
function advanceTurn(game, presentPlayerIds) {
  const present = new Set(presentPlayerIds);
  let next = game.currentTurn + 1;
  while (next < game.turnOrder.length && !present.has(game.turnOrder[next])) next++;
  if (next >= game.turnOrder.length) {
    game.currentTurn = game.turnOrder.length;
    game.phase = "gallery";
    game.turnDeadline = null;
  } else {
    game.currentTurn = next;
    game.turnDeadline = Date.now() + TURN_MS;
  }
}

// The current drawer submits their finished contribution (the whole
// composited canvas). An oversized / malformed payload is ignored but the
// turn still advances.
export function submitDrawing(game, playerId, image, presentPlayerIds) {
  if (game.phase !== "draw") return { ok: false };
  const drawerId = game.turnOrder[game.currentTurn];
  if (playerId !== drawerId) return { ok: false, notYourTurn: true };

  if (
    typeof image === "string" &&
    image.startsWith("data:image/") &&
    image.length <= MAX_IMAGE_BYTES
  ) {
    game.canvas = image;
    game.canvasRev += 1;
  }
  advanceTurn(game, presentPlayerIds);
  return { ok: true };
}

// Server-interval hook: the current drawer's clock ran out.
export function tickTurn(game, presentPlayerIds) {
  if (game.phase !== "draw") return false;
  if (game.turnDeadline && Date.now() > game.turnDeadline + LATE_GRACE_MS) {
    advanceTurn(game, presentPlayerIds);
    return true;
  }
  return false;
}

export function startVoting(game) {
  if (game.phase !== "gallery") return { ok: false };
  game.phase = "vote";
  game.voteDeadline = Date.now() + VOTE_MS;
  return { ok: true };
}

// One vote each, never yourself. Re-voting the same player clears it.
export function submitVote(game, voterId, targetId, presentPlayerIds) {
  if (game.phase !== "vote") return { ok: false };
  if (voterId === targetId) return { ok: false, self: true };
  if (!game.turnOrder.includes(targetId)) return { ok: false };

  if (game.votes.get(voterId) === targetId) game.votes.delete(voterId);
  else game.votes.set(voterId, targetId);

  const voters = presentPlayerIds;
  if (voters.length > 0 && voters.every((pid) => game.votes.has(pid))) {
    finishVoting(game, presentPlayerIds);
  }
  return { ok: true };
}

export function tickVote(game, presentPlayerIds) {
  if (game.phase !== "vote") return false;
  if (game.voteDeadline && Date.now() > game.voteDeadline + LATE_GRACE_MS) {
    finishVoting(game, presentPlayerIds);
    return true;
  }
  return false;
}

function tally(game, presentPlayerIds) {
  const present = new Set(presentPlayerIds);
  const counts = {};
  for (const pid of game.turnOrder) counts[pid] = 0;
  for (const [voter, target] of game.votes) {
    if (present.has(voter) && target in counts) counts[target] += 1;
  }
  return counts;
}

// The imposter is "caught" if they're tied-for-most or outright most
// voted (and at least one vote landed on them).
function computeCaught(counts, imposterId) {
  const values = Object.values(counts);
  const max = values.length ? Math.max(...values) : 0;
  return max > 0 && (counts[imposterId] ?? 0) >= max;
}

export function finishVoting(game, presentPlayerIds) {
  if (game.phase !== "vote") return;
  const imposterId = currentImposter(game);
  const entry = currentEntry(game);
  const counts = tally(game, presentPlayerIds);
  const caught = computeCaught(counts, imposterId);

  // Detective points: each non-imposter who fingered the actual imposter.
  for (const [voter, target] of game.votes) {
    if (voter === imposterId) continue;
    if (!presentPlayerIds.includes(voter)) continue;
    if (target === imposterId) {
      game.scores.set(voter, (game.scores.get(voter) ?? 0) + DETECTIVE_POINTS);
    }
  }
  // Evasion points: the imposter got away with it.
  if (!caught) {
    game.scores.set(imposterId, (game.scores.get(imposterId) ?? 0) + EVASION_POINTS);
  }

  game.lastResult = {
    roundIndex: game.roundIndex,
    imposterId,
    word: entry.word,
    category: entry.category,
    counts,
    caught,
    detectivePoints: DETECTIVE_POINTS,
    evasionPoints: EVASION_POINTS,
    guessBonus: GUESS_BONUS,
    imposterGuess: null,
  };
  game.phase = "reveal";
  game.guessDeadline = Date.now() + GUESS_MS;
}

// The Fake Artist's one shot at the real word, after the vote reveal.
// Happens every round regardless of whether they were caught.
export function submitImposterGuess(game, playerId, rawText) {
  if (game.phase !== "reveal") return { ok: false };
  if (playerId !== currentImposter(game)) return { ok: false };
  if (game.imposterGuess !== null) return { ok: false, done: true };

  const entry = currentEntry(game);
  const correct = isCorrectGuess(rawText, entry.word);
  if (correct) {
    game.scores.set(playerId, (game.scores.get(playerId) ?? 0) + GUESS_BONUS);
  }
  game.imposterGuess = { text: String(rawText ?? "").trim().slice(0, 60), correct };
  if (game.lastResult) game.lastResult.imposterGuess = game.imposterGuess;
  game.guessDeadline = null;
  return { ok: true, correct };
}

export function skipImposterGuess(game) {
  if (game.phase !== "reveal" || game.imposterGuess !== null) return;
  game.imposterGuess = { text: null, correct: false };
  if (game.lastResult) game.lastResult.imposterGuess = game.imposterGuess;
  game.guessDeadline = null;
}

export function tickGuess(game) {
  if (game.phase !== "reveal") return false;
  if (game.guessDeadline && Date.now() > game.guessDeadline + LATE_GRACE_MS) {
    skipImposterGuess(game);
    return true;
  }
  return false;
}

export function nextRound(game, presentPlayerIds) {
  if (game.phase !== "reveal") return;
  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  setupRound(game, game.roundIndex + 1, presentPlayerIds);
}

// ---- framework hooks ----

export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return;
  if (game.phase === "draw") {
    if (!presentPlayerIds.includes(game.turnOrder[game.currentTurn])) {
      advanceTurn(game, presentPlayerIds);
    }
  } else if (game.phase === "vote") {
    if (presentPlayerIds.every((pid) => game.votes.has(pid))) {
      finishVoting(game, presentPlayerIds);
    }
  }
}

export function forceAdvance(game, presentPlayerIds) {
  switch (game.phase) {
    case "brief":
      startDrawing(game);
      break;
    case "draw":
      advanceTurn(game, presentPlayerIds);
      break;
    case "gallery":
      startVoting(game);
      break;
    case "vote":
      finishVoting(game, presentPlayerIds);
      break;
    case "reveal":
      if (game.imposterGuess === null) skipImposterGuess(game);
      else nextRound(game, presentPlayerIds);
      break;
    default:
      break;
  }
}

// ---- views ----

export function getPublicState(game, presentPlayerIds) {
  const now = Date.now();
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const entry = currentEntry(game);

  const msLeft =
    game.phase === "draw" && game.turnDeadline
      ? Math.max(0, game.turnDeadline - now)
      : game.phase === "vote" && game.voteDeadline
        ? Math.max(0, game.voteDeadline - now)
        : game.phase === "reveal" && game.guessDeadline
          ? Math.max(0, game.guessDeadline - now)
          : 0;

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    category: entry ? entry.category : "",
    turnOrder: game.turnOrder,
    currentDrawerId: game.phase === "draw" ? game.turnOrder[game.currentTurn] ?? null : null,
    turnNumber: Math.min(game.currentTurn + 1, game.turnOrder.length),
    turnCount: game.turnOrder.length,
    turnMs: TURN_MS,
    voteMs: VOTE_MS,
    guessMs: GUESS_MS,
    msLeft,
    canvasRev: game.canvasRev,
    totalPlayers: presentPlayerIds.length,
    scores,
  };

  if (["draw", "gallery", "vote", "reveal"].includes(game.phase) && game.canvas) {
    state.canvas = game.canvas;
  }

  if (game.phase === "vote") {
    state.votedPlayerIds = presentPlayerIds.filter((pid) => game.votes.has(pid));
    state.totalVoters = presentPlayerIds.length;
  }

  if (game.phase === "reveal" && game.lastResult) {
    const r = game.lastResult;
    state.result = {
      roundIndex: r.roundIndex,
      imposterId: r.imposterId,
      word: r.word,
      category: r.category,
      counts: r.counts,
      caught: r.caught,
      detectivePoints: r.detectivePoints,
      evasionPoints: r.evasionPoints,
      guessBonus: r.guessBonus,
      imposterGuess: game.imposterGuess,
      guessPending: game.imposterGuess === null,
    };
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

export function getPrivateState(game, playerId) {
  const entry = currentEntry(game);
  if (!entry) return null;

  if (["brief", "draw", "gallery", "vote"].includes(game.phase)) {
    if (playerId === currentImposter(game)) {
      return { fakeArtist: { role: "imposter", category: entry.category } };
    }
    return { fakeArtist: { role: "artist", word: entry.word, category: entry.category } };
  }

  if (game.phase === "reveal" && playerId === currentImposter(game)) {
    return { fakeArtist: { role: "imposter", canGuess: game.imposterGuess === null } };
  }

  return null;
}

// --- Tournament Mode: default per-game config.
export function tournamentOptions() {
  return { rounds: 3, categories: [...CATEGORY_NAMES] };
}

export { SCORED_PHASES, TURN_MS, VOTE_MS, GUESS_MS, MAX_IMAGE_BYTES };
