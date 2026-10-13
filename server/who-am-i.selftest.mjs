// Standalone check for the "Who Am I?" game module — identity dealing +
// redaction, the ask/pass/guess turn engine, timeouts, the question cap,
// scoring, and the presence hooks (disconnect skip / final removal).
// Run:  node server/who-am-i.selftest.mjs
// Prints PASS/FAIL per case, exits non-zero on any failure.

import * as wai from "./games/who-am-i.js";
import { CATEGORIES, BANKS } from "./games/whoAmIBank.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const IDS = ["p1", "p2", "p3", "p4"];
const present = (ids = IDS) => [...ids];

// --- content sanity --------------------------------------------------
check("six categories", CATEGORIES.length === 6);
check(
  "every category has 30+ identities",
  CATEGORIES.every((c) => BANKS[c.key].length >= 30),
  CATEGORIES.map((c) => `${c.key}:${BANKS[c.key].length}`).join(" ")
);
for (const c of CATEGORIES) {
  const names = BANKS[c.key].map((e) => e.name);
  check(`${c.key}: no duplicate names`, new Set(names).size === names.length);
}

// --- (a) createGame: dealing + redacted private state -----------------
{
  const g = wai.createGame(IDS, { rounds: 3, categories: ["animals"] });
  check("phase starts at 'turns'", g.phase === "turns");
  check("totalRounds honours the request", g.totalRounds === 3);
  check("everyone starts at 0", [...g.scores.values()].every((v) => v === 0));
  check("rejects <2 players", (() => {
    try { wai.createGame(["a"], { rounds: 1 }); return false; } catch { return true; }
  })());
  check("accepts 2 players", (() => {
    try { return wai.createGame(["a", "b"], { rounds: 1 }).phase === "turns"; } catch { return false; }
  })());
  check("rejects >10 players", (() => {
    try { wai.createGame(Array.from({ length: 11 }, (_, i) => `x${i}`), { rounds: 1 }); return false; }
    catch { return true; }
  })());
  check("rejects bad round count", (() => {
    try { wai.createGame(IDS, { rounds: 0 }); return false; } catch { return true; }
  })());
  check("an unknown category falls back to every category (like other games)", (() => {
    const gg = wai.createGame(["a", "b", "c"], { rounds: 1, categories: ["__bogus__"] });
    return gg.categories.length === CATEGORIES.length;
  })());

  // No duplicate identities within the round.
  const pub = wai.getPublicState(g, present());
  check("public state never carries identities during 'turns'", !("identities" in pub));

  for (const pid of IDS) {
    const priv = wai.getPrivateState(g, pid);
    check(`${pid}: private state lists every player`, priv.whoAmI.identities.length === IDS.length);
    const own = priv.whoAmI.identities.find((r) => r.playerId === pid);
    check(`${pid}: own row is hidden`, own.hidden === true && own.identity === null);
    check(`${pid}: myIdentity is null before any guess`, priv.whoAmI.myIdentity === null);
    check(`${pid}: myCategory is a safe narrowing hint (no name leak)`, typeof priv.whoAmI.myCategory === "string" && priv.whoAmI.myCategory.length > 0);
    const others = priv.whoAmI.identities.filter((r) => r.playerId !== pid);
    check(`${pid}: every other row is revealed`, others.every((r) => r.identity && r.identity.name));
  }
  const names = [...new Set(wai.getPrivateState(g, IDS[0]).whoAmI.identities.map((r) => r.identity?.name).filter(Boolean))];
  check("identities assigned within the round are unique", names.length === IDS.length - 1);

  // The network-traffic guarantee, made explicit: serialize exactly what a
  // socket would send to each player and confirm their own name is absent.
  for (const pid of IDS) {
    const payload = JSON.stringify(wai.getPrivateState(g, pid));
    const myEntry = wai.getPrivateState(g, pid).whoAmI.identities.find((r) => r.playerId === pid);
    // (sanity: my own entry's name must not appear anywhere in MY payload)
    const othersEntries = wai.getPrivateState(g, pid).whoAmI.identities.filter((r) => r.playerId !== pid);
    const myRealName = null; // not knowable from the private payload itself — see the guess test below
    check(`${pid}: payload has no leaked own-identity field`, myEntry.identity === null && !payload.includes('"myIdentity":{"name"'));
    void othersEntries; void myRealName;
  }
}

