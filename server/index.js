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
  setPlayerColor,
  allRooms,
  deleteRoom,
  startGame as startGameOnRoom,
  endGame,
  addAiContent,
  aiContentFor,
  REJOIN_GRACE_MS,
} from "./rooms.js";
import { getLanIp } from "./network.js";
import { AI_GENERATORS, aiContentAvailable, hostFacingAiError } from "./aiContent.js";
import { GAMES } from "./games/registry.js";
import {
  chaosTick,
  chaosPublicSlice,
  chaosPatchGameState,
  setChaosFrequency,
  recordWager,
  recordDisableTarget,
  clearChaos,
} from "./chaosRuntime.js";
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
  // Fake Artist relays a composited canvas PNG per turn — a hand drawing is
  // small, but give it plenty of headroom over the 1MB default.
  maxHttpBufferSize: 4e6,
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

// Which createGame() option each game reads its AI custom batches from.
// The game module resolves the host's actual selection out of this list.
const AI_CREATEGAME_KEY = {
  imposter: "customCategories",
  "emoji-movie": "customThemes",
  fibbage: "customTopics",
  taboo: "customCategories",
  "fake-artist": "customThemes",
};

// Extra createGame() options carrying this room's AI custom content for
// `gameId` (or {} for a game with no AI content). Used by every code path
// that starts a game — the standalone start and both tournament paths.
function aiCreateGameExtras(gameId, room) {
  const key = AI_CREATEGAME_KEY[gameId];
  return key ? { [key]: aiContentFor(room, gameId) } : {};
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
  const base = {
    ...toPublicRoom(room),
    status: room.status,
    game: null,
    tournament: null,
    // Last host-configured options per game this session, so the setup
    // screen can pre-fill instead of resetting to defaults on replay.
    gameSettings: room.gameSettings ?? {},
    // AI custom content: per game, the NAMES the host has generated this
    // session (the batches themselves stay server-side — clients only need
    // to show/select names). Plus whether the server can generate more at
    // all, so the client hides the option when there's no API key.
    aiContent: Object.fromEntries(
      Object.entries(room.aiContent ?? {}).map(([gid, list]) => [
        gid,
        list.map((c) => c.name),
      ]),
    ),
    aiContentEnabled: aiContentAvailable(),
    // Chaos Events layer: the host's frequency dial + any live event.
    chaos: chaosPublicSlice(room),
  };
  if (room.status === "in-game" && room.game) {
    const gameModule = GAMES[room.game.id];
    base.game = gameModule.getPublicState(room.game, connectedPlayerIds(room));
    chaosPatchGameState(room, base.game);
  }
  if (room.tournament?.active) {
    base.tournament = getTournamentPublicState(room.tournament, [...room.players.keys()]);
  }
  return base;
}

function broadcastRoom(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  // Every meaningful room mutation funnels through here, so this is the
  // one place the abandoned-room sweep needs to read for "last activity".
  room.lastActivityAt = Date.now();
  // Chaos Events layer intercept: roll at each new scoring round, resolve
  // round-end modifiers once the game has scored, keep Speed Round's clock
  // pinned. Runs before the tournament check so a chaos-rewritten score is
  // what gets folded into tournament standings.
  chaosTick(room, { connectedPlayerIds });
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
      finalizePlayerRemoval(code, playerId);
    }, REJOIN_GRACE_MS)
  );
}

function clearGraceTimer(code, playerId) {
  const key = graceKey(code, playerId);
  clearTimeout(graceTimers.get(key));
  graceTimers.delete(key);
}

