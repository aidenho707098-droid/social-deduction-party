// Game catalogue + player-count rules selftest.
//   (a) client/src/games/catalog.js (what every menu shows) agrees with the
//       server game modules (what actually gets enforced)
//   (b) fit checks: per-mode minimums, the Random Mode wheel pool, Manual
//       lineups, replacing / skipping an "up next" game that stopped fitting
//   (c) every game whose minimum is now 2 plays start to finish with
//       exactly 2 players, incl. the known edge cases
//   (d) tournament points with 2 players
// Run:  node server/catalog.selftest.mjs   (or npm run test:catalog)

import { GAMES } from "./games/registry.js";
import { fitError, fitsSomeMode, limitsFor } from "./games/playerLimits.js";
import { CATALOG, FILTERS, fitReason, playerRangeLabel } from "../client/src/games/catalog.js";
import {
  createTournament,
  eligibleGameIds,
  stepAt,
  enterIntro,
  replacePendingGame,
  skipGame,
  toTournamentPoints,
  getTournamentPublicState,
} from "./tournament.js";
import * as bm from "./games/black-magic.js";
import * as taboo from "./games/taboo.js";
import * as wai from "./games/who-am-i.js";
import * as wl from "./games/wavelength.js";
import * as emoji from "./games/emoji-movie.js";
import * as soup from "./games/alphabet-soup.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);
const P2 = ["a", "b"];

// ===================================================================
section("(a) client catalogue matches the server");
{
  const serverIds = Object.keys(GAMES).sort();
  const clientIds = CATALOG.map((g) => g.id).sort();
  check("same set of games", serverIds.join() === clientIds.join(), `server ${serverIds} / client ${clientIds}`);
  const tagKeys = new Set(FILTERS.map((f) => f.key).filter((k) => k !== "all"));
  for (const entry of CATALOG) {
    const mod = GAMES[entry.id];
    if (!mod) continue;
    check(`${entry.id}: name`, entry.name === mod.name, `${entry.name} vs ${mod.name}`);
    check(`${entry.id}: minPlayers`, entry.minPlayers === mod.minPlayers, `${entry.minPlayers} vs ${mod.minPlayers}`);
    check(`${entry.id}: maxPlayers`, (entry.maxPlayers ?? null) === (mod.maxPlayers ?? null), `${entry.maxPlayers} vs ${mod.maxPlayers}`);
    const clientModes = Object.fromEntries(Object.entries(entry.modes ?? {}).map(([k, m]) => [k, m.minPlayers]));
    check(`${entry.id}: per-mode minimums`, JSON.stringify(clientModes) === JSON.stringify(mod.modeMinPlayers ?? {}));
    check(`${entry.id}: has a valid tag`, entry.tags.length > 0 && entry.tags.every((t) => tagKeys.has(t)), entry.tags.join());
    check(`${entry.id}: has a description + genre`, entry.description?.length > 20 && entry.genre);
  }
  const twos = ["emoji-movie", "wavelength", "black-magic", "who-am-i", "taboo", "alphabet-soup"];
  check("lowered games have minimum 2", twos.every((id) => GAMES[id].minPlayers === 2));
  check("other minimums unchanged", ["imposter", "fibbage", "fake-artist", "hot-potato"].every((id) => GAMES[id].minPlayers === 3) && GAMES["would-you-rather"].minPlayers === 2);
  const memory = CATALOG.find((g) => g.id === "memory-imposter");
  check("Memory Imposter: 4–10, Deduction + Memory, Memory chip exists",
    GAMES["memory-imposter"].minPlayers === 4 && GAMES["memory-imposter"].maxPlayers === 10 &&
    memory?.tags.join() === "deduction,memory" && FILTERS.some((f) => f.key === "memory"));
  check("Memory Imposter: client name = server name constant", memory?.name === GAMES["memory-imposter"].name);
  check("menu label shows both Alphabet Soup minimums", playerRangeLabel(CATALOG.find((g) => g.id === "alphabet-soup")) === "2–10 players, Spoken 3+");
}

