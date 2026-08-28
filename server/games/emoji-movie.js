// "Emoji Movie Guess" — a speed trivia game. Each round shows a well-known
// movie as emojis, revealed ONE AT A TIME. Players type the title on their
// own phone at any point during the reveal; guessing early (with fewer
// emojis shown) is worth far more. A wrong guess costs nothing and doesn't
// lock you out — a correct guess locks you in for the round. No roles, no
// hidden info: the only thing that's ever private is a player's own
// in-progress typed guess, which lives on their device until they submit.

const MOVIES = [
  // --- Easy: instantly recognizable to almost anyone ---
  { emojis: ["🕷️", "🧑", "🌆"], title: "Spider-Man", alts: ["spidey"], difficulty: "easy" },
  { emojis: ["🦁", "👑", "🌅"], title: "The Lion King", alts: [], difficulty: "easy" },
  { emojis: ["❄️", "⛄", "👸"], title: "Frozen", alts: [], difficulty: "easy" },
  { emojis: ["🚢", "🧊", "💔"], title: "Titanic", alts: [], difficulty: "easy" },
  { emojis: ["🦖", "🌴", "🧬"], title: "Jurassic Park", alts: [], difficulty: "easy" },
  { emojis: ["🐠", "🔍", "🌊"], title: "Finding Nemo", alts: [], difficulty: "easy" },
  { emojis: ["💊", "🕶️", "🐇"], title: "The Matrix", alts: [], difficulty: "easy" },
  { emojis: ["🧸", "🤠", "🚀"], title: "Toy Story", alts: [], difficulty: "easy" },
  { emojis: ["🧛", "✨", "💕"], title: "Twilight", alts: [], difficulty: "easy" },
  { emojis: ["🧞", "🪔", "🐒"], title: "Aladdin", alts: [], difficulty: "easy" },
  { emojis: ["🏴‍☠️", "🦜", "💰"], title: "Pirates of the Caribbean", alts: ["potc", "pirates"], difficulty: "easy" },
  { emojis: ["🧙", "💍", "🌋"], title: "The Lord of the Rings", alts: ["lotr", "fellowship of the ring"], difficulty: "easy" },
  { emojis: ["⚡", "🧙", "🦉"], title: "Harry Potter", alts: ["harry potter and the sorcerers stone", "harry potter and the philosophers stone"], difficulty: "easy" },
  { emojis: ["🚗", "⚡", "🏁"], title: "Cars", alts: [], difficulty: "easy" },
  { emojis: ["🦸", "🛡️", "🌍"], title: "The Avengers", alts: [], difficulty: "easy" },
  { emojis: ["👹", "🧅", "🏰"], title: "Shrek", alts: [], difficulty: "easy" },
  { emojis: ["🌌", "⚔️", "🤖"], title: "Star Wars", alts: [], difficulty: "easy" },
  { emojis: ["🌺", "🌊", "🚣"], title: "Moana", alts: [], difficulty: "easy" },
  { emojis: ["🐼", "🥋", "🍜"], title: "Kung Fu Panda", alts: [], difficulty: "easy" },
  { emojis: ["🤖", "❤️", "🌍"], title: "WALL-E", alts: [], difficulty: "easy" },

  // --- Medium: well known, but the emojis take a beat ---
  { emojis: ["🦇", "🃏", "🌃"], title: "The Dark Knight", alts: ["batman"], difficulty: "medium" },
  { emojis: ["🦈", "🏖️", "🩸"], title: "Jaws", alts: [], difficulty: "medium" },
  { emojis: ["👻", "🔫", "🏙️"], title: "Ghostbusters", alts: [], difficulty: "medium" },
  { emojis: ["🐀", "👨‍🍳", "🍅"], title: "Ratatouille", alts: [], difficulty: "medium" },
  { emojis: ["👨‍🚀", "🌌", "⏳"], title: "Interstellar", alts: [], difficulty: "medium" },
  { emojis: ["🎈", "🏠", "👴"], title: "Up", alts: [], difficulty: "medium" },
  { emojis: ["🦍", "🏙️", "✈️"], title: "King Kong", alts: [], difficulty: "medium" },
  { emojis: ["🥊", "🏆", "🇺🇸"], title: "Rocky", alts: [], difficulty: "medium" },
  { emojis: ["🕶️", "👽", "🔫"], title: "Men in Black", alts: ["mib"], difficulty: "medium" },
  { emojis: ["🌪️", "👠", "🦁"], title: "The Wizard of Oz", alts: [], difficulty: "medium" },
  { emojis: ["🚗", "⏰", "⚡"], title: "Back to the Future", alts: ["bttf"], difficulty: "medium" },
  { emojis: ["👽", "🚲", "🌕"], title: "E.T. the Extra-Terrestrial", alts: ["et"], difficulty: "medium" },
  { emojis: ["🤖", "🔫", "🕶️"], title: "The Terminator", alts: ["terminator"], difficulty: "medium" },
  { emojis: ["🏃", "🍫", "🪶"], title: "Forrest Gump", alts: [], difficulty: "medium" },
  { emojis: ["🌀", "💤", "🎧"], title: "Inception", alts: [], difficulty: "medium" },
  { emojis: ["🔵", "🌿", "🏹"], title: "Avatar", alts: [], difficulty: "medium" },
  { emojis: ["🏠", "👦", "🕯️"], title: "Home Alone", alts: [], difficulty: "medium" },
  { emojis: ["🎲", "🐘", "🌴"], title: "Jumanji", alts: [], difficulty: "medium" },
  { emojis: ["💀", "🎸", "🌼"], title: "Coco", alts: [], difficulty: "medium" },
  { emojis: ["🕯️", "🏠", "🦋"], title: "Encanto", alts: [], difficulty: "medium" },
  { emojis: ["🌙", "🦹", "👾"], title: "Despicable Me", alts: ["minions"], difficulty: "medium" },
  { emojis: ["🦸‍♂️", "👨‍👩‍👧‍👦", "🎭"], title: "The Incredibles", alts: [], difficulty: "medium" },
  { emojis: ["👿", "🚪", "😱"], title: "Monsters, Inc.", alts: ["monsters inc"], difficulty: "medium" },
  { emojis: ["👽", "🥚", "🚀"], title: "Alien", alts: [], difficulty: "medium" },
  { emojis: ["⚔️", "🏟️", "👑"], title: "Gladiator", alts: [], difficulty: "medium" },
  { emojis: ["🏹", "🔥", "🎯"], title: "The Hunger Games", alts: ["hunger games"], difficulty: "medium" },
  { emojis: ["🎹", "💃", "🌇"], title: "La La Land", alts: [], difficulty: "medium" },
  { emojis: ["🐈‍⬛", "👑", "🌍"], title: "Black Panther", alts: [], difficulty: "medium" },
  { emojis: ["🩸", "🗡️", "😜"], title: "Deadpool", alts: [], difficulty: "medium" },
  { emojis: ["🚀", "🌳", "🦝"], title: "Guardians of the Galaxy", alts: ["gotg"], difficulty: "medium" },
  { emojis: ["👸", "🛡️", "⚔️"], title: "Wonder Woman", alts: [], difficulty: "medium" },
  { emojis: ["🏜️", "🪱", "🌌"], title: "Dune", alts: [], difficulty: "medium" },
  { emojis: ["🏝️", "🏐", "✈️"], title: "Cast Away", alts: ["castaway"], difficulty: "medium" },

  // --- Hard: cult classics, wordplay, or deliberately abstract clues ---
  { emojis: ["🤵", "🐴", "🍊"], title: "The Godfather", alts: ["godfather"], difficulty: "hard" },
  { emojis: ["👦", "👻", "🩺"], title: "The Sixth Sense", alts: ["sixth sense"], difficulty: "hard" },
  { emojis: ["🐹", "📅", "🔁"], title: "Groundhog Day", alts: [], difficulty: "hard" },
  { emojis: ["🤫", "👾", "🌽"], title: "A Quiet Place", alts: [], difficulty: "hard" },
  { emojis: ["🫖", "📷", "🕳️"], title: "Get Out", alts: [], difficulty: "hard" },
  { emojis: ["🪓", "🏨", "🩸"], title: "The Shining", alts: ["shining"], difficulty: "hard" },
  { emojis: ["💰", "❓", "🇮🇳"], title: "Slumdog Millionaire", alts: [], difficulty: "hard" },
  { emojis: ["🎤", "👑", "🎸"], title: "Bohemian Rhapsody", alts: [], difficulty: "hard" },
  { emojis: ["🚗", "🔥", "🏜️"], title: "Mad Max: Fury Road", alts: ["mad max", "fury road"], difficulty: "hard" },
  { emojis: ["🤠", "💨", "🪙"], title: "No Country for Old Men", alts: [], difficulty: "hard" },
  { emojis: ["📺", "🏝️", "🎥"], title: "The Truman Show", alts: ["truman show"], difficulty: "hard" },
  { emojis: ["🪳", "🏠", "💵"], title: "Parasite", alts: [], difficulty: "hard" },
  { emojis: ["🥁", "🎵", "😰"], title: "Whiplash", alts: [], difficulty: "hard" },
  { emojis: ["🎁", "📦", "7️⃣"], title: "Se7en", alts: ["seven"], difficulty: "hard" },
  { emojis: ["🕺", "💼", "🍔"], title: "Pulp Fiction", alts: [], difficulty: "hard" },
  { emojis: ["🧼", "👊", "🧠"], title: "Fight Club", alts: [], difficulty: "hard" },
];