// Actually drop a player from the room and let the running game (if any)
// move on without them — the shared end state for BOTH a rejoin grace that
// expired and a host kick. Their score stays on the board (it lives in the
// game's own state, keyed to playerId); the game just stops waiting on
// them. Rejoining later comes in fresh via join_room -> the lobby.
function finalizePlayerRemoval(code, playerId) {
  clearGraceTimer(code, playerId);
  removePlayer(code, playerId);
  reconcileGame(getRoom(code));
  refreshFibbageVoteRoles(getRoom(code));
  broadcastRoom(code);
  syncEmojiTicker(getRoom(code));
  syncBlackMagicTicker(getRoom(code));
  syncTabooTicker(getRoom(code));
  syncFakeArtistTicker(getRoom(code));
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

// Taboo's round clock is server-owned and DYNAMIC — every guesser's first
// answer shaves 30s off the deadline (done inside submitGuess). This 1s
// ticker keeps every device's countdown honest during a guess phase and
// auto-reveals once the (shrinking) deadline passes. Idempotent, like the
// others.
const tabooTickers = new Map(); // roomCode -> intervalId

function syncTabooTicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" &&
    room.game?.id === "taboo" &&
    room.game.phase === "guess";
  const existing = tabooTickers.get(room.code);

  if (active && !existing) {
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      const game = current?.game;
      if (!current || game?.id !== "taboo" || game.phase !== "guess") {
        clearInterval(tabooTickers.get(room.code));
        tabooTickers.delete(room.code);
        return;
      }
      if (game.deadline && Date.now() > game.deadline + 1500) {
        GAMES.taboo.revealRound(game, connectedPlayerIds(current));
        clearInterval(tabooTickers.get(room.code));
        tabooTickers.delete(room.code);
      }
      broadcastRoom(room.code);
    }, 1000);
    tabooTickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    tabooTickers.delete(room.code);
  }
}

// Fake Artist owns three server clocks: the per-turn drawing timer, the
// voting timer, and the Fake Artist's word-guess window. This 1s ticker
// keeps every device's countdown honest and auto-advances when a clock
// runs out (a turn ends, voting closes, the guess is skipped).
const fakeArtistTickers = new Map(); // roomCode -> intervalId
const FAKE_ARTIST_TICK_PHASES = new Set(["draw", "vote", "reveal"]);

function syncFakeArtistTicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" &&
    room.game?.id === "fake-artist" &&
    FAKE_ARTIST_TICK_PHASES.has(room.game.phase);
  const existing = fakeArtistTickers.get(room.code);

  if (active && !existing) {
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      const game = current?.game;
      if (
        !current ||
        game?.id !== "fake-artist" ||
        !FAKE_ARTIST_TICK_PHASES.has(game.phase)
      ) {
        clearInterval(fakeArtistTickers.get(room.code));
        fakeArtistTickers.delete(room.code);
        return;
      }
      const present = connectedPlayerIds(current);
      const mod = GAMES["fake-artist"];
      const changed =
        mod.tickTurn(game, present) ||
        mod.tickVote(game, present) ||
        mod.tickGuess(game);
      if (changed) sendPrivateRoles(current);
      broadcastRoom(room.code);
      syncFakeArtistTicker(current);
    }, 1000);
    fakeArtistTickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    fakeArtistTickers.delete(room.code);
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

// Session-scoped "already used this content" memory, per room, per game.
// Each game's createGame() draws its rounds skipping keys it's seen before
// and hands back the updated list on `game.deckMemory`; we stash that on
// the room so the NEXT game of the same kind (Play Again, or another
// Tournament round) continues through the bank instead of reshuffling from
// the top. Lives as long as the room does; cleared only on server restart.
function recordDeckMemory(room, gameId, game) {
  if (!game?.deckMemory) return;
  room.itemMemory = room.itemMemory ?? {};
  room.itemMemory[gameId] = game.deckMemory;
}

