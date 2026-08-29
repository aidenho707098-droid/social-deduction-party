// Shared random-selection helpers for every game.
//
// Before this module each game had its own copy of `shuffle` and drew its
// round content from a fresh full-pool shuffle every time `createGame` ran.
// That gave "no repeats WITHIN a game" but nothing across games — so every
// "Play Again" and every Tournament game reshuffled the whole bank from the
// top and the same few items kept resurfacing all session.
//
// `drawWithoutRepeats` fixes that: the caller persists the returned
// `seenKeys` (per room, per game) and passes it back in next time, so a
// session works its way through the whole bank before anything repeats.

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Draw up to `count` items from `pool` at random, skipping any whose key is
// already in `seenKeys` (used earlier this session). Returns:
//   { items, seenKeys }  — the draw, plus the seen-key list to persist.
//
// `keyOf` maps an item to a stable string id (default: the item itself, for
// pools of plain strings). When the unused part of the pool can't cover the
// request, every remaining unused item is taken first, then the rest is
// topped up from a reshuffled full pool and the seen list restarts from
// just this draw — one clean cycle through the bank before repeats.
export function drawWithoutRepeats(pool, count, seenKeys = [], keyOf = (x) => x) {
  const want = Math.max(0, Math.min(count, pool.length));
  const seen = new Set(seenKeys);
  const unused = shuffle(pool.filter((item) => !seen.has(keyOf(item))));

  if (unused.length >= want) {
    const items = unused.slice(0, want);
    return { items, seenKeys: [...seenKeys, ...items.map(keyOf)] };
  }

  // Bank exhausted mid-draw: keep the leftovers, refill from a fresh shuffle
  // of everything else, and begin a new cycle.
  const topUp = shuffle(pool).filter((item) => !unused.includes(item));
  const items = [...unused, ...topUp].slice(0, want);
  return { items, seenKeys: items.map(keyOf) };
}
