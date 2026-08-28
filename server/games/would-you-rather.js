// "Would You Rather" — a prediction party game. No roles, no secret info:
// everyone sees the same question at the same time, picks one option on
// their own phone, and scores based on how many people landed on the same
// option they did. The only thing that's ever private is a player's own
// pick before the round is revealed — and even that just isn't broadcast;
// it lives on their device until reveal, so there's nothing sensitive in
// this module's state.
//
// Each question carries 2–4 options. Whichever option gets the most votes
// is "the majority"; players who picked it score on a sliding scale by how
// lopsided the vote was (see POINT_TIERS), plus a flat streak bonus for
// consecutive majority rounds. Minority picks score 0. A tie for the top
// option means no majority that round — nobody scores, every streak resets.

const QUESTIONS = [
  // --- Food & drink (2-option) ---
  { options: ["Never eat pizza again", "Never eat chocolate again"] },
  { options: ["Only eat sweet foods forever", "Only eat savory foods forever"] },
  { options: ["Give up coffee and tea forever", "Give up soda and juice forever"] },
  { options: ["Have unlimited free sushi for life", "Have unlimited free tacos for life"] },
  { options: ["Every meal is slightly too spicy", "Every meal is slightly too bland"] },
  { options: ["Cheese vanishes from the world", "Bread vanishes from the world"] },
  { options: ["Only ever drink your coffee lukewarm", "Only ever eat your fries cold"] },
  { options: ["Always have to share your dessert", "Never be allowed an appetizer"] },
  { options: ["Only breakfast can be eaten out", "Only dinner can be eaten out"] },
  { options: ["Fruit is the only sweet thing you can eat", "Candy is fine but no fresh fruit ever"] },

  // --- Superpowers (2-option) ---
  { options: ["Fly, but only at running speed", "Turn invisible whenever you want"] },
  { options: ["Read anyone's thoughts", "See 30 seconds into the future"] },
  { options: ["Teleport, but only to places you've already been", "Time travel, but only to watch, never change things"] },
  { options: ["Have super strength", "Have super speed"] },
  { options: ["Talk to animals", "Speak every human language"] },
  { options: ["Control fire", "Control water"] },
  { options: ["Never feel tired again", "Never feel hungry again"] },
  { options: ["Heal any injury by sleeping it off", "Never get sick again"] },
  { options: ["Breathe underwater", "Be comfortable in any temperature"] },
  { options: ["Freeze time for everyone but you, 1 min a day", "Rewind time 10 seconds, once a day"] },

  // --- Hypotheticals & life (2-option) ---
  { options: ["Know exactly how you'll die", "Know exactly when you'll die"] },
  { options: ["Relive your favorite day on loop for a week", "Live one brand-new perfect day"] },
  { options: ["Always be 15 minutes early", "Always be 5 minutes late"] },
  { options: ["Restart today from this morning", "Skip straight to tomorrow"] },
  { options: ["Have a pause button for life, 60 sec once a day", "Have a slow-motion button, 60 sec once a day"] },
  { options: ["Be the funniest person in every room", "Be the smartest person in every room"] },
  { options: ["Never feel embarrassed again", "Never feel bored again"] },
  { options: ["Always win a coin flip", "Always find a great parking spot"] },
  { options: ["Have a personal soundtrack only you can hear", "Have a narrator only you can hear"] },
  { options: ["Get a 10-minute call with your future self", "Get a 10-minute call with your past self"] },

  // --- Everyday dilemmas (2-option) ---
  { options: ["Always have a slow phone", "Always have slow internet"] },
  { options: ["Only ever take the stairs", "Only ever take elevators and escalators"] },
  { options: ["Your phone always sits at 40% battery", "Your phone storage is always 90% full"] },
  { options: ["Be slightly too warm all the time", "Be slightly too cold all the time"] },
  { options: ["Lose every photo you've ever taken", "Lose every message you've ever sent or received"] },
  { options: ["Give up shows and movies for a year", "Give up listening to music for a year"] },
  { options: ["Never find a matching pair of socks again", "Always have one shoelace that won't stay tied"] },
  { options: ["Wear shoes that are always slightly wet", "Wear sleeves that are always slightly too long"] },
  { options: ["Have a perfect memory for names", "Have a perfect memory for faces"] },
  { options: ["Think of the perfect reply 10 seconds too late", "Say it on time, but only half as clever"] },

  // --- Silly & absurd (2-option) ---
  { options: ["Sweat maple syrup", "Cry glitter"] },
  { options: ["Sneeze confetti every time", "Burp a small soap bubble every time"] },
  { options: ["Only be able to walk backwards", "Only be able to walk sideways"] },
  { options: ["Your hair grows an inch every hour", "Your fingernails grow an inch every hour"] },
  { options: ["Everything you touch feels slightly sticky", "Everything you touch feels slightly damp"] },
  { options: ["Have to sing everything you want to say", "Have to whisper everything you want to say"] },
  { options: ["A tiny cloud rains on you when you're sad", "A spotlight follows you when you're happy"] },
  { options: ["Live where every room is a kitchen", "Live where every room is a bathroom"] },
  { options: ["Have hands the size of dinner plates", "Have feet the size of skateboards"] },
  { options: ["Hiccup once every minute forever", "Yawn once every minute forever"] },

  // --- World, travel, money, people (2-option) ---
  { options: ["Take one free trip to space", "Take one free trip to the bottom of the ocean"] },
  { options: ["Visit every country, one day in each", "Visit only five countries, a month in each"] },
  { options: ["Always get a free window seat", "Always get a free aisle seat with extra legroom"] },
  { options: ["Teleport anywhere instantly, but never with luggage", "Travel normally, always with everything you need"] },
  { options: ["Have five close friends and no more", "Have fifty good friends but none very close"] },
  { options: ["Always know when someone is lying to you", "Always be believed, even when you're lying"] },
  { options: ["Find $200 in an old jacket", "Get a $250 gift card to one store you choose"] },
  { options: ["Work four days a week for 80% of your pay", "Work six days a week for 130% of your pay"] },
  { options: ["Instantly master any one instrument", "Instantly master any one sport"] },
  { options: ["Be fluent in five languages", "Be a genuinely great cook"] },

  // --- 3-option ---
  { options: ["Best pizza: pepperoni", "Best pizza: mushroom", "Best pizza: plain cheese"] },
  { options: ["Free daily coffee for life", "Free daily tea for life", "Free daily fresh juice for life"] },
  { options: ["Unlimited tacos for life", "Unlimited sushi for life", "Unlimited dumplings for life"] },
  { options: ["Superpower: flight", "Superpower: invisibility", "Superpower: super strength"] },
  { options: ["Free Saturday: a long hike", "Free Saturday: a movie marathon", "Free Saturday: a big group dinner"] },
  { options: ["Have a dog", "Have a cat", "Have a parrot"] },
  { options: ["It's always spring", "It's always summer", "It's always autumn"] },
  { options: ["Dream trip: beach resort", "Dream trip: big city", "Dream trip: mountain cabin"] },
  { options: ["Only music format: vinyl", "Only music format: streaming", "Only music: live shows"] },
  { options: ["Instantly master piano", "Instantly master guitar", "Instantly master drums"] },
  { options: ["Commute forever by bike", "Commute forever by train", "Commute forever on foot"] },

  // --- 4-option ---
  { options: ["Only eat pizza forever", "Only eat tacos forever", "Only eat sushi forever", "Only eat burgers forever"] },
  { options: ["One cuisine forever: Italian", "One cuisine forever: Japanese", "One cuisine forever: Mexican", "One cuisine forever: Indian"] },
  { options: ["Best breakfast: pancakes", "Best breakfast: bacon and eggs", "Best breakfast: cereal", "Best breakfast: just coffee"] },
  { options: ["Instantly master a language", "Instantly master an instrument", "Instantly master a sport", "Instantly master cooking"] },
  { options: ["Sidekick: a loyal dog", "Sidekick: a wise owl", "Sidekick: a clever raccoon", "Sidekick: a chill cat"] },
  { options: ["Lifetime pass: movie theaters", "Lifetime pass: concerts", "Lifetime pass: sports games", "Lifetime pass: theme parks"] },
  { options: ["Dream home: beach house", "Dream home: city loft", "Dream home: forest cabin", "Dream home: countryside farm"] },
  { options: ["First superpower pick: fly", "First superpower pick: teleport", "First superpower pick: read minds", "First superpower pick: freeze time"] },
  { options: ["Ice cream forever: vanilla", "Ice cream forever: chocolate", "Ice cream forever: strawberry", "Ice cream forever: mint choc chip"] },
];

