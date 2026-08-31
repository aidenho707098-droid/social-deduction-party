// Per-game wiring for the Chaos Events layer. Each entry says, for one
// game id:
//   * whether chaos runs for it at all,
//   * which phases mean "a new scoring round just began" (roll here),
//   * which phases mean "the round's points are now in game.scores"
//     (settle round-end modifiers here),
//   * whether Speed Round applies, and which per-phase timer window(s) to
//     rewrite / advertise as 10s.
//
// Anything NOT listed here is treated as chaos-ineligible (safe default —
// a brand-new game gets no chaos until it's added here on purpose, so its
// scoring is never silently rewritten by a modifier that doesn't fit).
//
// FLAGGED game/modifier combinations (see MODIFIERS filter in chaos.js):
//   * Imposter        — excluded entirely. One round, binary team win/lose,
//                       no per-round point deltas and no "next round", so
//                       none of the 17 modifiers have anything to act on.
//   * Speed Round      — only the race-to-answer games (Crack the Code,
//                       Majority Pick, Wavelength, Taboo). Excluded from
//                       Fact or Fake (can't write a convincing fake in 10s)
//                       and Black Magic (the round is Witch-paced, not a
//                       countdown players race).
//   * Player Disable   — needs a round after it. On the FINAL round it
//                       still announces but resolves to a no-op.

const SPEED_MS = 10_000;

export const CHAOS_GAMES = {
  "emoji-movie": {
    rollPhases: ["guess"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    timer: { phases: ["guess"], deadlineField: "deadline", windowKeys: ["answerMs"] },
  },
  "would-you-rather": {
    rollPhases: ["answer"],
    scoredPhases: ["result", "final"],
    speedRound: true,
    timer: { phases: ["answer"], deadlineField: "deadline", windowKeys: ["answerMs"] },
  },
  wavelength: {
    rollPhases: ["guess"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    timer: { phases: ["guess"], deadlineField: "deadline", windowKeys: ["guessMs"] },
  },
  taboo: {
    rollPhases: ["describe", "guess"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    // Taboo's clock only starts when the Describer taps Reveal (phase
    // "guess"); if Speed Round fired during "describe" the glue clamps the
    // deadline the moment it appears.
    timer: { phases: ["guess"], deadlineField: "deadline", windowKeys: ["startMs"] },
  },
  fibbage: {
    rollPhases: ["write"],
    scoredPhases: ["reveal", "final"],
    speedRound: false,
  },
  "black-magic": {
    rollPhases: ["pick", "choose"],
    scoredPhases: ["reveal", "final"],
    speedRound: false,
  },
  "fake-artist": {
    // Roll on the role-reveal beat, before anyone draws. Speed Round is
    // excluded — a 10s drawing turn would gut the game, same reasoning as
    // Fact or Fake / Black Magic.
    rollPhases: ["brief"],
    scoredPhases: ["reveal", "final"],
    speedRound: false,
  },
};

export function chaosGameConfig(gameId) {
  return CHAOS_GAMES[gameId] ?? null;
}

export function isChaosEligible(gameId) {
  return Boolean(CHAOS_GAMES[gameId]);
}

// Modifiers this game can draw — the full pool minus the ones its config
// can't support. `roundsLeft` is how many scoring rounds remain AFTER the
// current one (Player Disable needs at least 1).
export function eligibleModifiers(gameId, modifiers, { playerCount, roundsLeft }) {
  const cfg = CHAOS_GAMES[gameId];
  if (!cfg) return [];
  return modifiers.filter((m) => {
    const needs = m.needs ?? {};
    if (needs.speedRound && !cfg.speedRound) return false;
    if (needs.minPlayers && playerCount < needs.minPlayers) return false;
    if (needs.nextRound && !(roundsLeft > 0)) return false;
    return true;
  });
}

export { SPEED_MS };
