// "Bomb Squad" (working title, bombSquad/config.js NAME) — talk a bomb
// down in pairs.
//
// Players are split into pairs (one TRIO if the count is odd). In a pair,
// the DEFUSER sees the bomb but not the manual; the EXPERT sees the manual
// but not the bomb. In a trio, two Experts split the manual's chapters.
// Roles rotate every round. Two PLAY STYLES:
//
//   "turns"    pairs play ONE AT A TIME in a random order; everyone else
//              spectates (a read-only mirror) and bets.
//              per turn:  ready (10s) -> live -> result;  then summary
//   "together" every pair plays its OWN bomb AT THE SAME TIME: one shared
//              10s get-ready, every fuse lit at the same server time, each
//              bomb with its own fuse, strikes and result. No spectators.
//              ready (10s) -> live (until every bomb has ended) -> result
//              (the last card) -> summary
//
// Every pair in a round gets the SAME module lineup and sizes (equal
// difficulty) but its own seed: its own serial number, module states and
// manual VARIANT (the rules, generated as data by each module plug-in in
// bombSquad/modules/). The server checks every action against those same
// rules, and the Expert's manual is rendered from them, so the two can't
// disagree. Before any bomb starts, the server plays it through with its
// own solver (bombSquad/verify.js) and regenerates it if anything's off.
//
// PRIVACY (verify in real traffic):
//   * The manual goes ONLY to that bomb's Experts (in a trio, each Expert
//     gets their chapters + the general page).
//   * The bomb (serial, module states) goes ONLY to its Defuser and, in
//     "turns", as a read-only mirror to spectators. Experts get the fuse and
//     strikes, never module states or the serial.
//   * Strike details ("what went wrong") only once that bomb has ended.
//   * "together": nothing of one pair's bomb reaches another pair — the
//     public state carries each bomb's status only (live / defused /
//     exploded / forfeit); fuse, strikes and results go privately.
//
// The fuse is server-authoritative: each strike re-anchors it and makes it
// run 25% faster; clients get { leftMs, rate } and extrapolate. Pure state
// + timestamps; server/index.js drives tick().

import { CONFIG, NAME, defusePoints, resolveSettings } from "./bombSquad/config.js";
import { MODULES, MODULE_IDS } from "./bombSquad/modules/index.js";
import { hashSeed, makeRng } from "./bombSquad/rng.js";
import { verifyModule, fakeSecondsAt } from "./bombSquad/verify.js";
import { clock, generalPage, makeSerial } from "./bombSquad/vocab.js";

export const id = "bomb-squad";
export const name = NAME;
export const minPlayers = CONFIG.minPlayers;
export const maxPlayers = CONFIG.maxPlayers;
export { CONFIG };

// =====================================================================
// pairing
// =====================================================================

// Random pairs; with an odd count the last group is a trio.
export function makePairing(playerIds, rng = makeRng(Math.floor(Math.random() * 2 ** 32))) {
  const ids = rng.shuffle(playerIds);
  const groups = [];
  for (let i = 0; i + 1 < ids.length; i += 2) groups.push([ids[i], ids[i + 1]]);
  if (ids.length % 2) groups[groups.length - 1].push(ids[ids.length - 1]);
  return groups;
}

// A pairing the host rolled in the lobby is used only if it still covers
// exactly the players starting the game.
export function validPairing(groups, playerIds) {
  if (!Array.isArray(groups) || !groups.length) return false;
  const flat = groups.flat();
  if (flat.length !== playerIds.length || new Set(flat).size !== flat.length) return false;
  if (!flat.every((p) => playerIds.includes(p))) return false;
  const trios = groups.filter((g) => g.length === 3).length;
  return groups.every((g) => g.length === 2 || g.length === 3) && trios === playerIds.length % 2;
}

// =====================================================================
// lifecycle
// =====================================================================

