const CATEGORIES = {
  Animals: [
    "Elephant", "Penguin", "Kangaroo", "Octopus", "Giraffe",
    "Dolphin", "Tiger", "Panda", "Flamingo", "Koala",
  ],
  Food: [
    "Pizza", "Sushi", "Taco", "Pancake", "Burger",
    "Spaghetti", "Sandwich", "Waffle", "Popcorn", "Donut",
  ],
  Places: [
    "Beach", "Hospital", "Library", "Airport", "Castle",
    "Zoo", "Concert", "Volcano", "Submarine", "Space Station",
  ],
  Movies: [
    "Titanic", "Frozen", "Jaws", "Avatar", "Shrek",
    "Inception", "Gladiator", "Cinderella", "Rocky", "Matrix",
  ],
};

export const id = "imposter";
export const name = "Imposter";
export const minPlayers = 3;
export const CATEGORY_NAMES = Object.keys(CATEGORIES);

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// playerIds: array of socket ids currently in the room. The host only ever
// picks a CATEGORY — the server draws the actual word at random from it, so
// not even the host knows the specific word going in. That matters because
// the host is assigned a role (crew or imposter) exactly like anyone else;
// if they'd hand-picked the word themselves, they'd already know it even
// on rounds where they end up being the imposter.
export function createGame(playerIds, { imposterCount, category }) {
  if (![1, 2].includes(imposterCount)) {
    throw new Error("Imposter count must be 1 or 2.");
  }
  if (imposterCount >= playerIds.length) {
    throw new Error("Not enough players for that many imposters.");
  }
  const words = CATEGORIES[category];
  if (!words) {
    throw new Error("Unknown category.");
  }

  const word = words[Math.floor(Math.random() * words.length)];
  const imposterIds = new Set(shuffle(playerIds).slice(0, imposterCount));

  return {
    id,
    phase: "reveal", // reveal -> turns -> voting -> results
    category,
    word,
    imposterIds,
    turnOrder: shuffle(playerIds),
    currentTurnIndex: 0,
    votes: new Map(), // voterId -> Set<votedForId>, one vote per imposter in play
  };
}

// The PUBLIC view of the game — identical for every player. Never contains
// the word or who the imposters are, except once the round has ended.
export function getPublicState(game, presentPlayerIds) {
  const voteLimit = game.imposterIds.size;

  const state = {
    id: game.id,
    phase: game.phase,
    imposterCount: voteLimit,
    turnOrder: game.turnOrder,
    currentTurnPlayerId: game.turnOrder[game.currentTurnIndex] ?? null,
    // Players who have cast ALL of their votes — not just some of them.
    votedPlayerIds: presentPlayerIds.filter(
      (id) => (game.votes.get(id)?.size ?? 0) === voteLimit
    ),
    totalVoters: presentPlayerIds.length,
  };

  if (game.phase === "results") {
    const counts = tally(game, presentPlayerIds);
    state.category = game.category;
    state.word = game.word;
    state.imposterIds = [...game.imposterIds];
    state.tally = counts;
    state.detectivesWin = computeDetectivesWin(game, counts);
  }

  return state;
}

// The PRIVATE view of the game — different depending on WHO is asking.
// This is the one function in the whole app whose output must never be
// broadcast; it's only ever sent to the one matching player's socket.
// Every player — host included — goes through this exact same check
// against game.imposterIds; nothing here special-cases who the host is.
export function getPrivateState(game, playerId) {
  if (game.imposterIds.has(playerId)) {
    // Imposters get the category (so they have something to bluff off of)
    // but never the word itself.
    return { role: "imposter", category: game.category };
  }
  return { role: "crew", word: game.word };
}

export function startTurns(game) {
  game.phase = "turns";
}

export function advanceTurn(game, presentPlayerIds) {
  const remaining = game.turnOrder.filter((id) => presentPlayerIds.includes(id));
  const currentId = game.turnOrder[game.currentTurnIndex];
  const posInRemaining = remaining.indexOf(currentId);

  if (posInRemaining === -1 || posInRemaining === remaining.length - 1) {
    game.phase = "voting";
    return;
  }

  const nextId = remaining[posInRemaining + 1];
  game.currentTurnIndex = game.turnOrder.indexOf(nextId);
}

