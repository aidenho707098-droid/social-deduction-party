import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  createRoom,
  joinRoom,
  reconnectToRoom,
  markDisconnected,
  removePlayer,
  getRoom,
  getPlayerBySocket,
  toPublicRoom,
  startGame as startGameOnRoom,
  endGame,
  REJOIN_GRACE_MS,
} from "./rooms.js";
import { getLanIp } from "./network.js";
import { GAMES } from "./games/registry.js";
import {
  createTournament,
  stepAt,
  enterIntro,
  beginGame,
  skipGame,
  recordGameResult,
  getTournamentPublicState,
  finalStandingsOf,
  isGameOver,
  tournamentOptionsFor,
} from "./tournament.js";

const PORT = process.env.PORT || 3001;
const CLIENT_PORT = process.env.CLIENT_PORT || 5173;

const app = express();
app.use(cors());

// Simple health check — handy for confirming the server is reachable
// from a phone's browser before you even open the React app.
app.get("/health", (req, res) => res.json({ ok: true }));

// Tells the client the URL phones on the same WiFi should use to reach
// the React app — used to build the QR code correctly even if the host
// opened the app via "localhost" instead of their LAN address.
app.get("/lan-url", (req, res) => {
  const ip = getLanIp();
  res.json({ url: ip ? `http://${ip}:${CLIENT_PORT}` : null });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }, // fine for a LAN party app with no real auth yet
});

// The socket that fired an event belongs to some player in some room —
// resolve it to that stable playerId. Returns null for a socket that
// isn't a current player (stale connection, already reconnected
// elsewhere, never joined). Every game action below routes through this
// so the games only ever see stable playerIds, never socket ids.
function playerIdOf(socket) {
  return getPlayerBySocket(socket.id)?.player.id ?? null;
}

function isRoomHost(room, socket) {
  return room.hostId === playerIdOf(socket);
}

function isRoundWitch(room, socket) {
  return room.game?.witchId != null && room.game.witchId === playerIdOf(socket);
}

// The players a running game should actively wait on / advance through —
// everyone in the room who's currently connected. A player who's
// disconnected (but still inside their rejoin grace window) keeps their
// score/role/votes in the game's own state, but is left OUT of this list
// so the game doesn't stall waiting on someone whose phone is locked.
function connectedPlayerIds(room) {
  return [...room.players.values()].filter((p) => p.connected).map((p) => p.id);
}

// The PUBLIC view of a room: full player list (each tagged connected /
// disconnected) plus, if a game is running, that game's own public state,
// plus the tournament layer's state when a tournament is active.
function buildPublicRoom(room) {
  const base = { ...toPublicRoom(room), status: room.status, game: null, tournament: null };
  if (room.status === "in-game" && room.game) {
    const gameModule = GAMES[room.game.id];
    base.game = gameModule.getPublicState(room.game, connectedPlayerIds(room));
  }
  if (room.tournament?.active) {
    base.tournament = getTournamentPublicState(room.tournament, [...room.players.keys()]);
  }
  return base;
}

function broadcastRoom(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  // Tournament layer intercept: the moment the running game reaches its
  // terminal state, fold its standings into the tournament and move to the
  // "between" screen — no game-specific code, no host click needed.
  advanceTournamentIfGameOver(room);
  io.to(roomCode).emit("room_update", buildPublicRoom(room));
}

function advanceTournamentIfGameOver(room) {
  const t = room.tournament;
  if (!t?.active || t.phase !== "playing") return;
  if (room.status !== "in-game" || !room.game) return;
  const gameModule = GAMES[room.game.id];
  if (!isGameOver(gameModule, room.game)) return;
  const standings = finalStandingsOf(gameModule, room.game, t.currentParticipants);
  recordGameResult(t, room.game.id, standings); // -> t.phase = "between"
  endGame(room); // the game state is done with; its result lives in t.history now
}

// A player just dropped or was removed — give the running game (if it
// defines the optional hook) a chance to unstick itself: skip a vanished
// speaker's turn, reveal a round everyone still present has finished, etc.
function reconcileGame(room) {
  if (room?.status !== "in-game" || !room.game) return;
  const gameModule = GAMES[room.game.id];
  gameModule.reconcilePresence?.(room.game, connectedPlayerIds(room));
}

