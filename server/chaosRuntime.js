// Glue between the pure Chaos core (server/chaos.js) and a live room. This
// is the piece server/index.js talks to. It:
//   * tracks the host's frequency setting on the room,
//   * at each new scoring round: snapshots scores, rolls, and (on a hit)
//     applies instant / pre-round effects,
//   * when the round finishes scoring: resolves round-end modifiers and
//     rewrites game.scores,
//   * carries Player Disable forward to the next round,
//   * keeps Speed Round's 10s clock clamped,
//   * builds the `chaos` slice of the public room payload.
//
// One entry point does the per-tick work: chaosTick(room, deps), called
// from broadcastRoom BEFORE the room is serialised (same spot the
// tournament layer intercepts a finished game).

import {
  MODIFIERS,
  FREQUENCIES,
  rollChaos,
  pickModifier,
  applyInstant,
  resolveRoundEnd,
  applyDisable,
} from "./chaos.js";
import { chaosGameConfig, eligibleModifiers, SPEED_MS } from "./chaosGames.js";

// How long the server will accept a Risk It wager after the event fires.
// The client pop-up enforces the crisp 3-second decision feel; this is a
// lenient backstop (the takeover animation eats ~4s before the prompt).
const WAGER_MS = 9000;

export function defaultChaosFrequency() {
  return "off";
}

export function setChaosFrequency(room, freq) {
  if (!(freq in FREQUENCIES)) return { error: "Unknown chaos frequency." };
  room.chaosFrequency = freq;
  return { ok: true, frequency: freq };
}

function scoresToObj(map) {
  const out = {};
  if (map instanceof Map) for (const [k, v] of map) out[k] = v;
  return out;
}

function roundsLeftAfter(game) {
  const total = Number(game.totalRounds) || 0;
  const idx = Number(game.roundIndex) || 0;
  return Math.max(0, total - idx - 1);
}

// --- the per-tick driver -------------------------------------------

// Everyone still IN this game — the keys of game.scores. A player who
// fully leaves the room is pulled from game.scores by the framework;
// a momentary socket drop (backgrounded tab, locked phone, network
// blip — the norm on mobile) is NOT. Chaos scoring math must run over
// this stable set, never `connectedPlayerIds`: otherwise a player who
// blinked offline at round-settle gets their points left un-multiplied
// / skipped by every round-end and instant modifier.
function rosterOf(game, fallback) {
  const s = game?.scores;
  const ids = s instanceof Map ? [...s.keys()] : s && typeof s === "object" ? Object.keys(s) : [];
  return ids.length ? ids : fallback;
}

// deps: { connectedPlayerIds(room) -> string[] }
export function chaosTick(room, deps) {
  if (!room || room.status !== "in-game" || !room.game) return;
  const game = room.game;
  const cfg = chaosGameConfig(game.id);
  if (!cfg) return; // chaos-ineligible game (e.g. Imposter)

  const freq = room.chaosFrequency ?? "off";
  const roundKey = `${game.id}:${game.roundIndex}`;
  const phase = game.phase;
  const connected = deps.connectedPlayerIds(room);
  const present = rosterOf(game, connected);

  // 1) Settle anything owed on the round that just finished scoring.
  settle(room, cfg, roundKey, phase, present);

  // 2) New scoring round beginning — snapshot + roll (once per roundKey).
  const startingRound =
    cfg.rollPhases.includes(phase) && room.chaos?.roundKey !== roundKey;
  if (freq !== "off" && startingRound) {
    beginRound(room, cfg, game, roundKey, present);
  }

  // 3) Keep Speed Round's clock pinned to ~10s while its timed phase runs.
  if (
    room.chaos?.modifier?.id === "speed-round" &&
    room.chaos.roundKey === roundKey &&
    cfg.timer &&
    cfg.timer.phases.includes(phase)
  ) {
    const df = cfg.timer.deadlineField;
    const now = Date.now();
    if (typeof game[df] === "number" && game[df] - now > SPEED_MS + 500) {
      game[df] = now + SPEED_MS;
    }
  }
}

