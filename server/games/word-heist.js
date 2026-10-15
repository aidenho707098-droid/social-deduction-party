// "Word Heist" (working title, wordHeistRules.js NAME) — a Wordle-style duel.
//
// Every round, each player secretly SETS one word, then SOLVES exactly one
// other player's word, Wordle-style. The pairing is a cycle over a player
// order fixed at the start (wordHeistRules.pairingsFor), so nobody solves
// their own word and the setters rotate round to round.
//
//   phase: set (45s, everyone at once) -> solve (3 min, everyone at once)
//          -> reveal -> set ... -> final
//
// SETTING. Prompted mode: each player is offered two prompts and picks one
// ("Name an instrument"); Free choice: any word. One word, letters only,
// 4-8 letters. On "Check word" the server makes ONE AI check
// (server/wordHeistChecker.js; index.js awaits it between beginCheck() and
// finishCheck() here). A corrected spelling is offered back ("Did you mean
// BRAZIL?") and only locks on Yes. Three rejections, three checks used, or
// the clock running out assign a fallback word (wordHeistBank.js). If the
// AI is down, the word is accepted as typed (blocklist only), unverified.
//
// SOLVING. length + 1 guesses, any letters of the right length, standard
// Wordle feedback. The pot for a pairing is length + 2: solved in g, the
// solver takes pot - g and the setter g; failed, the setter takes it all;
// void (the solver left), nobody scores.
//
// PRIVACY (verify in real traffic):
//   * A word reaches ONLY its setter's private payload until the round's
//     reveal. The public state carries counts and statuses, never words,
//     lengths or feedback.
//   * The solver's payload carries their own guesses and the feedback
//     pattern for each, never the target.
//   * "Already used this game" only counts words from EARLIER rounds (all
//     revealed by then): checking this round's words would let a 2-player
//     solver probe the other player's word.
//
// Server-timed and server-validated. This module is pure state +
// timestamps; server/index.js drives tick().

import { shuffle } from "./deck.js";
import {
  CONFIG,
  NAME,
  cleanGuess,
  feedback,
  gridForm,
  guessesAllowed,
  isBlocked,
  pairingsFor,
  resolveSettings,
  scorePairing,
  solvedPattern,
  structuralCheck,
  titleCase,
} from "./wordHeistRules.js";
import { GENERAL, PROMPTS, PROMPTS_BY_ID } from "./wordHeistBank.js";

export const id = "word-heist";
export const name = NAME;
export const minPlayers = CONFIG.minPlayers;
export const maxPlayers = CONFIG.maxPlayers;
export { CONFIG };

const USED_MSG = "Someone already used that this game. Try another.";

// =====================================================================
// lifecycle
// =====================================================================