export function createGame(playerIds, options = {}) {
  if (playerIds.length < minPlayers) throw new Error(`${name} needs at least ${minPlayers} players.`);
  if (playerIds.length > maxPlayers) throw new Error(`${name} supports at most ${maxPlayers} players.`);
  const settings = resolveSettings(options);
  const seed = Number.isInteger(options.seed) ? options.seed : Math.floor(Math.random() * 2 ** 32);
  const rng = makeRng(seed);
  const groups = validPairing(options.pairing, playerIds) ? options.pairing : makePairing(playerIds, rng);
  const game = {
    id,
    settings,
    difficulty: settings.difficulty,
    style: settings.playStyle,
    totalRounds: settings.rounds,
    roundIndex: 0,
    groups: groups.map((members, i) => ({ id: i, members: [...members] })),
    participants: [...playerIds],
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    removed: new Set(),
    rng,
    lastLineupKey: null,
    turnSerial: 0,
    phase: "ready",
    deadline: null,
    windowMs: null,
    round: null,
    turn: null, // "turns": the bomb being played
    bombs: new Map(), // "together": groupId -> bomb
    history: [],
    checkFailures: 0,
  };
  startRound(game, Date.now());
  return game;
}

const active = (game, ids) => ids.filter((pid) => !game.removed.has(pid));
const together = (game) => game.style === "together";

// This round's roles for a group: the Defuser rotates through the members
// still in the game (a pair swaps, a trio rotates).
export function rolesFor(game, group, roundIndex = game.roundIndex) {
  const live = active(game, group.members);
  if (live.length < 2) return null;
  const defuserId = live[roundIndex % live.length];
  return { defuserId, expertIds: live.filter((p) => p !== defuserId) };
}

// Same module types + sizes for every pair this round; a different set of
// types from last round whenever there's a choice; never a module twice.
// (Every module weighs the same 1 point in the scoring formula, so any
// lineup of N modules is the same difficulty.)
function chooseLineup(game) {
  const want = Math.min(CONFIG.difficulties[game.difficulty].modules, MODULE_IDS.length);
  let types = null;
  for (let i = 0; i < 30; i++) {
    types = game.rng.sample(MODULE_IDS, want);
    if ([...types].sort().join() !== game.lastLineupKey) break;
  }
  game.lastLineupKey = [...types].sort().join();
  return { types, params: Object.fromEntries(types.map((t) => [t, MODULES[t].params(game.rng, game.difficulty)])) };
}

function startRound(game, now) {
  game.round = {
    index: game.roundIndex,
    lineup: chooseLineup(game),
    order: game.rng.shuffle(game.groups.map((g) => g.id)),
    pos: -1,
    results: [],
  };
  if (together(game)) {
    // Every pair's bomb and manual now; one shared get-ready.
    game.turn = null;
    game.bombs = new Map();
    for (const g of game.groups) game.bombs.set(g.id, makeBomb(game, g, now));
    game.phase = "ready";
    setClock(game, CONFIG.readyMs, now);
    for (const bomb of game.bombs.values()) if (!bomb.roles || bomb.broken) endBomb(game, bomb, "forfeit", now, bomb.broken ? "check" : "short");
    return;
  }
  nextTurn(game, now);
}

function setClock(game, ms, now) {
  game.windowMs = ms;
  game.deadline = now + ms;
}

// "turns": the ONLY way the turn moves — exactly one step down the order.
function nextTurn(game, now) {
  const r = game.round;
  r.pos += 1;
  if (r.pos >= r.order.length) {
    game.turn = null;
    game.phase = "summary";
    setClock(game, CONFIG.summaryMs, now);
    return;
  }
  const group = game.groups[r.order[r.pos]];
  game.turn = makeBomb(game, group, now);
  // A partner left the game for good, or no bomb passed the safety check.
  if (!game.turn.roles || game.turn.broken) return endBomb(game, game.turn, "forfeit", now, game.turn.broken ? "check" : "short");
  game.phase = "ready";
  setClock(game, CONFIG.readyMs, now);
}