export const id = "emoji-movie";
export const name = "Emoji Movie Guess";
export const minPlayers = 2;

export const DIFFICULTY_MODES = ["easy", "medium", "hard", "mixed"];

// Emojis are revealed one at a time. Emoji 1 is up from the start; each
// later emoji appears REVEAL_INTERVAL_MS after the previous one. With three
// emojis and a 6s step, everything is on screen by 12s; ANSWER_MS leaves a
// comfortable window to keep guessing after the last reveal.
const REVEAL_INTERVAL_MS = 6_000;
const ANSWER_MS = 30_000;

// Scoring. A correct guess is BASE_POINTS shaped by three factors:
//   * stage      — how many emojis were showing when it landed (the big one)
//   * difficulty — harder movies are worth more (matters most in "mixed")
//   * speed      — a mild nudge so faster is always a little better
// never dropping below MIN_POINTS.
const BASE_POINTS = 1000;
const MIN_POINTS = 50;
const STAGE_MULTIPLIER = { 1: 1.0, 2: 0.6, 3: 0.3 };
const DIFFICULTY_WEIGHT = { easy: 1.0, medium: 1.4, hard: 1.8 };
const SPEED_FLOOR = 0.75; // speed factor runs 1.0 (instant) -> 0.75 (buzzer)

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Lowercase, strip accents, turn "&" into "and", drop everything that
// isn't a letter or digit, then drop a leading "the". So "The Dark-Knight",
// "the dark knight" and "THEDARKKNIGHT" all collapse to "darkknight".
function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^the/, "");
}