export function createGame(playerIds, options = {}, rng = Math.random) {
  if (playerIds.length < minPlayers) throw new Error(`${name} needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`${name} supports at most ${maxPlayers} players.`);
  const settings = resolveSettings(options);
  const recent = Array.isArray(options.memory) ? options.memory.filter((p) => PROMPTS_BY_ID[p]) : [];
  const game = {
    id,
    settings,
    mode: settings.mode,
    totalRounds: settings.rounds,
    roundIndex: 0,
    serial: 0,
    order: shuffle([...playerIds]), // fixed for the whole game
    removed: new Set(),
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    usedWords: new Set(), // grid forms from EARLIER rounds
    // Prompts this room saw in earlier games go to the back of the bag.
    promptBag: [...shuffle(PROMPTS.map((p) => p.id).filter((p) => !recent.includes(p))), ...shuffle(recent)],
    deckMemory: recent,
    rng,
    history: [],
    phase: "set",
    deadline: null,
    windowMs: null,
    round: null,
  };
  dealRound(game, Date.now());
  return game;
}

function participants(game) {
  return game.order.filter((pid) => !game.removed.has(pid));
}

function drawPrompts(game) {
  const out = [];
  while (out.length < 2) {
    if (!game.promptBag.length) game.promptBag = shuffle(PROMPTS.map((p) => p.id));
    const p = game.promptBag.shift();
    if (!out.includes(p)) out.push(p);
  }
  game.deckMemory = [...game.deckMemory.filter((p) => !out.includes(p)), ...out].slice(-PROMPTS.length + 4);
  return out;
}

function dealRound(game, now) {
  const who = participants(game);
  if (who.length < minPlayers) return finish(game);
  game.serial += 1;
  const pairs = pairingsFor(who, game.roundIndex + 1);
  game.round = {
    serial: game.serial,
    participants: who,
    pairs,
    setters: new Map(
      who.map((pid) => [
        pid,
        {
          playerId: pid,
          prompts: game.mode === "prompted" ? drawPrompts(game) : null,
          promptId: null,
          pending: null, // a corrected word awaiting Yes / No
          locked: null, // { grid, display, hint, verified, source, promptId }
          checksUsed: 0,
          rejections: 0,
          checking: false,
          checkSeq: 0,
          message: null, // the last reason / notice for this setter
        },
      ]),
    ),
    boards: new Map(pairs.map(({ solverId, setterId }) => [solverId, { setterId, guesses: [], status: "waiting" }])),
    speed: false,
    setStartsAt: now,
    leadApplied: false,
    result: null,
  };
  game.phase = "set";
  setClock(game, CONFIG.setMs, now);
}

function setClock(game, ms, now) {
  game.windowMs = ms;
  game.deadline = now + ms;
}

function finish(game) {
  game.phase = "final";
  game.deadline = null;
  game.windowMs = null;
}

// Chaos hook: the set clock waits out the takeover; Speed Round shortens
// both of this round's clocks (CONFIG.speed).
export function onChaosAnnounced(game, modifier) {
  if (game.phase !== "set" || game.round.leadApplied) return;
  game.round.leadApplied = true;
  if (modifier?.id === "speed-round") game.round.speed = true;
  const lead = CONFIG.chaosTakeoverMs + (modifier?.id === "risk-it" ? CONFIG.chaosWagerMs : 0);
  const setMs = game.round.speed ? CONFIG.speed.setMs : CONFIG.setMs;
  game.deadline = game.round.setStartsAt + lead + setMs;
  game.windowMs = setMs;
}

// =====================================================================
// (a) setting a word
// =====================================================================

function setterOf(game, pid) {
  if (game.phase !== "set" || game.removed.has(pid)) return null;
  return game.round.setters.get(pid) ?? null;
}

export function choosePrompt(game, pid, promptId) {
  const s = setterOf(game, pid);
  if (!s || game.mode !== "prompted") return { ok: false };
  if (s.locked || s.checking) return { ok: false, message: s.locked ? "Your word is locked in." : "Hold on, checking…" };
  if (!s.prompts.includes(promptId)) return { ok: false };
  if (s.promptId !== promptId) {
    s.promptId = promptId;
    s.pending = null;
    s.message = null;
  }
  return { ok: true };
}

// Step 1 of a check (sync). Shape problems come straight back and cost
// nothing; anything else uses one of the round's checks. Returns
// { ok: true, job } for index.js to send to the AI, or { ok: false, ... }.
export function beginCheck(game, pid, text) {
  const s = setterOf(game, pid);
  if (!s) return { ok: false, message: "It's not word-setting time." };
  if (s.locked) return { ok: false, message: "Your word is locked in." };
  if (s.checking) return { ok: false, message: "Hold on, checking…" };
  if (s.pending) return { ok: false, message: "Answer Yes or No first." };
  if (game.mode === "prompted" && !s.promptId) return { ok: false, message: "Pick a prompt first." };
  if (s.checksUsed >= CONFIG.checksPerRound) return { ok: false, message: "No checks left this round." };

  const shape = structuralCheck(text);
  if (!shape.ok) return { ok: false, rejected: false, message: shape.reason };

  s.checksUsed += 1;
  if (game.usedWords.has(shape.grid)) return reject(game, s, USED_MSG);
  if (isBlocked(shape.grid)) return reject(game, s, "Let's keep it family-friendly. Try another word.");

  s.checking = true;
  s.checkSeq += 1;
  s.message = null;
  return {
    ok: true,
    job: {
      serial: game.round.serial,
      playerId: pid,
      seq: s.checkSeq,
      mode: game.mode,
      promptId: s.promptId,
      promptText: s.promptId ? PROMPTS_BY_ID[s.promptId].text : null,
      grid: shape.grid,
      display: shape.display,
    },
  };
}

// Step 2 (after the AI). `verdict` is the checker's result, or null when
// the AI was unavailable / timed out. Stale jobs (the round moved on, or
// the clock already assigned a word) are ignored.
export function finishCheck(game, job, verdict, presentPlayerIds = []) {
  if (game.phase !== "set" || game.round?.serial !== job.serial) return { ok: false, stale: true };
  const s = game.round.setters.get(job.playerId);
  if (!s || s.locked || s.checkSeq !== job.seq) return { ok: false, stale: true };
  s.checking = false;

  let out;
  if (!verdict) {
    // AI down: accept as typed (it already passed the shape check and the
    // blocklist), marked unverified.
    out = lock(game, s, { grid: job.grid, display: job.display, hint: null, verified: false, source: "player" });
    out.unverified = true;
  } else if (!verdict.ok) {
    out = reject(game, s, verdict.reason);
  } else if (game.usedWords.has(verdict.grid)) {
    out = reject(game, s, USED_MSG);
  } else if (verdict.corrected) {
    s.pending = { grid: verdict.grid, display: verdict.display, hint: verdict.hint ?? null };
    out = { ok: true, confirm: { display: verdict.display, grid: verdict.grid } };
  } else {
    out = lock(game, s, { grid: verdict.grid, display: verdict.display, hint: verdict.hint ?? null, verified: true, source: "player" });
  }
  maybeStartSolve(game, presentPlayerIds, Date.now());
  return out;
}

// "Did you mean BRAZIL?" — Yes locks it, No goes back to typing.
export function confirm(game, pid, yes, presentPlayerIds = []) {
  const s = setterOf(game, pid);
  if (!s?.pending) return { ok: false };
  let out;
  if (yes) {
    out = lock(game, s, { ...s.pending, verified: true, source: "player" });
  } else {
    s.pending = null;
    s.message = null;
    out = { ok: true, declined: true };
    if (s.checksUsed >= CONFIG.checksPerRound) out = assignFallback(game, s, "No checks left, so here's a word for you.");
  }
  maybeStartSolve(game, presentPlayerIds, Date.now());
  return out;
}

function reject(game, s, reason) {
  s.rejections += 1;
  s.message = reason;
  s.checking = false;
  if (s.rejections >= CONFIG.rejectionsBeforeFallback || s.checksUsed >= CONFIG.checksPerRound) {
    const out = assignFallback(game, s, `${reason} That was your last try, so here's a word for you.`);
    return { ...out, rejected: true, reason };
  }
  return { ok: false, rejected: true, message: reason, triesLeft: CONFIG.checksPerRound - s.checksUsed };
}

