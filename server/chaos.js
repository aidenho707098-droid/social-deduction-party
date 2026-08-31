// "Chaos Events" — a shared layer that sits ABOVE the individual games
// (like Tournament Mode). At the start of each scoring round it rolls
// against the host-chosen frequency; on a hit it picks ONE modifier from
// the pool (uniform, no weighting) and warps that round's scoring/rules.
//
// This file is the PURE core: constants, the modifier pool, and the
// resolvers. Everything here is deterministic given an `rng` and takes
// plain data (score Maps, id arrays) — no sockets, no room objects — so it
// can be exercised in isolation (see server/chaos.selftest.mjs). The glue
// that snapshots scores, detects round boundaries and rewrites game state
// lives in server/index.js + server/chaosGames.js.
//
// TIMING of a modifier:
//   "instant"   — applied to TOTAL scores the moment it's announced
//                 (Score Swap, Steal, The Tyrant). No round-end step.
//   "preround"  — changes how the round plays, not the maths
//                 (Speed Round timers, Countdown Chaos atmosphere, and the
//                 opt-in / pairing setup for Risk It / Rival). May also
//                 have a round-end step.
//   "roundend"  — needs the round's per-player point deltas, so it's
//                 resolved after the game finishes scoring the round.
//
// A modifier that isn't a clean fit for a given game is filtered out of
// that game's pool by server/chaosGames.js (e.g. Speed Round only for
// race-to-answer games; Player Disable needs a following round).

export const FREQUENCIES = {
  off: 0,
  low: 0.1,
  medium: 0.2,
  high: 0.35,
  maximum: 1, // guarantees a Chaos Event every single round
};

export const FREQUENCY_ORDER = ["off", "low", "medium", "high", "maximum"];

// Percentage bites for the "take from the room" modifiers. These are share
// of the points EARNED THIS ROUND (never a flat number), so their impact
// scales with whatever the game's normal scoring magnitude is — "skim 40%"
// lands the same whether a good round is worth 3 points or 300.
export const STEAL_PCT = 0.4; // last place skims this off first place's round haul
export const TAX_PCT = 0.2; // round winner rakes this off every other player's round
export const TYRANT_PCT = 0.2; // points leader seizes this off every other player's round
export const RIVAL_PCT = 0.45; // winning rival rips this off the losing rival's round
export const UNDERDOG_MULT = 3; // last place's round points ×this