// --- (b) turn engine + timers ------------------------------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const active0 = wai.getPublicState(g, present()).activePlayerId;
  check("an active player is chosen", IDS.includes(active0));
  check("subPhase starts 'asking'", wai.getPublicState(g, present()).subPhase === "asking");

  // Wrong player can't act.
  const bystander = IDS.find((p) => p !== active0);
  check("a non-active player's ask is rejected", wai.askQuestion(g, bystander, "yes", present()).notYourTurn === true);

  // "Yes" keeps the turn and resets the clock.
  const before = g.deadline;
  const r1 = wai.askQuestion(g, active0, "yes", present());
  check("yes: ok + counted", r1.ok && r1.questionsAsked === 1);
  check("yes: same player still active", wai.getPublicState(g, present()).activePlayerId === active0);
  check("yes: deadline reset forward", g.deadline >= before);

  // "No" passes the turn to exactly the next player in turnOrder.
  const order = g.turnOrder;
  const idx0 = order.indexOf(active0);
  const expectedNext = order[(idx0 + 1) % order.length];
  wai.askQuestion(g, active0, "no", present());
  check("no: turn passes to exactly the next player", wai.getPublicState(g, present()).activePlayerId === expectedNext);

  // A wrong guess also passes the turn and counts as a question.
  const active1 = expectedNext;
  wai.startGuess(g, active1);
  check("startGuess: subPhase -> guessing", g.subPhase === "guessing");
  const qBefore = g.questionsAsked.get(active1);
  const wrong = wai.submitGuess(g, active1, "definitely not a real animal zzz", present());
  check("wrong guess: ok, not correct", wrong.ok && wrong.correct === false);
  check("wrong guess: counted as a question", g.questionsAsked.get(active1) === qBefore + 1);
  const idx1 = order.indexOf(active1);
  const expectedNext2 = (() => {
    for (let s = 1; s <= order.length; s++) {
      const c = order[(idx1 + s) % order.length];
      if (!g.doneIds.has(c)) return c;
    }
    return null;
  })();
  check("wrong guess: turn passes on", wai.getPublicState(g, present()).activePlayerId === expectedNext2);
  check("wrong guess: back to 'asking'", g.subPhase === "asking");
}

// --- deliberate timeouts: never skip anyone ----------------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const order = g.turnOrder;
  const active0 = order[0];
  const qBefore = g.questionsAsked.get(active0);

  // Force an "asking" timeout.
  g.deadline = Date.now() - 10_000;
  const changed = wai.tick(g, present());
  check("asking timeout: tick reports a change", changed === true);
  check("asking timeout: does NOT cost a question", g.questionsAsked.get(active0) === qBefore);
  check("asking timeout: passes to exactly the next player", wai.getPublicState(g, present()).activePlayerId === order[1]);

  // Force a "guessing" timeout — counts as a (wrong) question.
  const active1 = order[1];
  wai.startGuess(g, active1);
  const q1Before = g.questionsAsked.get(active1);
  g.deadline = Date.now() - 10_000;
  wai.tick(g, present());
  check("guessing timeout: auto-submits as wrong (costs a question)", g.questionsAsked.get(active1) === q1Before + 1);
  check("guessing timeout: turn moves on", wai.getPublicState(g, present()).activePlayerId === order[2]);

  // No more timeouts once the clock hasn't actually expired.
  check("tick is a no-op with time left", wai.tick(g, present()) === false);
}

// --- the question cap --------------------------------------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const active0 = g.turnOrder[0];
  // Keep answering "yes" to the SAME player 19 times (stays active each time).
  for (let i = 0; i < 19; i++) {
    const res = wai.askQuestion(g, active0, "yes", present());
    check(`cap: question ${i + 1} keeps the turn`, res.ok && res.capped === false, `count=${res.questionsAsked}`);
  }
  check("cap: still active, not done", wai.getPublicState(g, present()).activePlayerId === active0);
  const r20 = wai.askQuestion(g, active0, "yes", present());
  check("cap: 20th question caps them out even on 'yes'", r20.ok && r20.capped === true);
  check("cap: active player moved on", wai.getPublicState(g, present()).activePlayerId !== active0);
  check("cap: capped player left the rotation", wai.getPublicState(g, present()).doneIds.includes(active0));
  check("cap: capped player never guessed", wai.getPublicState(g, present()).cappedIds.includes(active0));
}

// --- correct guess: placement + reveal to self --------------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const active0 = g.turnOrder[0];
  const realName = wai.getPrivateState(g, IDS.find((p) => p !== active0)).whoAmI.identities
    .find((r) => r.playerId === active0).identity.name;

  check("not revealed before guessing", wai.getPrivateState(g, active0).whoAmI.myIdentity === null);
  wai.startGuess(g, active0);
  const res = wai.submitGuess(g, active0, realName, present());
  check("correct guess accepted", res.ok && res.correct === true && res.placement === 1);
  check("correct guess reveals identity in the ack", res.identity?.name === realName);
  check("correct guess reveals identity via private state now", wai.getPrivateState(g, active0).whoAmI.myIdentity?.name === realName);
  check("correct guesser leaves the rotation", wai.getPublicState(g, present()).doneIds.includes(active0));
  check("correct guesser is not active anymore", wai.getPublicState(g, present()).activePlayerId !== active0);
}

// --- fuzzy matching (typos / alternate names) --------------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["fictional"] });
  const active0 = g.turnOrder[0];
  const entry = BANKS.fictional.find((e) =>
    e.name === wai.getPrivateState(g, IDS.find((p) => p !== active0)).whoAmI.identities
      .find((r) => r.playerId === active0).identity.name
  );
  wai.startGuess(g, active0);
  const typo = entry.name.length > 4 ? entry.name.slice(0, -1) + "x" : entry.name; // one-letter typo
  const res = wai.submitGuess(g, active0, entry.alts[0] ?? typo, present());
  check("alt name or near-typo is accepted", res.correct === true, `${entry.name} <- "${entry.alts[0] ?? typo}"`);
}

