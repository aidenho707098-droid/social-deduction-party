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
  addCustomCategory,
  publicCustomCategories,
  MAX_CUSTOM_CATEGORIES,
  REJOIN_GRACE_MS,
} from "./rooms.js";
import { getLanIp } from "./network.js";
import { AI_GENERATORS, aiContentAvailable, hostFacingAiError, generateCustomCategory } from "./aiContent.js";
import { CATEGORIES as SOUP_BANK } from "./games/alphabetSoupBank.js";
import { COMMON_LETTERS, categoryMapFor, resolveSelection } from "./games/categorySelection.js";
import { sameAnswer } from "./games/wordMatch.js";
import { GAMES } from "./games/registry.js";
import { fitError, fitsSomeMode } from "./games/playerLimits.js";
import { pumpValidation as pumpSoupValidation } from "./alphabetSoupRuntime.js";
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
  replacePendingGame,
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
  "who-am-i": "customThemes",
};

// Basic per-room throttle for host-triggered AI calls (custom content and
// custom categories): one call in flight at a time, and at most
// AI_CALLS_PER_MINUTE in any rolling minute. Returns an error line, or null
// and marks the room busy — pair every null with aiCallDone(room).
const AI_CALLS_PER_MINUTE = 6;
function aiCallStart(room) {
  const now = Date.now();
  room.aiCalls = (room.aiCalls ?? []).filter((t) => now - t < 60_000);
  if (room.aiBusy) return "Still working on the last one — give it a moment.";
  if (room.aiCalls.length >= AI_CALLS_PER_MINUTE) {
    return "That's a lot of requests — wait a minute and try again.";
  }
  room.aiCalls.push(now);
  room.aiBusy = true;
  return null;
}
function aiCallDone(room) {
  room.aiBusy = false;
}

// Extra createGame() options carrying this room's AI custom content for
// `gameId` (or {} for a game with no AI content). Used by every code path
// that starts a game — the standalone start and both tournament paths.
function aiCreateGameExtras(gameId, room) {
  // Alphabet Soup + Hot Potato read the room's shared custom categories.
  if (gameId === "alphabet-soup" || gameId === "hot-potato") {
    return { customCategories: room.customCategories ?? [] };
  }
  const key = AI_CREATEGAME_KEY[gameId];
  return key ? { [key]: aiContentFor(room, gameId) } : {};
}

// Alphabet Soup needs letter data for every custom category it's about to
// use. One created from Hot Potato has none yet: fetch it now (one small
// call each, in parallel), or fall back to the 20 common letters, marked
// unverified. Stored on the room record, so it's fetched at most once.
async function ensureSoupLetters(room, selectedKeys) {
  const keys = Array.isArray(selectedKeys) ? selectedKeys : [];
  const missing = (room.customCategories ?? []).filter((c) => keys.includes(c.key) && !Array.isArray(c.letters));
  await Promise.all(
    missing.map(async (c) => {
      try {
        const res = await generateCustomCategory(c.name, { wantLetters: true });
        // [] = checked, and no letter has 5+ answers: unusable in Alphabet
        // Soup (the start is refused below), rather than faked with the
        // common letters ("Planets" + W).
        c.letters = res.letters ?? [];
      } catch (err) {
        console.warn(`[custom-category] letters for "${c.name}" failed (${err.code ?? "?"}): ${err.message}`);
        c.letters = [...COMMON_LETTERS];
        c.unverified = true;
      }
    }),
  );
  if (missing.length) broadcastRoom(room.code);
  // Selected custom categories that turned out to have no usable letters.
  return (room.customCategories ?? [])
    .filter((c) => keys.includes(c.key) && Array.isArray(c.letters) && c.letters.length === 0)
    .map((c) => c.name);
}