export const id = "would-you-rather";
export const name = "Would You Rather";
export const minPlayers = 2;

// How long players get to answer each round. The client shows a countdown
// seeded from the `msLeft` in public state; when it hits zero the host's
// device asks the server to reveal. The host can also reveal early.
const ANSWER_MS = 25_000;

// Tiered majority payout, checked high-to-low against the winning option's
// share of everyone who answered. Below 51% (a weak plurality on a 3–4
// option question) the base payout is 0 — but the picker still counts as
// "in the majority" for streak and end-of-game award purposes.
const POINT_TIERS = [
  { min: 0.9, points: 3 },
  { min: 0.7, points: 2 },
  { min: 0.51, points: 1 },
];

// Flat bonus added once a player has been in the majority for 2+ rounds in
// a row, on top of the tiered base. Applies regardless of how many options
// the round's question had.
const STREAK_BONUS = 1;

const letterFor = (i) => String.fromCharCode(65 + i); // 0 -> "A"
const indexFor = (letter) => letter.charCodeAt(0) - 65; // "A" -> 0

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function freshStats() {
  return { answered: 0, majority: 0, bestStreak: 0 };
}

// The host only picks how many rounds. We draw the whole session's
// questions up front from a shuffled copy of the bank, so no question can
// repeat within a game — each session gets its own fresh shuffle.
export function createGame(playerIds, { rounds }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const deck = shuffle(QUESTIONS);
  const totalRounds = Math.min(requested, deck.length);

  return {
    id,
    phase: "answer", // "answer" -> "result" -> ("answer" ...) -> "final"
    totalRounds,
    roundIndex: 0,
    questions: deck.slice(0, totalRounds), // each { options: string[] }
    answers: new Map(), // playerId -> "A".."D", cleared between rounds
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    streaks: new Map(playerIds.map((pid) => [pid, 0])), // consecutive majority rounds
    stats: new Map(playerIds.map((pid) => [pid, freshStats()])), // for end-of-game awards
    deadline: Date.now() + ANSWER_MS,
    lastResult: null, // filled in by revealRound()
  };
}

