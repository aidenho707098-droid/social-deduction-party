// Tournament Mode — a layer that sits ABOVE the individual games. It never
// touches how a game plays; it only:
//   * decides which game runs next (a fixed manual lineup, or a random
//     "wheel" spin before every game),
//   * reads each finished game's per-player final standings through a
//     small, generic contract, and
//   * converts those standings into rank-based tournament points that
//     accumulate on a separate running leaderboard.
//
// Contract a game module may implement (all OPTIONAL — sensible defaults
// cover the common case, so most games and all future games need nothing):
//   * isGameOver(game) -> boolean            (default: game.phase === "final")
//   * getFinalStandings(game, participantIds) -> [{ playerId, score }] desc
//         (default: getPublicState(game, participantIds).scores)
//   * tournamentOptions(playerIds) -> options for createGame()
//         (default: {} — the game's own defaults)

import { GAMES } from "./games/registry.js";

// FIXED rank -> points scale, regardless of how many players were in the
// game. Anything 5th or lower scores 0.
const RANK_POINTS = [5, 3, 2, 1];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function eligibleGameIds(playerCount) {
  return Object.values(GAMES)
    .filter((mod) => playerCount >= mod.minPlayers)
    .map((mod) => mod.id);
}

// --- Generic game-result reading (the "report your standings" hook) ----

export function isGameOver(gameModule, game) {
  if (typeof gameModule.isGameOver === "function") return gameModule.isGameOver(game);
  return game.phase === "final";
}

export function finalStandingsOf(gameModule, game, participantIds) {
  let standings;
  if (typeof gameModule.getFinalStandings === "function") {
    standings = gameModule.getFinalStandings(game, participantIds);
  } else {
    const pub = gameModule.getPublicState(game, participantIds);
    standings = Array.isArray(pub.scores) ? pub.scores : [];
  }
  return [...standings].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function tournamentOptionsFor(gameId, playerIds) {
  const mod = GAMES[gameId];
  if (mod && typeof mod.tournamentOptions === "function") {
    return mod.tournamentOptions(playerIds) ?? {};
  }
  return {};
}

// Convert a single game's final standings (sorted desc by score, ties =
// equal score) into rank-based tournament points. Tied players share the
// HIGHER rank's points and the following ranks are skipped.
//   e.g. [10, 10, 6, 2]  ->  ranks 1, 1, 3, 4  ->  points 5, 5, 2, 1
export function toTournamentPoints(standings) {
  const rows = [...standings].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const out = [];
  let i = 0;
  let rank = 1;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && (rows[j].score ?? 0) === (rows[i].score ?? 0)) j++;
    const points = RANK_POINTS[rank - 1] ?? 0;
    for (let k = i; k < j; k++) {
      out.push({
        playerId: rows[k].playerId,
        rank,
        points,
        gameScore: rows[k].score ?? 0,
      });
    }
    rank += j - i; // skip ranks consumed by the tie
    i = j;
  }
  return out;
}

// --- Tournament lifecycle -------------------------------------------------

export function createTournament({ mode, lineup, lineupSettings, totalGames }, playerIds) {
  const method = mode === "random" ? "random" : "manual";
  const eligible = eligibleGameIds(playerIds.length);
  if (eligible.length === 0) {
    throw new Error("No games can run with the current number of players.");
  }

  let orderedLineup = [];
  let orderedSettings = []; // parallel to orderedLineup: host-chosen createGame() options per slot
  let total;
  if (method === "manual") {
    // Keep each game's chosen settings aligned with its lineup slot as we
    // drop any games the current player count can't support.
    const kept = (Array.isArray(lineup) ? lineup : [])
      .map((id, i) => ({ id, options: (Array.isArray(lineupSettings) && lineupSettings[i]) || {} }))
      .filter((e) => eligible.includes(e.id));
    orderedLineup = kept.map((e) => e.id);
    orderedSettings = kept.map((e) => e.options);
    if (orderedLineup.length < 2) {
      throw new Error("Pick at least 2 games for the lineup.");
    }
    total = orderedLineup.length;
  } else {
    total = Math.max(2, Math.min(Math.floor(Number(totalGames)) || 3, 12));
  }

  return {
    active: true,
    // lineup -> (wheel ->)? intro -> playing -> between -> ... -> complete
    phase: "lineup",
    mode: method,
    lineup: orderedLineup,
    lineupSettings: orderedSettings, // manual mode: options per lineup slot
    totalGames: total,
    currentIndex: 0,
    standings: new Map(), // playerId -> accumulated points
    history: [], // [{ gameId, gameName, ranks: [{playerId,rank,points,gameScore}], skipped? }]
    currentGameId: null,
    currentParticipants: [],
    pendingGameId: null, // the game the "intro" screen is for
    pendingGameOptions: null, // random mode: host-chosen options for the "up next" game
    usedThisCycle: [], // random mode: games drawn since the last pool reset
    wheel: null, // { pool: [gameId], landedOn, spinId }
  };
}