// Actually start the next game a tournament wants to run (manual pick or a
// resolved wheel spin). Skips the game gracefully if it can no longer run.
function startTournamentGameNow(room, gameId) {
  const mod = GAMES[gameId];
  const t = room.tournament;
  const playerIds = [...room.players.keys()];

  // Settings the host chose for THIS game in the tournament flow: manual mode
  // set them per lineup slot at build time; random mode sets them on the
  // "up next" screen right before starting. Either way they win over the
  // room's last-used settings and the game's tournament defaults.
  const hostOptions =
    (t.mode === "manual" ? t.lineupSettings?.[t.currentIndex] : t.pendingGameOptions) ?? {};
  const hasHostOptions = Object.keys(hostOptions).length > 0;

  let game;
  try {
    game = mod.createGame(playerIds, {
      ...tournamentOptionsFor(gameId, playerIds),
      ...(room.gameSettings?.[gameId] ?? {}),
      ...hostOptions,
      memory: room.itemMemory?.[gameId],
      // So a tournament round can resolve an AI custom category / theme /
      // topic the host picked in the lineup / "up next" config (same as
      // the standalone start_game path below).
      ...aiCreateGameExtras(gameId, room),
    });
  } catch (err) {
    console.warn(`Tournament: skipping ${gameId} — ${err.message}`);
    skipGame(room.tournament, gameId);
    return runTournamentStep(room);
  }
  // Remember the host's choice as the room's new last-used for this game.
  if (hasHostOptions) {
    room.gameSettings = room.gameSettings ?? {};
    room.gameSettings[gameId] = { ...hostOptions };
  }
  recordDeckMemory(room, gameId, game);
  beginGame(room.tournament, gameId, playerIds);
  clearChaos(room); // each game starts with a clean chaos slate
  startGameOnRoom(room, game);
  broadcastRoom(room.code);
  sendPrivateRoles(room);
  syncEmojiTicker(room);
  syncBlackMagicTicker(room);
  syncTabooTicker(room);
  syncFakeArtistTicker(room);
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
    syncTabooTicker(room);
    syncFakeArtistTicker(room);
  });

  // Lobby-only: a player changes their colour identity. The server checks
  // the room is idle and the colour is free, then broadcasts so every
  // device updates the dot everywhere that player is shown.
  socket.on("set_player_color", ({ code, color }, callback) => {
    const playerId = playerIdOf(socket);
    if (!playerId) return callback?.({ error: "You're not in this room." });
    const result = setPlayerColor(code, playerId, color);
    if (result.error) return callback?.({ error: result.error });
    callback?.({ ok: true });
    broadcastRoom(code);
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
      game = gameModule.createGame(playerIds, {
        ...(options ?? {}),
        memory: room.itemMemory?.[gameId],
        // The game reads this to resolve an AI custom category / theme /
        // topic the host picked; {} for games with no AI content.
        ...aiCreateGameExtras(gameId, room),
      });
    } catch (err) {
      return callback?.({ error: err.message });
    }
    recordDeckMemory(room, gameId, game);
    // Remember exactly what the host configured, keyed to this game, for
    // the life of the room — the next setup screen for it pre-fills these.
    room.gameSettings = room.gameSettings ?? {};
    room.gameSettings[gameId] = options ?? {};

    clearChaos(room); // fresh chaos slate for the new game
    startGameOnRoom(room, game);
    callback?.({ ok: true });

    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
    syncTabooTicker(room);
    syncFakeArtistTicker(room);
  });

  // --- Chaos Events layer ----------------------------------------------
  // Host dial (OFF / LOW / MEDIUM / HIGH), persisted on the room; plus the
  // two interactive modifiers' player inputs (Risk It opt-in, Player
  // Disable target pick).

  socket.on("chaos_set_frequency", ({ code, frequency }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) return cb?.({ error: "Only the host can do that." });
    const res = setChaosFrequency(room, frequency);
    if (res.error) return cb?.(res);
    broadcastRoom(room.code);
    cb?.(res);
  });

  socket.on("chaos_wager", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Room not found." });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Not in this room." });
    const res = recordWager(room, playerId);
    if (res.ok) broadcastRoom(room.code);
    cb?.(res);
  });

  socket.on("chaos_disable_target", ({ code, targetId }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Room not found." });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Not in this room." });
    const res = recordDisableTarget(room, playerId, targetId);
    if (res.ok) broadcastRoom(room.code);
    cb?.(res);
  });

  // --- Tournament Mode actions -------------------------------------------
  // A layer above the individual games — it decides which game runs next
  // and accumulates rank-based points across them. Games are untouched.

  socket.on("tournament_configure", ({ code, mode, lineup, lineupSettings, totalGames }, callback) => {
    const room = getRoom(code);
    if (!room) return callback?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) return callback?.({ error: "Only the host can do that." });
    if (room.status !== "lobby") return callback?.({ error: "Finish the current game first." });
    let t;
    try {
      t = createTournament({ mode, lineup, lineupSettings, totalGames }, [...room.players.keys()]);
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
  // In random mode the host may pass `options` configured on that screen for
  // the just-revealed game; manual mode's settings were fixed at lineup time.
  socket.on("tournament_intro_start", ({ code, options }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    const t = room.tournament;
    if (t?.phase !== "intro" || !t.pendingGameId) return;
    if (t.mode === "random" && options && typeof options === "object") {
      t.pendingGameOptions = options;
    }
    startTournamentGameNow(room, t.pendingGameId);
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
    syncTabooTicker(room);
    syncFakeArtistTicker(room);
  });

  // --- AI custom content ------------------------------------------------
  // ONE event for every game's "Custom Category / Theme / Topic" option on
  // its setup screen. Calls OpenAI (see aiContent.js) to fill a batch, then
  // stashes it on the ROOM so it's a normal, re-selectable option for the
  // rest of the session — no second API call. This is the only game action
  // that does async I/O; it acks through the callback with { ok, name } or
  // a plain-language { error } the setup screen shows inline (retry, or
  // fall back to built-in content). Nothing here can wedge a game.
  socket.on("ai_generate_content", async ({ code, gameId, name }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) {
      return cb?.({ error: "Only the host can add custom content." });
    }
    const spec = AI_GENERATORS[gameId];
    if (!spec) return cb?.({ error: "That game doesn't support custom content." });

    const raw = (name ?? "").trim();
    if (raw.length < 2 || raw.length > 40) {
      return cb?.({ error: "Give it a name (2–40 characters)." });
    }
    // Don't shadow a built-in category/theme name; a same-name re-generate
    // of an existing custom batch is fine (addAiContent replaces it).
    const reserved = GAMES[gameId]?.AI_CONTENT_RESERVED ?? [];
    if (reserved.some((n) => n.toLowerCase() === raw.toLowerCase())) {
      return cb?.({ error: `"${raw}" is already a built-in option.` });
    }

    let result;
    try {
      result = await spec.generate(raw);
    } catch (err) {
      console.warn(
        `[ai-content] room ${code} ${gameId} — "${raw}" failed (${err.code ?? "?"}): ${err.message}`,
      );
      return cb?.({ error: hostFacingAiError(err, spec.fallbackNoun) });
    }

    const added = addAiContent(room, gameId, result);
    if (added.error) return cb?.({ error: added.error });

    // Broadcast first so the host's setup screen already has the new option
    // in room.aiContent by the time the ack callback (which selects it) runs.
    broadcastRoom(room.code);
    cb?.({ ok: true, name: result.name });
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

  // --- Majority Pick actions (game id "would-you-rather") -----------
  // Same idea as the imposter events above: a small per-game set of
  // socket events, routed through the registry so index.js stays
  // game-agnostic. `wyr_submit_prompt` / `wyr_force_generate` only apply
  // to Custom Mode's "collect" phase.

  socket.on("wyr_submit_prompt", ({ code, slotId, text }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "would-you-rather") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["would-you-rather"].submitPrompt(
      room.game, playerId, text, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    sendPrivateRoles(room); // push each player their next prompt / "done"
    cb?.(res ?? { ok: false });
  });

  socket.on("wyr_force_generate", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "would-you-rather") return;
    GAMES["would-you-rather"].forceAdvance(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room);
  });

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
  // `fibbage_truth_*` only apply to Personal Mode's "truth" phase.

  socket.on("fibbage_truth_choose", ({ code, slotIndex, choiceIndex }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fibbage") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.fibbage.chooseTruthPrompt(room.game, playerId, slotIndex, choiceIndex);
    broadcastRoom(room.code);
    sendPrivateRoles(room); // push this player their now-chosen prompt + 45s clock
    cb?.(res ?? { ok: false });
  });

  socket.on("fibbage_truth_submit", ({ code, text }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fibbage") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.fibbage.submitTruthAnswer(
      room.game, playerId, text, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    sendPrivateRoles(room); // next prompt / "done" for this player
    refreshFibbageVoteRoles(room); // that submission may have started the fib phase
    cb?.(res ?? { ok: false });
  });

  socket.on("fibbage_truth_force", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fibbage") return;
    GAMES.fibbage.forceAdvance(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    refreshFibbageVoteRoles(room);
  });

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

  // --- Wavelength actions ---------------------------------------------
  // All clue-writing happens up front, in parallel (the "write" phase):
  // `wavelength_submit_clue` is one Clue-Giver submitting their current
  // queued clue. It acks with { ok } or a { reason, term } so their device
  // can show why a phrase bounced and let them retry. The secret target
  // never leaves the server except to that writer via their private role
  // (see wavelength.js getPrivateState).

  socket.on("wavelength_submit_clue", ({ code, clue }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "wavelength") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.wavelength.submitClue(
      room.game, playerId, clue, connectedPlayerIds(room)
    );
    broadcastRoom(room.code); // progress ticks up; guessing may now open
    sendPrivateRoles(room); // push each writer their next clue / "done"
    cb?.(res ?? { ok: false });
  });

  socket.on("wavelength_guess", ({ code, guess }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "wavelength") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.wavelength.submitGuess(
      room.game, playerId, guess, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    cb?.(res ?? { ok: false });
  });

  // Host "Skip to guessing now" (during write) / "Reveal now" (during a
  // guess round) — both routed through forceAdvance.
  socket.on("wavelength_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "wavelength") return;
    GAMES.wavelength.forceAdvance(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the round's Clue-Giver gets their target
  });

  socket.on("wavelength_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "wavelength") return;
    GAMES.wavelength.nextRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the new Clue-Giver gets their scale + target
  });

  // --- Taboo actions -------------------------------------------------
  // The round clock is server-owned and DYNAMIC (syncTabooTicker). Only
  // the round's Describer ever holds the secret word (see taboo.js
  // getPrivateState). `taboo_guess` acks with the verdict + placing so the
  // guesser's device can show "locked in — 2nd!" or "try again".

  socket.on("taboo_start_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "taboo") return;
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return;
    const res = GAMES.taboo.startRound(room.game, playerId, {
      asHost: isRoomHost(room, socket),
    });
    if (!res?.ok) return;
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncTabooTicker(room);
  });

  socket.on("taboo_guess", ({ code, guess }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "taboo") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.taboo.submitGuess(
      room.game, playerId, guess, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    syncTabooTicker(room); // everyone solving early can end the phase
    cb?.(res ?? { ok: false });
  });

  socket.on("taboo_reveal", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "taboo") return;
    GAMES.taboo.revealRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncTabooTicker(room);
  });

  socket.on("taboo_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "taboo") return;
    GAMES.taboo.nextRound(room.game);
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the next Describer gets their word
    syncTabooTicker(room);
  });

  // --- Fake Artist actions -------------------------------------------
  // Turn-based canvas snapshots: `fake_artist_submit` carries the whole
  // composited PNG data URL for the current drawer's finished turn; the
  // server just stores + relays it (no server-side image work). Only the
  // round's Fake Artist ever holds a role that isn't the secret word.

  socket.on("fake_artist_start", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fake-artist") return;
    GAMES["fake-artist"].startDrawing(room.game);
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncFakeArtistTicker(room);
  });

  socket.on("fake_artist_submit", ({ code, image }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fake-artist") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["fake-artist"].submitDrawing(
      room.game, playerId, image, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    sendPrivateRoles(room); // phase may have flipped to gallery
    syncFakeArtistTicker(room);
    cb?.(res ?? { ok: false });
  });

  socket.on("fake_artist_start_vote", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fake-artist") return;
    GAMES["fake-artist"].startVoting(room.game);
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncFakeArtistTicker(room);
  });

  socket.on("fake_artist_vote", ({ code, targetId }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fake-artist") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["fake-artist"].submitVote(
      room.game, playerId, targetId, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    sendPrivateRoles(room); // everyone voting can flip to reveal
    syncFakeArtistTicker(room);
    cb?.(res ?? { ok: false });
  });

  socket.on("fake_artist_guess", ({ code, text }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "fake-artist") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["fake-artist"].submitImposterGuess(room.game, playerId, text);
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncFakeArtistTicker(room);
    cb?.(res ?? { ok: false });
  });

  socket.on("fake_artist_skip_guess", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fake-artist") return;
    GAMES["fake-artist"].skipImposterGuess(room.game);
    broadcastRoom(room.code);
    sendPrivateRoles(room);
    syncFakeArtistTicker(room);
  });

  socket.on("fake_artist_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "fake-artist") return;
    GAMES["fake-artist"].nextRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the next round's Fake Artist gets their category
    syncFakeArtistTicker(room);
  });

  socket.on("back_to_lobby", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return;
    clearWheelTimer(room.code);
    room.tournament = null; // "Back to Lobby" also ends any tournament
    endGame(room);
    clearChaos(room); // drop any live chaos event / carried Player Disable
    broadcastRoom(room.code);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
    syncTabooTicker(room);
    syncFakeArtistTicker(room);
  });

  // --- Host session-management controls ---------------------------------
  // All host-only; the client only shows the panel to the host, and every
  // handler re-checks isRoomHost so a crafted event from a non-host does
  // nothing.

  // KICK: a TEMPORARY removal. The player is told why, their socket is
  // closed, and their seat is freed via the exact same path as a rejoin
  // grace that expired (finalizePlayerRemoval). They can rejoin the room
  // with the normal code afterwards — landing in the lobby, like any new
  // joiner, never mid-game.
  socket.on("kick_player", ({ code, playerId }, callback) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) {
      return callback?.({ error: "Only the host can remove players." });
    }
    if (playerId === room.hostId) {
      return callback?.({ error: "You can't remove yourself." });
    }
    const target = room.players.get(playerId);
    if (!target) return callback?.({ error: "That player isn't in the room." });

    if (target.socketId) {
      io.to(target.socketId).emit("kicked", { reason: "host" });
      const sock = io.sockets.sockets.get(target.socketId);
      if (sock) setTimeout(() => sock.disconnect(true), 250); // let the emit flush
    }
    finalizePlayerRemoval(code, playerId);
    callback?.({ ok: true });
  });

  // FORCE PROCEED: push the current phase forward as if every player who
  // hasn't acted this round had no input (auto-forfeit for THIS round
  // only). Routed through each game's optional forceAdvance() hook so the
  // per-game "what does 'proceed' mean here" logic lives with the game,
  // not here.
  socket.on("host_force_advance", ({ code }, callback) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) {
      return callback?.({ error: "Only the host can do that." });
    }
    if (room.status !== "in-game" || !room.game) {
      return callback?.({ error: "No game is running." });
    }
    const gameModule = GAMES[room.game.id];
    gameModule.forceAdvance?.(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code); // also folds a now-finished game into a tournament
    sendPrivateRoles(room);
    refreshFibbageVoteRoles(room);
    syncEmojiTicker(room);
    syncBlackMagicTicker(room);
    syncTabooTicker(room);
    syncFakeArtistTicker(room);
    callback?.({ ok: true });
  });

  // END GAME EARLY reuses "back_to_lobby" above — same effect: abandon the
  // running mini-game (and any tournament) and drop everyone back to the
  // lobby. No separate handler needed.

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const info = markDisconnected(socket.id);
    if (!info) return; // stale socket / already reconnected elsewhere

    reconcileGame(getRoom(info.code)); // don't stall the round on the player who just dropped
    refreshFibbageVoteRoles(getRoom(info.code)); // that drop may have started voting
    broadcastRoom(info.code); // others immediately see them as "disconnected"
    syncEmojiTicker(getRoom(info.code));
    syncBlackMagicTicker(getRoom(info.code)); // The Witch leaving abandons the round
    syncTabooTicker(getRoom(info.code));
    syncFakeArtistTicker(getRoom(info.code));
    armGraceTimer(info.code, info.playerId); // remove them if they don't return in time
  });
});