// The pool. `blurb` is the one-liner shown under the name on the takeover.
// `timing` drives when the glue applies it. `needs` flags extra
// requirements the per-game filter checks.
export const MODIFIERS = [
  {
    id: "double-points",
    name: "Double Points",
    blurb: "Every point scored this round counts twice.",
    timing: "roundend",
  },
  {
    id: "triple-points",
    name: "Triple Points",
    blurb: "Every point scored this round counts triple.",
    timing: "roundend",
  },
  {
    id: "quad-points",
    name: "Quadruple Points",
    blurb: "Every point scored this round counts four times.",
    timing: "roundend",
  },
  {
    id: "score-swap",
    name: "Score Swap",
    blurb: "Two random players trade their total scores. Right now.",
    timing: "instant",
    needs: { minPlayers: 2 },
  },
  {
    id: "steal",
    name: "Steal",
    blurb: "Last place skims 40% of first place's haul this round.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "underdog-boost",
    name: "Underdog Boost",
    blurb: "Whoever's in last place scores TRIPLE this round, no matter what.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "all-or-nothing",
    name: "All or Nothing",
    blurb: "Only the round winner scores. Everyone else gets nothing.",
    timing: "roundend",
  },
  {
    id: "speed-round",
    name: "Speed Round",
    blurb: "Every timer this round is slashed to ten seconds. Go.",
    timing: "preround",
    needs: { speedRound: true },
  },
  {
    id: "point-reversal",
    name: "Point Reversal",
    blurb: "Scoring is flipped — the lowest scorer takes the biggest reward.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "risk-it",
    name: "Risk It",
    blurb: "Wager your points now. Do well to double it — do badly and it's gone.",
    timing: "preround",
    interactive: "wager",
    needs: { minPlayers: 2 },
  },
  {
    id: "countdown-chaos",
    name: "Countdown Chaos",
    blurb: "The clock vanishes. A creeping pulse at the screen's edge is all the warning you get.",
    timing: "preround",
  },
  {
    id: "kingbreaker",
    name: "Kingbreaker",
    blurb: "Every point earned this round is torn from the current points leader.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "rival",
    name: "Rival",
    blurb: "Two players are paired — the one who scores higher this round rips 45% of the other's round points.",
    timing: "preround",
    needs: { minPlayers: 2 },
  },
  {
    id: "tax-collector",
    name: "Tax Collector",
    blurb: "The round winner rakes in 20% of everyone else's round points.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "half-reset",
    name: "Half Reset",
    blurb: "Whoever scores least this round has their TOTAL score halved.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
  {
    id: "player-disable",
    name: "Player Disable",
    blurb: "The round winner zeroes out one rival's points for the NEXT round.",
    timing: "roundend",
    interactive: "target",
    needs: { minPlayers: 2, nextRound: true },
  },
  {
    id: "the-tyrant",
    name: "The Tyrant",
    blurb: "The points leader seizes 20% of every rival's round score.",
    timing: "roundend",
    needs: { minPlayers: 2 },
  },
];

export const MODIFIERS_BY_ID = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));

// --- small helpers ----------------------------------------------------

function mapFrom(scores) {
  // Accepts a Map or a plain object; returns a fresh Map<string, number>.
  const out = new Map();
  if (scores instanceof Map) {
    for (const [k, v] of scores) out.set(k, Number(v) || 0);
  } else if (scores && typeof scores === "object") {
    for (const k of Object.keys(scores)) out.set(k, Number(scores[k]) || 0);
  }
  return out;
}