// Figure out what happens next for tournament.currentIndex. Mutates the
// tournament: sets phase to "intro" (manual — the game is known), "wheel"
// (random — spin for it) or "complete" (done). Returns a small directive
// for the caller (which owns broadcasts / game start / the wheel timer).
export function stepAt(tournament, currentPlayerCount) {
  const t = tournament;
  if (t.currentIndex >= t.totalGames) {
    t.phase = "complete";
    t.currentGameId = null;
    t.pendingGameId = null;
    t.wheel = null;
    return { done: true };
  }

  if (t.mode === "manual") {
    enterIntro(t, t.lineup[t.currentIndex]);
    return { intro: true };
  }

  // Random mode: spin a wheel over games that HAVEN'T been drawn yet this
  // cycle. Once every eligible game has been used, refill the pool (repeats
  // now allowed) and start a fresh cycle.
  const eligible = eligibleGameIds(currentPlayerCount);
  if (eligible.length === 0) {
    t.phase = "complete";
    return { done: true };
  }
  let available = eligible.filter((id) => !t.usedThisCycle.includes(id));
  if (available.length === 0) {
    t.usedThisCycle = [];
    available = [...eligible];
  }

  const pool = shuffle(available);
  const landedOn = pool[Math.floor(Math.random() * pool.length)];
  t.usedThisCycle.push(landedOn);
  t.wheel = { pool, landedOn, spinId: (t.wheel?.spinId ?? 0) + 1 };
  t.phase = "wheel";
  return { wheel: true, landedOn };
}

// The wheel landed (or a manual game is up) — hold on the "up next" intro
// screen until the host proceeds.
export function enterIntro(tournament, gameId) {
  tournament.pendingGameId = gameId;
  tournament.pendingGameOptions = null; // host reconfigures per reveal (random mode)
  tournament.phase = "intro";
  tournament.wheel = null;
}

export function beginGame(tournament, gameId, playerIds) {
  tournament.currentGameId = gameId;
  tournament.currentParticipants = [...playerIds];
  tournament.pendingGameId = null;
  tournament.pendingGameOptions = null;
  tournament.phase = "playing";
  tournament.wheel = null;
}

// A game that couldn't be started (e.g. player count dropped below its
// minimum) — noted in history, no points, move on.
export function skipGame(tournament, gameId) {
  tournament.history.push({
    gameId,
    gameName: GAMES[gameId]?.name ?? gameId,
    ranks: [],
    skipped: true,
  });
  tournament.currentIndex += 1;
  tournament.currentGameId = null;
  tournament.currentParticipants = [];
}

// Record a finished game's standings into the running tournament totals.
export function recordGameResult(tournament, gameId, standings) {
  const ranks = toTournamentPoints(standings);
  for (const r of ranks) {
    tournament.standings.set(
      r.playerId,
      (tournament.standings.get(r.playerId) ?? 0) + r.points
    );
  }
  tournament.history.push({
    gameId,
    gameName: GAMES[gameId]?.name ?? gameId,
    ranks,
  });
  tournament.currentGameId = null;
  tournament.currentParticipants = [];
  tournament.phase = "between";
}

// --- Public (broadcast) view ------------------------------------------

export function getTournamentPublicState(tournament, allPlayerIds) {
  const leaderboard = allPlayerIds
    .map((pid) => ({ playerId: pid, points: tournament.standings.get(pid) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const state = {
    active: true,
    phase: tournament.phase,
    mode: tournament.mode,
    totalGames: tournament.totalGames,
    currentIndex: tournament.currentIndex,
    gamesPlayed: tournament.history.filter((h) => !h.skipped).length,
    leaderboard,
  };

  if (tournament.mode === "manual") {
    state.lineup = tournament.lineup.map((id) => ({ id, name: GAMES[id]?.name ?? id }));
  }

  if (tournament.phase === "intro" && tournament.pendingGameId) {
    state.pendingGame = {
      id: tournament.pendingGameId,
      name: GAMES[tournament.pendingGameId]?.name ?? tournament.pendingGameId,
    };
  }

  if (tournament.phase === "wheel" && tournament.wheel) {
    state.wheel = {
      pool: tournament.wheel.pool.map((id) => ({ id, name: GAMES[id]?.name ?? id })),
      landedOn: tournament.wheel.landedOn,
      landedOnName: GAMES[tournament.wheel.landedOn]?.name ?? tournament.wheel.landedOn,
      spinId: tournament.wheel.spinId,
    };
  }

  if (tournament.phase === "between" || tournament.phase === "complete") {
    state.history = tournament.history.map((h) => ({
      gameId: h.gameId,
      gameName: h.gameName,
      skipped: Boolean(h.skipped),
      ranks: h.ranks.map((r) => ({ ...r })),
    }));
  }

  if (tournament.phase === "complete") {
    const top = leaderboard.length ? leaderboard[0].points : 0;
    state.winnerIds =
      top > 0 ? leaderboard.filter((p) => p.points === top).map((p) => p.playerId) : [];
  }

  return state;
}