// --- Rejoin grace timers -----------------------------------------------
// When a socket drops we hold the player's seat for REJOIN_GRACE_MS. If
// they haven't reconnected by then, the player is actually removed and
// the room/game moves on. Keyed "CODE:playerId"; cleared on reconnect.
const graceTimers = new Map();

function graceKey(code, playerId) {
  return `${code}:${playerId}`;
}

function armGraceTimer(code, playerId) {
  const key = graceKey(code, playerId);
  clearTimeout(graceTimers.get(key));
  graceTimers.set(
    key,
    setTimeout(() => {
      graceTimers.delete(key);
      const room = getRoom(code);
      const player = room?.players.get(playerId);
      if (!player || player.connected) return; // gone already, or came back
      removePlayer(code, playerId);
      reconcileGame(getRoom(code));
      refreshFibbageVoteRoles(getRoom(code));
      broadcastRoom(code);
      syncEmojiTicker(getRoom(code));
      syncBlackMagicTicker(getRoom(code));
    }, REJOIN_GRACE_MS)
  );
}

function clearGraceTimer(code, playerId) {
  const key = graceKey(code, playerId);
  clearTimeout(graceTimers.get(key));
  graceTimers.delete(key);
}

// Emoji Movie Guess reveals emojis one at a time on a server clock, but
// room_update is otherwise only sent when someone acts. This 1s ticker
// keeps every device's reveal + countdown honest during a guess phase;
// it's started/stopped idempotently by syncEmojiTicker() from the emoji
// action handlers below.
const emojiTickers = new Map(); // roomCode -> intervalId

function syncEmojiTicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" &&
    room.game?.id === "emoji-movie" &&
    room.game.phase === "guess";
  const existing = emojiTickers.get(room.code);

  if (active && !existing) {
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      if (
        !current ||
        current.game?.id !== "emoji-movie" ||
        current.game.phase !== "guess"
      ) {
        clearInterval(emojiTickers.get(room.code));
        emojiTickers.delete(room.code);
        return;
      }
      broadcastRoom(room.code);
    }, 1000);
    emojiTickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    emojiTickers.delete(room.code);
  }
}

// Black Magic's round clock is owned by the server. This 1s ticker keeps
// every device's stopwatch in sync during an active round AND enforces
// the 5-minute hard limit (auto-revealing "Curse Unbroken" when it's
// reached). Started/stopped idempotently, like the emoji ticker.
const blackMagicTickers = new Map(); // roomCode -> intervalId

function syncBlackMagicTicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" &&
    room.game?.id === "black-magic" &&
    room.game.phase === "active";
  const existing = blackMagicTickers.get(room.code);

  if (active && !existing) {
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      const game = current?.game;
      if (!current || game?.id !== "black-magic" || game.phase !== "active") {
        clearInterval(blackMagicTickers.get(room.code));
        blackMagicTickers.delete(room.code);
        return;
      }
      if (Date.now() - game.roundStartedAt >= game.limitMs) {
        GAMES["black-magic"].endRound(game, "unbroken");
        clearInterval(blackMagicTickers.get(room.code));
        blackMagicTickers.delete(room.code);
      }
      broadcastRoom(room.code);
    }, 1000);
    blackMagicTickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    blackMagicTickers.delete(room.code);
  }
}

// Sends each player THEIR OWN private game data — a different payload per
// socket, addressed to that player's current live socket id. Skips anyone
// currently disconnected; they get it re-sent when they reconnect.
function sendPrivateRoles(room) {
  if (!room.game) return; // the game may have just ended (e.g. tournament advance)
  const gameModule = GAMES[room.game.id];
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit(
      "your_role",
      gameModule.getPrivateState(room.game, player.id)
    );
  }
}

function sendPrivateRoleTo(room, player) {
  if (!player.socketId || room.status !== "in-game" || !room.game) return;
  const gameModule = GAMES[room.game.id];
  io.to(player.socketId).emit(
    "your_role",
    gameModule.getPrivateState(room.game, player.id)
  );
}

// Fibbage assigns each player their own answer id only once voting starts,
// via getPrivateState(). Any code path that can flip Fibbage into "vote"
// (a submit, a host skip, a disconnect that completes the round) must
// re-push those per-player payloads.
function refreshFibbageVoteRoles(room) {
  if (room?.status === "in-game" && room.game?.id === "fibbage" && room.game.phase === "vote") {
    sendPrivateRoles(room);
  }
}

