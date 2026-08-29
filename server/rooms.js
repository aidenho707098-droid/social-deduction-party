// In-memory room store. No database yet — this all lives in RAM and
// resets whenever the server restarts. That's fine for Phase 1.
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

function makePlayer(name, socketId) {
  return {
    id: randomUUID(), // stable playerId
    token: randomUUID(), // secret, never broadcast
    name,
    socketId, // current live socket, or null while disconnected
    connected: true,
    disconnectedAt: null,
  };
}

function bindSocket(socketId, code, playerId) {
  socketIndex.set(socketId, { code, playerId });
}

export function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const host = makePlayer(hostName, hostSocketId);
  const room = {
    code,
    hostId: host.id, // a playerId now, not a socket id
    players: new Map([[host.id, host]]), // playerId -> player
    createdAt: Date.now(),
    status: "lobby", // "lobby" | "in-game"
    game: null,
    tournament: null, // set by the tournament layer (see server/tournament.js)
    itemMemory: {}, // gameId -> { seen: string[] }; session no-repeat memory
    gameSettings: {}, // gameId -> last host-configured options this session
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

  const player = makePlayer(name, socketId);
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

export function toPublicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
    })),
  };
}