// One bomb for one group: rules (the manual variant), module states and a
// serial from a fresh seed — played through by the server's own solver
// first. A bomb that fails is regenerated (up to CONFIG.generationTries)
// and logged; one that never passes is never started (it's forfeit).
function makeBomb(game, group, now) {
  const roles = rolesFor(game, group);
  game.turnSerial += 1;
  const { types, params } = game.round.lineup;
  let built = null;
  for (let attempt = 1; attempt <= CONFIG.generationTries && !built; attempt++) {
    const seed = game.rng.seed();
    const inst = makeRng(seed);
    const modules = types.map((type) => {
      const rules = MODULES[type].generateRules(hashSeed(`${seed}:${type}`), params[type]);
      return { type, rules, state: MODULES[type].createInstance(inst, rules, params[type]), solved: false, rev: 0 };
    });
    const serialNo = makeSerial(inst);
    try {
      const ctx = { serial: serialNo, strikes: 0, at: 0, secondsAt: fakeSecondsAt, timeAt: () => "0:00" };
      for (const m of modules) verifyModule(MODULES[m.type], m.rules, m.state, ctx);
      built = { seed, inst, modules, serialNo };
    } catch (err) {
      game.checkFailures += 1;
      console.warn(`[bomb-squad] safety check failed (attempt ${attempt}, seed ${seed}): ${err.message}`);
    }
  }
  // QA only: BOMB_SQUAD_QA_FUSE_MS shortens every fuse (to test a fuse
  // running out without a 4-minute wait). Unset in production.
  const fuseMs = Number(process.env.BOMB_SQUAD_QA_FUSE_MS) || CONFIG.difficulties[game.difficulty].fuseMs;
  return {
    serial: game.turnSerial,
    groupId: group.id,
    roles,
    defuserId: roles?.defuserId ?? null,
    expertIds: roles?.expertIds ?? [],
    // Trio: alternating chapters (by module position), randomly assigned.
    split: roles && roles.expertIds.length === 2 && built ? (built.inst.chance(0.5) ? 0 : 1) : null,
    seed: built?.seed ?? null,
    serialNo: built?.serialNo ?? "",
    modules: built?.modules ?? [],
    broken: !built,
    strikes: 0,
    strikeLog: [],
    lastSeq: 0, // the Defuser's last processed action number (see act)
    fuse: { totalMs: fuseMs, leftMs: fuseMs, anchorAt: null, rate: 1, paused: false },
    bets: new Map(),
    outcome: built ? null : "forfeit",
    reason: built ? null : "check",
    points: 0,
    endedLeftMs: null,
    betWinners: [],
    result: null,
  };
}

// ---- the fuse ----------------------------------------------------------
export function fuseLeft(turn, now) {
  const f = turn.fuse;
  if (f.anchorAt == null || f.paused) return f.leftMs;
  return f.leftMs - (now - f.anchorAt) * f.rate;
}

function reanchor(turn, now) {
  turn.fuse.leftMs = fuseLeft(turn, now);
  if (turn.fuse.anchorAt != null && !turn.fuse.paused) turn.fuse.anchorAt = now;
}

// The timer's two "seconds" digits at server time `at` — the same formula
// the client draws (mm:ss of the rounded-up seconds left).
export function secondsAt(turn, at) {
  const secs = Math.ceil(Math.max(0, fuseLeft(turn, at)) / 1000);
  return String(secs % 60).padStart(2, "0");
}

function lightFuses(game, now) {
  game.phase = "live";
  game.deadline = null;
  game.windowMs = null;
  for (const bomb of bombsOf(game)) {
    if (bomb.outcome) continue;
    bomb.fuse.anchorAt = now; // the same server instant for all
    startModules(bomb, now, "start");
  }
}

// Modules with a live clock of their own (Simon's flashes) start, or
// restart after a pause, here.
function startModules(turn, now, reason) {
  for (const m of turn.modules) {
    const mod = MODULES[m.type];
    if (m.solved || !mod.start) continue;
    mod.start(m.state, now, reason);
    m.rev += 1;
  }
}

function pause(turn, now) {
  if (turn.fuse.paused) return;
  turn.fuse.leftMs = fuseLeft(turn, now);
  turn.fuse.paused = true;
}

function resume(turn, now) {
  if (!turn.fuse.paused) return;
  turn.fuse.paused = false;
  turn.fuse.anchorAt = now;
  startModules(turn, now, "resume"); // the Defuser is back: show them the flashes again
}

// Every bomb this round: the one in play ("turns"), or all ("together").
export function bombsOf(game) {
  return together(game) ? [...game.bombs.values()] : game.turn ? [game.turn] : [];
}

const teamOf = (bomb) => [bomb.defuserId, ...bomb.expertIds].filter(Boolean);

// The bomb `pid` is on this round (as Defuser or Expert), if any.
export function bombFor(game, pid) {
  return bombsOf(game).find((b) => teamOf(b).includes(pid)) ?? null;
}

