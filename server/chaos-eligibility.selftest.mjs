// Regression check for the "Chaos Event hit an ineligible player" report:
// playtesters saw Half Reset and Risk It apply to / target Fact or Fake
// Personal Mode's SUBJECT — a player who sits out their own round entirely
// (writes no fake, casts no vote, scores nothing that round; see
// server/games/fibbage.js writerIds() / chaosParticipants()).
//
// The fix generalizes through server/chaosRuntime.js: every modifier roll,
// resolution, and interactive action is scoped to `activeParticipants()`
// (which defers to a game's own `chaosParticipants` hook), not the raw
// roster. This file drives every modifier in the pool — not just the two
// originally reported — against a REAL Personal Mode round via the real
// chaosTick glue, and asserts the subject is never rolled in as eligible,
// never offered/charged a Risk It wager, never paired as a Rival, never a
// Player Disable candidate, never a Steal/Tyrant principal, and never in
// any modifier's `targets` list or `rivalPair` — and that their total score
// is byte-for-byte unchanged by the round.
//
//   node server/chaos-eligibility.selftest.mjs

import * as fibbage from "./games/fibbage.js";
import { MODIFIERS } from "./chaos.js";
import { chaosTick, recordWager } from "./chaosRuntime.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const IDS = ["a", "b", "c", "d", "e"];

// Fresh Personal Mode game, driven through the "truth" phase (everyone
// answers their one prompt) so it lands on phase "write", round 0, with a
// known subject — exactly the moment Chaos rolls for fibbage (rollPhases
// includes "write").
function setupPersonalRound() {
  const game = fibbage.createGame(IDS, { mode: "personal", promptsPerPlayer: 1 });
  for (const pid of IDS) {
    fibbage.chooseTruthPrompt(game, pid, 0, 0);
    fibbage.submitTruthAnswer(game, pid, `${pid}'s true answer`, IDS);
  }
  if (game.phase !== "write") throw new Error("setup failed to reach 'write'");
  const subjectId = game.rounds[game.roundIndex].subjectId;
  return { game, subjectId };
}

function makeRoom(game) {
  const room = {
    code: "TEST",
    status: "in-game",
    chaosFrequency: "maximum",
    chaos: null,
    chaosCarry: null,
    game,
  };
  const deps = { connectedPlayerIds: () => IDS };
  return { room, deps };
}

// Drive "write" -> "vote" -> "reveal": every writer (everyone but the
// subject) submits a fake and then votes for the truth option.
function finishRound(game) {
  const writers = IDS.filter((id) => id !== game.rounds[game.roundIndex].subjectId);
  for (const pid of writers) fibbage.submitAnswer(game, pid, `${pid} says a fib`, IDS);
  if (game.phase !== "vote") throw new Error("submissions didn't open voting");
  const truthId = game.answerOptions.find((o) => o.isTruth).id;
  for (const pid of writers) fibbage.submitVote(game, pid, truthId, IDS);
  if (game.phase !== "reveal") throw new Error("votes didn't close the round");
}

const MODIFIER_IDS = MODIFIERS.map((m) => m.id).filter((id) => id !== "speed-round"); // fibbage opts out of Speed Round entirely (chaosGames.js)

for (const modifierId of MODIFIER_IDS) {
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = modifierId;

  const { game, subjectId } = setupPersonalRound();
  const { room, deps } = makeRoom(game);
  const scoreBefore = game.scores.get(subjectId) ?? 0;

  chaosTick(room, deps); // roll + announce (write phase)

  if (!room.chaos?.modifier) {
    check(`${modifierId}: rolled for fibbage`, false, "did not fire — check needs{} gating");
    continue;
  }
  if (room.chaos.modifier.id !== modifierId) {
    // Pool filtering picked a substitute (shouldn't happen for anything but
    // speed-round, which is excluded above) — skip rather than false-fail.
    check(`${modifierId}: pool offered it`, false, `got ${room.chaos.modifier.id} instead`);
    continue;
  }

  check(
    `${modifierId}: subject excluded from eligibleIds`,
    !room.chaos.eligibleIds.includes(subjectId),
    JSON.stringify(room.chaos.eligibleIds)
  );

  if (modifierId === "risk-it") {
    const res = recordWager(room, subjectId);
    check("risk-it: wager refused for the sitting-out subject", !!res.error, JSON.stringify(res));
  }

  if (modifierId === "rival" && room.chaos.rivalPair) {
    check("rival: pairing never includes the subject", !room.chaos.rivalPair.includes(subjectId));
  }

  if ((modifierId === "steal" || modifierId === "the-tyrant") && room.chaos.principal) {
    const { leaderId, trailerId } = room.chaos.principal;
    check(
      `${modifierId}: principal never picks the subject`,
      leaderId !== subjectId && trailerId !== subjectId,
      JSON.stringify(room.chaos.principal)
    );
  }

  // score-swap is INSTANT — already resolved inside beginRound, above.
  if (modifierId === "score-swap") {
    check(
      "score-swap: subject's total untouched",
      (game.scores.get(subjectId) ?? 0) === scoreBefore
    );
    const targets = room.chaos.result?.targets ?? [];
    check(
      "score-swap: subject never named a swap target",
      !targets.some((t) => t.playerId === subjectId)
    );
    continue;
  }

  finishRound(game);
  chaosTick(room, deps); // settle round-end effects

  check(
    `${modifierId}: subject's total unchanged after the round settles`,
    (game.scores.get(subjectId) ?? 0) === scoreBefore,
    `before=${scoreBefore} after=${game.scores.get(subjectId)}`
  );

  const targets = room.chaos.result?.targets ?? [];
  check(
    `${modifierId}: subject never appears in the modifier's targets`,
    !targets.some((t) => t.playerId === subjectId),
    JSON.stringify(targets)
  );

  if (modifierId === "player-disable") {
    const carry = room.chaosCarry;
    check(
      "player-disable: subject never a disable candidate",
      !!carry && !carry.candidates.includes(subjectId),
      JSON.stringify(carry)
    );
  }
}

delete process.env.CHAOS_FORCE;
delete process.env.CHAOS_FORCE_MODIFIER;

console.log(
  failures === 0
    ? "\nALL CHAOS ELIGIBILITY CHECKS PASSED"
    : `\n${failures} CHAOS ELIGIBILITY CHECK(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
