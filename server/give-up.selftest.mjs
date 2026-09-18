// Standalone check for the "Give Up" playtest feature — Taboo guessers and
// Black Magic Players opting out of a round they're not going to crack,
// without it costing them anything beyond not scoring.
// Run:  node server/give-up.selftest.mjs
// Prints PASS/FAIL per case, exits non-zero on any failure.

import * as taboo from "./games/taboo.js";
import * as bm from "./games/black-magic.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ================= Taboo =================

const IDS = ["p1", "p2", "p3", "p4"];

function freshTaboo() {
  const g = taboo.createGame(IDS, { rounds: 3, categories: ["animals"] });
  return g;
}

{
  const g = freshTaboo();
  const describerId = g.describerByRound[0];
  const guessers = IDS.filter((id) => id !== describerId);
  taboo.startRound(g, describerId);
  check("setup: round is running", g.phase === "guess");

  const res = taboo.giveUp(g, describerId, IDS);
  check("Describer can't give up", res.ok === false && res.isDescriber === true);

  const res2 = taboo.giveUp(g, guessers[0], IDS);
  check("a guesser giving up succeeds", res2.ok === true);
  check("round stays open with only one of several guessers given up", g.phase === "guess");

  const guessRes = taboo.submitGuess(g, guessers[0], "anything", IDS);
  check("a given-up guesser can't submit a guess", guessRes.ok === false && guessRes.gaveUp === true);

  const res3 = taboo.giveUp(g, guessers[0], IDS);
  check("giving up twice is a harmless no-op", res3.ok === true);

  const pub = taboo.getPublicState(g, IDS);
  check(
    "public state lists the given-up guesser",
    pub.gaveUpPlayerIds.includes(guessers[0]) && !pub.guessedPlayerIds.includes(guessers[0])
  );

  // Everyone else gives up too -> round auto-reveals, nobody scores.
  taboo.giveUp(g, guessers[1], IDS);
  taboo.giveUp(g, guessers[2], IDS);
  check("round auto-reveals once every guesser has given up", g.phase === "reveal");
  check(
    "nobody scored a give-up round",
    g.lastResult.rows.every((r) => r.points === 0 && !r.correct)
  );
}

{
  // A fresh round clears last round's give-ups.
  const g = freshTaboo();
  const describerId = g.describerByRound[0];
  const guessers = IDS.filter((id) => id !== describerId);
  taboo.startRound(g, describerId);
  taboo.giveUp(g, guessers[0], IDS);
  taboo.giveUp(g, guessers[1], IDS);
  taboo.giveUp(g, guessers[2], IDS);
  check("setup: round ended via give-ups", g.phase === "reveal");
  taboo.nextRound(g);
  check("setup: next round started", g.phase === "describe");
  const nextDescriberId = g.describerByRound[g.roundIndex];
  taboo.startRound(g, nextDescriberId);
  const pub = taboo.getPublicState(g, IDS);
  check(
    "give-ups don't carry over into the new round",
    (pub.gaveUpPlayerIds ?? []).length === 0
  );

  const nextGuessers = IDS.filter((id) => id !== nextDescriberId);
  const canGiveUpAgain = taboo.giveUp(g, nextGuessers[0], IDS);
  check("a previously-given-up player can give up again next round", canGiveUpAgain.ok === true);
}

{
  const g = freshTaboo();
  check("can't give up before the round starts (still 'describe')", taboo.giveUp(g, IDS[1], IDS).ok === false);
}

// ================= Black Magic =================

function freshBlackMagic() {
  return bm.createGame(IDS, { rounds: 3, assignment: "rotation" });
}

{
  const g = freshBlackMagic();
  const witch = g.witchId;
  const players = IDS.filter((id) => id !== witch);
  check("can't give up before the curse is active (still 'choose')", bm.giveUp(g, players[0]).ok === false);

  bm.chooseCurse(g, "verbal");
  check("setup: round is active", g.phase === "active");

  const witchRes = bm.giveUp(g, witch);
  check("The Witch can't give up", witchRes.ok === false && witchRes.isWitch === true);

  const res = bm.giveUp(g, players[0]);
  check("a Player giving up succeeds", res.ok === true);
  check("round stays active with one Player given up", g.phase === "active");

  const pub = bm.getPublicState(g, IDS);
  check("public state lists the given-up Player", pub.gaveUpPlayerIds.includes(players[0]));

  bm.awardGuess(g, players[0], IDS);
  check("The Witch can't award a given-up Player the point", g.phase === "active");

  bm.awardGuess(g, players[1], IDS);
  check("The Witch can still award a Player who didn't give up", g.phase === "reveal" && g.lastResult.outcome === "lifted");
}

{
  // A fresh round clears last round's give-ups.
  const g = freshBlackMagic();
  const witch = g.witchId;
  const players = IDS.filter((id) => id !== witch);
  bm.chooseCurse(g, "physical");
  bm.giveUp(g, players[0]);
  bm.awardGuess(g, players[1], IDS);
  check("setup: round ended", g.phase === "reveal");

  bm.nextRound(g, IDS);
  const nextWitch = g.witchId;
  bm.chooseCurse(g, "verbal");
  const pub = bm.getPublicState(g, IDS);
  check("give-ups don't carry over into the new round", (pub.gaveUpPlayerIds ?? []).length === 0);

  const nextPlayers = IDS.filter((id) => id !== nextWitch);
  check(
    "a previously-given-up Player can give up again next round",
    bm.giveUp(g, nextPlayers[0]).ok === true
  );
}

console.log(failures === 0 ? "\nALL GIVE-UP CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
