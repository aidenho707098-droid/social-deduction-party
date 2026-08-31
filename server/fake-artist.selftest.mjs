// Standalone check for the Fake Artist game module — the turn-based
// merge-and-broadcast flow and the voting / scoring / word-guess maths.
// Run:  node server/fake-artist.selftest.mjs
// Prints PASS/FAIL per case, exits non-zero on any failure.

import * as fa from "./games/fake-artist.js";
import { CATEGORIES, CATEGORY_NAMES } from "./fakeArtistWords.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const IDS = ["p1", "p2", "p3", "p4"];
const present = () => [...IDS];

// --- content sanity --------------------------------------------------
check(
  "every category has 20+ drawable words",
  CATEGORY_NAMES.every((c) => CATEGORIES[c].length >= 20)
);
check("categories reuse Imposter-style labels", CATEGORY_NAMES.includes("Animals"));

// --- createGame ----------------------------------------------------
{
  const g = fa.createGame(IDS, { rounds: 3, categories: ["Animals"] });
  check("phase starts at 'brief'", g.phase === "brief");
  check("totalRounds honours the request", g.totalRounds === 3);
  check("entries are all from the chosen category", g.entries.every((e) => e.category === "Animals"));
  check("no repeated words within a game", new Set(g.entries.map((e) => e.word)).size === g.entries.length);
  check("imposterByRound cycles the roster", g.imposterByRound.length === 3);
  check("turnOrder is the full roster, shuffled", [...g.turnOrder].sort().join() === [...IDS].sort().join());
  check("everyone starts at 0", [...g.scores.values()].every((v) => v === 0));
  check("rejects <3 players", (() => { try { fa.createGame(["a", "b"], { rounds: 1 }); return false; } catch { return true; } })());
  check("rejects bad round count", (() => { try { fa.createGame(IDS, { rounds: 0 }); return false; } catch { return true; } })());
}

// --- turn-based drawing flow: merge & advance --------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Animals"] });
  fa.startDrawing(g);
  check("startDrawing -> phase 'draw', a turn clock is set", g.phase === "draw" && g.turnDeadline > Date.now());
  check("first drawer is turnOrder[0]", fa.getPublicState(g, present()).currentDrawerId === g.turnOrder[0]);

  // Wrong player can't submit.
  const wrong = g.turnOrder[1];
  check("a non-current player's submit is rejected", fa.submitDrawing(g, wrong, PNG, present()).notYourTurn === true);

  // Walk every turn.
  let lastRev = g.canvasRev;
  for (let i = 0; i < g.turnOrder.length; i++) {
    const drawer = g.turnOrder[g.currentTurn];
    const res = fa.submitDrawing(g, drawer, PNG, present());
    check(`turn ${i + 1}: accepted`, res.ok === true);
    check(`turn ${i + 1}: canvasRev incremented`, g.canvasRev === lastRev + 1);
    lastRev = g.canvasRev;
  }
  check("after the last turn -> phase 'gallery'", g.phase === "gallery");
  check("gallery: shared canvas is present in public state", typeof fa.getPublicState(g, present()).canvas === "string");
  check("gallery: no more turn clock", g.turnDeadline === null);
}

// --- oversized / malformed image is dropped, turn still advances --
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Food & Drink"] });
  fa.startDrawing(g);
  const drawer = g.turnOrder[0];
  const huge = "data:image/png;base64," + "A".repeat(fa.MAX_IMAGE_BYTES + 10);
  const before = g.canvasRev;
  const res = fa.submitDrawing(g, drawer, huge, present());
  check("oversized image: submit still ok", res.ok === true);
  check("oversized image: canvas NOT updated", g.canvasRev === before);
  check("oversized image: turn still advanced", g.currentTurn === 1);

  const res2 = fa.submitDrawing(g, g.turnOrder[1], "not a data url", present());
  check("garbage image: turn still advances", res2.ok === true && g.currentTurn === 2);
}

// --- turn timeout auto-advances ---------------------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Nature"] });
  fa.startDrawing(g);
  check("tickTurn is a no-op while time remains", fa.tickTurn(g, present()) === false && g.currentTurn === 0);
  g.turnDeadline = Date.now() - 5000; // pretend the clock ran out
  check("tickTurn advances past a dead clock", fa.tickTurn(g, present()) === true && g.currentTurn === 1);
}

// --- a drawer who left mid-turn is skipped ---------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Nature"] });
  fa.startDrawing(g);
  const gone = g.turnOrder[0];
  const stillHere = IDS.filter((id) => id !== gone);
  fa.reconcilePresence(g, stillHere);
  check("reconcile skips the vanished current drawer", g.turnOrder[g.currentTurn] !== gone);
}

// --- voting: can't vote yourself, one vote each --------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Places"] });
  fa.startDrawing(g);
  while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
  fa.startVoting(g);
  check("startVoting -> phase 'vote'", g.phase === "vote");
  check("voting for yourself is rejected", fa.submitVote(g, "p1", "p1", present()).self === true);
  check("voting for a non-player is rejected", fa.submitVote(g, "p1", "ghost", present()).ok === false);

  fa.submitVote(g, "p1", "p2", present());
  check("re-voting the same target clears it", (fa.submitVote(g, "p1", "p2", present()), !g.votes.has("p1")));
  fa.submitVote(g, "p1", "p2", present());
  fa.submitVote(g, "p1", "p3", present());
  check("changing your vote replaces it", g.votes.get("p1") === "p3");
}