// A typed name that's really an existing category (bank or custom), by the
// same fuzzy rule answers use ("Animal" = "Animals", "Fast Food Chain" =
// "Fast Food Chains"). Returns its key, or null.
function existingCategoryKey(room, name) {
  const all = [...SOUP_BANK.map((c) => ({ key: c.key, name: c.name })), ...(room.customCategories ?? [])];
  return all.find((c) => sameAnswer(c.name, name))?.key ?? null;
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
    // Alphabet Soup + Hot Potato custom categories (no letter data).
    customCategories: publicCustomCategories(room),
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
    const pending = base.tournament.pendingGame;
    if (pending && GAMES[pending.id]) {
      const opts = tournamentGameOptions(room, pending.id, [...room.players.keys()]);
      pending.fitError = fitError(GAMES[pending.id], room.players.size, opts);
      // Everyone (non-hosts included) sees the up-next game's categories,
      // read-only, as the same summary the host's selector shows.
      if (pending.id === "alphabet-soup" || pending.id === "hot-potato") {
        const map = categoryMapFor(room.customCategories, { game: pending.id });
        const keys = resolveSelection(opts.categories, map);
        pending.categories = { keys, names: keys.slice(0, 3).map((k) => map[k]?.name ?? k) };
      }
    }
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
//
// `final` distinguishes WHY presence changed, for games that care:
//   * false — a raw socket "disconnect" just fired. Could be a refresh or a
//     WiFi blip; the player still holds their seat for REJOIN_GRACE_MS (see
//     armGraceTimer below) and may reconnect any moment.
//   * true  — the player is actually, permanently gone: the rejoin grace
//     expired, or the host kicked them. This is finalizePlayerRemoval's call,
//     always right after removePlayer().
// Most games don't look at this (a vanished speaker's turn should skip
// right away either way) and keep working exactly as before. A game whose
// round can't survive losing ONE specific player at all (Black Magic's
// Witch) uses it to wait out the same grace window everyone else gets
// instead of ending the round the instant a socket blips.
function reconcileGame(room, { final = true } = {}) {
  if (room?.status !== "in-game" || !room.game) return;
  const gameModule = GAMES[room.game.id];
  // `roomPlayerIds` = everyone still in the room, connected or not, so a
  // game can tell the player who just LEFT from one still inside their
  // rejoin grace (Echo Chain reads it; other games ignore it).
  gameModule.reconcilePresence?.(room.game, connectedPlayerIds(room), { final, roomPlayerIds: [...room.players.keys()] });
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
  reconcileGame(getRoom(code), { final: true });
  refreshFibbageVoteRoles(getRoom(code));
  broadcastRoom(code);
  // A permanent departure can change what a game's PRIVATE payload looks
  // like even though nobody acted (Who Am I? purges the removed player's
  // identity out of everyone else's redacted list in reconcilePresence) —
  // most games' private state is static per role-per-round and just
  // resends unchanged, which is harmless.
  sendPrivateRoles(getRoom(code));
  syncEmojiTicker(getRoom(code));
  syncBlackMagicTicker(getRoom(code));
  syncTabooTicker(getRoom(code));
  syncFakeArtistTicker(getRoom(code));
  syncWhoAmITicker(getRoom(code));
  syncAlphabetSoupTicker(getRoom(code));
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

// Who Am I?'s clock is server-owned and switches meaning (a 30s question
// window vs. a 20s guess window) without ever changing `phase` — both live
// on the same "turns" phase, so this ticker just defers to the game's own
// tick() to decide whether the active player's clock has actually run out.
// Idempotent, like the others.
const whoAmITickers = new Map(); // roomCode -> intervalId

function syncWhoAmITicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" && room.game?.id === "who-am-i" && room.game.phase === "turns";
  const existing = whoAmITickers.get(room.code);

  if (active && !existing) {
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      const game = current?.game;
      if (!current || game?.id !== "who-am-i" || game.phase !== "turns") {
        clearInterval(whoAmITickers.get(room.code));
        whoAmITickers.delete(room.code);
        return;
      }
      const changed = GAMES["who-am-i"].tick(game, connectedPlayerIds(current));
      if (changed) sendPrivateRoles(current);
      broadcastRoom(room.code);
      syncWhoAmITicker(current);
    }, 1000);
    whoAmITickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    whoAmITickers.delete(room.code);
  }
}

// Alphabet Soup runs several short server clocks — the letter-reveal intro
// (the answer clock must not start until it ends), the 40s typed window,
// the wait for background validation, the dispute votes, and Spoken mode's
// 10s→4s turns and 5s challenge / vote windows. Those windows are short
// enough that a 1s tick would visibly lag a transition, so this ticker
// checks every 250ms but only broadcasts when something changed or once a
// second for the countdowns. Each beat also pumps any queued answer
// validations (a round-end retry is queued by a phase change, not a
// socket event). Idempotent, like the others.
const alphabetSoupTickers = new Map(); // roomCode -> intervalId
const ALPHABET_SOUP_TICK_MS = 250;
const ALPHABET_SOUP_LIVE_PHASES = new Set(["intro", "answer", "checking", "review", "turns"]);

