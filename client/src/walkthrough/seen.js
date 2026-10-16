import { socket } from '../socket'

// Which first-time walkthroughs a player has already been SHOWN in a room.
//
// The rule: a walkthrough appears automatically only the first time a given
// player opens a given game in a room, never again in that room (across
// rounds, restarts, the menu, Tournament "up next", reconnects and
// reloads). So "seen" is:
//   * keyed per player + per GAME ("game:<gameId>", or "tournament" for
//     the Tournament walkthrough), never per round or per mode;
//   * marked the moment it is first shown, not when it's dismissed;
//   * kept by the SERVER in the room (room.walkthroughsSeen, sent with the
//     public room), and mirrored in localStorage by room code + player, so
//     it holds even in the instant before the room arrives after a reload.
// The How to Play popup can still reopen it by hand.

export const seenKeyForGame = (gameId) => (gameId ? `game:${gameId}` : null)

const storageKey = (code, playerId) => `party-game:walkthrough-seen:${code}:${playerId}`

function localList(code, playerId) {
  try {
    const raw = localStorage.getItem(storageKey(code, playerId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function hasSeenWalkthrough(room, playerId, key) {
  if (!key) return true
  if (!room?.code || !playerId) return true // no identity yet: don't nag
  if ((room.walkthroughsSeen?.[playerId] ?? []).includes(key)) return true
  return localList(room.code, playerId).includes(key)
}

export function markWalkthroughSeen(code, playerId, key) {
  if (!code || !playerId || !key) return
  try {
    const list = localList(code, playerId)
    if (!list.includes(key)) localStorage.setItem(storageKey(code, playerId), JSON.stringify([...list, key]))
  } catch {
    // Storage blocked: the server copy still holds it.
  }
  socket.emit('walkthrough_seen', { code, key })
}