// Classic Levenshtein edit distance between two short strings.
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

// Lenient match: exact after normalizing, or within a small edit distance
// that grows with title length (so short titles must be spot-on but longer
// ones tolerate a typo or two). Checked against the title and any alts.
function isCorrectGuess(rawGuess, movie) {
  const guess = normalize(rawGuess);
  if (guess.length < 2) return false;

  const targets = [movie.title, ...(movie.alts ?? [])].map(normalize).filter(Boolean);
  for (const target of targets) {
    if (guess === target) return true;
    const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
    if (tolerance > 0 && editDistance(guess, target) <= tolerance) return true;
  }
  return false;
}

// How many emojis are showing `atMs`. Emoji 1 from the start, then one more
// every REVEAL_INTERVAL_MS, capped at the movie's emoji count.
function revealedCountAt(movie, roundStartedAt, atMs) {
  const elapsed = atMs - roundStartedAt;
  if (elapsed <= 0) return 1;
  return Math.min(movie.emojis.length, 1 + Math.floor(elapsed / REVEAL_INTERVAL_MS));
}

// Points for a correct guess, given when it landed (elapsedMs), how many
// emojis were revealed at that moment, and the movie's difficulty.
function pointsFor(elapsedMs, revealedAtGuess, difficulty) {
  const stage = STAGE_MULTIPLIER[revealedAtGuess] ?? STAGE_MULTIPLIER[3];
  const weight = DIFFICULTY_WEIGHT[difficulty] ?? 1.0;
  const remainingFraction = Math.max(0, Math.min(1, 1 - elapsedMs / ANSWER_MS));
  const speed = SPEED_FLOOR + (1 - SPEED_FLOOR) * remainingFraction;
  return Math.max(MIN_POINTS, Math.round(BASE_POINTS * weight * stage * speed));
}