function beginRound(room, cfg, game, roundKey, present) {
  const totalsAtStart = scoresToObj(game.scores);
  const playerCount = present.length;

  // CHAOS_FORCE=1 makes every round fire (QA only); CHAOS_FORCE_MODIFIER
  // pins which one. Both are no-ops unless the env vars are set.
  const forced = process.env.CHAOS_FORCE === "1";
  const rolled = forced || rollChaos(room.chaosFrequency);
  let modifier = null;
  if (rolled) {
    const pool = eligibleModifiers(game.id, MODIFIERS, {
      playerCount,
      roundsLeft: roundsLeftAfter(game),
    });
    const pinned = process.env.CHAOS_FORCE_MODIFIER;
    modifier =
      (pinned && pool.find((m) => m.id === pinned)) || pickModifier(pool) || null;
  }

  room.chaos = {
    roundKey,
    roundIndex: game.roundIndex,
    modifier: modifier
      ? {
          id: modifier.id,
          name: modifier.name,
          blurb: modifier.blurb,
          timing: modifier.timing,
          interactive: modifier.interactive ?? null,
        }
      : null,
    announcedAt: modifier ? Date.now() : null,
    totalsAtStart,
    settled: !modifier || modifier.timing === "instant" || modifier.timing === "preround",
    result: null,
    wagers: {},
    wagerDeadline: null,
    rivalPair: null,
    disablePending: null,
  };

  if (!modifier) return;

  // INSTANT — rewrite totals right now.
  if (modifier.timing === "instant") {
    const { totals, summary, targets } = applyInstant(modifier.id, {
      totals: game.scores,
      presentIds: present,
    });
    game.scores = totals;
    room.chaos.result = {
      modifierId: modifier.id,
      name: modifier.name,
      summary,
      rows: [],
      targets: targets ?? [],
    };
    return;
  }

  // PRE-ROUND setup.
  if (modifier.id === "rival") {
    const shuffled = [...present].sort(() => Math.random() - 0.5);
    room.chaos.rivalPair = shuffled.slice(0, 2);
    // Show the pairing on the takeover straight away; the steal resolves at
    // round end.
    room.chaos.result = {
      modifierId: modifier.id,
      name: modifier.name,
      summary: "",
      rows: [],
      targets: room.chaos.rivalPair.map((id) => ({ playerId: id, tag: "rival" })),
    };
    room.chaos.settled = false;
    room.chaos.pendingRoundEnd = true;
  }
  if (modifier.id === "risk-it") {
    room.chaos.settled = false;
    room.chaos.pendingRoundEnd = true;
    room.chaos.wagerDeadline = Date.now() + WAGER_MS;
  }
  if (modifier.id === "speed-round") {
    // Clamp immediately if the timed phase is already live; otherwise the
    // per-tick step in chaosTick catches it when the phase opens.
    if (cfg.timer && cfg.timer.phases.includes(game.phase)) {
      const df = cfg.timer.deadlineField;
      const now = Date.now();
      if (typeof game[df] === "number" && game[df] - now > SPEED_MS) {
        game[df] = now + SPEED_MS;
      }
    }
  }

  // Steal / The Tyrant resolve at ROUND END now (their bite is a % of the
  // round's actual points), but we lock in WHO up front — by current total
  // standings — so the takeover can name them, and pass that choice through
  // to resolveRoundEnd so the announcement and the resolution always agree.
  if (modifier.id === "steal" || modifier.id === "the-tyrant") {
    const roster = present.filter((id) => id in totalsAtStart);
    const byTotal = (id) => totalsAtStart[id] ?? 0;
    const leaderId = extremeId(roster, byTotal, "max");
    const trailerId = extremeId(roster, byTotal, "min");
    room.chaos.principal = { leaderId, trailerId };
    room.chaos.settled = false;
    room.chaos.result = {
      modifierId: modifier.id,
      name: modifier.name,
      summary: "",
      rows: [],
      targets:
        modifier.id === "steal"
          ? leaderId && trailerId && leaderId !== trailerId
            ? [
                { playerId: trailerId, tag: "thief" },
                { playerId: leaderId, tag: "mark" },
              ]
            : []
          : leaderId
            ? [{ playerId: leaderId, tag: "tyrant" }]
            : [],
    };
  }
}

