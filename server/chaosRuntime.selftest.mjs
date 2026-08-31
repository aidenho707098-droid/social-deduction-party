// Integration check for the Chaos runtime glue (server/chaosRuntime.js).
// Drives chaosTick() through a round lifecycle against a fake room/game
// shaped like the real point-accumulation games. Run:
//   node server/chaosRuntime.selftest.mjs

import {
  chaosTick,
  chaosPublicSlice,
  chaosPatchGameState,
  setChaosFrequency,
  recordWager,
  recordDisableTarget,
  clearChaos,
} from "./chaosRuntime.js";
import { SPEED_MS } from "./chaosGames.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const IDS = ["a", "b", "c", "d"];
const deps = { connectedPlayerIds: () => IDS };

function fakeRoom(scores) {
  return {
    status: "in-game",
    chaosFrequency: "off",
    chaos: null,
    chaosCarry: null,
    game: {
      id: "emoji-movie",
      phase: "guess",
      roundIndex: 0,
      totalRounds: 4,
      deadline: Date.now() + 30_000,
      roundStartedAt: Date.now(),
      scores: new Map(Object.entries(scores)),
    },
  };
}

// Force chaos to fire and to pick a chosen modifier id, by stubbing
// Math.random for the duration of a call.
function withForcedModifier(modId, fn) {
  const real = Math.random;
  // chaosTick calls: rollChaos(freq) -> rng() ; pickModifier(pool) -> rng()
  // We want rng()#1 tiny (guarantee a hit) and rng()#2 to land on modId.
  // eligibleModifiers filters the 17-entry pool; compute the index lazily.
  let call = 0;
  Math.random = () => {
    call++;
    if (call === 1) return 0.0001; // definite hit at any frequency > 0
    // second call: pickModifier does Math.floor(rng()*len). We can't know
    // len here without the pool, so overshoot toward the target by using a
    // fraction; the test asserts the *effect*, not a specific id, when the
    // fraction can't pin it. For precise control we set it after.
    return real();
  };
  try {
    fn();
  } finally {
    Math.random = real;
  }
}

// --- frequency setter -------------------------------------------
{
  const room = fakeRoom({ a: 0, b: 0, c: 0, d: 0 });
  check("reject unknown frequency", setChaosFrequency(room, "nuts").error);
  check("accept 'high'", setChaosFrequency(room, "high").ok && room.chaosFrequency === "high");
}

// --- OFF never rolls -------------------------------------------
{
  const room = fakeRoom({ a: 5, b: 5, c: 5, d: 5 });
  room.chaosFrequency = "off";
  chaosTick(room, deps);
  check("OFF: no chaos record created", room.chaos === null);
}

// --- a round rolls, snapshots, and (on a miss) stays inert -----
{
  const room = fakeRoom({ a: 5, b: 3, c: 8, d: 1 });
  room.chaosFrequency = "high";
  const real = Math.random;
  Math.random = () => 0.99; // guaranteed MISS at 35%
  chaosTick(room, deps);
  Math.random = real;
  check("miss: chaos record exists for the round", room.chaos?.roundKey === "emoji-movie:0");
  check("miss: modifier is null", room.chaos.modifier === null);
  check("miss: snapshot captured", room.chaos.totalsAtStart.c === 8);
  check("miss: settled (nothing owed)", room.chaos.settled === true);
  check("miss: public slice hides it", chaosPublicSlice(room).event === null);
}

// --- Double Points end-to-end via the runtime -----------------
{
  const room = fakeRoom({ a: 0, b: 0, c: 0, d: 0 });
  room.chaosFrequency = "high";
  // Stub so: call#1 hit, call#2 -> index of 'double-points' (0) in pool.
  const real = Math.random;
  let n = 0;
  Math.random = () => (++n === 1 ? 0.0001 : 0);
  chaosTick(room, deps); // start of round 0 -> rolls
  Math.random = real;
  check("hit: modifier chosen", room.chaos.modifier?.id === "double-points");
  check("hit: not settled yet (round-end)", room.chaos.settled === false);
  check("hit: announcedAt set", typeof room.chaos.announcedAt === "number");

  // Game scores the round normally.
  room.game.scores = new Map(Object.entries({ a: 10, b: 4, c: 0, d: 2 }));
  room.game.phase = "reveal";
  chaosTick(room, deps); // settle

  check("Double Points settled", room.chaos.settled === true);
  check(
    "Double Points doubled the round deltas",
    room.game.scores.get("a") === 20 &&
      room.game.scores.get("b") === 8 &&
      room.game.scores.get("d") === 4 &&
      room.game.scores.get("c") === 0
  );
  const slice = chaosPublicSlice(room);
  check("public slice exposes the resolved result", slice.event?.result?.modifierId === "double-points");
}