function lock(game, s, word) {
  s.locked = { ...word, promptId: s.promptId };
  s.pending = null;
  s.checking = false;
  s.message = null;
  return { ok: true, locked: true };
}

// A bundled safe word nobody has used yet (earlier rounds, or any word
// already locked this round: the server may look, nobody else can).
function assignFallback(game, s, message) {
  const taken = new Set([...game.usedWords, ...[...game.round.setters.values()].filter((x) => x.locked).map((x) => x.locked.grid)]);
  const pick = (list) => list[Math.floor(game.rng() * list.length)];
  let word = null;
  if (game.mode === "prompted") {
    const order = s.promptId ? [s.promptId, ...s.prompts.filter((p) => p !== s.promptId)] : shuffle(s.prompts);
    for (const p of order) {
      const free = PROMPTS_BY_ID[p].words.filter((w) => !taken.has(w));
      if (free.length) {
        s.promptId = p;
        const w = pick(free);
        word = { grid: w, display: titleCase(w), hint: null };
        break;
      }
    }
  }
  if (!word) {
    // Free choice — or (never in practice) both prompts' banks used up, in
    // which case the solver gets the general hint instead of a prompt.
    if (game.mode === "prompted") s.promptId = null;
    const free = GENERAL.filter((g) => !taken.has(g.word));
    const g = pick(free.length ? free : GENERAL);
    word = { grid: g.word, display: titleCase(g.word), hint: g.hint };
  }
  lock(game, s, { ...word, verified: true, source: "fallback" });
  s.message = message;
  return { ok: true, locked: true, fallback: true, message };
}