// =====================================================================
// actions
// =====================================================================

// The ack every action gets back: the module's fresh view and revision, so
// the client never drifts from the server (it keeps whichever view of a
// module has the highest rev, ack or push).
function ackOf(turn, m, now) {
  return { module: { index: turn.modules.indexOf(m), rev: m.rev, solved: m.solved, view: MODULES[m.type].view(m.state, now) }, lastSeq: turn.lastSeq, strikes: turn.strikes };
}

// The Defuser acts on one module of THEIR bomb. `halfRttMs` (from
// server/latency.js) backs the moment out to when the player actually did it.
//
// `seq` is the client's action number for this bomb (1, 2, 3 …, carried on
// from the bomb's lastSeq after a reload). Actions are processed in order;
// one numbered at or below the last processed is a duplicate (a resend, or
// a stale copy that arrived late) and is dropped without being judged.
// Then the module's own gate (if any) checks the action is for the step
// the server is on (Simon: not during playback, the right stage + index).
// Every outcome is acked with the module's fresh view.
export function act(game, pid, { turn: turnSerial, module: idx, seq, ...a }, { now = Date.now(), halfRttMs = 0 } = {}) {
  const turn = bombsOf(game).find((b) => b.defuserId === pid);
  if (!turn) return { ok: false, message: "Only the Defuser can touch the bomb." };
  if (game.phase !== "live" || turn.outcome || turn.serial !== turnSerial) return { ok: false, message: "That bomb isn't live." };
  const m = turn.modules[idx];
  if (!m) return { ok: false };
  if (Number.isInteger(seq)) {
    if (seq <= turn.lastSeq) return { ok: false, reason: "duplicate", ...ackOf(turn, m, now) };
    turn.lastSeq = seq;
  }
  if (turn.fuse.paused) return { ok: false, reason: "paused", message: "Paused: waiting for your partner.", ...ackOf(turn, m, now) };
  if (m.solved) return { ok: false, reason: "solved", ...ackOf(turn, m, now) };
  const mod = MODULES[m.type];
  const gated = mod.gate?.(m.state, a, now);
  if (gated) return { ok: false, ...gated, ...ackOf(turn, m, now) };
  const at = now - Math.min(Math.max(0, halfRttMs), CONFIG.button.maxHalfRttMs);
  const ctx = {
    serial: turn.serialNo,
    strikes: turn.strikes,
    at,
    now,
    secondsAt: (ms) => secondsAt(turn, ms),
    timeAt: (ms) => clock(fuseLeft(turn, ms)),
  };
  const before = structuredClone(m.state);
  const res = mod.act(m.rules, m.state, a, ctx);
  if (!res.valid) return { ok: false, reason: "invalid", ...ackOf(turn, m, now) };
  m.rev += 1;
  const out = { ok: true, strike: !!res.strike, solved: !!res.solved };
  const ack = () => Object.assign(out, ackOf(turn, m, now));
  if (res.strike) {
    // "What went wrong", revealed only after the bomb ends.
    const entry = mod.describe(m.rules, before, a, ctx);
    turn.strikeLog.push({ module: m.type, did: entry.did, expected: entry.expected, msLeft: Math.round(Math.max(0, fuseLeft(turn, now))) });
    reanchor(turn, now);
    turn.strikes += 1;
    turn.fuse.rate = CONFIG.strikeRate ** turn.strikes;
    if (turn.strikes >= CONFIG.strikesToExplode) {
      endBomb(game, turn, "exploded", now, "strikes");
      out.exploded = true;
      return ack();
    }
  }
  if (res.solved) {
    m.solved = true;
    if (turn.modules.every((x) => x.solved)) {
      endBomb(game, turn, "defused", now);
      out.defused = true;
    }
  }
  return ack();
}

// Spectators ("turns" only): "defused" or "boom", during the get-ready.
export function bet(game, pid, choice) {
  const turn = game.turn;
  if (together(game)) return { ok: false, message: "No spectators when every pair plays at once." };
  if (game.phase !== "ready" || !turn) return { ok: false, message: "Bets are closed." };
  if (!["defused", "boom"].includes(choice)) return { ok: false };
  if (!game.participants.includes(pid) || game.removed.has(pid)) return { ok: false };
  if (game.groups[turn.groupId].members.includes(pid)) return { ok: false, message: "You're on this bomb!" };
  turn.bets.set(pid, choice);
  return { ok: true };
}

