// Standalone check for Black Magic — specifically the Witch-disconnect
// grace period (a raw socket blip must NOT abort the round; only a truly
// final absence should).
// Run:  node server/black-magic.selftest.mjs
// Prints PASS/FAIL per case, exits non-zero on any failure.

import * as bm from "./games/black-magic.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const IDS = ["p1", "p2", "p3", "p4"];

function freshGame() {
  const g = bm.createGame(IDS, { rounds: 3, assignment: "rotation" });
  check("setup: starts in 'choose' with a Witch assigned", g.phase === "choose" && g.witchId, `phase=${g.phase} witch=${g.witchId}`);
  return g;
}

// --- a transient disconnect (final: false) must NOT abort ------------
{
  const g = freshGame();
  const witch = g.witchId;
  const present = IDS.filter((id) => id !== witch); // Witch just dropped
  bm.reconcilePresence(g, present, { final: false });
  check("choose phase: transient Witch drop leaves the round running", g.phase === "choose");

  bm.chooseCurse(g, "verbal");
  check("setup: Witch's curse choice starts the round", g.phase === "active");
  bm.reconcilePresence(g, present, { final: false });
  check("active phase: transient Witch drop leaves the round running", g.phase === "active");
}

// --- a final absence (grace expired / kicked) must abort --------------
{
  const g = freshGame();
  const witch = g.witchId;
  const present = IDS.filter((id) => id !== witch);
  bm.reconcilePresence(g, present, { final: true });
  check("choose phase: final Witch absence aborts the round", g.phase === "reveal" && g.lastResult?.outcome === "aborted");
}
{
  const g = freshGame();
  const witch = g.witchId;
  bm.chooseCurse(g, "physical");
  const present = IDS.filter((id) => id !== witch);
  bm.reconcilePresence(g, present, { final: true });
  check("active phase: final Witch absence aborts the round", g.phase === "reveal" && g.lastResult?.outcome === "aborted");
}

// --- default (no options passed) matches the old always-abort behaviour,
// so any future caller that forgets to pass `final` stays safe rather
// than silently letting a round hang forever.
{
  const g = freshGame();
  const witch = g.witchId;
  const present = IDS.filter((id) => id !== witch);
  bm.reconcilePresence(g, present);
  check("no options passed defaults to final (safe default)", g.phase === "reveal" && g.lastResult?.outcome === "aborted");
}

// --- Witch present: never aborts, regardless of `final` ----------------
{
  const g = freshGame();
  bm.reconcilePresence(g, [...IDS], { final: true });
  check("Witch present: final call is a no-op", g.phase === "choose");
  bm.reconcilePresence(g, [...IDS], { final: false });
  check("Witch present: transient call is a no-op", g.phase === "choose");
}

console.log(failures === 0 ? "\nALL BLACK MAGIC CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