// Everyone CONNECTED has a word: start solving now (anyone away gets a
// fallback — a setter who drops before locking).
function maybeStartSolve(game, presentPlayerIds, now) {
  if (game.phase !== "set") return false;
  const live = game.round.participants.filter((pid) => !game.removed.has(pid) && presentPlayerIds.includes(pid));
  if (!live.length || !live.every((pid) => game.round.setters.get(pid).locked)) return false;
  startSolve(game, now);
  return true;
}

function startSolve(game, now) {
  const r = game.round;
  for (const s of r.setters.values()) {
    if (!s.locked) assignFallback(game, s, s.checking ? "Time's up before the check came back, so here's a word for you." : "Time's up, so here's a word for you.");
    s.checking = false;
    s.pending = null;
  }
  for (const [solverId, b] of r.boards) {
    const word = r.setters.get(b.setterId).locked;
    b.length = word.grid.length;
    b.status = game.removed.has(solverId) ? "void" : "solving";
  }
  game.phase = "solve";
  setClock(game, r.speed ? CONFIG.speed.solveMs : CONFIG.solveMs, now);
}

// =====================================================================
// (b) solving
// =====================================================================

export function guess(game, pid, raw, presentPlayerIds = [], now = Date.now()) {
  if (game.phase !== "solve") return { ok: false, message: "It's not solving time." };
  const b = game.round.boards.get(pid);
  if (!b || game.removed.has(pid)) return { ok: false };
  if (b.status !== "solving") return { ok: false, message: "Your board is finished." };
  if (now > game.deadline + CONFIG.graceMs) return { ok: false, message: "Time's up." };
  const g = cleanGuess(raw, b.length);
  if (!g) return { ok: false, message: `Type ${b.length} letters.` };
  const target = game.round.setters.get(b.setterId).locked.grid;
  const pattern = feedback(g, target);
  b.guesses.push({ guess: g, pattern });
  if (pattern === solvedPattern(b.length)) b.status = "solved";
  else if (b.guesses.length >= guessesAllowed(b.length)) b.status = "failed";
  const out = { ok: true, pattern, status: b.status, guessCount: b.guesses.length };
  maybeReveal(game, presentPlayerIds, now);
  return out;
}

function maybeReveal(game, presentPlayerIds, now) {
  if (game.phase !== "solve") return false;
  if ([...game.round.boards.values()].some((b) => b.status === "solving")) return false;
  reveal(game, presentPlayerIds, now);
  return true;
}

// =====================================================================
// (d) scoring, reveal, voiding
// =====================================================================