// The host picks how many rounds and a difficulty mode. Movies are drawn up
// front from a shuffled copy of the (optionally filtered) bank, so none
// repeats within a game. "mixed" uses the whole bank; the other modes keep
// only movies of that tier — and if the bank has fewer of them than the
// requested round count, the game just runs fewer rounds.
export function createGame(playerIds, { rounds, difficulty }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const mode = String(difficulty ?? "mixed");
  if (!DIFFICULTY_MODES.includes(mode)) {
    throw new Error("Choose a difficulty.");
  }

  const pool = mode === "mixed" ? MOVIES : MOVIES.filter((m) => m.difficulty === mode);
  if (pool.length === 0) {
    throw new Error("No movies available for that difficulty.");
  }

  const deck = shuffle(pool);
  const totalRounds = Math.min(requested, deck.length);
  const now = Date.now();

  return {
    id,
    phase: "guess", // "guess" -> "reveal" -> ("guess" ...) -> "final"
    difficultyMode: mode,
    totalRounds,
    roundIndex: 0,
    movies: deck.slice(0, totalRounds),
    roundStartedAt: now,
    deadline: now + ANSWER_MS,
    answers: new Map(), // playerId -> { guess, correct, elapsedMs, revealedAtGuess }, current round only
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    lastResult: null, // filled in by revealRound()
  };
}

// Record a guess. A WRONG guess is free and non-locking — players keep
// guessing as more emojis appear. A CORRECT guess locks the player in for
// the round at the stage/time it landed. Returns a small ack so the
// guesser's own device can show the outcome (the server owns the fuzzy
// matching, not the client).
export function submitAnswer(game, playerId, rawGuess, presentPlayerIds) {
  if (game.phase !== "guess") return { correct: false };
  if (Date.now() > game.deadline + 1000) return { correct: false, tooLate: true };

  const movie = game.movies[game.roundIndex];

  const prev = game.answers.get(playerId);
  if (prev?.correct) {
    return {
      correct: true,
      lockedIn: true,
      alreadyLocked: true,
      revealedAtGuess: prev.revealedAtGuess,
      points: pointsFor(prev.elapsedMs, prev.revealedAtGuess, movie.difficulty),
    };
  }

  const guess = String(rawGuess ?? "").slice(0, 100).trim();
  const now = Date.now();
  const correct = isCorrectGuess(guess, movie);
  const elapsedMs = Math.max(0, now - game.roundStartedAt);
  const revealedAtGuess = revealedCountAt(movie, game.roundStartedAt, now);
  game.answers.set(playerId, { guess, correct, elapsedMs, revealedAtGuess });

  if (correct) {
    const everyoneSolved = presentPlayerIds.every((pid) => game.answers.get(pid)?.correct);
    if (everyoneSolved) revealRound(game, presentPlayerIds);
    return {
      correct: true,
      lockedIn: true,
      revealedAtGuess,
      points: pointsFor(elapsedMs, revealedAtGuess, movie.difficulty),
    };
  }
  return { correct: false };
}

