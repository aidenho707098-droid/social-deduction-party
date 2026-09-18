// Regression check for the "extra results screen before the tournament
// finale" playtest report: after the LAST game in a tournament, the
// individual game's own "between" results screen (that game's standings ->
// tournament points, see TournamentBetween.jsx) used to show and require a
// host click before the actual Tournament Winner screen — a redundant beat
// right before the real finale. Every OTHER game should still land on
// "between" normally.
//
//   node server/tournament.selftest.mjs

import { createTournament, stepAt, beginGame, recordGameResult } from "./tournament.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const PLAYERS = ["a", "b", "c"];
const STANDINGS = [
  { playerId: "a", score: 10 },
  { playerId: "b", score: 5 },
  { playerId: "c", score: 1 },
];

// A 3-game manual lineup: after game 1 and game 2, "between" should show;
// after game 3 (the last), it should skip straight to "complete".
const t = createTournament(
  { mode: "manual", lineup: ["taboo", "wavelength", "emoji-movie"] },
  PLAYERS
);

stepAt(t, PLAYERS.length); // -> intro for game 1
beginGame(t, "taboo", PLAYERS);
recordGameResult(t, "taboo", STANDINGS);
check("game 1 of 3: phase is 'between' (not the last game)", t.phase === "between");
check("game 1 of 3: history has 1 entry", t.history.length === 1);
check(
  "game 1 of 3: tournament points were tallied",
  t.standings.get("a") === 5 && t.standings.get("b") === 3 && t.standings.get("c") === 2
);

t.currentIndex += 1; // the host's "Next Game ->" click on TournamentBetween
stepAt(t, PLAYERS.length); // -> intro for game 2
beginGame(t, "wavelength", PLAYERS);
recordGameResult(t, "wavelength", STANDINGS);
check("game 2 of 3: phase is 'between' (not the last game)", t.phase === "between");
check("game 2 of 3: history has 2 entries", t.history.length === 2);

t.currentIndex += 1;
stepAt(t, PLAYERS.length); // -> intro for game 3 (the last one)
beginGame(t, "emoji-movie", PLAYERS);
recordGameResult(t, "emoji-movie", STANDINGS);
check(
  "game 3 of 3 (LAST game): phase skips 'between' straight to 'complete'",
  t.phase === "complete",
  `got '${t.phase}'`
);
check("game 3 of 3: its result still made it into history", t.history.length === 3);
check(
  "game 3 of 3: its points still counted on the leaderboard",
  t.standings.get("a") === 15 && t.standings.get("b") === 9 && t.standings.get("c") === 6
);

// Two-game tournament — the LAST game is also the very first one played;
// still must skip "between" the same way.
{
  const t2 = createTournament({ mode: "manual", lineup: ["taboo", "wavelength"] }, PLAYERS);
  stepAt(t2, PLAYERS.length);
  beginGame(t2, "taboo", PLAYERS);
  recordGameResult(t2, "taboo", STANDINGS);
  check("2-game lineup, game 1: 'between' shows normally", t2.phase === "between");

  t2.currentIndex += 1;
  stepAt(t2, PLAYERS.length);
  beginGame(t2, "wavelength", PLAYERS);
  recordGameResult(t2, "wavelength", STANDINGS);
  check(
    "2-game lineup, game 2 (LAST game): skips straight to 'complete'",
    t2.phase === "complete"
  );
}

console.log(failures === 0 ? "\nALL TOURNAMENT CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
