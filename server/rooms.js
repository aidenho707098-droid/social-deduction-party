// In-memory room store. No database yet — this all lives in RAM and
// resets whenever the server restarts. That's fine for Phase 1.
//
// Because there's no persistence, a room that everyone walks away from
// would otherwise sit in `rooms` forever. Two things keep that in check:
// the short empty-room timer below (fires once every player has been
// formally removed), and a periodic "abandoned room" sweep in
// server/index.js that uses the `lastActivityAt` / `lastConnectedAt`
// stamps on each room as a longer-horizon backstop.
//
// --- Player identity & reconnects ------------------------------------
// A player is NOT their socket. A refresh, a locked phone, or a blip of
// flaky WiFi all kill the socket and hand the browser a brand-new one on
// reconnect. So each player gets two ids the moment they first
// create/join a room:
//
//   * playerId — a stable, room-scoped id. Everything downstream (scores,
//     roles, turn order, votes, the host pointer) is keyed to THIS, never
//     to a socket id. It's fine for other players to see it (it's in the
//     public player list).
//   * token — a secret, sent only to that one player's own device and
//     never broadcast. On reconnect the browser sends {playerId, token}
//     back; we re-attach the new socket to the existing player only if the
//     token matches. Without the secret, knowing someone's public
//     playerId isn't enough to impersonate them.
//
// The browser stashes {code, playerId, token} in localStorage, so it can
// prove "I'm the same player" across reloads and reconnects.

import { randomUUID } from "node:crypto";
import { assignPlayerColor, isValidColorId, hexOf } from "./playerColors.js";

const rooms = new Map(); // roomCode -> Room

// Reverse index so a disconnect (which only gives us a socket id) can find
// the player it belongs to in O(1) instead of scanning every room.
const socketIndex = new Map(); // socketId -> { code, playerId }

// Characters chosen to avoid visual mix-ups on a phone screen
// (no 0/O, no 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

// How long a disconnected player's seat is held open. Reconnect within
// this window and you land back in the same room + game with your score,
// role, and place in the turn order intact. Miss it and you're removed
// and the game moves on without you. Overridable via env for testing.
export const REJOIN_GRACE_MS = Number(process.env.REJOIN_GRACE_MS) || 60_000;

// Once a room has NObody left in it (everyone was removed, not just
// disconnected), keep the shell around this long before deleting — covers
// the very last player refreshing an otherwise-empty room.
const EMPTY_ROOM_GRACE_MS = 20_000;

function generateRoomCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function makePlayer(name, socketId, color) {
  return {
    id: randomUUID(), // stable playerId
    token: randomUUID(), // secret, never broadcast
    name,
    color, // a player-colour id (see playerColors.js); unique within a room
    socketId, // current live socket, or null while disconnected
    connected: true,
    disconnectedAt: null,
  };
}

// The colour ids currently worn by players in this room — so a new joiner
// (or a lobby colour change) can avoid collisions.
function usedColors(room, exceptPlayerId) {
  return [...room.players.values()]
    .filter((p) => p.id !== exceptPlayerId)
    .map((p) => p.color);
}

function bindSocket(socketId, code, playerId) {
  socketIndex.set(socketId, { code, playerId });
}

export function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const host = makePlayer(hostName, hostSocketId, assignPlayerColor([]));
  const now = Date.now();
  const room = {
    code,
    hostId: host.id, // a playerId now, not a socket id
    players: new Map([[host.id, host]]), // playerId -> player
    createdAt: now,
    // Bumped by broadcastRoom() on every meaningful state change (join,
    // game action, tournament step, …) and refreshed by the abandoned-room
    // sweep while at least one player is connected. Both feed that sweep.
    lastActivityAt: now,
    lastConnectedAt: now,
    status: "lobby", // "lobby" | "in-game"
    game: null,
    tournament: null, // set by the tournament layer (see server/tournament.js)
    itemMemory: {}, // gameId -> { seen: string[] }; session no-repeat memory
    gameSettings: {}, // gameId -> last host-configured options this session
    // AI-generated custom content, per game: gameId -> [{ name, ...batch }].
    // Host-typed names the server filled in via the OpenAI API (Imposter
    // categories, Crack the Code themes, Fact or Fake topics, Taboo
    // categories, Fake Artist themes). Lives only here, for the room's
    // lifetime — selectable like built-in content for the rest of the
    // session, gone when the room is cleaned up. No DB.
    aiContent: {},
    chaosFrequency: "off", // app-wide Chaos Events dial; persists for the room
    chaos: null, // current round's chaos record (see chaosRuntime.js)
    chaosCarry: null, // Player Disable effect owed to a future round
  };
  rooms.set(code, room);
  bindSocket(hostSocketId, code, host.id);
  return { room, playerId: host.id, token: host.token };
}

export function startGame(room, game) {
  room.status = "in-game";
  room.game = game;
}

export function endGame(room) {
  room.status = "lobby";
  room.game = null;
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase());
}

// A snapshot of every live room. Used by the abandoned-room sweep; it's a
// copy, so the sweep can delete rooms while iterating.
export function allRooms() {
  return [...rooms.values()];
}

// Hard-delete a room and drop every reverse-index entry keyed to it. Used
// only by the abandoned-room sweep (a normal emptied room goes away via
// the empty-room timer armed in removePlayer). Returns the removed room,
// or null if the code was already gone.
export function deleteRoom(code) {
  const room = rooms.get(code?.toUpperCase());
  if (!room) return null;
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  for (const player of room.players.values()) {
    if (player.socketId) socketIndex.delete(player.socketId);
  }
  rooms.delete(room.code);
  return room;
}