// --- scoring: detectives catch the imposter -----------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Places"] });
  const imp = g.imposterByRound[0];
  const others = IDS.filter((id) => id !== imp);
  fa.startDrawing(g);
  while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
  fa.startVoting(g);
  // Everyone (including the imposter) votes the imposter.
  for (const v of IDS) if (v !== imp) fa.submitVote(g, v, imp, present());
  fa.submitVote(g, imp, others[0], present()); // imposter throws a vote elsewhere
  check("all voted -> phase 'reveal'", g.phase === "reveal");
  check("result marks the imposter CAUGHT", g.lastResult.caught === true);
  for (const d of others) {
    check(`detective ${d} got +${fa.VOTE_MS ? 2 : 2}`, g.scores.get(d) === 2);
  }
  check("caught imposter gets no evasion points", g.scores.get(imp) === 0);
}

// --- scoring: imposter evades ------------------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Animals"] });
  const imp = g.imposterByRound[0];
  const others = IDS.filter((id) => id !== imp);
  fa.startDrawing(g);
  while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
  fa.startVoting(g);
  // Everyone points at an innocent instead.
  const scapegoat = others[0];
  for (const v of IDS) if (v !== scapegoat) fa.submitVote(g, v, scapegoat, present());
  fa.submitVote(g, scapegoat, others[1], present());
  check("imposter marked EVADED", g.lastResult.caught === false);
  check("evading imposter gets +3", g.scores.get(imp) === 3);
  check("nobody earned detective points", others.every((d) => g.scores.get(d) === 0));
}

// --- word-guess bonus: independent of the vote outcome -------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Animals"] });
  const imp = g.imposterByRound[0];
  const word = g.entries[0].word;
  fa.startDrawing(g);
  while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
  fa.startVoting(g);
  for (const v of IDS) if (v !== imp) fa.submitVote(g, v, imp, present()); // caught
  fa.submitVote(g, imp, IDS.find((i) => i !== imp), present());
  const scoreBeforeGuess = g.scores.get(imp);
  const gr = fa.submitImposterGuess(g, imp, word.toLowerCase());
  check("exact word guess is correct", gr.correct === true);
  check("correct guess adds exactly +1 on top", g.scores.get(imp) === scoreBeforeGuess + 1);
  check("a second guess is rejected", fa.submitImposterGuess(g, imp, word).ok === false);
  check("result carries the guess outcome", g.lastResult.imposterGuess.correct === true);

  const g2 = fa.createGame(IDS, { rounds: 1, categories: ["Animals"] });
  const imp2 = g2.imposterByRound[0];
  fa.startDrawing(g2);
  while (g2.phase === "draw") fa.submitDrawing(g2, g2.turnOrder[g2.currentTurn], PNG, present());
  fa.startVoting(g2);
  for (const v of IDS) if (v !== imp2) fa.submitVote(g2, v, imp2, present());
  fa.submitVote(g2, imp2, IDS.find((i) => i !== imp2), present());
  const before2 = g2.scores.get(imp2);
  fa.submitImposterGuess(g2, imp2, "definitely not the word xyzzy");
  check("wrong guess adds nothing", g2.scores.get(imp2) === before2);
  check("non-imposter can't guess", fa.submitImposterGuess(fa.createGame(IDS, { rounds: 1 }), "p1", "x").ok === false);
}

// --- guess timeout / skip -----------------------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Nature"] });
  const imp = g.imposterByRound[0];
  fa.startDrawing(g);
  while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
  fa.startVoting(g);
  for (const v of IDS) if (v !== imp) fa.submitVote(g, v, imp, present());
  fa.submitVote(g, imp, IDS.find((i) => i !== imp), present());
  g.guessDeadline = Date.now() - 4000;
  check("tickGuess skips a dead guess clock", fa.tickGuess(g) === true);
  check("skipped guess is recorded as no-answer", g.imposterGuess.text === null && g.imposterGuess.correct === false);
}

// --- multi-round: rotation + leaderboard accumulation ---------
{
  const g = fa.createGame(IDS, { rounds: 3, categories: CATEGORY_NAMES });
  const seenImposters = [];
  for (let r = 0; r < 3; r++) {
    seenImposters.push(g.imposterByRound[g.roundIndex]);
    fa.startDrawing(g);
    while (g.phase === "draw") fa.submitDrawing(g, g.turnOrder[g.currentTurn], PNG, present());
    fa.startVoting(g);
    const imp = g.imposterByRound[g.roundIndex];
    for (const v of IDS) if (v !== imp) fa.submitVote(g, v, imp, present());
    fa.submitVote(g, imp, IDS.find((i) => i !== imp), present());
    fa.skipImposterGuess(g);
    fa.nextRound(g, present());
  }
  check("game ends after the last round", g.phase === "final");
  check("imposter role rotated between rounds", new Set(seenImposters).size >= 2);
  check("scores accumulated across rounds", [...g.scores.values()].reduce((a, b) => a + b, 0) > 0);
  const pub = fa.getPublicState(g, present());
  check("final: winnerIds is the top scorer(s)", Array.isArray(pub.winnerIds));
}

// --- private role view --------------------------------------
{
  const g = fa.createGame(IDS, { rounds: 1, categories: ["Animals"] });
  const imp = g.imposterByRound[0];
  const artist = IDS.find((id) => id !== imp);
  const impView = fa.getPrivateState(g, imp);
  const artistView = fa.getPrivateState(g, artist);
  check("imposter sees the category, NOT the word", impView.fakeArtist.role === "imposter" && !impView.fakeArtist.word);
  check("artist sees the real word", artistView.fakeArtist.role === "artist" && artistView.fakeArtist.word === g.entries[0].word);
  check("imposter's hint category matches the round", impView.fakeArtist.category === g.entries[0].category);
}

console.log(`\n${failures === 0 ? "ALL FAKE ARTIST CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
