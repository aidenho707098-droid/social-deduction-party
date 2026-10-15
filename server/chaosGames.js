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
//   * Echo Chain       — excluded entirely (deliberately NOT listed below).
//                       Its points are rounds survived, counted at the end,
//                       so there are no per-round score deltas for a
//                       modifier to rewrite, and Speed Round's 10s timers
//                       would be SLOWER than its own 4–5s tap timers. Its
//                       setup screen says so.

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
  "who-am-i": {
    // One "turns" phase per round covers the whole deal-to-done rotation;
    // it scores at "reveal" exactly like Taboo. Speed Round slashes
    // whichever of the two windows (question / guess) is currently running
    // down to 10s — same shape as Taboo's single dynamic `deadline`.
    rollPhases: ["turns"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    timer: { phases: ["turns"], deadlineField: "deadline", windowKeys: ["questionMs", "guessMs"] },
  },
  "alphabet-soup": {
    // Rolls on the letter-reveal intro, so the takeover plays BEFORE the
    // soup animation (the game pushes its intro clock back by the takeover's
    // length via its onChaosAnnounced hook — nobody loses answering time).
    // Scores land at "reveal": in Typed mode that's AFTER disputes resolve
    // (the "review" phase in between carries provisional points only).
    //
    // FLAGGED:
    //   * Speed Round — Typed mode only (40s answer window -> 10s). Spoken
    //     turns are already 10s -> 4s and the challenge/vote windows are
    //     5s; clamping to 10s would do nothing, so it's filtered out there.
    //   * Countdown Chaos — works in both: hides the Typed timer bar and the
    //     Spoken countdown ring (see the [data-chaos-blind] rules).
    //   * Risk It — its wager beat lengthens the takeover; the intro waits
    //     for it too.
    rollPhases: ["intro"],
    scoredPhases: ["reveal", "final"],
    speedRound: (game) => game?.mode === "typed",
    timer: { phases: ["answer"], deadlineField: "deadline", windowKeys: ["answerMs"] },
  },
  "hot-potato": {
    // One Chaos roll per POTATO: Short Rounds have one potato per round,
    // Elimination many per match (the game's roundIndex counts potatoes).
    // Rolls on the category intro, which waits for the takeover
    // (onChaosAnnounced) like Alphabet Soup's letter reveal.
    //
    // FLAGGED (see `exclude`):
    //   * Speed Round — handled by the GAME, not the generic 10s clamp
    //     (every window is already under 10s): it pins every turn window to
    //     the 2s Sprint floor, and the Hidden Fuse cap to 2s too. No `timer`
    //     entry, so the glue never touches the deadline.
    //   * Countdown Chaos — hides the turn ring / bar ([data-chaos-blind]).
    //     A Hidden Fuse potato has no public clock, so the vignette idles.
    //   * Elimination — points only land when a MATCH ends, so a per-potato
    //     scoring modifier would almost always multiply nothing. Only the
    //     two clock modifiers run there.
    //   * Short Rounds — everyone but the exploder ties on +2, so modifiers
    //     that hinge on a single "round winner" or a ranked top half are
    //     either no-ops (All or Nothing, Tax Collector, The Tyrant, Rival)
    //     or pick arbitrarily among the tied (Risk It, Point Reversal).
    rollPhases: ["intro"],
    scoredPhases: ["explode", "final"],
    speedRound: true,
    exclude: (game) =>
      game?.mode === "elimination"
        ? (m) => m.id !== "speed-round" && m.id !== "countdown-chaos"
        : (m) => ["all-or-nothing", "tax-collector", "the-tyrant", "rival", "risk-it", "point-reversal"].includes(m.id),
  },
  "memory-imposter": {
    // One roll per round, at the start of the memorize phase. The look
    // waits out the takeover (onChaosAnnounced), so nobody memorizes under
    // the overlay. A round the Imposter abandons is redealt under the SAME
    // roundIndex, so its Chaos Event carries over to the redo instead of
    // rolling twice.
    //
    // Scoring is lopsided by design (an Imposter who evades is the round's
    // only scorer; a caught one hands +2 to each Witness who voted for
    // them), so several modifiers have nothing to act on. Audited at the
    // 3-player minimum and above:
    //   EXCLUDED at any size:
    //     * Point Reversal — hands a caught Imposter the Witnesses' points.
    //     * All or Nothing — a no-op: the round's scorers already ARE its
    //       winners (the lone Imposter, or every Witness who voted right).
    //     * Tax Collector / The Tyrant — 20% of a +2 rounds to 0, and an
    //       evaded round has one scorer: always a no-op.
    //   EXCLUDED at 3 players:
    //     * Rival — pairs two of three, almost always both Witnesses on the
    //       same score: nothing to steal.
    //     * Score Swap — a coin flip between two of three totals.
    //     * Steal — first and last are usually the only two players who
    //       scored differently: a straight transfer.
    //     * Risk It — "the top half" of three is the scorer plus one
    //       arbitrary 0-scorer.
    //   KEPT, with special handling:
    //     * Speed Round — handled by the GAME, not the generic 10s clamp:
    //       discussion 20s, vote 10s. The look itself is NOT shortened
    //       (that changes difficulty, not pace). No `timer` entry.
    //     * Countdown Chaos — hides the discussion / vote bars AND the
    //       memorize ring ([data-chaos-blind]), the same for everyone.
    //     * Risk It (4+ players) — the wager beat lengthens the takeover;
    //       the look waits for it too.
    rollPhases: ["memorize"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    exclude: (game) => {
      const always = ["point-reversal", "all-or-nothing", "tax-collector", "the-tyrant"];
      const players = game ? game.roster.length - game.removed.size : 3;
      const small = players <= 3 ? ["rival", "score-swap", "steal", "risk-it"] : [];
      return (m) => always.includes(m.id) || small.includes(m.id);
    },
  },
  "word-heist": {
    // One roll per round, as the set phase opens. The set clock waits out
    // the takeover (onChaosAnnounced), so nobody loses word-setting time.
    // Only the round's active participants are eligible (chaosParticipants).
    //
    // Scoring is a SHARED POT per pairing: everyone scores every round, as
    // solver (pot - guesses) and as setter (guesses, or the whole pot if
    // their solver fails). Audited:
    //   EXCLUDED:
    //     * Point Reversal — makes failing pay: a solver can burn all their
    //       guesses on nonsense in seconds to score 0, which reversal turns
    //       into the top reward. Trivially gamed.
    //   KEPT, with special handling:
    //     * Speed Round — handled by the GAME, not the generic 10s clamp
    //       (a 10s set phase can't fit an AI-checked word, and 10s can't
    //       fit a Wordle board): set 20s, solve 60s (CONFIG.speed). No
    //       `timer` entry.
    //     * Countdown Chaos — hides the timer ring on both screens
    //       ([data-chaos-blind] .wh-ring).
    //     * Risk It — its wager beat lengthens the takeover; the set clock
    //       waits for it too.
    //   KEPT as is: the multipliers, Underdog Boost, All or Nothing,
    //   Kingbreaker and Half Reset (every player has round points to act
    //   on); Score Swap, Steal, Rival, Tax Collector, The Tyrant and Player
    //   Disable are already 3+ players only, so a 2-player duel never
    //   collapses into a straight transfer.
    rollPhases: ["set"],
    scoredPhases: ["reveal", "final"],
    speedRound: true,
    exclude: () => (m) => m.id === "point-reversal",
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
// current one (Player Disable needs at least 1). `game` (optional) lets a
// config decide per-game-state — `speedRound` may be a function of it
// (Alphabet Soup allows Speed Round in Typed mode only).
export function eligibleModifiers(gameId, modifiers, { playerCount, roundsLeft, game = null }) {
  const cfg = CHAOS_GAMES[gameId];
  if (!cfg) return [];
  const speedOk = typeof cfg.speedRound === "function" ? cfg.speedRound(game) : cfg.speedRound;
  // Optional per-game, per-state veto: (game) -> (modifier) -> true to drop it.
  const excluded = cfg.exclude ? cfg.exclude(game) : () => false;
  return modifiers.filter((m) => {
    if (excluded(m)) return false;
    const needs = m.needs ?? {};
    if (needs.speedRound && !speedOk) return false;
    if (needs.minPlayers && playerCount < needs.minPlayers) return false;
    if (needs.nextRound && !(roundsLeft > 0)) return false;
    return true;
  });
}

export { SPEED_MS };
