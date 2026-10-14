// The fixed-order turn engine shared by Hot Potato and Echo Chain: a
// seating CYCLE, lives, elimination, and turn clocks that freeze while the
// player whose turn it is has dropped.
//
// A game using it keeps these fields on its state:
//   cycle      — player ids in the fixed seating order (never reordered)
//   removed    — Set of ids gone for good (rejoin grace expired / kicked)
//   lives      — Map id -> lives left
//   eliminated — ids knocked out, in elimination order
//   frozen     — null, or { reason, ...one "ms left" per frozen clock }
//
// Each game passes its own `clocks` map to freeze/resume: deadline field on
// the game -> key that holds its remaining ms while frozen, e.g. Hot
// Potato's { deadline: "turnLeftMs", fuseDeadline: "fuseLeftMs" }.

// Still in the cycle: not eliminated, not gone for good.
export function isActive(game, pid) {
  return game.cycle.includes(pid) && !game.removed.has(pid) && (game.lives.get(pid) ?? 0) > 0;
}

export function activePlayers(game) {
  return game.cycle.filter((pid) => isActive(game, pid));
}

// The next ACTIVE player after `pid` in the fixed cycle — exactly one seat
// on, skipping only players who are out. `pid` itself may be out (a player
// who just lost their last life): the walk starts from their seat.
export function nextActiveAfter(game, pid) {
  const n = game.cycle.length;
  const start = game.cycle.indexOf(pid);
  for (let step = 1; step <= n; step++) {
    const cand = game.cycle[(start + step) % n];
    if (cand !== pid && isActive(game, cand)) return cand;
  }
  return null;
}

// Did the walk from `fromId` to `toId` pass the end of the cycle (back to
// its first seat or earlier)? Echo Chain counts a new round on this.
export function wrapsAround(game, fromId, toId) {
  return game.cycle.indexOf(toId) <= game.cycle.indexOf(fromId);
}

// One life off. At 0 the player is eliminated (recorded once, in order).
// Returns the lives left.
export function loseLife(game, pid) {
  const left = Math.max(0, (game.lives.get(pid) ?? 0) - 1);
  game.lives.set(pid, left);
  if (left === 0 && !game.eliminated.includes(pid)) game.eliminated.push(pid);
  return left;
}

// Stop every clock where it is. Idempotent; the first reason wins.
export function freezeClocks(game, reason, now, clocks) {
  if (game.frozen) return;
  const frozen = { reason };
  for (const [field, key] of Object.entries(clocks)) {
    frozen[key] = game[field] != null ? Math.max(0, game[field] - now) : null;
  }
  game.frozen = frozen;
}

// Pick every clock up exactly where it stopped.
export function resumeClocks(game, now, clocks) {
  const f = game.frozen;
  if (!f) return;
  for (const [field, key] of Object.entries(clocks)) {
    if (f[key] != null) game[field] = now + f[key];
  }
  game.frozen = null;
}
