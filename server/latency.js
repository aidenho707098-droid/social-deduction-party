// Shared round-trip-time tracker. The SERVER measures each socket's RTT
// itself (it pings, the client acks), so a client can't claim a convenient
// latency. A game that judges "when did the player do it?" against a
// server clock backs the receipt time out by half the RTT:
//
//   const at = receivedAt - latency.halfRttOf(socket.id);
//
// Bomb Squad's button release uses it; any game can.

export function createLatencyTracker(io, { samples = 5, timeoutMs = 3_000, fallbackRttMs = 150 } = {}) {
  const rtts = new Map(); // socketId -> recent RTTs (ms)

  // Fire one ping at a socket; the client answers "latency_ping" with its ack.
  function sample(socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;
    const t0 = Date.now();
    socket.timeout(timeoutMs).emit("latency_ping", t0, (err) => {
      if (err) return;
      const list = rtts.get(socketId) ?? [];
      list.push(Date.now() - t0);
      if (list.length > samples) list.shift();
      rtts.set(socketId, list);
    });
  }

  // Median of the recent samples (robust to one slow ping), or null.
  function rttOf(socketId) {
    const list = rtts.get(socketId);
    if (!list?.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  return {
    sample,
    rttOf,
    halfRttOf: (socketId) => (rttOf(socketId) ?? fallbackRttMs) / 2,
    forget: (socketId) => rtts.delete(socketId),
  };
}
