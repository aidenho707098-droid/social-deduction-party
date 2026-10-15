// Word Heist — pure rules: the ONE config object, pairing, the Wordle
// feedback engine, scoring, and the word clean-up shared by the AI check
// and its fallbacks. No state, no I/O: word-heist.js holds the game and
// server/wordHeistChecker.js makes the AI call.

// Working title: the client's catalogue entry mirrors it, and
// server/catalog.selftest.mjs keeps the two in sync.
export const NAME = "Word Heist";

export const MODES = ["prompted", "free"];

// Every timer and constant, in one place.
export const CONFIG = {
  minPlayers: 2,
  maxPlayers: 10,
  rounds: { min: 1, max: 8, dflt: 3 },
  defaultMode: "prompted",
  word: { min: 4, max: 8 },
  setMs: 45_000, // everyone sets a word at once
  solveMs: 180_000, // everyone solves at once, each on a different word
  revealMs: 25_000, // the round's pairings, before the next round deals
  graceMs: 500, // a guess or lock racing its clock still counts
  checksPerRound: 3, // AI checks each player may ask for per round
  rejectionsBeforeFallback: 3, // rejected attempts before a word is assigned
  aiTimeoutMs: 8_000,
  hintMaxLen: 24,
  hintAfterGuess: 3, // Free choice: the hint chip appears after this many guesses
  // Chaos Speed Round, handled by the game: the generic 10s clamp can't
  // fit an AI-checked word or a whole Wordle board.
  speed: { setMs: 20_000, solveMs: 60_000 },
  // A Chaos takeover plays at the start of the set phase
  // (client/src/chaos/ChaosOverlay.jsx: 1400 buildup + 2500 reveal + 550
  // out, + 3200 for a Risk It wager). The set clock waits it out.
  chaosTakeoverMs: 1_400 + 2_500 + 550,
  chaosWagerMs: 3_200,
};

export const clampInt = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export function resolveSettings(options = {}) {
  return {
    mode: MODES.includes(options.mode) ? options.mode : CONFIG.defaultMode,
    rounds: clampInt(options.rounds, CONFIG.rounds.min, CONFIG.rounds.max, CONFIG.rounds.dflt),
  };
}

// =====================================================================
// pairing
// =====================================================================

// Round k (1-based) with N players: everyone solves the word set by the
// player `offset` places after them in the fixed order. A cycle, so each
// player sets one word and solves one, nobody solves their own, and the
// offsets walk through every other setter before any repeats.
export function offsetFor(roundNumber, n) {
  if (n < 2) return 0;
  return ((roundNumber - 1) % (n - 1)) + 1;
}

export function pairingsFor(order, roundNumber) {
  const n = order.length;
  const off = offsetFor(roundNumber, n);
  return order.map((solverId, i) => ({ solverId, setterId: order[(i + off) % n] }));
}

// =====================================================================
// Wordle feedback
// =====================================================================

// "g" = right letter, right spot; "y" = in the word, another spot; "x" =
// not in the word (or no copies left). Exact matches are marked first, then
// wrong-spot marks spend the remaining letter counts left to right — the
// standard handling of repeated letters.
export function feedback(guess, target) {
  const g = String(guess).toUpperCase();
  const t = String(target).toUpperCase();
  const out = Array(t.length).fill("x");
  const left = {};
  for (let i = 0; i < t.length; i++) {
    if (g[i] === t[i]) out[i] = "g";
    else left[t[i]] = (left[t[i]] ?? 0) + 1;
  }
  for (let i = 0; i < t.length; i++) {
    if (out[i] === "g") continue;
    if (left[g[i]] > 0) {
      out[i] = "y";
      left[g[i]] -= 1;
    }
  }
  return out.join("");
}

export const solvedPattern = (length) => "g".repeat(length);

// The on-screen keyboard: each letter's best-known state across every
// guess so far (green beats yellow beats grey). Shared with the client.
export function keyStates(guesses) {
  const rank = { x: 1, y: 2, g: 3 };
  const out = {};
  for (const { guess, pattern } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const st = pattern[i];
      if (!out[ch] || rank[st] > rank[out[ch]]) out[ch] = st;
    }
  }
  return out;
}

// =====================================================================
// scoring (a shared pot per pairing)
// =====================================================================

export const guessesAllowed = (length) => length + 1;
export const potFor = (length) => length + 2; // guesses allowed + 1