// --- Tournament Mode orchestration -----------------------------------
// tournament.js owns the pure state transitions; this wires them to
// broadcasts, per-player payloads, tickers, and the wheel's reveal timer.

const wheelTimers = new Map(); // roomCode -> timeout id

function clearWheelTimer(code) {
  const id = wheelTimers.get(code);
  if (id) clearTimeout(id);
  wheelTimers.delete(code);
}

// Actually start the next game a tournament wants to run (manual pick or a
// resolved wheel spin). Skips the game gracefully if it can no longer run.
function startTournamentGameNow(room, gameId) {
  const mod = GAMES[gameId];
  const playerIds = [...room.players.keys()];
  let game;
  try {
    game = mod.createGame(playerIds, tournamentOptionsFor(gameId, playerIds));
  } catch (err) {
    console.warn(`Tournament: skipping ${gameId} — ${err.message}`);
    skipGame(room.tournament, gameId);
    return runTournamentStep(room);
  }
  beginGame(room.tournament, gameId, playerIds);
  startGameOnRoom(room, game);
  broadcastRoom(room.code);
  sendPrivateRoles(room);
  syncEmojiTicker(room);
  syncBlackMagicTicker(room);
}

// Advance the tournament to whatever comes next for tournament.currentIndex:
// the "up next" intro (manual — game already known), a wheel spin (random,
// which then lands on its own intro), or the finale.
function runTournamentStep(room) {
  const t = room.tournament;
  if (!t?.active) return;
  const step = stepAt(t, room.players.size);
  if (step.done || step.intro) {
    broadcastRoom(room.code);
    return;
  }
  if (step.wheel) {
    broadcastRoom(room.code); // clients see the wheel + start animating
    clearWheelTimer(room.code);
    wheelTimers.set(
      room.code,
      setTimeout(() => {
        wheelTimers.delete(room.code);
        const r = getRoom(room.code);
        if (r?.tournament?.active && r.tournament.phase === "wheel") {
          enterIntro(r.tournament, r.tournament.wheel.landedOn);
          broadcastRoom(r.code);
        }
      }, 4800)
    );
    return;
  }
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("create_room", ({ name }, callback) => {
    const hostName = (name || "").trim();
    if (!hostName) return callback({ error: "Name is required." });

    const { room, playerId, token } = createRoom(socket.id, hostName);
    socket.join(room.code);
    callback({ room: buildPublicRoom(room), playerId, token });
  });

  socket.on("join_room", ({ code, name }, callback) => {
    const playerName = (name || "").trim();
    if (!playerName) return callback({ error: "Name is required." });
    if (!code) return callback({ error: "Room code is required." });

    const result = joinRoom(code, socket.id, playerName);
    if (result.error) return callback({ error: result.error });

    socket.join(result.room.code);
    callback({ room: buildPublicRoom(result.room), playerId: result.playerId, token: result.token });
    broadcastRoom(result.room.code);
  });

  // A player's browser came back (refresh, reconnect, phone unlocked) and
  // is proving — with the secret token stashed in localStorage — that it's
  // the same player as before. Re-attach this new socket to their existing
  // seat, cancel the removal countdown, and catch them up on current
  // state (public room + their private role, if a game is live).
  socket.on("resume_session", ({ code, playerId, token }, callback) => {
    const result = reconnectToRoom(code, socket.id, playerId, token);
    if (result.error) return callback?.({ error: result.error });

    const { room, player } = result;
    socket.join(room.code);
    clearGraceTimer(room.code, playerId);

    callback?.({ room: buildPublicRoom(room), playerId, token });
    broadcastRoom(room.code);
    sendPrivateRoleTo(room, player);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
  });

  socket.on("start_game", ({ code, gameId, options }, callback) => {
    const room = getRoom(code);
    if (!room) return callback?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) {
      return callback?.({ error: "Only the host can start a game." });
    }

    const gameModule = GAMES[gameId];
    if (!gameModule) return callback?.({ error: "Unknown game." });

    const playerIds = [...room.players.keys()];
    if (playerIds.length < gameModule.minPlayers) {
      return callback?.({
        error: `${gameModule.name} needs at least ${gameModule.minPlayers} players.`,
      });
    }

    let game;
    try {
      game = gameModule.createGame(playerIds, options ?? {});
    } catch (err) {
      return callback?.({ error: err.message });
    }

    startGameOnRoom(room, game);
    callback?.({ ok: true });

    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
  });

  // --- Tournament Mode actions -------------------------------------------
  // A layer above the individual games — it decides which game runs next
  // and accumulates rank-based points across them. Games are untouched.

  socket.on("tournament_configure", ({ code, mode, lineup, totalGames }, callback) => {
    const room = getRoom(code);
    if (!room) return callback?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) return callback?.({ error: "Only the host can do that." });
    if (room.status !== "lobby") return callback?.({ error: "Finish the current game first." });
    let t;
    try {
      t = createTournament({ mode, lineup, totalGames }, [...room.players.keys()]);
    } catch (err) {
      return callback?.({ error: err.message });
    }
    room.tournament = t;
    callback?.({ ok: true });
    broadcastRoom(room.code);
  });

  socket.on("tournament_start", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    if (room.tournament?.phase !== "lineup") return;
    runTournamentStep(room); // -> intro for game 1 (manual) or wheel 1 (random)
  });

  socket.on("tournament_next", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    if (room.tournament?.phase !== "between") return;
    room.tournament.currentIndex += 1;
    runTournamentStep(room);
  });

  // Fired by the host's device when the wheel animation finishes; a server
  // timer is the real backstop so progression never stalls.
  socket.on("tournament_wheel_ready", ({ code }) => {
    const room = getRoom(code);
    if (!room || !room.tournament?.active || room.tournament.phase !== "wheel") return;
    clearWheelTimer(room.code);
    enterIntro(room.tournament, room.tournament.wheel.landedOn);
    broadcastRoom(room.code);
  });

  // Host proceeds from the "up next" intro screen — now the game starts.
  socket.on("tournament_intro_start", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    if (room.tournament?.phase !== "intro" || !room.tournament.pendingGameId) return;
    startTournamentGameNow(room, room.tournament.pendingGameId);
  });

  socket.on("tournament_end", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    clearWheelTimer(room.code);
    room.tournament = null;
    endGame(room);
    broadcastRoom(room.code);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
  });

  // --- Imposter-specific actions -------------------------------------
  // These are deliberately named per-game rather than forced through one
  // generic "game_action" event — with only one game so far, that
  // indirection wouldn't buy anything. The reusable part of the framework
  // is the registry + public/private state split above; a second game
  // would add its own small set of events like these.

  socket.on("imposter_start_turns", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "imposter") return;
    GAMES.imposter.startTurns(room.game);
    broadcastRoom(room.code);
  });

  socket.on("imposter_next_turn", ({ code }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "imposter") return;
    const currentTurnPlayerId = room.game.turnOrder[room.game.currentTurnIndex];
    if (playerIdOf(socket) !== currentTurnPlayerId) return; // only the current player can advance

    GAMES.imposter.advanceTurn(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
  });

  socket.on("imposter_toggle_vote", ({ code, votedForId }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "imposter") return;
    const voterId = playerIdOf(socket);
    if (!voterId || !room.players.has(voterId)) return;

    GAMES.imposter.toggleVote(room.game, voterId, votedForId, connectedPlayerIds(room));
    broadcastRoom(room.code);
  });

  // --- Would You Rather actions -------------------------------------
  // Same idea as the imposter events above: a small per-game set of
  // socket events, routed through the registry so index.js stays
  // game-agnostic.

  socket.on("wyr_answer", ({ code, choice }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "would-you-rather") return;
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return;
    GAMES["would-you-rather"].submitAnswer(
      room.game, playerId, choice, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
  });

  socket.on("wyr_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "would-you-rather") return;
    GAMES["would-you-rather"].revealRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
  });

  socket.on("wyr_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "would-you-rather") return;
    GAMES["would-you-rather"].nextRound(room.game);
    broadcastRoom(room.code);
  });

  // --- Emoji Movie Guess actions -----------------------------------
  // `emoji_answer` acks with { correct, points } because the server owns
  // the lenient answer matching — the guesser's own device needs the
  // verdict back to show "correct / try again".

  socket.on("emoji_answer", ({ code, guess }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "emoji-movie") return cb?.({ correct: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ correct: false });
    const res = GAMES["emoji-movie"].submitAnswer(
      room.game, playerId, guess, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    syncEmojiTicker(room); // a correct guess from everyone can end the phase
    cb?.(res ?? { correct: false });
  });

  socket.on("emoji_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "emoji-movie") return;
    GAMES["emoji-movie"].revealRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    syncEmojiTicker(room);
  });

  socket.on("emoji_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "emoji-movie") return;
    GAMES["emoji-movie"].nextRound(room.game);
    broadcastRoom(room.code);
    syncEmojiTicker(room);
  });

  // --- Fibbage actions --------------------------------------------------
  // `fibbage_submit` / `fibbage_vote` ack with { ok } so the sender's own
  // device can confirm. Whose fake is whose never leaves the server until
  // `fibbage_reveal` — see fibbage.js getPublicState().

  socket.on("fibbage_submit", ({ code, text }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fibbage") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.fibbage.submitAnswer(
      room.game, playerId, text, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    refreshFibbageVoteRoles(room); // everyone submitting can start voting
    cb?.(res ?? { ok: false });
  });

  socket.on("fibbage_start_vote", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fibbage") return;
    GAMES.fibbage.startVoting(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    refreshFibbageVoteRoles(room);
  });

  socket.on("fibbage_vote", ({ code, optionId }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fibbage") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.fibbage.submitVote(
      room.game, playerId, optionId, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    cb?.(res ?? { ok: false });
  });

  socket.on("fibbage_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fibbage") return;
    GAMES.fibbage.revealRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
  });

  socket.on("fibbage_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fibbage") return;
    GAMES.fibbage.nextRound(room.game);
    broadcastRoom(room.code);
  });

  // --- Black Magic actions -------------------------------------------
  // The round clock lives on the server (syncBlackMagicTicker); these
  // handlers only ever choose a Curse, END a round, or advance it.
  // sendPrivateRoles re-pushes each Witch payload (the two options during
  // "choose", the chosen Curse during "active").

  socket.on("black_magic_pick_witch", ({ code, witchId }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "black-magic") return;
    GAMES["black-magic"].pickWitch(room.game, witchId, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // The Witch now gets their two Curse options
    syncBlackMagicTicker(room);
  });

  socket.on("black_magic_choose_curse", ({ code, pick }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "black-magic") return;
    if (!isRoundWitch(room, socket)) return; // only The Witch picks their Curse
    GAMES["black-magic"].chooseCurse(room.game, pick);
    broadcastRoom(room.code);
    sendPrivateRoles(room); // The Witch now gets the chosen Curse
    syncBlackMagicTicker(room); // the clock starts now (phase became "active")
  });

  socket.on("black_magic_award", ({ code, guesserId }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "black-magic") return;
    if (!isRoundWitch(room, socket)) return; // only The Witch judges the verbal guess
    GAMES["black-magic"].awardGuess(room.game, guesserId, connectedPlayerIds(room));
    broadcastRoom(room.code);
    syncBlackMagicTicker(room);
  });

  socket.on("black_magic_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "black-magic") return;
    // The Witch's own button — the host can also do it if The Witch is AFK.
    if (!isRoundWitch(room, socket) && !isRoomHost(room, socket)) return;
    GAMES["black-magic"].revealCurse(room.game);
    broadcastRoom(room.code);
    syncBlackMagicTicker(room);
  });

  socket.on("black_magic_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "black-magic") return;
    GAMES["black-magic"].nextRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // rotation may have just started a new round
    syncBlackMagicTicker(room);
  });

  socket.on("back_to_lobby", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    clearWheelTimer(room.code);
    room.tournament = null; // "Back to Lobby" also ends any tournament
    endGame(room);
    broadcastRoom(room.code);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const info = markDisconnected(socket.id);
    if (!info) return; // stale socket / already reconnected elsewhere

    reconcileGame(getRoom(info.code)); // don't stall the round on the player who just dropped
    refreshFibbageVoteRoles(getRoom(info.code)); // that drop may have started voting
    broadcastRoom(info.code); // others immediately see them as "disconnected"
    syncEmojiTicker(getRoom(info.code));
    syncBlackMagicTicker(getRoom(info.code)); // The Witch leaving abandons the round
    armGraceTimer(info.code, info.playerId); // remove them if they don't return in time
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