// Record (or change) a player's pick. Once every player still in the room
// has answered, the round reveals itself without waiting for the timer.
export function submitAnswer(game, playerId, choice, presentPlayerIds) {
  if (game.phase !== "answer") return;

  const optionCount = game.questions[game.roundIndex].options.length;
  const idx = typeof choice === "string" ? indexFor(choice) : -1;
  if (idx < 0 || idx >= optionCount) return;

  game.answers.set(playerId, choice);

  const everyoneAnswered = presentPlayerIds.every((pid) => game.answers.has(pid));
  if (everyoneAnswered) revealRound(game, presentPlayerIds);
}

// Tally the round, find the winning option, and hand out points:
//   base  — POINT_TIERS payout for the winning option's vote share (0 if <51%)
//   bonus — flat STREAK_BONUS once a player's majority streak reaches 2
// Minority picks score 0 and reset that player's streak. A tie for the top
// option means no majority: nobody scores, every present player's streak
// resets. Players who didn't answer score 0 and lose their streak too.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "answer") return;

  const question = game.questions[game.roundIndex];
  const optionCount = question.options.length;

  const picks = presentPlayerIds
    .filter((pid) => game.answers.has(pid))
    .map((pid) => [pid, game.answers.get(pid)]);

  const counts = {};
  for (let i = 0; i < optionCount; i++) counts[letterFor(i)] = 0;
  for (const [, choice] of picks) counts[choice] += 1;

  const totalAnswered = picks.length;
  const maxVotes = Math.max(0, ...Object.values(counts));
  const topKeys = Object.keys(counts).filter((k) => counts[k] === maxVotes && maxVotes > 0);
  const tie = topKeys.length !== 1;
  const majorityKey = tie ? null : topKeys[0];
  const majorityPct = majorityKey ? maxVotes / totalAnswered : 0;
  const tier = POINT_TIERS.find((t) => majorityPct >= t.min);
  const tierPoints = tier ? tier.points : 0;

  const roundScores = {};
  for (const [pid, choice] of picks) {
    const st = game.stats.get(pid) ?? freshStats();
    st.answered += 1;

    const inMajority = majorityKey !== null && choice === majorityKey;
    let base = 0;
    let bonus = 0;
    let streak = 0;

    if (inMajority) {
      st.majority += 1;
      streak = (game.streaks.get(pid) ?? 0) + 1;
      game.streaks.set(pid, streak);
      if (streak > st.bestStreak) st.bestStreak = streak;
      base = tierPoints;
      bonus = streak >= 2 ? STREAK_BONUS : 0;
    } else {
      game.streaks.set(pid, 0);
    }

    game.stats.set(pid, st);
    const total = base + bonus;
    if (total) game.scores.set(pid, (game.scores.get(pid) ?? 0) + total);
    roundScores[pid] = { inMajority, base, bonus, total, streak };
  }

  // Sitting a round out breaks a majority streak too.
  for (const pid of presentPlayerIds) {
    if (!game.answers.has(pid)) game.streaks.set(pid, 0);
  }

  game.lastResult = {
    roundIndex: game.roundIndex,
    optionCount,
    counts,
    totalAnswered,
    majorityKey,
    majorityPct,
    tie,
    tierPoints,
    answers: Object.fromEntries(picks), // playerId -> "A".."D"
    roundScores, // playerId -> { inMajority, base, bonus, total, streak }
  };
  game.phase = "result";
}

