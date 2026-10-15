// Bomb Squad — every constant in ONE place. The client mirrors the few it
// needs for the setup screen (client/src/games/bombSquad/config.js).

// Working title: the client's catalogue entry mirrors it, and
// server/catalog.selftest.mjs keeps the two in sync.
export const NAME = "Bomb Squad";

export const CONFIG = {
  minPlayers: 2,
  maxPlayers: 10,
  difficulties: {
    easy: { name: "Easy", modules: 2, fuseMs: 240_000 },
    medium: { name: "Medium", modules: 3, fuseMs: 270_000 },
    hard: { name: "Hard", modules: 4, fuseMs: 300_000 },
  },
  defaultDifficulty: "easy",
  // "turns": pairs play one at a time while everyone else watches.
  // "together": every pair plays its own bomb at the same time.
  playStyles: ["turns", "together"],
  defaultPlayStyle: "turns",
  // Bomb generation: tries before giving up on a bomb that fails the
  // runtime safety check (bombSquad/verify.js).
  generationTries: 5,
  rounds: { min: 1, max: 6, dflt: 2 },

  // Per turn: the briefing card + "get ready" (the Expert may open the
  // manual; spectators bet), the live fuse, then the result card.
  readyMs: 10_000,
  resultMs: 7_000,
  summaryMs: 15_000,

  strikesToExplode: 3,
  strikeRate: 1.25, // each strike makes the fuse run 25% faster

  // Defused: 3 + modules + min(4, floor(secondsLeft / 30)) - strikes, min 1.
  score: { base: 3, perModule: 1, timeBonusEveryMs: 30_000, timeBonusMax: 4, perStrike: 1, min: 1 },
  betPoints: 1,

  // The button: a press shorter than this is a tap, longer is a hold. The
  // release is judged on the SERVER's fuse clock at the moment the player
  // let go (receipt time minus half their measured round trip), with this
  // much tolerance either side.
  button: { holdMs: 1_000, releaseToleranceMs: 1_000, maxHalfRttMs: 750 },

  // Module sizes (equal for every pair within a round).
  wires: { min: 3, max: 6 },
  symbols: { pool: 24, columns: 6, perColumn: 7, shown: 4 },
  memory: { stages: 5 },
  switches: { count: 5, patterns: 8 },
};

export const DIFFICULTY_KEYS = Object.keys(CONFIG.difficulties);

export const clampInt = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export function resolveSettings(options = {}) {
  return {
    difficulty: DIFFICULTY_KEYS.includes(options.difficulty) ? options.difficulty : CONFIG.defaultDifficulty,
    rounds: clampInt(options.rounds, CONFIG.rounds.min, CONFIG.rounds.max, CONFIG.rounds.dflt),
    playStyle: CONFIG.playStyles.includes(options.playStyle) ? options.playStyle : CONFIG.defaultPlayStyle,
  };
}

// 3 + modules + min(4, floor(secondsLeft / 30)) - strikes, never below 1.
export function defusePoints({ modules, msLeft, strikes }) {
  const s = CONFIG.score;
  const bonus = Math.min(s.timeBonusMax, Math.floor(Math.max(0, msLeft) / s.timeBonusEveryMs));
  return Math.max(s.min, s.base + s.perModule * modules + bonus - s.perStrike * strikes);
}