function endBomb(game, turn, outcome, now, reason = null) {
  if (turn.result) return;
  reanchor(turn, now);
  turn.endedLeftMs = Math.round(Math.max(0, fuseLeft(turn, now)));
  turn.fuse.anchorAt = null;
  turn.outcome = outcome;
  turn.reason = reason ?? turn.reason;
  const team = teamOf(turn);
  if (outcome === "defused") {
    turn.points = defusePoints({ modules: turn.modules.length, msLeft: turn.endedLeftMs, strikes: turn.strikes });
    for (const pid of team) game.scores.set(pid, (game.scores.get(pid) ?? 0) + turn.points);
  }
  // Bets pay on a real defuse or explosion; a forfeit voids them.
  if (outcome !== "forfeit") {
    const right = outcome === "defused" ? "defused" : "boom";
    for (const [pid, choice] of turn.bets) {
      if (choice !== right || game.removed.has(pid)) continue;
      game.scores.set(pid, (game.scores.get(pid) ?? 0) + CONFIG.betPoints);
      turn.betWinners.push(pid);
    }
  }
  turn.result = {
    serial: turn.serial,
    groupId: turn.groupId,
    defuserId: turn.defuserId,
    expertIds: [...turn.expertIds],
    outcome,
    reason: turn.reason,
    points: turn.points,
    msLeft: turn.endedLeftMs,
    strikes: turn.strikes,
    modules: turn.modules.length,
    modulesSolved: turn.modules.filter((m) => m.solved).length,
    betWinners: [...turn.betWinners],
    // "What went wrong": every strike in order, plus what was left unsolved
    // if the fuse ran out.
    strikeLog: turn.strikeLog,
    unsolved: outcome === "exploded" && turn.reason === "time" ? turn.modules.filter((m) => !m.solved).map((m) => m.type) : [],
  };
  game.round.results.push(turn.result);
  if (!together(game)) {
    game.phase = "result";
    setClock(game, CONFIG.resultMs, now);
  } else if (bombsOf(game).every((b) => b.result)) {
    // The last pair still gets its result card before the summary.
    game.phase = "result";
    setClock(game, CONFIG.resultMs, now);
  }
}

function toSummary(game, now) {
  game.phase = "summary";
  setClock(game, CONFIG.summaryMs, now);
}

// =====================================================================
// clocks + framework hooks
// =====================================================================

export function tick(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "ready":
      if (now < game.deadline) return false;
      lightFuses(game, now);
      return true;
    case "live": {
      let changed = false;
      for (const turn of bombsOf(game)) {
        if (turn.outcome) continue;
        // A bomb's fuse waits while its Defuser, or every Expert, is away.
        const here = presentPlayerIds.includes(turn.defuserId) && turn.expertIds.some((p) => presentPlayerIds.includes(p));
        if (!here && !turn.fuse.paused) {
          pause(turn, now);
          changed = true;
        } else if (here && turn.fuse.paused) {
          resume(turn, now);
          changed = true;
        } else if (!turn.fuse.paused && fuseLeft(turn, now) <= 0) {
          endBomb(game, turn, "exploded", now, "time");
          changed = true;
          if (game.phase !== "live") break;
        } else if (!turn.fuse.paused) {
          // Module clocks: Simon's playback ending / its inactivity replay.
          for (const m of turn.modules) {
            const mod = MODULES[m.type];
            if (m.solved || !mod.tick || !mod.tick(m.state, now)) continue;
            m.rev += 1;
            changed = true;
          }
        }
      }
      return changed;
    }
    case "result":
      if (now < game.deadline) return false;
      if (together(game)) toSummary(game, now);
      else nextTurn(game, now);
      return true;
    case "summary":
      if (now < game.deadline) return false;
      nextRound(game, now);
      return true;
    default:
      return false;
  }
}

export function nextRound(game, now = Date.now()) {
  if (game.phase !== "summary") return { ok: false };
  game.history.push({ roundIndex: game.roundIndex, results: game.round.results });
  if (game.roundIndex + 1 >= game.totalRounds) {
    finish(game);
    return { ok: true };
  }
  game.roundIndex += 1;
  startRound(game, now);
  return { ok: true };
}