export function getPlayerBySocket(socketId) {
  const entry = socketIndex.get(socketId);
  if (!entry) return null;
  const room = getRoom(entry.code);
  const player = room?.players.get(entry.playerId);
  if (!player) return null;
  return { room, player };
}

export function joinRoom(code, socketId, name) {
  const room = getRoom(code);
  if (!room) return { error: "Room not found. Check the code and try again." };

  // A brand-new player still can't drop into a game that's already
  // running — turn order and roles were dealt when it started. (Returning
  // players come back through reconnectToRoom(), not here.)
  if (room.status === "in-game") {
    return { error: "This room already started a game. Wait for it to return to the lobby." };
  }

  const nameTaken = [...room.players.values()].some(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (nameTaken) return { error: "That name is already taken in this room." };

  // Someone rejoined during the empty-room window — the shell survived,
  // and since they're the only one here, they take the host seat.
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }

  const player = makePlayer(name, socketId, assignPlayerColor(usedColors(room)));
  room.players.set(player.id, player);
  if (room.players.size === 1) room.hostId = player.id;
  bindSocket(socketId, code, player.id);
  return { room, playerId: player.id, token: player.token };
}

// A returning player: same playerId, same secret token, brand-new socket.
// Re-attach the socket to the existing seat — score, role, turn position,
// and (if they were the host) the host seat are all still theirs.
export function reconnectToRoom(code, socketId, playerId, token) {
  const room = getRoom(code);
  if (!room) return { error: "That room is no longer available." };

  const player = room.players.get(playerId);
  if (!player) {
    return { error: "Your seat in this game has expired. Rejoin from the start." };
  }
  if (player.token !== token) {
    return { error: "Could not verify your session. Rejoin from the start." };
  }

  if (player.socketId && player.socketId !== socketId) {
    socketIndex.delete(player.socketId);
  }
  player.socketId = socketId;
  player.connected = true;
  player.disconnectedAt = null;
  bindSocket(socketId, code, playerId);

  return { room, player };
}

// A socket dropped. DON'T remove the player — just mark the seat empty and
// hand back which player/room it was so the caller can start the grace
// countdown. Returns null if this socket wasn't a current player (e.g. a
// stale socket disconnecting after the player already reconnected on a
// new one).
export function markDisconnected(socketId) {
  const entry = socketIndex.get(socketId);
  socketIndex.delete(socketId);
  if (!entry) return null;

  const room = getRoom(entry.code);
  const player = room?.players.get(entry.playerId);
  if (!room || !player) return null;

  // Guard: only the player's CURRENT socket can mark them away.
  if (player.socketId && player.socketId !== socketId) return null;

  player.connected = false;
  player.socketId = null;
  player.disconnectedAt = Date.now();
  return { code: room.code, playerId: entry.playerId };
}

// The grace period expired without a reconnect — actually remove the
// player. Reassigns the host seat (preferring someone still connected) and
// arms the empty-room timer if that was the last one. Returns the room
// (for a final broadcast) or null if there was nothing to do.
export function removePlayer(code, playerId) {
  const room = getRoom(code);
  const player = room?.players.get(playerId);
  if (!room || !player) return null;

  room.players.delete(playerId);
  if (player.socketId) socketIndex.delete(player.socketId);

  if (room.players.size === 0) {
    room.emptyTimer = setTimeout(() => {
      if (room.players.size === 0) rooms.delete(room.code);
    }, EMPTY_ROOM_GRACE_MS);
    return room;
  }

  if (room.hostId === playerId) {
    const nextHost =
      [...room.players.values()].find((p) => p.connected) ??
      room.players.values().next().value;
    room.hostId = nextHost.id;
  }
  return room;
}

// Lobby-only: a player re-picks their colour identity. Rejected once a
// game or tournament is under way — a colour is locked in for the duration
// and only changeable back in a plain lobby. The target colour must be
// free (not worn by anyone else in the room).
export function setPlayerColor(code, playerId, colorId) {
  const room = getRoom(code);
  if (!room) return { error: "Room not found." };
  if (room.status !== "lobby" || room.tournament?.active) {
    return { error: "Colours are locked once a game starts." };
  }
  const player = room.players.get(playerId);
  if (!player) return { error: "You're not in this room." };
  if (!isValidColorId(colorId)) return { error: "Unknown colour." };
  if (player.color === colorId) return { room }; // no-op

  if (usedColors(room, playerId).includes(colorId)) {
    return { error: "Someone already has that colour." };
  }
  player.color = colorId;
  return { room };
}

// Add (or replace, if the host re-generates the same name) an AI-built
// content batch for `gameId` on the room. `batch` is { name, ...payload }.
// Case-insensitive on the name so "ancient rome" and "Ancient Rome" don't
// both appear. Capped per game so a host can't grow room memory without
// bound over a long session.
const MAX_AI_BATCHES_PER_GAME = 20;

export function addAiContent(room, gameId, batch) {
  if (!room) return { error: "Room not found." };
  const list = (room.aiContent[gameId] ??= []);
  const key = batch.name.toLowerCase();
  const existingIndex = list.findIndex((c) => c.name.toLowerCase() === key);
  if (existingIndex !== -1) {
    list[existingIndex] = batch;
    return { room, name: batch.name };
  }
  if (list.length >= MAX_AI_BATCHES_PER_GAME) {
    return { error: "This room already has the maximum number of custom sets for this game." };
  }
  list.push(batch);
  return { room, name: batch.name };
}

// The custom batches for one game, or [] — safe read used by index.js when
// building createGame options and the public room view.
export function aiContentFor(room, gameId) {
  return room?.aiContent?.[gameId] ?? [];
}

export function toPublicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      color: p.color, // player-colour id
      colorHex: hexOf(p.color), // resolved hex, so clients never need the map
    })),
  };
}