// ===================================================================
section("(b) fit checks");
{
  const soupMod = GAMES["alphabet-soup"];
  check("Alphabet Soup Typed fits 2", fitError(soupMod, 2, { mode: "typed" }) === null);
  check("Alphabet Soup with no mode = Typed, fits 2", fitError(soupMod, 2, {}) === null);
  check("Alphabet Soup Spoken rejected at 2", /Spoken|spoken/.test(fitError(soupMod, 2, { mode: "spoken" }) ?? ""));
  check("Alphabet Soup Spoken fits 3", fitError(soupMod, 3, { mode: "spoken" }) === null);
  check("limitsFor picks the mode minimum", limitsFor(soupMod, { mode: "spoken" }).min === 3 && limitsFor(soupMod, {}).min === 2);
  check("max enforced", /at most 10/.test(fitError(GAMES["who-am-i"], 11, {}) ?? ""));
  check("client fitReason phrasing", fitReason(CATALOG.find((g) => g.id === "imposter"), 2) === "needs 3+ players" && fitReason(CATALOG.find((g) => g.id === "hot-potato"), 11) === "max 10 players");
  check("client + server agree on every game at 1..12 players", CATALOG.every((g) =>
    Array.from({ length: 12 }, (_, i) => i + 1).every((n) => (fitReason(g, n) === null) === fitsSomeMode(GAMES[g.id], n))));

  const pool2 = eligibleGameIds(2).sort();
  check("wheel pool at 2 = exactly the 2-player games", pool2.join() === ["alphabet-soup", "black-magic", "emoji-movie", "taboo", "wavelength", "who-am-i", "would-you-rather"].sort().join(), pool2.join());
  // Spin the wheel many times at 2 players: it never lands on a game that doesn't fit.
  const t = createTournament({ mode: "random", totalGames: 12 }, P2);
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    t.currentIndex = i % 12;
    const step = stepAt(t, 2);
    if (!fitsSomeMode(GAMES[step.landedOn], 2)) bad++;
  }
  check("200 wheel spins at 2 players never land on a misfit", bad === 0);
  // Players leave between spins: the pool is rebuilt from the count at spin time.
  const t2 = createTournament({ mode: "random", totalGames: 4 }, ["a", "b", "c", "d"]);
  const s1 = stepAt(t2, 2);
  check("wheel uses the count at spin time", t2.wheel.pool.every((id) => fitsSomeMode(GAMES[id], 2)) && fitsSomeMode(GAMES[s1.landedOn], 2));

  let err = "";
  try { createTournament({ mode: "manual", lineup: ["imposter", "taboo"] }, P2); } catch (e) { err = e.message; }
  check("manual lineup with a misfit is rejected (not silently dropped)", /Imposter needs at least 3/.test(err), err);
  err = "";
  try { createTournament({ mode: "manual", lineup: ["alphabet-soup", "taboo"], lineupSettings: [{ mode: "spoken" }, {}] }, P2); } catch (e) { err = e.message; }
  check("manual lineup checks the slot's chosen mode", /spoken/i.test(err), err);
  const ok = createTournament({ mode: "manual", lineup: ["alphabet-soup", "taboo"], lineupSettings: [{ mode: "typed" }, {}] }, P2);
  check("a fitting 2-player lineup is accepted", ok.lineup.join() === "alphabet-soup,taboo");

  // "Up next" game stopped fitting: replace / skip.
  const m = createTournament({ mode: "manual", lineup: ["imposter", "fibbage", "taboo"] }, ["a", "b", "c"]);
  stepAt(m, 3);
  check("setup: intro for game 1", m.phase === "intro" && m.pendingGameId === "imposter");
  replacePendingGame(m, "taboo");
  check("replace swaps the lineup slot and stays on the intro", m.lineup[0] === "taboo" && m.pendingGameId === "taboo" && m.phase === "intro");
  check("replaced game is flagged for the intro screen", getTournamentPublicState(m, ["a", "b"]).pendingGame.replaced === true);
  check("a normal intro isn't flagged", (enterIntro(m, "taboo"), !getTournamentPublicState(m, ["a", "b"]).pendingGame.replaced));
  m.currentIndex = 1;
  stepAt(m, 2);
  skipGame(m, m.pendingGameId);
  check("skip records the game as skipped and moves on", m.history.at(-1).skipped && m.history.at(-1).gameId === "fibbage" && m.currentIndex === 2);
}