// Close the round. Anyone still solving FAILED (time ran out) — unless
// they're away right now, or the host forced past them: that pairing is
// VOID instead, nobody scores.
function reveal(game, presentPlayerIds, now, { force = false } = {}) {
  const r = game.round;
  for (const [solverId, b] of r.boards) {
    if (b.status !== "solving") continue;
    b.status = force || !presentPlayerIds.includes(solverId) ? "void" : "failed";
  }
  const points = {};
  const rows = r.pairs.map(({ solverId, setterId }) => {
    const b = r.boards.get(solverId);
    const w = r.setters.get(setterId).locked;
    const sc = scorePairing(w.grid.length, b.status, b.guesses.length);
    points[solverId] = (points[solverId] ?? 0) + sc.solver;
    points[setterId] = (points[setterId] ?? 0) + sc.setter;
    return {
      solverId,
      setterId,
      word: w.grid,
      display: w.display,
      prompt: w.promptId ? PROMPTS_BY_ID[w.promptId].text : null,
      hint: w.hint ?? null,
      verified: w.verified,
      fallback: w.source === "fallback",
      status: b.status,
      guessCount: b.guesses.length,
      maxGuesses: guessesAllowed(w.grid.length),
      pot: sc.pot,
      solverPoints: sc.solver,
      setterPoints: sc.setter,
      patterns: b.guesses.map((x) => x.pattern), // colours only, for the reveal's mini board
    };
  });
  for (const [pid, pts] of Object.entries(points)) game.scores.set(pid, (game.scores.get(pid) ?? 0) + pts);
  for (const s of r.setters.values()) game.usedWords.add(s.locked.grid);
  r.result = { rows, points };
  game.history.push({ roundIndex: game.roundIndex, rows: rows.map(({ solverId, setterId, display, status, guessCount }) => ({ solverId, setterId, display, status, guessCount })) });
  game.phase = "reveal";
  setClock(game, CONFIG.revealMs, now);
}

export function nextRound(game, now = Date.now()) {
  if (game.phase !== "reveal") return { ok: false };
  if (game.roundIndex + 1 >= game.totalRounds) {
    finish(game);
    return { ok: true };
  }
  game.roundIndex += 1;
  dealRound(game, now);
  return { ok: true };
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

// A check that's still with the AI when the set clock runs out gets this
// long to land before its setter is handed a fallback.
const CHECK_OVERRUN_MS = 3_000;

export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "set": {
      if (maybeStartSolve(game, presentPlayerIds, now)) return true;
      if (now < game.deadline + CONFIG.graceMs) return false;
      const waiting = [...game.round.setters.values()].some((s) => s.checking);
      if (waiting && now < game.deadline + CHECK_OVERRUN_MS) return false;
      startSolve(game, now);
      return true;
    }
    case "solve":
      if (maybeReveal(game, presentPlayerIds, now)) return true;
      if (now < game.deadline + CONFIG.graceMs) return false;
      reveal(game, presentPlayerIds, now);
      return true;
    case "reveal":
      if (now < game.deadline) return false;
      nextRound(game, now);
      return true;
    default:
      return false;
  }
}

// `final` = someone is gone for good (rejoin grace expired, or kicked).
// `roomPlayerIds` tells who actually left from who's just inside their
// grace window.
export function reconcilePresence(game, presentPlayerIds, { final = false, roomPlayerIds = null } = {}) {
  if (final) {
    const inRoom = roomPlayerIds ?? presentPlayerIds;
    for (const pid of game.order.filter((p) => !inRoom.includes(p) && !game.removed.has(p))) {
      removeFromGame(game, pid);
    }
  }
  // Phase changes this may unlock (everyone left has a word; every board
  // left is finished) happen on the next tick(), which re-sends private
  // state — a raw disconnect doesn't.
}

// Gone for good. As a SOLVER their pairing is void; as a SETTER their word
// stays in play (a fallback if they hadn't locked one by the set clock).
function removeFromGame(game, pid) {
  game.removed.add(pid);
  if (game.phase === "final") return;
  if (participants(game).length < minPlayers) return finish(game);
  const b = game.round?.boards.get(pid);
  if (b && (b.status === "solving" || b.status === "waiting")) b.status = "void";
}

// Host "Force proceed": set -> unlocked players get fallbacks, solving
// starts; solve -> unfinished pairings are void; reveal -> next round.
export function forceAdvance(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "set":
      startSolve(game, now);
      break;
    case "solve":
      reveal(game, presentPlayerIds, now, { force: true });
      break;
    case "reveal":
      nextRound(game, now);
      break;
    default:
      break;
  }
}

// Chaos: only this round's active participants.
export function chaosParticipants(game, roster) {
  const inRound = game.round?.participants ?? [];
  return roster.filter((pid) => inRound.includes(pid) && !game.removed.has(pid));
}

export function tournamentOptions() {
  return { mode: CONFIG.defaultMode, rounds: CONFIG.rounds.dflt };
}