// Score the round (correct answers are worth the most when locked in early
// with few emojis; wrong or missing answers are worth 0) and freeze a
// per-player breakdown for the reveal screen — earliest lock-in first,
// then fastest.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "guess") return;

  const movie = game.movies[game.roundIndex];
  const entries = presentPlayerIds.map((pid) => {
    const answer = game.answers.get(pid);
    const points = answer?.correct
      ? pointsFor(answer.elapsedMs, answer.revealedAtGuess, movie.difficulty)
      : 0;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    return {
      playerId: pid,
      guess: answer?.guess ?? "",
      correct: Boolean(answer?.correct),
      points,
      elapsedMs: answer?.elapsedMs ?? null,
      revealedAtGuess: answer?.revealedAtGuess ?? null,
    };
  });

  entries.sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? -1 : 1;
    if (!a.correct) return 0;
    if (a.revealedAtGuess !== b.revealedAtGuess) return a.revealedAtGuess - b.revealedAtGuess;
    return a.elapsedMs - b.elapsedMs;
  });

  game.lastResult = {
    roundIndex: game.roundIndex,
    title: movie.title,
    emojis: movie.emojis,
    difficulty: movie.difficulty,
    entries,
  };
  game.phase = "reveal";
}

// Optional framework hook: called when the connected-player set changes.
// If everyone still connected has already locked in a correct guess, end
// the round now instead of waiting on a player who left.
export function reconcilePresence(game, presentPlayerIds) {
  if (game.phase !== "guess") return;
  if (presentPlayerIds.length === 0) return;
  if (presentPlayerIds.every((pid) => game.answers.get(pid)?.correct)) {
    revealRound(game, presentPlayerIds);
  }
}

export function nextRound(game) {
  if (game.phase !== "reveal") return;

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  game.answers = new Map();
  game.roundStartedAt = Date.now();
  game.deadline = Date.now() + ANSWER_MS;
  game.phase = "guess";
}

// The PUBLIC view — identical for every player. During the guess phase only
// the emojis revealed SO FAR are sent (the hidden ones never leave the
// server until their time comes, so they can't be peeked at); the reveal
// screen gets the full set. Typed guesses stay private until the reveal.
export function getPublicState(game, presentPlayerIds) {
  const movie = game.movies[game.roundIndex];
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const now = Date.now();
  const revealedCount =
    game.phase === "guess"
      ? revealedCountAt(movie, game.roundStartedAt, now)
      : movie.emojis.length;

  const state = {
    id: game.id,
    phase: game.phase,
    difficultyMode: game.difficultyMode,
    currentDifficulty: movie.difficulty,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    emojis: movie.emojis.slice(0, revealedCount),
    revealedCount,
    totalEmojis: movie.emojis.length,
    revealIntervalMs: REVEAL_INTERVAL_MS,
    solvedCount: presentPlayerIds.filter((pid) => game.answers.get(pid)?.correct).length,
    totalPlayers: presentPlayerIds.length,
    answerMs: ANSWER_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  };

  if (game.phase === "reveal") {
    state.result = game.lastResult;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// No per-player secret data — everyone sees the same thing. The framework
// still calls this once when the game starts; returning null is fine.
export function getPrivateState() {
  return null;
}

// --- Tournament Mode: default per-game config when run inside a tournament.
export function tournamentOptions() {
  return { rounds: 4, difficulty: "mixed" };
}