// ===================================================================
section("(c) 2-player games, start to finish");

// Black Magic: the Witch + one guesser.
{
  const g = bm.createGame(P2, { rounds: 2, assignment: "rotation" });
  const witch = g.witchId;
  const guesser = P2.find((p) => p !== witch);
  bm.chooseCurse(g, "verbal");
  const t0 = Date.now();
  bm.giveUp(g, guesser, P2);
  check("BM: the only guesser giving up ends the round at once", g.phase === "reveal" && g.lastResult.outcome === "surrendered", g.phase);
  check("BM: ended immediately (not at the 5-minute limit)", g.lastResult.elapsedMs < 5_000 && Date.now() - t0 < 1000);
  check("BM: Witch scored by time, guesser 0", g.lastResult.playerPts === 0 && g.scores.get(guesser) === 0);
  bm.nextRound(g, P2);
  check("BM: rotation hands the Witch to the other player", g.witchId === guesser && g.phase === "choose");
  bm.chooseCurse(g, "physical");
  bm.awardGuess(g, witch, P2);
  check("BM: Witch awards the only guesser", g.phase === "reveal" && g.lastResult.outcome === "lifted" && g.lastResult.guesserId === witch);
  bm.nextRound(g, P2);
  check("BM: game finishes", g.phase === "final");
  const pub = bm.getPublicState(g, P2);
  check("BM: final standings for both", pub.scores.length === 2 && pub.winnerIds.length >= 1);

  // Give up with 3 players: only ends once EVERY guesser has given up.
  const g3 = bm.createGame(["a", "b", "c"], { rounds: 1, assignment: "rotation" });
  bm.chooseCurse(g3, "verbal");
  const gs = ["a", "b", "c"].filter((p) => p !== g3.witchId);
  bm.giveUp(g3, gs[0], ["a", "b", "c"]);
  check("BM 3p: one of two give-ups keeps the round going", g3.phase === "active");
  bm.giveUp(g3, gs[1], ["a", "b", "c"]);
  check("BM 3p: all give-ups end it", g3.phase === "reveal" && g3.lastResult.outcome === "surrendered");
  // The last non-given-up guesser leaves for good.
  const g4 = bm.createGame(["a", "b", "c"], { rounds: 1, assignment: "rotation" });
  bm.chooseCurse(g4, "verbal");
  const gs4 = ["a", "b", "c"].filter((p) => p !== g4.witchId);
  bm.giveUp(g4, gs4[0], ["a", "b", "c"]);
  const present = ["a", "b", "c"].filter((p) => p !== gs4[1]);
  bm.reconcilePresence(g4, present, { final: false });
  check("BM: a blip from the last guesser doesn't end the round", g4.phase === "active");
  bm.reconcilePresence(g4, present, { final: true });
  check("BM: the last guesser leaving for good ends it", g4.phase === "reveal" && g4.lastResult.outcome === "surrendered");
}

// Taboo: Describer + one guesser.
{
  const g = taboo.createGame(P2, { rounds: 2, categories: ["animals"] });
  const d0 = g.describerByRound[0];
  const guesser = P2.find((p) => p !== d0);
  taboo.startRound(g, d0);
  taboo.giveUp(g, guesser, P2);
  check("Taboo: the only guesser giving up ends the round at once", g.phase === "reveal");
  taboo.nextRound(g);
  const d1 = g.describerByRound[1];
  check("Taboo: Describer alternates", d1 !== d0);
  taboo.startRound(g, d1);
  const r = taboo.submitGuess(g, d0, g.entries[1].word, P2);
  check("Taboo: a correct guess from the only guesser ends the round", r.correct && g.phase === "reveal");
  check("Taboo: guesser + Describer both scored", g.lastResult.rows[0].points > 0 && g.lastResult.describerPoints > 0);
  taboo.nextRound(g);
  check("Taboo: game finishes", g.phase === "final");
}