// --- Abandoned-room cleanup -----------------------------------------
// Room + game state lives only in memory, so without this a room everyone
// walked away from would sit in the `rooms` map until the process
// restarts. A lightweight timer sweeps every few minutes and drops rooms
// in one of two states:
//
//   * EMPTY — zero connected players for EMPTY_ROOM_TTL_MS (~25 min).
//     That window is far longer than the per-player reconnect grace
//     (REJOIN_GRACE_MS, 60s), so a refresh or a flaky-WiFi blip is never
//     caught by this: a player who comes back within their grace is still
//     in room.players and, once reconnected, keeps lastConnectedAt fresh.
//   * INACTIVE — still has a connected socket, but nothing has changed in
//     the room for INACTIVE_ROOM_TTL_MS (~5 h). Every join, game action
//     and tournament step runs through broadcastRoom(), which stamps
//     lastActivityAt, so this only trips for a genuinely idle tab left
//     open (e.g. overnight).
//
// The sweep only READS timestamps and the per-player `connected` flags —
// it never touches game state — so it can't race with or interrupt a
// game in progress.
const CLEANUP_SWEEP_MS = Number(process.env.CLEANUP_SWEEP_MS) || 3 * 60_000;
const EMPTY_ROOM_TTL_MS =
  Number(process.env.EMPTY_ROOM_TTL_MS) || 25 * 60_000;