function finish(game) {
  game.phase = "final";
  game.turn = null;
  game.bombs = new Map();
  game.deadline = null;
  game.windowMs = null;
}

// Gone for good (grace expired or kicked). A Defuser or the last Expert
// leaving mid-bomb forfeits THAT bomb; one Expert of a trio leaving hands
// the other the whole manual.
export function reconcilePresence(game, presentPlayerIds, { final = false, roomPlayerIds = null } = {}) {
  if (!final) return; // a blip just pauses that bomb's fuse (tick)
  const now = Date.now();
  const inRoom = roomPlayerIds ?? presentPlayerIds;
  for (const pid of game.participants.filter((p) => !inRoom.includes(p) && !game.removed.has(p))) {
    game.removed.add(pid);
    if (game.turn) game.turn.bets.delete(pid);
    if (game.phase === "final") continue;
    if (game.participants.filter((p) => !game.removed.has(p)).length < minPlayers) {
      finish(game);
      continue;
    }
    if (!["ready", "live"].includes(game.phase)) continue;
    const turn = bombsOf(game).find((b) => !b.outcome && teamOf(b).includes(pid));
    if (!turn) continue;
    if (pid === turn.defuserId) {
      endBomb(game, turn, "forfeit", now, "left");
    } else {
      turn.expertIds = turn.expertIds.filter((p) => p !== pid);
      turn.split = null; // the remaining Expert gets the full manual
      if (!turn.expertIds.length) endBomb(game, turn, "forfeit", now, "left");
    }
  }
}

// Host: skip a pair (it forfeits its bomb). "together": `groupId` says which.
export function skipPair(game, groupId = null, now = Date.now()) {
  if (!["ready", "live"].includes(game.phase)) return { ok: false };
  const turn = together(game) ? game.bombs.get(groupId) : game.turn;
  if (!turn || turn.outcome) return { ok: false };
  endBomb(game, turn, "forfeit", now, "skipped");
  return { ok: true };
}

// Host "Force proceed": light the fuse(s) now / end the bomb(s) still
// running as forfeits / on to the next pair / on to the next round.
export function forceAdvance(game, presentPlayerIds, now = Date.now()) {
  switch (game.phase) {
    case "ready":
      lightFuses(game, now);
      break;
    case "live":
      for (const turn of bombsOf(game)) if (!turn.outcome) endBomb(game, turn, "forfeit", now, "skipped");
      break;
    case "result":
      if (together(game)) toSummary(game, now);
      else nextTurn(game, now);
      break;
    case "summary":
      nextRound(game, now);
      break;
    default:
      break;
  }
}

export function tournamentOptions() {
  return { difficulty: CONFIG.defaultDifficulty, rounds: CONFIG.rounds.dflt, playStyle: CONFIG.defaultPlayStyle };
}

export function getFinalStandings(game) {
  return currentScores(game);
}