// Who Am I?: turn passing with one other player.
{
  const g = wai.createGame(P2, { rounds: 1, categories: ["animals"] });
  const first = g.turnOrder[0];
  const other = g.turnOrder[1];
  wai.askQuestion(g, first, "no", P2);
  check("WAI: 'No' passes to exactly the other player", g.turnOrder[g.currentTurnIndex] === other);
  wai.askQuestion(g, other, "yes", P2);
  check("WAI: 'Yes' keeps the turn", g.turnOrder[g.currentTurnIndex] === other);
  g.deadline = Date.now() - 5_000; // the turn clock ran out
  wai.tick(g, P2);
  check("WAI: a timeout passes to exactly the other player", g.turnOrder[g.currentTurnIndex] === first);
  wai.startGuess(g, first);
  const right = wai.submitGuess(g, first, g.assignment.get(first).name, P2);
  check("WAI: correct guess", right.correct && g.phase === "turns");
  check("WAI: turn moves to the player still guessing", g.turnOrder[g.currentTurnIndex] === other);
  wai.askQuestion(g, other, "no", P2);
  check("WAI: the remaining player keeps going solo after a 'No'", g.turnOrder[g.currentTurnIndex] === other && g.phase === "turns");
  g.deadline = Date.now() - 5_000;
  wai.tick(g, P2);
  check("WAI: ...and after a timeout", g.turnOrder[g.currentTurnIndex] === other && g.phase === "turns");
  wai.startGuess(g, other);
  wai.submitGuess(g, other, g.assignment.get(other).name, P2);
  check("WAI: second player can finish -> reveal", g.phase === "reveal");
  const rows = g.lastResult.rows;
  check("WAI: placements 1 and 2", rows[0].playerId === first && rows[0].placement === 1 && rows[1].placement === 2);
  wai.nextRound(g, P2);
  check("WAI: game finishes", g.phase === "final");
}

// Wavelength: upfront writing, alternating Clue-Giver, single guesser.
{
  const g = wl.createGame(P2, { rounds: 4 });
  check("WL: Clue-Giver alternates", g.clueGiverByRound.every((pid, i) => i === 0 || pid !== g.clueGiverByRound[i - 1]));
  check("WL: each player writes 2 of the 4 clues", P2.every((p) => g.writeQueueByPlayer.get(p).length === 2));
  for (let i = 0; i < 2; i++) for (const p of P2) wl.submitClue(g, p, "somewhere around there", P2);
  check("WL: both writers done -> guessing", g.phase === "guess");
  let round = 0;
  while (g.phase !== "final" && round < 10) {
    const guesser = P2.find((p) => p !== g.clueGiverId);
    wl.submitGuess(g, guesser, g.target, P2);
    if (round === 0) {
      check("WL: the single guesser's guess ends the round", g.phase === "reveal");
      check("WL: exact = 3 for the guesser, 2 for the Clue-Giver", g.lastResult.rows[0].points === 3 && g.lastResult.giverPoints === 2);
    }
    wl.nextRound(g, P2);
    round++;
  }
  check("WL: game finishes after 4 rounds", g.phase === "final" && round === 4);
  check("WL: alternating roles give equal totals for equal play", g.scores.get("a") === g.scores.get("b"), JSON.stringify([...g.scores]));
}

// Crack the Code: both race; ranking + leaderboard.
{
  const g = emoji.createGame(P2, { rounds: 2, difficulty: "easy", categories: ["movies"] });
  const title = g.entries[0].title;
  emoji.submitAnswer(g, "a", title, P2);
  check("CtC: one solve doesn't end the round while the other is guessing", g.phase === "guess");
  emoji.submitAnswer(g, "b", title, P2);
  check("CtC: both solved -> reveal", g.phase === "reveal");
  check("CtC: both scored, earliest first", g.lastResult.entries.every((e) => e.points > 0) && g.lastResult.entries[0].playerId === "a");
  emoji.nextRound(g);
  emoji.forceAdvance(g, P2);
  emoji.nextRound(g);
  check("CtC: game finishes with a 2-row leaderboard", g.phase === "final" && emoji.getPublicState(g, P2).scores.length === 2);
}