const INACTIVE_ROOM_TTL_MS =
  Number(process.env.INACTIVE_ROOM_TTL_MS) || 5 * 60 * 60_000;

function cleanupRoom(code, category, detail) {
  const room = getRoom(code);
  if (!room) return;

  // A connected socket in an INACTIVE room gets a clean "it's gone" signal
  // rather than a silently frozen screen. Nobody is in an EMPTY room to
  // receive this, but emitting to an empty channel is harmless.
  io.to(code).emit("room_closed", { reason: category });

  clearWheelTimer(code);
  for (const map of [emojiTickers, blackMagicTickers, tabooTickers, fakeArtistTickers]) {
    const timerId = map.get(code);
    if (timerId) clearInterval(timerId);
    map.delete(code);
  }
  for (const playerId of room.players.keys()) clearGraceTimer(code, playerId);

  deleteRoom(code);
  console.log(`[room-cleanup] removed ${code} — ${category} (${detail})`);
}

function sweepAbandonedRooms() {
  const now = Date.now();
  for (const room of allRooms()) {
    try {
      const occupied = [...room.players.values()].some((p) => p.connected);
      // While anyone's connected, keep the "empty since" clock reset.
      if (occupied) room.lastConnectedAt = now;

      const emptyForMs = now - (room.lastConnectedAt ?? room.createdAt);
      const idleForMs = now - (room.lastActivityAt ?? room.createdAt);

      if (!occupied && emptyForMs >= EMPTY_ROOM_TTL_MS) {
        cleanupRoom(room.code, "empty", `${Math.round(emptyForMs / 60_000)}m empty`);
      } else if (idleForMs >= INACTIVE_ROOM_TTL_MS) {
        cleanupRoom(
          room.code,
          "inactive",
          `${Math.round(idleForMs / 60_000)}m idle, ${occupied ? "still connected" : "empty"}`
        );
      }
    } catch (err) {
      console.warn(`[room-cleanup] sweep error for ${room.code}:`, err);
    }
  }
}