function currentScores(game) {
  return active(game, game.participants)
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

// =====================================================================
// views
// =====================================================================

// A bomb's public face: fuse and strikes (what an Expert may see), roles,
// and its result once it has ended.
function turnView(game, turn, now, { withLog = true } = {}) {
  const view = {
    serial: turn.serial,
    groupId: turn.groupId,
    defuserId: turn.defuserId,
    expertIds: turn.expertIds,
    strikes: turn.strikes,
    fuse: {
      totalMs: turn.fuse.totalMs,
      leftMs: Math.max(0, turn.outcome ? turn.endedLeftMs : fuseLeft(turn, now)),
      rate: turn.fuse.rate,
      running: game.phase === "live" && !turn.outcome && !turn.fuse.paused,
      paused: turn.fuse.paused,
    },
    betCount: turn.bets.size,
    outcome: turn.outcome,
  };
  if (turn.result) view.result = withLog ? turn.result : stripLog(turn.result);
  return view;
}

const stripLog = ({ strikeLog, unsolved, ...rest }) => rest;

// The round's results ranked: points, then fuse time left.
const ranked = (results) => [...results].sort((a, b) => b.points - a.points || b.msLeft - a.msLeft);

// PUBLIC — identical for everyone. Never the rules, the serial or module
// states. "together": each bomb's status only, until the round is over.
export function getPublicState(game, presentPlayerIds, now = Date.now()) {
  const scores = currentScores(game);
  const over = game.phase === "summary" || game.phase === "final";
  const state = {
    id: game.id,
    phase: game.phase,
    style: game.style,
    difficulty: game.difficulty,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    groups: game.groups.map((g) => ({ id: g.id, members: g.members, roles: rolesFor(game, g) })),
    removedIds: [...game.removed],
    lineup: game.round?.lineup.types ?? [],
    order: game.round?.order ?? [],
    pos: game.round?.pos ?? 0,
    // The round's results: in "turns" as each pair finishes (everyone
    // watched); in "together" only once every bomb has ended.
    results: !together(game) || over ? ranked(game.round?.results ?? []).map(stripLog) : [],
    scores,
    windowMs: game.windowMs,
    msLeft: game.deadline != null ? Math.max(0, game.deadline - now) : null,
    config: { strikesToExplode: CONFIG.strikesToExplode, strikeRate: CONFIG.strikeRate },
  };
  if (together(game)) {
    state.bombs = [...game.bombs.values()].map((b) => ({
      groupId: b.groupId,
      defuserId: b.defuserId,
      expertIds: b.expertIds,
      status: b.outcome ?? (game.phase === "ready" ? "ready" : "live"),
    }));
  } else if (game.turn) {
    state.turn = turnView(game, game.turn, now);
  }
  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds = top > 0 ? scores.filter((x) => x.score === top).map((x) => x.playerId) : [];
    state.history = game.history.map((h) => ({ roundIndex: h.roundIndex, results: h.results.map(stripLog) }));
  }
  return state;
}

// What the Defuser and spectators see of the bomb: never the rules.
// `lastSeq` lets a reloaded Defuser carry on numbering its actions; `rev`
// orders this push against acks (the client keeps the newest).
function bombView(turn, now) {
  return {
    serialNo: turn.serialNo,
    lastSeq: turn.lastSeq,
    modules: turn.modules.map((m, i) => ({ index: i, type: m.type, solved: m.solved, rev: m.rev, view: MODULES[m.type].view(m.state, now) })),
  };
}

// The Expert's manual: the general page + their chapters, rendered ONLY
// from this pair's rules. In a trio each Expert gets alternating chapters.
function manualFor(turn, pid) {
  const which = turn.split == null ? null : (turn.expertIds.indexOf(pid) + turn.split) % 2;
  const chapters = turn.modules
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => which == null || i % 2 === which)
    .map(({ m }) => MODULES[m.type].renderManual(m.rules));
  return { general: generalPage(), chapters, split: turn.split != null };
}

// PRIVATE — by role on the current bomb(s).
export function getPrivateState(game, pid, now = Date.now()) {
  if (game.removed.has(pid) || !["ready", "live", "result", "summary"].includes(game.phase)) return null;
  if (together(game)) {
    const turn = bombFor(game, pid);
    if (!turn || game.phase === "summary") return null;
    const base = { serial: turn.serial, roundIndex: game.roundIndex, turn: turnView(game, turn, now) };
    if (pid === turn.defuserId) return { bombSquad: { ...base, role: "defuser", bomb: game.phase === "ready" ? null : bombView(turn, now) } };
    return { bombSquad: { ...base, role: "expert", manual: manualFor(turn, pid) } };
  }
  const turn = game.turn;
  if (!turn || game.phase === "summary") return null;
  const base = { serial: turn.serial, roundIndex: game.roundIndex };
  if (pid === turn.defuserId) {
    return { bombSquad: { ...base, role: "defuser", bomb: game.phase === "ready" ? null : bombView(turn, now) } };
  }
  if (turn.expertIds.includes(pid)) {
    return { bombSquad: { ...base, role: "expert", manual: manualFor(turn, pid) } };
  }
  // A partner of this group who is no longer on it (left) gets nothing.
  if (game.groups[turn.groupId].members.includes(pid)) return null;
  return {
    bombSquad: { ...base, role: "spectator", bomb: game.phase === "ready" ? null : bombView(turn, now), myBet: turn.bets.get(pid) ?? null },
  };
}