// Solved in g guesses: solver pot - g, setter g. Failed (out of guesses or
// out of time): the setter takes the whole pot. Void: nobody scores. The
// two always add up to the pot (or to 0 when void).
export function scorePairing(length, status, guessCount) {
  const pot = potFor(length);
  if (status === "solved") return { pot, solver: pot - guessCount, setter: guessCount };
  if (status === "failed") return { pot, solver: 0, setter: pot };
  return { pot, solver: 0, setter: 0 };
}

// =====================================================================
// words: clean-up, structure, profanity
// =====================================================================

const SPECIAL = { ß: "ss", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", ø: "o", Ø: "O", đ: "d", Đ: "D", ł: "l", Ł: "L", ð: "d", þ: "th" };

export function stripDiacritics(s) {
  return String(s ?? "")
    .replace(/[ßæÆœŒøØđĐłŁðþ]/g, (c) => SPECIAL[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// The grid form: A to Z only, upper case ("Perú" -> "PERU").
export function gridForm(s) {
  return stripDiacritics(s).toUpperCase().replace(/[^A-Z]/g, "");
}

// What a player typed, judged on shape alone (no AI): one word, letters
// only (accents, hyphens and apostrophes are fine and dropped for the
// grid), 4 to 8 letters. Same rules as the client's live counter.
export function structuralCheck(raw) {
  const display = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!display) return { ok: false, reason: "Type a word first." };
  if (/\s/.test(display)) return { ok: false, reason: "One word only, no spaces." };
  if (!/^[A-Za-z'’\-.]+$/.test(stripDiacritics(display))) return { ok: false, reason: "Letters only: no numbers or symbols." };
  const grid = gridForm(display);
  if (grid.length < CONFIG.word.min || grid.length > CONFIG.word.max) {
    return { ok: false, reason: `${CONFIG.word.min} to ${CONFIG.word.max} letters, please.` };
  }
  return { ok: true, grid, display };
}

// A guess: ANY letters of the right length (no dictionary check, so names
// work).
export function cleanGuess(raw, length) {
  const g = String(raw ?? "").toUpperCase();
  return /^[A-Z]+$/.test(g) && g.length === length ? g : null;
}

// A basic blocklist for the no-AI path (and a belt-and-braces check on the
// AI path). Exact words, plus a few roots that are never innocent inside a
// 4-8 letter word.
const BLOCK_EXACT = new Set(
  "ARSE ARSES ASSES ASSHOLE BASTARD BITCH BITCHES BOLLOCKS BONER BOOBS BOOBIES BUTTHOLE CLIT COCK COCKS CRAP DAMN DICK DICKS DILDO DOUCHE DYKE FAGGOT FAGS HOOKER HORNY JIZZ KINKY MILF NAZI NAZIS NIPPLE NUDE NUDES ORGASM ORGY PENIS PISS PISSED PORN PORNO PRICK PUBES PUSSY RAPE RAPED RAPIST SCROTUM SEMEN SEXY SHAG SKANK SLUT SLUTS SMEGMA SPERM TITS TITTIES TWAT VAGINA WANK WANKER WHORE WHORES NIGGER NIGGERS NIGGA NIGGAS"
    .split(" "),
);
const BLOCK_ROOTS = ["FUCK", "SHIT", "CUNT", "WHORE", "SLUT", "RETARD", "BITCH"];

export function isBlocked(word) {
  const g = gridForm(word);
  if (BLOCK_EXACT.has(g)) return true;
  return BLOCK_ROOTS.some((r) => g.includes(r));
}

// A Free-choice category hint is only kept if it's short, plain, and
// doesn't give the word (or its stem) away.
export function cleanHint(raw, word) {
  if (typeof raw !== "string") return null;
  const hint = raw.replace(/\s+/g, " ").replace(/^["'`\-–—\s]+|["'`\s.]+$/g, "").trim();
  if (!hint || hint.length > CONFIG.hintMaxLen) return null;
  if (/[\n\r{}[\]<>]/.test(hint)) return null;
  const hg = gridForm(hint);
  const wg = gridForm(word);
  if (!wg) return null;
  if (hg.includes(wg)) return null;
  if (wg.length >= 5 && hg.includes(wg.slice(0, -1))) return null;
  if (isBlocked(hint)) return null;
  return hint;
}

// "Brazil" from "BRAZIL" — the reveal's display form for a corrected word
// (the player's own text is kept when nothing was changed).
export function titleCase(grid) {
  const g = String(grid);
  return g.charAt(0) + g.slice(1).toLowerCase();
}