export function getFinalStandings(game) {
  return currentScores(game);
}

function currentScores(game) {
  return game.order
    .filter((pid) => !game.removed.has(pid))
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

// =====================================================================
// views
// =====================================================================

// PUBLIC — identical for everyone. Counts and statuses only until the
// reveal: no words, no lengths, no feedback.
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const r = game.round;
  const scores = currentScores(game);
  const state = {
    id: game.id,
    phase: game.phase,
    mode: game.mode,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    serial: game.serial,
    order: game.order,
    participantIds: r ? r.participants.filter((pid) => !game.removed.has(pid)) : [],
    removedIds: [...game.removed],
    scores,
    speed: r?.speed ?? false,
    windowMs: game.windowMs,
    msLeft: game.deadline != null ? Math.max(0, game.deadline - now) : null,
    config: { setMs: CONFIG.setMs, solveMs: CONFIG.solveMs, hintAfterGuess: CONFIG.hintAfterGuess, word: CONFIG.word },
  };
  if (r && (game.phase === "set" || game.phase === "solve")) {
    state.pairs = r.pairs.map(({ solverId, setterId }) => {
      const b = r.boards.get(solverId);
      return { solverId, setterId, guessCount: b.guesses.length, status: b.status };
    });
  }
  if (game.phase === "set") {
    state.lockedIds = r.participants.filter((pid) => r.setters.get(pid).locked);
    state.leadMsLeft = Math.max(0, game.deadline - game.windowMs - now); // a Chaos takeover still playing
  }
  if (game.phase === "reveal") state.result = r.result;
  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((x) => x.score === top).map((x) => x.playerId) : [];
    state.history = game.history;
  }
  return state;
}

// PRIVATE — your own setting state, then your own board. `serial` ties it
// to one round so a client never shows last round's word.
export function getPrivateState(game, playerId) {
  const r = game.round;
  if (!r || game.removed.has(playerId) || !r.participants.includes(playerId)) return null;
  if (game.phase !== "set" && game.phase !== "solve") return null;
  const s = r.setters.get(playerId);
  const solverId = r.pairs.find((p) => p.setterId === playerId)?.solverId ?? null;
  const mine = s.locked ? { display: s.locked.display, grid: s.locked.grid, fallback: s.locked.source === "fallback", verified: s.locked.verified } : null;

  if (game.phase === "set") {
    return {
      wordHeist: {
        serial: r.serial,
        phase: "set",
        prompts: s.prompts ? s.prompts.map((p) => ({ id: p, text: PROMPTS_BY_ID[p].text })) : null,
        promptId: s.promptId,
        pending: s.pending ? { display: s.pending.display, grid: s.pending.grid } : null,
        locked: mine,
        checking: s.checking,
        checksLeft: Math.max(0, CONFIG.checksPerRound - s.checksUsed),
        message: s.message,
        solverId,
      },
    };
  }

  const b = r.boards.get(playerId);
  const target = r.setters.get(b.setterId).locked;
  // (A prompted word with no prompt left only happens if both offered
  // prompts ran dry: it falls back to a hint too.)
  const showHint = (game.mode === "free" || !target.promptId) && b.guesses.length >= CONFIG.hintAfterGuess;
  const solver = r.boards.get(solverId);
  return {
    wordHeist: {
      serial: r.serial,
      phase: "solve",
      board: {
        setterId: b.setterId,
        length: b.length,
        maxGuesses: guessesAllowed(b.length),
        guesses: b.guesses.map((x) => ({ ...x })),
        status: b.status,
        prompt: target.promptId ? PROMPTS_BY_ID[target.promptId].text : null,
        // Free choice, after guess 3: the category hint — or, for an
        // unverified word (no hint), its first letter.
        hint: showHint && target.hint ? target.hint : null,
        firstLetter: showHint && !target.hint ? target.grid[0] : null,
      },
      myWord: { ...mine, solverId, guessCount: solver?.guesses.length ?? 0, status: solver?.status ?? null },
    },
  };
}

// For tests: the grid form of what a player typed.
export { gridForm };