// Alphabet Soup Typed: unique vs shared, the bonus, a one-voter dispute.
{
  const g = soup.createGame(P2, { rounds: 1, mode: "typed", categories: ["animals"] });
  soup.tick(g, P2, g.introEndsAt);
  g.round = { ...g.round, categoryKey: "animals", letter: "B" };
  const at = g.introEndsAt + 1000;
  soup.submitAnswer(g, "a", "Bear", P2, at);
  soup.submitAnswer(g, "a", "Bison", P2, at);
  soup.submitAnswer(g, "a", "Bus", P2, at);
  soup.submitAnswer(g, "b", "Bear", P2, at);
  soup.submitAnswer(g, "b", "Baboon", P2, at);
  soup.submitAnswer(g, "b", "Beaver", P2, at);
  for (const j of soup.takeValidationJobs(g)) soup.recordValidation(g, j.token, j.answer === "Bus" ? "invalid" : "valid");
  soup.markDone(g, "a", P2, at + 10);
  soup.markDone(g, "b", P2, at + 10);
  soup.tick(g, P2, at + 20);
  check("Soup: setup reaches review", g.phase === "review");
  const row = (pid) => g.lastResult.rows.find((r) => r.playerId === pid);
  // a: Bear shared 1 + Bison 2 = 3; b: Bear 1 + Baboon 2 + Beaver 2 = 5 + bonus 2.
  check("Soup: shared 1 / unique 2 with 2 players", row("a").points === 3 && row("b").points === 7, JSON.stringify(g.lastResult.rows));
  check("Soup: most-unique bonus to the outright leader only", g.lastResult.bonusIds.join() === "b");
  const busId = g.answers.get("a").find((x) => x.text === "Bus").id;
  const d = soup.openDispute(g, "a", busId, P2, at + 30);
  check("Soup: dispute opens", d.ok);
  soup.voteDispute(g, "b", d.disputeId, true, P2, at + 31);
  const D = g.review.disputes[0];
  check("Soup: the single voter decides at once (1–0, no tie possible)", D.resolved && D.overturned === true);
  check("Soup: overturned -> both tie on 2 uniques, both get the bonus", g.lastResult.bonusIds.sort().join() === "a,b");
  soup.settleReview(g, "b", P2, at + 32);
  check("Soup: review closes -> reveal", g.phase === "reveal");
  check("Soup: totals a 7, b 7", g.scores.get("a") === 7 && g.scores.get("b") === 7, JSON.stringify([...g.scores]));
  // A "keep rejected" vote from the single voter also decides at once.
  const g2 = soup.createGame(P2, { rounds: 1, mode: "typed", categories: ["animals"] });
  soup.tick(g2, P2, g2.introEndsAt);
  g2.round = { ...g2.round, categoryKey: "animals", letter: "B" };
  const at2 = g2.introEndsAt + 1000;
  soup.submitAnswer(g2, "a", "Bus", P2, at2);
  for (const j of soup.takeValidationJobs(g2)) soup.recordValidation(g2, j.token, "invalid");
  soup.markDone(g2, "a", P2, at2 + 1);
  soup.markDone(g2, "b", P2, at2 + 1);
  soup.tick(g2, P2, at2 + 2);
  const d2 = soup.openDispute(g2, "a", g2.answers.get("a")[0].id, P2, at2 + 3);
  soup.voteDispute(g2, "b", d2.disputeId, false, P2, at2 + 4);
  const D2 = g2.review?.disputes?.[0];
  check("Soup: single voter keeping it rejected also resolves at once", D2?.resolved === true && D2.overturned === false && g2.phase === "reveal", `${g2.phase} ${JSON.stringify(D2 && { r: D2.resolved, o: D2.overturned })}`);
}

// ===================================================================
section("(d) tournament points with 2 players");
{
  const pts = toTournamentPoints([{ playerId: "a", score: 9 }, { playerId: "b", score: 4 }]);
  check("winner 5, runner-up 3", pts.find((p) => p.playerId === "a").points === 5 && pts.find((p) => p.playerId === "b").points === 3);
  const tie = toTournamentPoints([{ playerId: "a", score: 4 }, { playerId: "b", score: 4 }]);
  check("a 2-player tie shares 1st (5 each)", tie.every((p) => p.rank === 1 && p.points === 5));
}

console.log(failures === 0 ? "\nALL CATALOG CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