// First-wins extreme (no random tiebreak — the caller stores the result and
// passes it to resolveRoundEnd, so this pick is the authoritative one).
function extremeId(ids, valueOf, dir) {
  let best = null;
  for (const id of ids) {
    if (best === null) {
      best = id;
      continue;
    }
    const v = valueOf(id);
    const bv = valueOf(best);
    if ((dir === "max" && v > bv) || (dir === "min" && v < bv)) best = id;
  }
  return best;
}

function settle(room, cfg, roundKey, phase, present) {
  const chaos = room.chaos;
  const carry = room.chaosCarry;
  const inScored = cfg.scoredPhases.includes(phase);
  if (!inScored) return;

  const game = room.game;

  // A) This round's own round-end modifier.
  const owesRoundEnd =
    chaos &&
    chaos.roundKey === roundKey &&
    !chaos.settled &&
    chaos.modifier &&
    (chaos.modifier.timing === "roundend" || chaos.pendingRoundEnd);

  if (owesRoundEnd) {
    const res = resolveRoundEnd(chaos.modifier.id, {
      totalsBefore: chaos.totalsAtStart,
      totalsAfter: scoresToObj(game.scores),
      presentIds: present,
      wagers: chaos.wagers,
      rivalPair: chaos.rivalPair,
      principal: chaos.principal ?? null,
    });
    game.scores = res.totals;
    chaos.settled = true;
    chaos.result = {
      modifierId: chaos.modifier.id,
      name: chaos.modifier.name,
      summary: res.summary,
      rows: res.rows,
      targets: res.targets ?? [],
      multiplier: res.multiplier ?? null,
      disabledIds: chaos.result?.disabledIds ?? [],
    };

    if (res.carryOut) {
      const nextKey = `${game.id}:${chaos.roundIndex + 1}`;
      const hasNextRound = chaos.roundIndex + 1 < (Number(game.totalRounds) || 0);
      if (hasNextRound) {
        room.chaosCarry = {
          roundKey: nextKey,
          chooserId: res.carryOut.chooserId,
          candidates: res.carryOut.candidates,
          targetId: null,
          applied: false,
        };
        chaos.disablePending = {
          chooserId: res.carryOut.chooserId,
          candidates: res.carryOut.candidates,
        };
      } else {
        chaos.result.summary =
          "Player Disable fired on the final round — nothing left to disable.";
      }
    }
  }

  // B) A Player Disable from an EARLIER round resolving against this one.
  if (carry && carry.roundKey === roundKey && !carry.applied) {
    let targetId = carry.targetId;
    if (!targetId) {
      // The winner never picked — auto-target the current points leader
      // among the eligible candidates.
      const cand = carry.candidates.filter((id) => present.includes(id));
      targetId =
        cand.sort(
          (a, b) => (game.scores.get(b) ?? 0) - (game.scores.get(a) ?? 0)
        )[0] ?? carry.candidates[0] ?? null;
    }
    if (targetId) {
      // Baseline = totals at the start of THIS round. Prefer this round's
      // own snapshot; fall back to current scores if none was taken.
      const before =
        chaos && chaos.roundKey === roundKey ? chaos.totalsAtStart : scoresToObj(game.scores);
      game.scores = applyDisable(before, scoresToObj(game.scores), targetId);
    }
    carry.applied = true;
    carry.resolvedTargetId = targetId;
    if (room.chaos) {
      room.chaos.disableResolved = { targetId };
      // Surface the zeroed player on the round scoreboard strip.
      room.chaos.result = room.chaos.result ?? {};
      const prior = room.chaos.result.disabledIds ?? [];
      room.chaos.result.disabledIds = targetId ? [...new Set([...prior, targetId])] : prior;
    }
  }
  // Drop the consumed carry — but only if branch A didn't just queue a
  // fresh one for the NEXT round (consecutive Player Disable rounds).
  if (carry && carry.applied && room.chaosCarry === carry) room.chaosCarry = null;
}