// Each voter gets one vote per imposter in play, and each of their votes
// must land on a different player. Clicking an already-selected target
// un-votes them; clicking a new one adds a vote as long as they're under
// their limit. Once every present player has used all their votes, the
// round moves to results.
export function toggleVote(game, voterId, votedForId, presentPlayerIds) {
  const limit = game.imposterIds.size;
  const current = game.votes.get(voterId) ?? new Set();

  if (current.has(votedForId)) {
    current.delete(votedForId);
  } else if (current.size < limit) {
    current.add(votedForId);
  } // else: already used all votes and this is a new target — ignore

  game.votes.set(voterId, current);

  const allDone = presentPlayerIds.every(
    (id) => (game.votes.get(id)?.size ?? 0) === limit
  );
  if (allDone) {
    game.phase = "results";
  }
}

// Optional framework hook: called whenever the set of connected players
// changes (someone dropped, or was removed after the rejoin grace). Keeps
// a round from stalling on a player who's gone — the turn baton can't be
// passed by anyone but its current holder, so if that holder vanishes we
// move it on ourselves.
export function reconcilePresence(game, presentPlayerIds) {
  const present = new Set(presentPlayerIds);

  if (game.phase === "turns") {
    if (!present.has(game.turnOrder[game.currentTurnIndex])) {
      const rest = game.turnOrder
        .slice(game.currentTurnIndex + 1)
        .filter((id) => present.has(id));
      if (rest.length) {
        game.currentTurnIndex = game.turnOrder.indexOf(rest[0]);
      } else {
        game.phase = "voting";
      }
    }
    return;
  }

  if (game.phase === "voting") {
    const limit = game.imposterIds.size;
    const allDone =
      present.size > 0 &&
      presentPlayerIds.every((id) => (game.votes.get(id)?.size ?? 0) === limit);
    if (allDone) game.phase = "results";
  }
}

function tally(game, presentPlayerIds) {
  const counts = {};
  for (const id of presentPlayerIds) counts[id] = 0;
  for (const voteSet of game.votes.values()) {
    for (const votedForId of voteSet) {
      if (votedForId in counts) counts[votedForId] += 1;
    }
  }
  return counts;
}

// Rank everyone by vote count and take the threshold at the Nth place
// (N = number of imposters) — this is the same idea as "tied for the max"
// generalized to more than one imposter. Anyone at or above that
// threshold counts as caught, so ties at the boundary are all included.
// Detectives win only if EVERY imposter clears that bar; if even one
// evades it, the imposters win as a team.
function computeDetectivesWin(game, counts) {
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const threshold = sorted[game.imposterIds.size - 1] ?? 0;
  if (threshold === 0) return false;
  return [...game.imposterIds].every((id) => counts[id] >= threshold);
}

// --- Tournament Mode hooks -------------------------------------------
// Imposter is a single win/lose round with no running score, so it needs
// to spell out its terminal phase and how to rank players. The winning
// side all "tie for 1st"; the tournament layer's tie handling turns that
// into equal points for them and skips ranks for the losers.

export function isGameOver(game) {
  return game.phase === "results";
}

export function getFinalStandings(game, participantIds) {
  if (game.phase !== "results") {
    return participantIds.map((pid) => ({ playerId: pid, score: 0 }));
  }
  const counts = tally(game, participantIds);
  const detectivesWin = computeDetectivesWin(game, counts);
  return participantIds
    .map((pid) => {
      const isImposter = game.imposterIds.has(pid);
      const won = detectivesWin ? !isImposter : isImposter;
      return { playerId: pid, score: won ? 1 : 0 };
    })
    .sort((a, b) => b.score - a.score);
}

export function tournamentOptions() {
  const category = CATEGORY_NAMES[Math.floor(Math.random() * CATEGORY_NAMES.length)];
  return { imposterCount: 1, category };
}