// Optional framework hook: called when the connected-player set changes.
// If everyone still connected has already answered, the round no longer
// needs to wait out the clock (or the missing player) — reveal it.
export function reconcilePresence(game, presentPlayerIds) {
  if (game.phase !== "answer") return;
  if (presentPlayerIds.length === 0) return;
  if (presentPlayerIds.every((pid) => game.answers.has(pid))) {
    revealRound(game, presentPlayerIds);
  }
}

export function nextRound(game) {
  if (game.phase !== "result") return;

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  game.answers = new Map();
  game.deadline = Date.now() + ANSWER_MS;
  game.phase = "answer";
}

// 1–3 lighthearted superlatives drawn entirely from per-player session
// stats already tracked during play. Only players who answered at least
// two rounds are eligible, and each award goes to a different person.
function computeAwards(game, presentPlayerIds) {
  const rows = presentPlayerIds
    .map((pid) => ({ pid, ...(game.stats.get(pid) ?? freshStats()) }))
    .filter((r) => r.answered >= 2);
  if (rows.length < 2) return [];

  const awards = [];
  const taken = new Set();

  const majorityRate = (r) => r.majority / r.answered;

  // Most Predictable — biggest share of answered rounds spent in the majority.
  const predictable = [...rows].sort(
    (a, b) => majorityRate(b) - majorityRate(a) || b.majority - a.majority
  )[0];
  if (predictable.majority > 0) {
    awards.push({
      id: "most-predictable",
      emoji: "🎯",
      title: "Most Predictable",
      playerId: predictable.pid,
      detail: `With the majority in ${predictable.majority} of ${predictable.answered} rounds (${Math.round(
        majorityRate(predictable) * 100
      )}%)`,
    });
    taken.add(predictable.pid);
  }

  // Wildcard — biggest share of answered rounds spent AGAINST the majority.
  const wildcard = [...rows].sort(
    (a, b) =>
      (1 - majorityRate(b)) - (1 - majorityRate(a)) ||
      (b.answered - b.majority) - (a.answered - a.majority)
  )[0];
  const wildMisses = wildcard.answered - wildcard.majority;
  if (wildMisses > 0 && !taken.has(wildcard.pid)) {
    awards.push({
      id: "wildcard",
      emoji: "🃏",
      title: "Wildcard",
      playerId: wildcard.pid,
      detail: `Went against the crowd in ${wildMisses} of ${wildcard.answered} rounds (${Math.round(
        (wildMisses / wildcard.answered) * 100
      )}%)`,
    });
    taken.add(wildcard.pid);
  }

  // Hot Streak — longest run of consecutive majority rounds, if notable.
  const streaker = [...rows].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  if (streaker.bestStreak >= 3 && !taken.has(streaker.pid)) {
    awards.push({
      id: "hot-streak",
      emoji: "🔥",
      title: "Hot Streak",
      playerId: streaker.pid,
      detail: `${streaker.bestStreak} rounds in the majority in a row`,
    });
  }

  return awards;
}

// The PUBLIC view — identical for every player. Everything about this game
// is public except a pick that hasn't been revealed yet, and those live on
// the clients, not here — so this is just the whole game state, trimmed to
// what the current phase needs.
export function getPublicState(game, presentPlayerIds) {
  const question = game.questions[game.roundIndex];
  const scores = presentPlayerIds
    .map((pid) => ({
      playerId: pid,
      score: game.scores.get(pid) ?? 0,
      streak: game.streaks.get(pid) ?? 0,
    }))
    .sort((x, y) => y.score - x.score);

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    question: { options: [...question.options] },
    answeredPlayerIds: presentPlayerIds.filter((pid) => game.answers.has(pid)),
    totalPlayers: presentPlayerIds.length,
    answerMs: ANSWER_MS,
    msLeft: Math.max(0, game.deadline - Date.now()),
    scores,
  };

  if (game.phase === "result") {
    state.result = game.lastResult;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
    state.awards = computeAwards(game, presentPlayerIds);
  }

  return state;
}

// No per-player secret data in this game — everyone sees the same thing.
// The framework still calls this once when the game starts; returning null
// is fine, the client just ignores the "your_role" message here.
export function getPrivateState() {
  return null;
}

// --- Tournament Mode: default per-game config when run inside a tournament.
export function tournamentOptions() {
  return { rounds: 3 };
}