// --- interactive bits (called from socket handlers) ---------------

export function recordWager(room, playerId) {
  const chaos = room.chaos;
  if (!chaos || chaos.modifier?.id !== "risk-it" || chaos.settled) {
    return { error: "No wager open." };
  }
  if (chaos.wagerDeadline && Date.now() > chaos.wagerDeadline) {
    return { error: "The wager window closed." };
  }
  if (chaos.wagers[playerId] != null) return { ok: true, amount: chaos.wagers[playerId] };
  const current = room.game?.scores?.get(playerId) ?? 0;
  if (current <= 0) return { error: "Nothing to wager." };
  const amount = Math.max(1, Math.floor(current / 2));
  chaos.wagers[playerId] = amount;
  return { ok: true, amount };
}

export function recordDisableTarget(room, chooserId, targetId) {
  const carry = room.chaosCarry;
  if (!carry || carry.applied) return { error: "No disable choice open." };
  if (carry.chooserId !== chooserId) return { error: "Not your choice to make." };
  if (!carry.candidates.includes(targetId)) return { error: "Not a valid target." };
  carry.targetId = targetId;
  if (room.chaos?.disablePending) room.chaos.disablePending.targetId = targetId;
  return { ok: true };
}

// --- public payload ----------------------------------------------

export function chaosPublicSlice(room) {
  const freq = room.chaosFrequency ?? "off";
  const chaos = room.chaos;
  if (!chaos) return { frequency: freq, event: null };

  const event = {
    roundKey: chaos.roundKey,
    announcedAt: chaos.announcedAt,
    settled: chaos.settled,
    modifier: chaos.modifier
      ? {
          id: chaos.modifier.id,
          name: chaos.modifier.name,
          blurb: chaos.modifier.blurb,
          interactive: chaos.modifier.interactive ?? null,
        }
      : null,
    result: chaos.result ?? null,
    wagered: Object.keys(chaos.wagers ?? {}),
    wagerOpen:
      chaos.modifier?.id === "risk-it" &&
      !chaos.settled &&
      (!chaos.wagerDeadline || Date.now() < chaos.wagerDeadline),
    rivalPair: chaos.rivalPair ?? null,
    disablePending:
      room.chaosCarry && !room.chaosCarry.applied
        ? {
            chooserId: room.chaosCarry.chooserId,
            candidates: room.chaosCarry.candidates,
            targetId: room.chaosCarry.targetId ?? null,
          }
        : null,
    disableResolved: chaos.disableResolved ?? null,
  };
  return { frequency: freq, event: event.modifier || event.disablePending ? event : null };
}

// Rewrite a game's public state so Speed Round's shrunk window shows up in
// the client's progress-bar maths. Mutates & returns `publicGameState`.
export function chaosPatchGameState(room, publicGameState) {
  const chaos = room.chaos;
  if (!publicGameState || chaos?.modifier?.id !== "speed-round") return publicGameState;
  const cfg = chaosGameConfig(room.game?.id);
  if (!cfg?.timer) return publicGameState;
  if (!cfg.timer.phases.includes(publicGameState.phase)) return publicGameState;
  for (const key of cfg.timer.windowKeys) publicGameState[key] = SPEED_MS;
  return publicGameState;
}

export function clearChaos(room) {
  room.chaos = null;
  room.chaosCarry = null;
}