function soupRuntimeDeps() {
  return {
    getRoom,
    onVerdict: (room, playerId) => {
      const player = room.players.get(playerId);
      if (player) sendPrivateRoleTo(room, player);
    },
  };
}

function syncAlphabetSoupTicker(room) {
  if (!room) return;
  const active =
    room.status === "in-game" &&
    room.game?.id === "alphabet-soup" &&
    ALPHABET_SOUP_LIVE_PHASES.has(room.game.phase);
  const existing = alphabetSoupTickers.get(room.code);

  if (active && !existing) {
    let lastBroadcast = 0;
    const timerId = setInterval(() => {
      const current = getRoom(room.code);
      const game = current?.game;
      if (
        !current ||
        game?.id !== "alphabet-soup" ||
        !ALPHABET_SOUP_LIVE_PHASES.has(game.phase)
      ) {
        clearInterval(alphabetSoupTickers.get(room.code));
        alphabetSoupTickers.delete(room.code);
        return;
      }
      try {
        const changed = GAMES["alphabet-soup"].tick(game, connectedPlayerIds(current));
        pumpSoupValidation(current, soupRuntimeDeps());
        const now = Date.now();
        if (changed || now - lastBroadcast >= 1000) {
          lastBroadcast = now;
          broadcastRoom(room.code);
          if (changed) sendPrivateRoles(current);
        }
      } catch (err) {
        console.warn(`[alphabet-soup] tick error for ${room.code}:`, err);
      }
      syncAlphabetSoupTicker(current);
    }, ALPHABET_SOUP_TICK_MS);
    alphabetSoupTickers.set(room.code, timerId);
  } else if (!active && existing) {
    clearInterval(existing);
    alphabetSoupTickers.delete(room.code);
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

// Settings the host chose for THIS game in the tournament flow: manual mode
// set them per lineup slot at build time; random mode (and a replacement
// game) sets them on the "up next" screen right before starting. Either way
// they win over the room's last-used settings and the game's tournament
// defaults.
function tournamentHostOptions(t) {
  return (t.mode === "manual" ? t.lineupSettings?.[t.currentIndex] : t.pendingGameOptions) ?? {};
}

function tournamentGameOptions(room, gameId, playerIds) {
  return {
    ...tournamentOptionsFor(gameId, playerIds),
    ...(room.gameSettings?.[gameId] ?? {}),
    ...tournamentHostOptions(room.tournament),
  };
}

// Actually start the next game a tournament wants to run (manual pick or a
// resolved wheel spin). Skips the game gracefully if it can no longer run.
function startTournamentGameNow(room, gameId) {
  const mod = GAMES[gameId];
  const t = room.tournament;
  const playerIds = [...room.players.keys()];

  const hostOptions = tournamentHostOptions(t);
  const hasHostOptions = Object.keys(hostOptions).length > 0;

  let game;
  try {
    game = mod.createGame(playerIds, {
      ...tournamentGameOptions(room, gameId, playerIds),
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
  syncWhoAmITicker(room);
  syncAlphabetSoupTicker(room);
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
    syncWhoAmITicker(room);
    syncAlphabetSoupTicker(room);
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

  socket.on("start_game", async ({ code, gameId, options }, callback) => {
    const room = getRoom(code);
    if (!room) return callback?.({ error: "Room not found." });
    if (!isRoomHost(room, socket)) {
      return callback?.({ error: "Only the host can start a game." });
    }

    const gameModule = GAMES[gameId];
    if (!gameModule) return callback?.({ error: "Unknown game." });

    const playerIds = [...room.players.keys()];
    const notFit = fitError(gameModule, playerIds.length, options ?? {});
    if (notFit) return callback?.({ error: notFit });
    // Custom categories made in Hot Potato get their letter data now.
    if (gameId === "alphabet-soup") {
      const statusBefore = room.status;
      const unusable = await ensureSoupLetters(room, options?.categories);
      if (room.status !== statusBefore || getRoom(code) !== room) return callback?.({ error: "The room changed — try again." });
      if (unusable.length) {
        return callback?.({ error: `${unusable.join(", ")} is too narrow for Alphabet Soup (no letter has 5+ answers). Deselect it to start.` });
      }
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
    syncWhoAmITicker(room);
    syncAlphabetSoupTicker(room);
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
  socket.on("tournament_intro_start", async ({ code, options }, cb) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return cb?.({ error: "Only the host can do that." });
    const t = room.tournament;
    if (t?.phase !== "intro" || !t.pendingGameId) return cb?.({ error: "Nothing to start." });
    if (options && typeof options === "object") {
      if (t.mode === "random") t.pendingGameOptions = options;
      else if (t.pendingReplaced) t.lineupSettings[t.currentIndex] = options;
    }
    // Players may have left since the lineup was built / the wheel spun.
    const playerIds = [...room.players.keys()];
    const err = fitError(GAMES[t.pendingGameId], playerIds.length, tournamentGameOptions(room, t.pendingGameId, playerIds));
    if (err) {
      broadcastRoom(room.code);
      return cb?.({ error: err });
    }
    if (t.pendingGameId === "alphabet-soup") {
      const gameId = t.pendingGameId;
      const unusable = await ensureSoupLetters(room, tournamentGameOptions(room, gameId, playerIds).categories);
      if (room.tournament !== t || t.phase !== "intro" || t.pendingGameId !== gameId) return cb?.({ error: "The tournament moved on." });
      if (unusable.length) {
        return cb?.({ error: `${unusable.join(", ")} is too narrow for Alphabet Soup (no letter has 5+ answers). Change this game's categories.` });
      }
    }
    startTournamentGameNow(room, t.pendingGameId);
    cb?.({ ok: true });
  });

  // The "up next" game doesn't fit the room any more — the host skips it
  // (recorded as skipped, no points) ...
  socket.on("tournament_skip", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return cb?.({ error: "Only the host can do that." });
    const t = room.tournament;
    if (t?.phase !== "intro" || !t.pendingGameId) return cb?.({ error: "Nothing to skip." });
    skipGame(t, t.pendingGameId);
    runTournamentStep(room);
    cb?.({ ok: true });
  });

  // ... or swaps in a game that fits the current player count.
  socket.on("tournament_replace", ({ code, gameId }, cb) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket)) return cb?.({ error: "Only the host can do that." });
    const t = room.tournament;
    if (t?.phase !== "intro" || !t.pendingGameId) return cb?.({ error: "Nothing to replace." });
    const mod = GAMES[gameId];
    if (!mod) return cb?.({ error: "Unknown game." });
    if (!fitsSomeMode(mod, room.players.size)) {
      return cb?.({ error: fitError(mod, room.players.size) ?? "That game doesn't fit." });
    }
    replacePendingGame(t, gameId);
    broadcastRoom(room.code);
    cb?.({ ok: true });
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
    syncAlphabetSoupTicker(room);
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

    // Per-game cap (e.g. 5 Who Am I? themes), checked before spending a call.
    const existing = aiContentFor(room, gameId);
    if (spec.maxPerRoom && existing.length >= spec.maxPerRoom &&
        !existing.some((c) => c.name.toLowerCase() === raw.toLowerCase())) {
      return cb?.({ error: `This room already has the maximum of ${spec.maxPerRoom} custom sets for this game.` });
    }
    const busy = aiCallStart(room);
    if (busy) return cb?.({ error: busy });

    let result;
    try {
      result = await spec.generate(raw);
    } catch (err) {
      console.warn(
        `[ai-content] room ${code} ${gameId} — "${raw}" failed (${err.code ?? "?"}): ${err.message}`,
      );
      return cb?.({ error: hostFacingAiError(err, spec.fallbackNoun) });
    } finally {
      aiCallDone(room);
    }

    const added = addAiContent(room, gameId, result, spec.maxPerRoom ? { max: spec.maxPerRoom } : undefined);
    if (added.error) return cb?.({ error: added.error });

    // Broadcast first so the host's setup screen already has the new option
    // in room.aiContent by the time the ack callback (which selects it) runs.
    broadcastRoom(room.code);
    cb?.({ ok: true, name: result.name });
  });

  // --- Custom categories (Alphabet Soup + Hot Potato) -------------------
  // The shared selector's "Create category". One small AI call vets and
  // describes the name ({ ok, name, tags, broad, letters? }); letters are
  // only asked for when it's created from Alphabet Soup. Acks:
  //   { ok, key }                         created (or an existing match)
  //   { error, kind: "invalid" }          bad input / cap / throttle
  //   { error, kind: "rejected" }         the AI judged it unusable — edit + retry
  //   { error, kind: "failed" }           AI unreachable — retry, or Add anyway
  // `force: true` is "Add anyway": no AI call; the 20 common letters, marked
  // unverified, counted as broad.
  socket.on("category_create", async ({ code, gameId, name, force }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Room not found.", kind: "invalid" });
    if (!isRoomHost(room, socket)) return cb?.({ error: "Only the host can add categories.", kind: "invalid" });
    if (gameId !== "alphabet-soup" && gameId !== "hot-potato") {
      return cb?.({ error: "That game doesn't use custom categories.", kind: "invalid" });
    }
    const raw = String(name ?? "").replace(/\s+/g, " ").trim();
    if (raw.length < 2) return cb?.({ error: "Type a category name first.", kind: "invalid" });
    if (raw.length > 40) return cb?.({ error: "Keep it to 40 characters.", kind: "invalid" });

    const dupe = existingCategoryKey(room, raw);
    if (dupe) return cb?.({ ok: true, key: dupe, existing: true });
    if ((room.customCategories ?? []).length >= MAX_CUSTOM_CATEGORIES) {
      return cb?.({ error: `This room already has the maximum of ${MAX_CUSTOM_CATEGORIES} custom categories.`, kind: "invalid" });
    }

    let record;
    if (force === true) {
      record = { name: raw, tags: [], broad: true, letters: [...COMMON_LETTERS], unverified: true };
    } else {
      const busy = aiCallStart(room);
      if (busy) return cb?.({ error: busy, kind: "invalid" });
      try {
        const res = await generateCustomCategory(raw, { wantLetters: gameId === "alphabet-soup" });
        if (gameId === "alphabet-soup" && !res.letters?.length) {
          return cb?.({ error: "Too narrow for Alphabet Soup — no letter has at least 5 answers. Try something broader.", kind: "rejected" });
        }
        record = { name: res.name, tags: res.tags, broad: res.broad, letters: res.letters, unverified: false };
      } catch (err) {
        console.warn(`[custom-category] room ${code} "${raw}" failed (${err.code ?? "?"}): ${err.message}`);
        if (err.code === "rejected") return cb?.({ error: err.hostMessage, kind: "rejected" });
        return cb?.({ error: hostFacingAiError(err, "Add anyway"), kind: "failed" });
      } finally {
        aiCallDone(room);
      }
      // The cleaned name may itself match something that already exists.
      const cleanedDupe = existingCategoryKey(room, record.name);
      if (cleanedDupe) return cb?.({ ok: true, key: cleanedDupe, existing: true });
    }

    const added = addCustomCategory(room, { ...record, createdIn: gameId });
    if (added.error) return cb?.({ error: added.error, kind: "invalid" });
    broadcastRoom(room.code); // the selector already lists it when the ack selects it
    cb?.({ ok: true, key: added.category.key, broad: added.category.broad !== false });
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

  socket.on("black_magic_give_up", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "black-magic") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["black-magic"].giveUp(room.game, playerId, connectedPlayerIds(room));
    if (res?.ok) {
      broadcastRoom(room.code);
      syncBlackMagicTicker(room); // everyone giving up ends the round
    }
    cb?.(res ?? { ok: false });
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

  socket.on("taboo_give_up", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "taboo") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES.taboo.giveUp(room.game, playerId, connectedPlayerIds(room));
    if (res?.ok) {
      broadcastRoom(room.code);
      syncTabooTicker(room); // everyone giving up/solving can end the phase
    }
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
    return;
  });

  // --- Who Am I? actions -------------------------------------------
  // The active player's own actions (ask / startGuess / guess) all route
  // through here; everything else (who's active, the clock) is public
  // state nobody needs a special event for. `who_am_i_guess` acks with the
  // verdict so the guesser's own device can show the reveal animation
  // immediately, without waiting on the next room_update.

  socket.on("who_am_i_ask", ({ code, answer }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "who-am-i") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["who-am-i"].askQuestion(room.game, playerId, answer, connectedPlayerIds(room));
    broadcastRoom(room.code);
    syncWhoAmITicker(room);
    cb?.(res ?? { ok: false });
  });

  socket.on("who_am_i_start_guess", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "who-am-i") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["who-am-i"].startGuess(room.game, playerId);
    if (res?.ok) {
      broadcastRoom(room.code);
      syncWhoAmITicker(room);
    }
    cb?.(res ?? { ok: false });
  });

  socket.on("who_am_i_guess", ({ code, guess }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "who-am-i") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["who-am-i"].submitGuess(
      room.game, playerId, guess, connectedPlayerIds(room)
    );
    broadcastRoom(room.code);
    sendPrivateRoles(room); // a correct guess just unlocked the guesser's own identity
    syncWhoAmITicker(room);
    cb?.(res ?? { ok: false });
  });

  socket.on("who_am_i_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "who-am-i") return;
    GAMES["who-am-i"].nextRound(room.game, connectedPlayerIds(room));
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the new round's identities are dealt
    syncWhoAmITicker(room);
  });

  // --- Alphabet Soup actions -------------------------------------------
  // Typed: `alphabet_soup_submit` locks ONE answer in and acks straight
  // back with it (or a short reason it bounced) so the input clears
  // instantly; the background category check then runs without blocking
  // the next answer, and its verdict reaches only the author (private
  // state). Nobody else sees answer text until the round closes.
  // Spoken: turn actions carry the server's `turnSeq` so a tap that raced
  // the buzzer can never act on the NEXT player's turn.

  function soupContext(socket, code) {
    const room = getRoom(code);
    if (!room || room.game?.id !== "alphabet-soup") return null;
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return null;
    return { room, playerId, present: connectedPlayerIds(room) };
  }

  function afterSoupAction(room, { privateFor = null, everyone = false } = {}) {
    broadcastRoom(room.code);
    if (everyone) sendPrivateRoles(room);
    else if (privateFor) {
      const player = room.players.get(privateFor);
      if (player) sendPrivateRoleTo(room, player);
    }
    syncAlphabetSoupTicker(room);
  }

  socket.on("alphabet_soup_submit", ({ code, text }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const { room, playerId, present } = ctx;
    const phaseBefore = room.game.phase;
    const res = GAMES["alphabet-soup"].submitAnswer(room.game, playerId, text, present);
    cb?.(res);
    if (!res.ok) return;
    pumpSoupValidation(room, soupRuntimeDeps());
    afterSoupAction(room, { privateFor: playerId, everyone: room.game.phase !== phaseBefore });
  });

  socket.on("alphabet_soup_done", ({ code }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const { room, playerId, present } = ctx;
    const phaseBefore = room.game.phase;
    const res = GAMES["alphabet-soup"].markDone(room.game, playerId, present);
    cb?.(res);
    if (res.ok) afterSoupAction(room, { privateFor: playerId, everyone: room.game.phase !== phaseBefore });
  });

  socket.on("alphabet_soup_dispute", ({ code, answerId }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].openDispute(ctx.room.game, ctx.playerId, answerId, ctx.present);
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  socket.on("alphabet_soup_dispute_vote", ({ code, disputeId, overturn }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].voteDispute(
      ctx.room.game, ctx.playerId, disputeId, overturn === true, ctx.present
    );
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  socket.on("alphabet_soup_settle", ({ code }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].settleReview(ctx.room.game, ctx.playerId, ctx.present);
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  socket.on("alphabet_soup_said_it", ({ code, turnSeq }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].saidIt(ctx.room.game, ctx.playerId, turnSeq, ctx.present);
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  // Targets the most recent answer: `answerSeq` is that answer's turnSeq
  // (public lastAnswer.seq), so a stale tap can't hit a newer answer.
  socket.on("alphabet_soup_challenge", ({ code, answerSeq }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].challenge(ctx.room.game, ctx.playerId, answerSeq, ctx.present);
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  socket.on("alphabet_soup_challenge_vote", ({ code, turnSeq, uphold }, cb) => {
    const ctx = soupContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["alphabet-soup"].voteChallenge(
      ctx.room.game, ctx.playerId, turnSeq, uphold === true, ctx.present
    );
    cb?.(res);
    if (res.ok) afterSoupAction(ctx.room, { everyone: true });
  });

  socket.on("alphabet_soup_next_round", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "alphabet-soup") return;
    GAMES["alphabet-soup"].nextRound(room.game, connectedPlayerIds(room));
    afterSoupAction(room, { everyone: true });
  });

  // --- Hot Potato actions -----------------------------------------------
  // Every turn action carries the server's `turnId` (Pass) or the pass's
  // `passSeq` (Challenge), so a tap that raced a turn change can never act
  // on the NEXT turn. Clocks run in the hot-potato sweep below.

  function potatoContext(socket, code) {
    const room = getRoom(code);
    if (!room || room.game?.id !== "hot-potato") return null;
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return null;
    return { room, playerId, present: connectedPlayerIds(room) };
  }

  function afterPotatoAction(room) {
    broadcastRoom(room.code);
    sendPrivateRoles(room); // the holder's private turn cap / everyone's vote
  }

  socket.on("hot_potato_pass", ({ code, turnId }, cb) => {
    const ctx = potatoContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["hot-potato"].pass(ctx.room.game, ctx.playerId, turnId, ctx.present);
    cb?.(res);
    if (res.ok) afterPotatoAction(ctx.room);
  });

  socket.on("hot_potato_challenge", ({ code, passSeq }, cb) => {
    const ctx = potatoContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["hot-potato"].challenge(ctx.room.game, ctx.playerId, passSeq, ctx.present);
    cb?.(res);
    if (res.ok) afterPotatoAction(ctx.room);
  });

  socket.on("hot_potato_vote", ({ code, valid }, cb) => {
    const ctx = potatoContext(socket, code);
    if (!ctx) return cb?.({ ok: false });
    const res = GAMES["hot-potato"].vote(ctx.room.game, ctx.playerId, valid === true, ctx.present);
    cb?.(res);
    if (res.ok) afterPotatoAction(ctx.room);
  });

  socket.on("hot_potato_next_match", ({ code }) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "hot-potato") return;
    const res = GAMES["hot-potato"].nextMatch(room.game, connectedPlayerIds(room));
    if (res.ok) afterPotatoAction(room);
  });

  // --- Memory Imposter actions -----------------------------------------
  // Every clock runs in the memory-imposter sweep below; the only player
  // action is the vote, and the host can skip the discussion or start the
  // next round early. Private state is re-pushed after every change: it is
  // how roles are dealt (and the Imposter's sequence taken away) once the
  // look is over.

  socket.on("memory_vote", ({ code, targetId }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "memory-imposter") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["memory-imposter"].submitVote(room.game, playerId, targetId, connectedPlayerIds(room));
    cb?.(res);
    if (res.ok) {
      broadcastRoom(room.code);
      sendPrivateRoles(room);
    }
  });

  // Host: skip the discussion to the vote / next round from the reveal.
  socket.on("memory_host", ({ code, action }, cb) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "memory-imposter") return cb?.({ ok: false });
    const mod = GAMES["memory-imposter"];
    const res =
      action === "skip"
        ? mod.skipDiscussion(room.game)
        : action === "next"
          ? mod.nextRound(room.game, connectedPlayerIds(room))
          : { ok: false };
    cb?.(res);
    if (res.ok) {
      broadcastRoom(room.code);
      sendPrivateRoles(room);
    }
  });

  // --- Echo Chain actions -----------------------------------------------
  // The chain stays on the server; every tap is validated there in order.
  // A valid tap goes out to the whole room as its own one-off event (so
  // every phone lights it up live, with its note) — taps are never kept in
  // the room state. Clocks run in the echo-chain sweep below.

  socket.on("echo_chain_tap", ({ code, tile, turnId }, cb) => {
    const room = getRoom(code);
    if (!room || room.game?.id !== "echo-chain") return cb?.({ ok: false });
    const playerId = playerIdOf(socket);
    if (!playerId || !room.players.has(playerId)) return cb?.({ ok: false });
    const res = GAMES["echo-chain"].tap(room.game, playerId, tile, connectedPlayerIds(room), { turnId });
    cb?.({ ok: res.ok, correct: res.correct, added: res.added, reason: res.reason, message: res.message });
    if (!res.ok) return;
    io.to(room.code).emit("echo_chain_tap", res.tap);
    broadcastRoom(room.code);
  });

  // Host: end the game here — everyone still alive shares the top place.
  socket.on("echo_chain_end", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room || !isRoomHost(room, socket) || room.game?.id !== "echo-chain") return cb?.({ ok: false });
    const res = GAMES["echo-chain"].endEarly(room.game);
    cb?.(res);
    if (res.ok) broadcastRoom(room.code);
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
    syncWhoAmITicker(room);
    syncAlphabetSoupTicker(room);
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
    syncWhoAmITicker(room);
    syncAlphabetSoupTicker(room);
    callback?.({ ok: true });
  });

  // END GAME EARLY reuses "back_to_lobby" above — same effect: abandon the
  // running mini-game (and any tournament) and drop everyone back to the
  // lobby. No separate handler needed.

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const info = markDisconnected(socket.id);
    if (!info) return; // stale socket / already reconnected elsewhere

    reconcileGame(getRoom(info.code), { final: false }); // don't stall the round on the player who just dropped — but don't end anything final on a mere blip either
    refreshFibbageVoteRoles(getRoom(info.code)); // that drop may have started voting
    broadcastRoom(info.code); // others immediately see them as "disconnected"
    syncEmojiTicker(getRoom(info.code));
    syncBlackMagicTicker(getRoom(info.code)); // The Witch leaving abandons the round
    syncTabooTicker(getRoom(info.code));
    syncFakeArtistTicker(getRoom(info.code));
    syncWhoAmITicker(getRoom(info.code));
    syncAlphabetSoupTicker(getRoom(info.code));
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
  for (const map of [emojiTickers, blackMagicTickers, tabooTickers, fakeArtistTickers, alphabetSoupTickers]) {
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

// --- Hot Potato: turn windows, fuses, votes, intro + explosion beats --
// Sprint windows get down to 2s and a Pass has 300ms of grace, so this
// sweep runs every 100ms (a 1s tick would visibly lag every explosion). It
// broadcasts the moment something changes, plus once a second so the
// countdowns stay honest. Self-managed like the sweeps above: no per-
// handler start/stop wiring, and a no-op for any other game.
const HOT_POTATO_TICK_MS = 100;
const hotPotatoLastBroadcast = new Map(); // roomCode -> ms
const hotPotatoTimer = setInterval(() => {
  const now = Date.now();
  for (const room of allRooms()) {
    const game = room.game;
    if (room.status !== "in-game" || game?.id !== "hot-potato" || game.phase === "final") {
      hotPotatoLastBroadcast.delete(room.code);
      continue;
    }
    try {
      const changed = GAMES["hot-potato"].tick(game, connectedPlayerIds(room), now);
      if (changed || now - (hotPotatoLastBroadcast.get(room.code) ?? 0) >= 1000) {
        hotPotatoLastBroadcast.set(room.code, now);
        broadcastRoom(room.code);
        sendPrivateRoles(room);
      }
    } catch (err) {
      console.warn(`[hot-potato] tick error for ${room.code}:`, err);
    }
  }
}, HOT_POTATO_TICK_MS);
hotPotatoTimer.unref?.();

// --- Echo Chain: turn timers, miss beat, replay ---------------------------
// Taps are 4–5s apart at most and carry 500ms of grace, so a 100ms beat
// (like Hot Potato) keeps a timeout from visibly overrunning. Broadcasts
// the moment something changes, plus once a second for the timer ring.
const ECHO_TICK_MS = 100;
const echoLastBroadcast = new Map(); // roomCode -> ms
const echoTimer = setInterval(() => {
  const now = Date.now();
  for (const room of allRooms()) {
    const game = room.game;
    if (room.status !== "in-game" || game?.id !== "echo-chain" || game.phase === "final") {
      echoLastBroadcast.delete(room.code);
      continue;
    }
    try {
      const changed = GAMES["echo-chain"].tick(game, connectedPlayerIds(room), now);
      if (changed || now - (echoLastBroadcast.get(room.code) ?? 0) >= 1000) {
        echoLastBroadcast.set(room.code, now);
        broadcastRoom(room.code);
      }
    } catch (err) {
      console.warn(`[echo-chain] tick error for ${room.code}:`, err);
    }
  }
}, ECHO_TICK_MS);
echoTimer.unref?.();

// --- Memory Imposter: every phase clock ---------------------------------
// Memorize, role reveal, discussion, vote and reveal all run here. A 200ms
// beat keeps the look from overrunning visibly; it broadcasts (and re-pushes
// private state — the look opening and the role deal are private-state
// changes) the moment something changes, plus once a second for the
// countdowns.
const MEMORY_TICK_MS = 200;
const memoryLastBroadcast = new Map(); // roomCode -> ms
const memoryTimer = setInterval(() => {
  const now = Date.now();
  for (const room of allRooms()) {
    const game = room.game;
    if (room.status !== "in-game" || game?.id !== "memory-imposter" || game.phase === "final") {
      memoryLastBroadcast.delete(room.code);
      continue;
    }
    try {
      const changed = GAMES["memory-imposter"].tick(game, connectedPlayerIds(room), now);
      if (changed || now - (memoryLastBroadcast.get(room.code) ?? 0) >= 1000) {
        memoryLastBroadcast.set(room.code, now);
        broadcastRoom(room.code);
        if (changed) sendPrivateRoles(room);
      }
    } catch (err) {
      console.warn(`[memory-imposter] tick error for ${room.code}:`, err);
    }
  }
}, MEMORY_TICK_MS);
memoryTimer.unref?.();

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