// --- Speed Round clamps the timer + patches the window --------
{
  const room = fakeRoom({ a: 1, b: 1, c: 1, d: 1 });
  room.chaosFrequency = "high";
  room.game.deadline = Date.now() + 30_000;
  const real = Math.random;
  // Need pickModifier to land on 'speed-round'. Its index in the
  // emoji-movie pool: compute by filtering isn't trivial here, so just
  // force via a fraction sweep until we get it.
  let got = false;
  for (let frac = 0; frac < 1 && !got; frac += 0.01) {
    clearChaos(room);
    room.game.phase = "guess";
    room.game.roundIndex = 0;
    room.game.deadline = Date.now() + 30_000;
    let n = 0;
    Math.random = () => (++n === 1 ? 0.0001 : frac);
    chaosTick(room, deps);
    if (room.chaos?.modifier?.id === "speed-round") got = true;
  }
  Math.random = real;
  check("Speed Round reachable in emoji-movie pool", got);
  if (got) {
    check(
      "Speed Round clamped the deadline to ~10s",
      room.game.deadline - Date.now() <= SPEED_MS + 50
    );
    const pub = { phase: "guess", answerMs: 30_000, msLeft: 9000 };
    chaosPatchGameState(room, pub);
    check("Speed Round advertises answerMs = 10s", pub.answerMs === SPEED_MS);
  }
}

// --- Player Disable carries to the next round ----------------
{
  const room = fakeRoom({ a: 0, b: 0, c: 0, d: 0 });
  room.chaosFrequency = "high";
  const real = Math.random;
  let got = false;
  for (let frac = 0; frac < 1 && !got; frac += 0.01) {
    clearChaos(room);
    room.game.phase = "guess";
    room.game.roundIndex = 1; // not the last round (totalRounds 4)
    room.game.scores = new Map(Object.entries({ a: 0, b: 0, c: 0, d: 0 }));
    let n = 0;
    Math.random = () => (++n === 1 ? 0.0001 : frac);
    chaosTick(room, deps);
    if (room.chaos?.modifier?.id === "player-disable") got = true;
  }
  Math.random = real;
  check("Player Disable reachable", got);
  if (got) {
    // round 1 scores; a wins -> a chooses
    room.game.scores = new Map(Object.entries({ a: 9, b: 3, c: 1, d: 0 }));
    room.game.phase = "reveal";
    chaosTick(room, deps);
    check("carry created for round 2", room.chaosCarry?.roundKey === "emoji-movie:2");
    check("chooser is round winner a", room.chaosCarry.chooserId === "a");

    const pick = recordDisableTarget(room, "a", "b");
    check("a picks b as target", pick.ok && room.chaosCarry.targetId === "b");

    // round 2 begins + scores; b would gain 6. Force this round's roll to
    // MISS so no fresh event competes with the carry-consumption assertion
    // (beginRound still runs -> totalsAtStart is snapshotted for the disable).
    room.game.roundIndex = 2;
    room.game.phase = "guess";
    Math.random = () => 0.99; // guaranteed miss at "high" (35%)
    chaosTick(room, deps);
    Math.random = real;
    room.game.scores = new Map(Object.entries({ a: 12, b: 9, c: 4, d: 0 }));
    room.game.phase = "reveal";
    chaosTick(room, deps);
    check("Player Disable zeroed b's round-2 gain (back to 3)", room.game.scores.get("b") === 3);
    check("carry consumed", room.chaosCarry === null);
  }
}

// --- Risk It records a wager --------------------------------
{
  const room = fakeRoom({ a: 40, b: 10, c: 10, d: 10 });
  room.chaosFrequency = "high";
  const real = Math.random;
  let got = false;
  for (let frac = 0; frac < 1 && !got; frac += 0.01) {
    clearChaos(room);
    room.game.phase = "guess";
    room.game.roundIndex = 0;
    room.game.scores = new Map(Object.entries({ a: 40, b: 10, c: 10, d: 10 }));
    let n = 0;
    Math.random = () => (++n === 1 ? 0.0001 : frac);
    chaosTick(room, deps);
    if (room.chaos?.modifier?.id === "risk-it") got = true;
  }
  Math.random = real;
  check("Risk It reachable", got);
  if (got) {
    const w = recordWager(room, "a");
    check("wager = half of 40 = 20", w.ok && w.amount === 20 && room.chaos.wagers.a === 20);
    check("public slice lists who wagered", chaosPublicSlice(room).event.wagered.includes("a"));
  }
}

// --- clearChaos --------------------------------------------
{
  const room = fakeRoom({ a: 1, b: 1, c: 1, d: 1 });
  room.chaos = { roundKey: "x", modifier: { id: "y" } };
  room.chaosCarry = { roundKey: "z" };
  clearChaos(room);
  check("clearChaos wipes both fields", room.chaos === null && room.chaosCarry === null);
}

console.log(`\n${failures === 0 ? "ALL CHAOS RUNTIME CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