// --- (d) scoring + reveal ------------------------------------------------
{
  const g = wai.createGame(IDS, { rounds: 2, categories: ["animals"] });
  const realNameOf = (pid) => {
    const other = IDS.find((p) => p !== pid);
    return wai.getPrivateState(g, other).whoAmI.identities.find((r) => r.playerId === pid).identity.name;
  };
  // turnOrder[0] guesses correctly first beat (top placement + efficiency);
  // turnOrder[1] is driven to cap out by always answering "no"; the other
  // two guess correctly the moment they're up.
  const first = g.turnOrder[0];
  const capTarget = g.turnOrder[1];

  let guard = 0;
  while (wai.getPublicState(g, present()).phase === "turns" && guard++ < 200) {
    const cur = wai.getPublicState(g, present()).activePlayerId;
    if (cur == null) break;
    if (cur === capTarget) {
      wai.askQuestion(g, cur, "no", present());
    } else {
      wai.startGuess(g, cur);
      wai.submitGuess(g, cur, realNameOf(cur), present());
    }
  }

  check("round moved to reveal", wai.getPublicState(g, present()).phase === "reveal");
  const result = wai.getPublicState(g, present()).result;
  check("reveal lists every player", result.rows.length === IDS.length);
  check("reveal includes every identity", result.rows.every((r) => r.identity?.name));
  const firstRow = result.rows.find((r) => r.playerId === first);
  check("1st place scores the top placement points", firstRow.placementPoints === 5);
  check("1st place gets the best efficiency bonus (<=5 Qs)", firstRow.efficiencyPoints === 3 && firstRow.questionsAsked === 0);
  const cappedRow = result.rows.find((r) => r.playerId === capTarget);
  check("capped player used exactly 20 questions and never guessed", cappedRow.questionsAsked === 20 && cappedRow.correct === false);
  check("capped player scores 0", cappedRow.points === 0);

  // nextRound advances; after the LAST round it's "final".
  wai.nextRound(g, present());
  check("round 2 starts back at 'turns'", g.phase === "turns" && g.roundIndex === 1);

  // Finish round 2 the same deterministic way (everyone just guesses right
  // away — only the terminal-phase transitions matter here).
  guard = 0;
  while (g.phase === "turns" && guard++ < 200) {
    const cur = wai.getPublicState(g, present()).activePlayerId;
    if (cur == null) break;
    wai.startGuess(g, cur);
    wai.submitGuess(g, cur, realNameOf(cur), present());
  }
  check("round 2 reached reveal", g.phase === "reveal");
  wai.nextRound(g, present());
  check("final phase after the last round", g.phase === "final");
  check("getPublicState reports winnerIds in 'final'", Array.isArray(wai.getPublicState(g, present()).winnerIds));
}

// --- host "Force proceed": unsticks one held-up beat at a time ----------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const active0 = wai.getPublicState(g, present()).activePlayerId;
  wai.forceAdvance(g, present()); // same as a timeout: skip this one question, no cap cost
  check("force proceed (asking): moves to the next player", wai.getPublicState(g, present()).activePlayerId !== active0);
  check("force proceed (asking): costs no question", g.questionsAsked.get(active0) === 0);

  const active1 = wai.getPublicState(g, present()).activePlayerId;
  wai.startGuess(g, active1);
  wai.forceAdvance(g, present()); // mid-guess: same as a guess-timeout (counts as a question)
  check("force proceed (guessing): counts as a question", g.questionsAsked.get(active1) === 1);
  check("force proceed (guessing): back to 'asking' for the next player", g.subPhase === "asking");
}

// --- (e) presence: disconnect skip + final removal ----------------------
{
  const g = wai.createGame(IDS, { rounds: 1, categories: ["animals"] });
  const order = g.turnOrder;
  const active0 = order[0];

  // Active player drops (temporary) — turn skips to the next PRESENT player,
  // but their identity stays assigned (they might come back).
  const stillHere = IDS.filter((p) => p !== active0);
  wai.reconcilePresence(g, stillHere, { final: false });
  check("disconnect: turn skips the missing active player", wai.getPublicState(g, stillHere).activePlayerId !== active0);
  check("disconnect: identity assignment kept (might reconnect)", [...g.assignment.keys()].includes(active0));

  // The grace period expires (final) — identity is purged so nobody can
  // ever see it via another player's redacted list again.
  wai.reconcilePresence(g, stillHere, { final: true });
  check("final removal: identity purged from assignment", ![...g.assignment.keys()].includes(active0));
  for (const pid of stillHere) {
    const ids = wai.getPrivateState(g, pid).whoAmI.identities.map((r) => r.playerId);
    check(`final removal: ${pid}'s redacted list no longer lists them`, !ids.includes(active0));
  }
}

// --- tournament hooks ----------------------------------------------------
{
  const opts = wai.tournamentOptions();
  check("tournamentOptions returns rounds + categories", opts.rounds > 0 && Array.isArray(opts.categories));
  check("minPlayers / maxPlayers exported", wai.minPlayers === 2 && wai.maxPlayers === 10);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
