// Player-count limits, read off each game module. A module exports
// `minPlayers` (the lowest count ANY of its modes supports), optionally
// `maxPlayers`, and optionally `modeMinPlayers: { [mode]: n }` for a mode
// that needs more people (Alphabet Soup's Spoken mode). `options.mode` is
// the createGame() option that selects it.
//
// Every server path that starts a game (standalone start_game and both
// Tournament paths) checks here, so the menu's greyed-out rows are never
// the only line of defence. client/src/games/catalog.js mirrors these
// numbers for the UI; server/catalog.selftest.mjs keeps the two in sync.

export function limitsFor(mod, options = {}) {
  const modeMin = mod.modeMinPlayers?.[options?.mode];
  return { min: modeMin ?? mod.minPlayers, max: mod.maxPlayers ?? null };
}

// A plain-language reason this many players can't play `mod` with these
// options, or null if they can.
export function fitError(mod, playerCount, options = {}) {
  const { min, max } = limitsFor(mod, options);
  const mode = String(options?.mode ?? "");
  const modeLabel = mod.modeMinPlayers?.[mode] != null ? ` (${mode[0].toUpperCase()}${mode.slice(1)} mode)` : "";
  if (playerCount < min) return `${mod.name}${modeLabel} needs at least ${min} players.`;
  if (max != null && playerCount > max) return `${mod.name} supports at most ${max} players.`;
  return null;
}

// Can SOME mode of `mod` run with this many players? Used where the mode
// isn't chosen yet (the Random Mode wheel, the lineup builder).
export function fitsSomeMode(mod, playerCount) {
  return playerCount >= mod.minPlayers && (mod.maxPlayers == null || playerCount <= mod.maxPlayers);
}