const cleanupTimer = setInterval(sweepAbandonedRooms, CLEANUP_SWEEP_MS);
cleanupTimer.unref?.(); // a maintenance timer shouldn't hold the process open

// --- Majority Pick: Custom Mode collect-phase clock ----------------
// Each player has their own ~45s countdown for the prompt they're
// currently writing. A single self-managed sweep (like the room cleanup
// above) auto-skips anyone whose clock has run out and starts the answer
// phase once everyone's queue is done — no per-handler wiring, and it
// can't touch a game that isn't in the "collect" phase.
const mpCollectTimer = setInterval(() => {
  for (const room of allRooms()) {
    const game = room.game;
    if (
      room.status !== "in-game" ||
      game?.id !== "would-you-rather" ||
      game.phase !== "collect"
    ) {
      continue;
    }
    try {
      const changed = GAMES["would-you-rather"].tickCollect(
        game,
        connectedPlayerIds(room)
      );
      if (changed) {
        broadcastRoom(room.code);
        sendPrivateRoles(room);
      }
    } catch (err) {
      console.warn(`[majority-pick] collect tick error for ${room.code}:`, err);
    }
  }
}, 1000);
mpCollectTimer.unref?.();

// --- Fact or Fake: Personal Mode "truth"-phase clock --------------
// Each player has their own ~25s to pick a prompt then ~45s to answer it.
// A self-managed sweep auto-picks / auto-skips anyone whose clock ran out
// and starts the fib phase once everyone's answers are in. No-op for any
// game not in the "truth" phase.
const fibbageTruthTimer = setInterval(() => {
  for (const room of allRooms()) {
    const game = room.game;
    if (room.status !== "in-game" || game?.id !== "fibbage" || game.phase !== "truth") {
      continue;
    }
    try {
      const changed = GAMES.fibbage.tickTruth(game, connectedPlayerIds(room));
      if (changed) {
        broadcastRoom(room.code);
        sendPrivateRoles(room);
        refreshFibbageVoteRoles(room);
      }
    } catch (err) {
      console.warn(`[fibbage] truth tick error for ${room.code}:`, err);
    }
  }
}, 1000);
fibbageTruthTimer.unref?.();

// --- Wavelength: parallel clue-writing phase clock ---------------
// Every Clue-Giver writes all their clues up front, each with a private
// 60s-per-clue countdown. A self-managed sweep auto-skips anyone whose
// clock ran out and starts the guess rounds once every clue is in. No-op
// for any game not in the "write" phase.
const wavelengthWriteTimer = setInterval(() => {
  for (const room of allRooms()) {
    const game = room.game;
    if (
      room.status !== "in-game" ||
      game?.id !== "wavelength" ||
      game.phase !== "write"
    ) {
      continue;
    }
    try {
      const changed = GAMES.wavelength.tickWrite(game, connectedPlayerIds(room));
      if (changed) {
        broadcastRoom(room.code);
        sendPrivateRoles(room);
      }
    } catch (err) {
      console.warn(`[wavelength] write tick error for ${room.code}:`, err);
    }
  }
}, 1000);
wavelengthWriteTimer.unref?.();

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