function pickN(ids, n, rng) {
  const pool = [...ids];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// All ids tied for the max/min of `valueOf`. `extreme` = "max" | "min".
function extremesOf(ids, valueOf, extreme) {
  if (ids.length === 0) return [];
  let best = valueOf(ids[0]);
  for (const id of ids) {
    const v = valueOf(id);
    if ((extreme === "max" && v > best) || (extreme === "min" && v < best)) best = v;
  }
  return ids.filter((id) => valueOf(id) === best);
}

function one(ids, rng) {
  return ids.length ? ids[Math.floor(rng() * ids.length)] : null;
}

// --- rolling --------------------------------------------------------

// Does chaos fire this round? `frequency` is a key of FREQUENCIES.
export function rollChaos(frequency, rng = Math.random) {
  const p = FREQUENCIES[frequency] ?? 0;
  if (p <= 0) return false;
  return rng() < p;
}

// Pick one modifier, uniform, from a pre-filtered eligible list.
export function pickModifier(eligibleModifiers, rng = Math.random) {
  if (!eligibleModifiers || eligibleModifiers.length === 0) return null;
  return eligibleModifiers[Math.floor(rng() * eligibleModifiers.length)];
}

// --- INSTANT modifiers (applied to totals at announcement) -----------
// Returns { totals: Map, summary: string }. `totals` is a NEW map.
//
// Only Score Swap is instant now: Steal and The Tyrant used to fire here on
// flat point amounts, but their bite is a PERCENTAGE of the round's actual
// points, which aren't known until the round is scored — so they moved to
// resolveRoundEnd(). See STEAL_PCT / TYRANT_PCT.

export function applyInstant(modifierId, { totals, presentIds, rng = Math.random }) {
  const t = mapFrom(totals);
  const ids = presentIds.filter((id) => t.has(id));
  const val = (id) => t.get(id) ?? 0;

  if (modifierId === "score-swap") {
    if (ids.length < 2) return { totals: t, summary: "Not enough players to swap.", targets: [] };
    const [a, b] = pickN(ids, 2, rng);
    const av = val(a);
    t.set(a, val(b));
    t.set(b, av);
    return {
      totals: t,
      summary: "Two players traded totals.",
      targets: [
        { playerId: a, tag: "swap" },
        { playerId: b, tag: "swap" },
      ],
    };
  }

  return { totals: t, summary: "", targets: [] };
}

// --- ROUND-END modifiers -------------------------------------------
// Given the pre-round totals and the totals AFTER the game scored the
// round normally, work out each present player's final total for the
// round. Pure. Returns:
//   { totals: Map, rows: [{ playerId, roundRaw, roundFinal }], summary, carryOut? }
// `carryOut` is set only by Player Disable: { targetId, chooserId }.

export function resolveRoundEnd(
  modifierId,
  {
    totalsBefore,
    totalsAfter,
    presentIds,
    rng = Math.random,
    wagers = {},
    rivalPair = null,
    // { leaderId, trailerId } chosen up front by the glue (so the takeover
    // can name them) for Steal / The Tyrant. Falls back to computing here.
    principal = null,
  }
) {
  const before = mapFrom(totalsBefore);
  const after = mapFrom(totalsAfter);
  const ids = presentIds.filter((id) => before.has(id) || after.has(id));

  const b = (id) => before.get(id) ?? 0;
  const rawDelta = new Map(ids.map((id) => [id, (after.get(id) ?? 0) - b(id)]));
  const d = (id) => rawDelta.get(id) ?? 0;

  // Default: no change — round points as the game scored them.
  const finalDelta = new Map(rawDelta);
  let summary = "";
  let carryOut = null;
  let targets = []; // [{ playerId, tag, amount? }] — who this modifier hit
  let multiplier = null; // 2 | 3 | 4 for the point-multiplier modifiers
  const totalOps = new Map(); // id -> signed adjustment applied to the TOTAL after deltas

  const roundWinners = extremesOf(ids, d, "max");
  const roundLosers = extremesOf(ids, d, "min");
  const totalLeaders = extremesOf(ids, b, "max");
  const totalTrailers = extremesOf(ids, b, "min");

  // How much of `earnerId`'s OWN round points a "take from the room" modifier
  // bites, capped at what that player will actually have. Percentage-based so
  // the hit scales with the game's real scoring magnitude.
  const bite = (earnerId, pct) =>
    Math.min(
      Math.round(Math.max(0, d(earnerId)) * pct),
      Math.max(0, b(earnerId) + d(earnerId))
    );
  const pickLeader = (fromPrincipal) =>
    fromPrincipal && before.has(fromPrincipal) ? fromPrincipal : one(totalLeaders, rng);

  switch (modifierId) {
    case "double-points":
    case "triple-points":
    case "quad-points": {
      const mult = modifierId === "double-points" ? 2 : modifierId === "triple-points" ? 3 : 4;
      for (const id of ids) finalDelta.set(id, d(id) * mult);
      multiplier = mult;
      summary = `Round points ×${mult}.`;
      break;
    }

    case "underdog-boost": {
      for (const id of totalTrailers) finalDelta.set(id, d(id) * UNDERDOG_MULT);
      targets = totalTrailers.map((id) => ({ playerId: id, tag: "boost" }));
      summary = `Last place scored ×${UNDERDOG_MULT} this round.`;
      break;
    }

    case "all-or-nothing": {
      const win = new Set(roundWinners);
      for (const id of ids) if (!win.has(id)) finalDelta.set(id, 0);
      targets = roundWinners.map((id) => ({ playerId: id, tag: "winner" }));
      summary = "Only the round winner scored.";
      break;
    }

    case "point-reversal": {
      // The multiset of round points is handed back out in reverse order:
      // the lowest raw scorer gets the highest amount, and so on.
      const byRawAsc = [...ids].sort((x, y) => d(x) - d(y) || (x < y ? -1 : 1));
      const rewardsDesc = [...ids].map((id) => d(id)).sort((x, y) => y - x);
      byRawAsc.forEach((id, i) => finalDelta.set(id, rewardsDesc[i] ?? 0));
      summary = "Scoring order flipped.";
      break;
    }

    case "kingbreaker": {
      const pot = ids.reduce((s, id) => s + Math.max(0, d(id)), 0);
      const leader = one(totalLeaders, rng);
      if (leader) {
        totalOps.set(leader, -(Math.min(pot, b(leader) + d(leader))));
        targets = [{ playerId: leader, tag: "leader", amount: pot }];
      }
      summary = `The points leader lost ${pot}.`;
      break;
    }

    case "steal": {
      // Last place skims STEAL_PCT of FIRST place's points THIS ROUND.
      const leader = pickLeader(principal?.leaderId);
      const trailer =
        principal?.trailerId && before.has(principal.trailerId)
          ? principal.trailerId
          : one(totalTrailers, rng);
      if (leader && trailer && leader !== trailer) {
        const amount = bite(leader, STEAL_PCT);
        if (amount > 0) {
          totalOps.set(leader, (totalOps.get(leader) ?? 0) - amount);
          totalOps.set(trailer, (totalOps.get(trailer) ?? 0) + amount);
        }
        targets = [
          { playerId: trailer, tag: "thief", amount },
          { playerId: leader, tag: "mark", amount },
        ];
        summary = amount
          ? `Last place skimmed ${amount} off first place's round haul.`
          : "First place earned nothing to skim this round.";
      } else {
        summary = "Nobody to steal from.";
      }
      break;
    }

    case "tax-collector": {
      // Round winner rakes in TAX_PCT of every OTHER player's round points.
      const winner = one(roundWinners, rng);
      let collected = 0;
      const paid = [];
      for (const id of ids) {
        if (id === winner) continue;
        const take = bite(id, TAX_PCT);
        if (take > 0) {
          totalOps.set(id, (totalOps.get(id) ?? 0) - take);
          paid.push({ playerId: id, tag: "payer", amount: take });
          collected += take;
        }
      }
      if (winner) {
        totalOps.set(winner, (totalOps.get(winner) ?? 0) + collected);
        targets = [{ playerId: winner, tag: "collector", amount: collected }, ...paid];
      }
      summary = `The round winner taxed ${collected} in round points from the room.`;
      break;
    }

    case "the-tyrant": {
      // Points leader seizes TYRANT_PCT of every OTHER player's round points.
      const tyrant = pickLeader(principal?.leaderId);
      if (tyrant) {
        let seized = 0;
        const victims = [];
        for (const id of ids) {
          if (id === tyrant) continue;
          const take = bite(id, TYRANT_PCT);
          if (take > 0) {
            totalOps.set(id, (totalOps.get(id) ?? 0) - take);
            victims.push({ playerId: id, tag: "victim", amount: take });
            seized += take;
          }
        }
        totalOps.set(tyrant, (totalOps.get(tyrant) ?? 0) + seized);
        targets = [{ playerId: tyrant, tag: "tyrant", amount: seized }, ...victims];
        summary = `The points leader seized ${seized} from the room's round scores.`;
      } else {
        summary = "No leader to crown.";
      }
      break;
    }

    case "half-reset": {
      for (const id of roundLosers) {
        const projected = b(id) + finalDelta.get(id);
        totalOps.set(id, Math.floor(projected / 2) - projected);
      }
      targets = roundLosers.map((id) => ({ playerId: id, tag: "halved" }));
      summary = "Lowest scorer this round had their total halved.";
      break;
    }

    case "rival": {
      // Higher round scorer rips RIVAL_PCT of the OTHER rival's round points
      // — a guaranteed meaningful steal even when the two performed alike
      // (the old "steal the gap" went to ~0 when they were close).
      const pair = rivalPair && rivalPair.length === 2 ? rivalPair : pickN(ids, 2, rng);
      if (pair.length === 2) {
        const [x, y] = pair;
        const hi = d(x) >= d(y) ? x : y;
        const lo = hi === x ? y : x;
        const steal = bite(lo, RIVAL_PCT); // % of the loser's OWN round haul, capped
        if (steal > 0) {
          finalDelta.set(hi, d(hi) + steal);
          finalDelta.set(lo, d(lo) - steal);
          targets = [
            { playerId: hi, tag: "rival-win", amount: steal },
            { playerId: lo, tag: "rival-lose", amount: steal },
          ];
          summary = `The winning rival ripped ${steal} off the other's round.`;
        } else {
          targets = pair.map((id) => ({ playerId: id, tag: "rival" }));
          summary = "The losing rival scored nothing to take.";
        }
      }
      break;
    }

    case "player-disable": {
      // The round winner disables one other player NEXT round. The glue
      // reads carryOut and (a) offers the winner a picker, (b) forces
      // that player's delta to 0 when the next round settles.
      const chooserId = one(roundWinners, rng);
      const candidates = ids.filter((id) => id !== chooserId);
      carryOut = { chooserId, candidates, targetId: null };
      targets = chooserId ? [{ playerId: chooserId, tag: "chooser" }] : [];
      summary = "The round winner will disable a rival next round.";
      break;
    }

    case "risk-it": {
      // wagers: { playerId: amountWagered }. "Did well" = finished in the
      // top half of this round's raw point-earners.
      const ranked = [...ids].sort((x, y) => d(y) - d(x));
      const cut = Math.ceil(ranked.length / 2);
      const didWell = new Set(ranked.slice(0, cut));
      const outcome = [];
      let cashed = 0;
      let busted = 0;
      for (const id of ids) {
        const w = Math.max(0, Math.floor(Number(wagers[id]) || 0));
        if (w <= 0) continue;
        if (didWell.has(id)) {
          finalDelta.set(id, d(id) * 2 + w); // double the round + keep the stake as winnings
          outcome.push({ playerId: id, tag: "cashed", amount: w });
          cashed++;
        } else {
          totalOps.set(id, (totalOps.get(id) ?? 0) - w);
          outcome.push({ playerId: id, tag: "busted", amount: w });
          busted++;
        }
      }
      targets = outcome;
      summary =
        cashed + busted === 0
          ? "Nobody risked it."
          : `${cashed} cashed in, ${busted} lost the wager.`;
      break;
    }

    default:
      summary = "";
  }

  // Compose final totals: pre-round total + final round delta + total ops.
  const totals = new Map();
  for (const id of ids) {
    const base = b(id) + (finalDelta.get(id) ?? 0) + (totalOps.get(id) ?? 0);
    totals.set(id, Math.max(0, Math.round(base)));
  }
  // Carry over anyone not present (disconnected mid-round) untouched.
  for (const [id, v] of after) if (!totals.has(id)) totals.set(id, v);

  const rows = ids.map((id) => ({
    playerId: id,
    roundRaw: d(id),
    roundFinal: (totals.get(id) ?? 0) - b(id),
  }));

  return { totals, rows, summary, carryOut, targets, multiplier };
}

// Force one player's round contribution to zero (Player Disable, resolved
// against the round AFTER it was announced). Applied on top of whatever
// that later round's own modifier did.
export function applyDisable(totalsBefore, totalsAfter, targetId) {
  const before = mapFrom(totalsBefore);
  const after = mapFrom(totalsAfter);
  if (!after.has(targetId)) return after;
  const out = new Map(after);
  out.set(targetId, Math.max(0, before.get(targetId) ?? 0));
  return out;
}
