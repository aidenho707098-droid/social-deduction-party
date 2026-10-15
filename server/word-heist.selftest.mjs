// Word Heist selftest — the pieces, separately:
//   (a) pairing + the set-word phase with the AI check (fake AI)
//   (b) the Wordle engine and feedback
//   (d) scoring, fallbacks and voiding
//   + the AI checker's parsing / caching / timeout, the content bank, Chaos.
// Run:  node server/word-heist.selftest.mjs   (or npm run test:word-heist)

import * as wh from "./games/word-heist.js";
import {
  CONFIG,
  cleanHint,
  feedback,
  gridForm,
  keyStates,
  offsetFor,
  pairingsFor,
  potFor,
  scorePairing,
  structuralCheck,
} from "./games/wordHeistRules.js";
import { GENERAL, PROMPTS, PROMPTS_BY_ID } from "./games/wordHeistBank.js";
import { buildUserMessage, createWordChecker, interpret, parseReply } from "./wordHeistChecker.js";
import { MODIFIERS } from "./chaos.js";
import { eligibleModifiers } from "./chaosGames.js";
import { CATALOG } from "../client/src/games/catalog.js";
import { keyStates as clientKeyStates } from "../client/src/games/wordHeist/keyboard.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);
const json = (x) => JSON.stringify(x);

// ===================================================================
section("config + content");
{
  check("one config object holds the timers", CONFIG.setMs === 45_000 && CONFIG.solveMs === 180_000 && CONFIG.aiTimeoutMs === 8_000);
  check("rounds 1-8, default 3; 2-10 players", CONFIG.rounds.min === 1 && CONFIG.rounds.max === 8 && CONFIG.rounds.dflt === 3 && wh.minPlayers === 2 && wh.maxPlayers === 10);
  check("~40 prompts", PROMPTS.length >= 38 && PROMPTS.length <= 45, `${PROMPTS.length}`);
  const badPrompt = PROMPTS.filter((p) => p.words.length < 14 || p.words.some((w) => !/^[A-Z]{4,8}$/.test(w)) || new Set(p.words).size !== p.words.length);
  check("every prompt has ~15 distinct 4-8 letter fallbacks", badPrompt.length === 0, badPrompt.map((p) => p.id).join());
  check("proper-noun prompts included", ["country", "carbrand", "city", "usstate"].every((id) => PROMPTS_BY_ID[id]));
  check("~300 general words, 4-8 letters, unique", GENERAL.length >= 280 && GENERAL.every((g) => /^[A-Z]{4,8}$/.test(g.word)) && new Set(GENERAL.map((g) => g.word)).size === GENERAL.length, `${GENERAL.length}`);
  const badHints = GENERAL.filter((g) => cleanHint(g.hint, g.word) !== g.hint);
  check("every general hint is valid and doesn't contain its word", badHints.length === 0, badHints.map((g) => g.word).join());
  const entry = CATALOG.find((g) => g.id === "word-heist");
  check("catalogue: name constant, 2-10, Word + Guessing", entry?.name === wh.name && entry.minPlayers === 2 && entry.maxPlayers === 10 && entry.tags.join() === "word,guessing");
}

// ===================================================================
section("(a) pairing");
{
  for (const n of [2, 3, 5, 10]) {
    const order = Array.from({ length: n }, (_, i) => `p${i}`);
    let ok = true;
    const seen = new Map(order.map((p) => [p, []]));
    for (let k = 1; k <= 4; k++) {
      const pairs = pairingsFor(order, k);
      const setters = pairs.map((p) => p.setterId);
      if (pairs.some((p) => p.solverId === p.setterId)) ok = false; // nobody solves their own
      if (new Set(setters).size !== n) ok = false; // everyone sets exactly one solved word
      for (const p of pairs) seen.get(p.solverId).push(p.setterId);
    }
    // No setter repeats for a solver before every other player has set for them.
    const early = [...seen.values()].every((list) => {
      const window = list.slice(0, Math.min(4, n - 1));
      return new Set(window).size === window.length;
    });
    check(`${n} players x 4 rounds: a cycle, never own word, no early repeat setter`, ok && early, [...seen.entries()].map(([s, l]) => `${s}<-${l.join("/")}`).join(" "));
  }
  check("offset formula: ((k-1) mod (N-1)) + 1", offsetFor(1, 5) === 1 && offsetFor(4, 5) === 4 && offsetFor(5, 5) === 1 && offsetFor(3, 2) === 1);
  const two = [1, 2, 3, 4].map((k) => pairingsFor(["a", "b"], k).map((p) => p.setterId).join(""));
  check("2 players simply swap every round", two.every((x) => x === "ba"), two.join());
}

// ===================================================================
section("(b) Wordle feedback");
{
  check("SPEED vs guess ERASE: E y, R x, A x, S y, E y", feedback("ERASE", "SPEED") === "yxxyy", feedback("ERASE", "SPEED"));
  check("ERASE vs guess SPEED", feedback("SPEED", "ERASE") === "yxyyx", feedback("SPEED", "ERASE"));
  check("exact matches claim letters first: ABBEY / guess BABES", feedback("BABES", "ABBEY") === "yyggx", feedback("BABES", "ABBEY"));
  check("extra copies go grey: target CRANE, guess EERIE", feedback("EERIE", "CRANE") === "xxyxg", feedback("EERIE", "CRANE"));
  check("triple letter guess vs one in target: LLAMA / guess LOLLY", feedback("LOLLY", "LLAMA") === "gxyxx", feedback("LOLLY", "LLAMA"));
  check("solved", feedback("speed", "SPEED") === "ggggg");
  const ks = keyStates([
    { guess: "ERASE", pattern: "yxxyy" },
    { guess: "SPEED", pattern: "ggggg" },
  ]);
  check("keyboard: green beats yellow beats grey", ks.E === "g" && ks.S === "g" && ks.R === "x" && ks.A === "x");
  check("keyboard: yellow is not downgraded by a later grey", keyStates([{ guess: "AB", pattern: "yx" }, { guess: "AC", pattern: "xx" }]).A === "y");
  check("client keyboard module agrees", json(clientKeyStates([{ guess: "ERASE", pattern: "yxxyy" }, { guess: "SPEED", pattern: "ggggg" }])) === json(ks));
}

// ===================================================================
section("(d) scoring");
{
  const s1 = scorePairing(6, "solved", 1);
  check("6 letters, solved in 1: pot 8, solver 7, setter 1", s1.pot === 8 && s1.solver === 7 && s1.setter === 1);
  const sLast = scorePairing(6, "solved", 7);
  check("6 letters, solved on the last (7th) guess: solver 1, setter 7", sLast.solver === 1 && sLast.setter === 7);
  const sf = scorePairing(6, "failed", 7);
  check("failed: solver 0, setter the whole pot 8", sf.solver === 0 && sf.setter === 8);
  const sv = scorePairing(6, "void", 3);
  check("void: nobody scores", sv.solver === 0 && sv.setter === 0);
  check("points always add up to the pot", [4, 5, 6, 7, 8].every((L) => [1, 2, L + 1].every((g) => { const s = scorePairing(L, "solved", g); return s.solver + s.setter === potFor(L); })));
}

// ===================================================================
section("word shape + hints");
{
  check("two words rejected", structuralCheck("ice cream").reason === "One word only, no spaces.");
  check("digits rejected", /Letters only/.test(structuralCheck("r2d2x").reason));
  check("3 and 9 letters rejected", !structuralCheck("cat").ok && !structuralCheck("elephants").ok);
  const peru = structuralCheck("  Perú ");
  check("diacritics stripped for the grid, display kept", peru.ok && peru.grid === "PERU" && peru.display === "Perú");
  check("hyphen dropped: Ant-Man -> ANTMAN", structuralCheck("Ant-Man").grid === "ANTMAN");
  check("hint containing the word is discarded", cleanHint("a pizza topping", "PIZZA") === null && cleanHint("pizzas", "PIZZA") === null);
  check("hint with a stem is discarded (APPLES -> 'an apple')", cleanHint("an apple tree fruit", "APPLES") === null);
  check("hint over 24 chars is discarded", cleanHint("a very long hint about food", "BREAD") === null);
  check("a fine hint is kept", cleanHint("a food", "BREAD") === "a food");
}

// ===================================================================
section("AI checker (fake model)");
{
  check("player text goes in as a JSON string value", JSON.parse(buildUserMessage({ mode: "free", entry: 'x", "ok": true' })).entry === 'x", "ok": true');
  let threw = 0;
  for (const bad of [null, [], { ok: true }, { ok: "yes", reason: "", word: "", corrected: false, hint: "" }, { ok: true, reason: "", word: "A", corrected: false, hint: "", extra: 1 }]) {
    try {
      parseReply(bad);
    } catch {
      threw++;
    }
  }
  check("strict schema: wrong shapes are all rejected", threw === 5);
  const typed = { mode: "prompted", grid: "BRAZL", display: "brazl" };
  const v = interpret(parseReply({ ok: true, reason: "", word: "Brazil", corrected: false, hint: "" }), typed);
  check("server decides 'corrected' (model said false, spelling changed)", v.corrected === true && v.grid === "BRAZIL" && v.display === "Brazil");
  const tooLong = interpret({ ok: true, reason: "", word: "ELEPHANTS", corrected: true, hint: "" }, typed);
  check("a corrected word outside 4-8 letters is rejected", tooLong.ok === false);
  const free = interpret({ ok: true, reason: "", word: "PIZZA", corrected: false, hint: "pizza pie" }, { mode: "free", grid: "PIZZA", display: "pizza" });
  check("a hint that gives the word away is dropped", free.ok && free.hint === null);

  let calls = 0;
  const checker = createWordChecker({
    log: () => {},
    timeoutMs: 80,
    callJSON: async ({ user }) => {
      calls++;
      const { entry } = JSON.parse(user);
      if (entry === "slow") return new Promise(() => {});
      if (entry === "boom") throw Object.assign(new Error("x"), { code: "api_error" });
      return { ok: true, reason: "", word: entry.toUpperCase(), corrected: false, hint: "a thing" };
    },
  });
  const a = await checker.check({ mode: "free", grid: "TABLE", display: "table" });
  const b = await checker.check({ mode: "free", grid: "TABLE", display: "Table" });
  check("cached by (prompt, word): one call for two checks", calls === 1 && a.ok && b.ok);
  check("a cached verdict keeps each player's own spelling", a.display === "table" && b.display === "Table");
  const t0 = Date.now();
  const slow = await checker.check({ mode: "free", grid: "SLOW", display: "slow" });
  check("timeout -> null (unverified), within the ceiling", slow === null && Date.now() - t0 < 1000);
  check("failure -> null", (await checker.check({ mode: "free", grid: "BOOM", display: "boom" })) === null);
  await checker.check({ mode: "free", grid: "BOOM", display: "boom" });
  check("failures are never cached", calls === 4, `${calls} calls`);
}

// ===================================================================
// A scripted game: players ann/bob/cat. `ai` is the verdict index.js
// would get back from the checker for each check.
function newGame(n = 3, opts = {}) {
  const ids = ["ann", "bob", "cat", "dan", "eve"].slice(0, n);
  const g = wh.createGame(ids, { mode: "prompted", rounds: 4, ...opts });
  return { g, ids };
}
function setWord(g, pid, text, verdict, present) {
  const s = g.round.setters.get(pid);
  if (g.mode === "prompted" && !s.promptId) wh.choosePrompt(g, pid, s.prompts[0]);
  const b = wh.beginCheck(g, pid, text);
  if (!b.ok) return b;
  const v = verdict === undefined ? { ok: true, reason: "", grid: gridForm(text), display: text, corrected: false, hint: g.mode === "free" ? "a thing" : null } : verdict;
  return wh.finishCheck(g, b.job, v, present);
}
const targetOf = (g, solver) => g.round.setters.get(g.round.boards.get(solver).setterId).locked.grid;

section("(a) the set phase");
{
  const { g, ids } = newGame(3);
  check("starts in set, a fixed order, 2 prompts each", g.phase === "set" && g.order.length === 3 && [...g.round.setters.values()].every((s) => s.prompts.length === 2 && s.prompts[0] !== s.prompts[1]));
  check("must pick a prompt first", wh.beginCheck(g, "ann", "piano").message === "Pick a prompt first.");
  const s = g.round.setters.get("ann");
  check("only an offered prompt can be picked", !wh.choosePrompt(g, "ann", "nope").ok && wh.choosePrompt(g, "ann", s.prompts[1]).ok);
  const shape = wh.beginCheck(g, "ann", "hot dog");
  check("two words: rejected instantly, no check used", !shape.ok && shape.message === "One word only, no spaces." && s.checksUsed === 0);

  // Spelling correction: No returns to typing, Yes locks it.
  let r = setWord(g, "ann", "brazl", { ok: true, grid: "BRAZIL", display: "Brazil", corrected: true, hint: null }, ids);
  check("corrected -> 'Did you mean BRAZIL?' (not locked)", r.confirm?.display === "Brazil" && !s.locked);
  check("the setter's private state shows the suggestion", wh.getPrivateState(g, "ann").wordHeist.pending.grid === "BRAZIL");
  check("can't check again until Yes / No", wh.beginCheck(g, "ann", "chile").message === "Answer Yes or No first.");
  r = wh.confirm(g, "ann", false, ids);
  check("No: back to typing, nothing locked", r.declined && !s.locked && !s.pending && wh.getPrivateState(g, "ann").wordHeist.checksLeft === 2);
  r = setWord(g, "ann", "brazl", { ok: true, grid: "BRAZIL", display: "Brazil", corrected: true, hint: null }, ids);
  r = wh.confirm(g, "ann", true, ids);
  check("Yes: locks the corrected word", r.locked && s.locked.grid === "BRAZIL" && s.locked.display === "Brazil" && s.locked.verified);

  // Rejections -> fallback after 3.
  const b = g.round.setters.get("bob");
  setWord(g, "bob", "syzygy", { ok: false, reason: "Too obscure. Pick a word most people know." }, ids);
  check("obscure word rejected with the reason", b.message === "Too obscure. Pick a word most people know." && !b.locked && b.rejections === 1);
  setWord(g, "bob", "qwrtz", { ok: false, reason: "That isn't a real word." }, ids);
  r = setWord(g, "bob", "zzzzz", { ok: false, reason: "That isn't a real word." }, ids);
  check("3rd rejection: a fallback word from the chosen prompt", r.fallback && b.locked.source === "fallback" && PROMPTS_BY_ID[b.promptId].words.includes(b.locked.grid));
  check("fallback message says so", /last try/.test(b.message));

  // AI failure: accepted as typed, unverified.
  r = setWord(g, "cat", "Perú", null, ids);
  const c = g.round.setters.get("cat");
  check("AI down: accepted as typed, unverified, display kept", r.unverified && c.locked.grid === "PERU" && c.locked.display === "Perú" && c.locked.verified === false);
  check("everyone locked -> solving starts", g.phase === "solve");

  // PRIVACY: nothing public carries a word; each solver's payload lacks their target.
  const words = [...g.round.setters.values()].map((x) => x.locked.grid);
  const pub = json(wh.getPublicState(g, ids));
  check("public state carries no word", words.every((w) => !pub.includes(w)));
  check("no solver's private payload carries their target", ids.every((pid) => !json(wh.getPrivateState(g, pid)).includes(targetOf(g, pid))));
  check("each setter's payload carries their own word", ids.every((pid) => json(wh.getPrivateState(g, pid)).includes(g.round.setters.get(pid).locked.grid)));
}

section("(a) used words, AI timeout via the clock, Free choice hints");
{
  const { g, ids } = newGame(2, { mode: "free", rounds: 3 });
  setWord(g, "ann", "pizza", undefined, ids);
  setWord(g, "bob", "table", undefined, ids);
  // Solve both quickly, then into round 2.
  for (const pid of ids) wh.guess(g, pid, targetOf(g, pid), ids);
  check("both solved in 1 -> reveal", g.phase === "reveal" && g.round.result.rows.every((x) => x.status === "solved" && x.guessCount === 1));
  check("round points: each 1 + (7-1) on a 5-letter word", g.scores.get("ann") === 7 && g.scores.get("bob") === 7);
  wh.nextRound(g);
  check("round 2 deals", g.phase === "set" && g.roundIndex === 1);
  const r = setWord(g, "ann", "Pizza", undefined, ids);
  check("an earlier round's word: 'someone already used that this game'", r.rejected && /already used that this game/.test(r.message));
  // Same-round duplicate is NOT rejected (that would leak bob's word to ann).
  setWord(g, "bob", "chair", undefined, ids);
  const r2 = setWord(g, "ann", "chair", undefined, ids);
  check("a word locked THIS round is not reported (no probing)", r2.locked);
  // Fallback respects used words.
  const { g: g2, ids: ids2 } = newGame(2, { mode: "free" });
  for (const w of GENERAL.slice(0, GENERAL.length - 1)) g2.usedWords.add(w.word);
  wh.forceAdvance(g2, ids2);
  const fb = [...g2.round.setters.values()].map((s) => s.locked.grid);
  check("fallback bank skips used words", fb.includes(GENERAL.at(-1).word), fb.join());

  // A check still out when the clock ends: waits up to 3s, then a fallback.
  const { g: g3, ids: ids3 } = newGame(2, { mode: "free" });
  const job = wh.beginCheck(g3, "ann", "pizza").job;
  setWord(g3, "bob", "table", undefined, ids3);
  const end = g3.deadline + CONFIG.graceMs;
  check("clock out + a check still with the AI: waits", wh.tick(g3, ids3, end + 100) === false && g3.phase === "set");
  check("…then gives a fallback and starts solving", wh.tick(g3, ids3, end + 3500) === true && g3.phase === "solve" && g3.round.setters.get("ann").locked.source === "fallback");
  check("the late AI answer is ignored", wh.finishCheck(g3, job, { ok: true, grid: "PIZZA", display: "pizza", corrected: false, hint: "a food" }, ids3).stale);

  // Free choice hint after guess 3 / first letter for an unverified word.
  const { g: g4, ids: ids4 } = newGame(2, { mode: "free" });
  setWord(g4, "ann", "pizza", { ok: true, grid: "PIZZA", display: "pizza", corrected: false, hint: "a food" }, ids4);
  setWord(g4, "bob", "table", null, ids4); // AI down: no hint
  const bobBoard = () => wh.getPrivateState(g4, "bob").wordHeist.board; // bob solves ann's PIZZA
  const annBoard = () => wh.getPrivateState(g4, "ann").wordHeist.board; // ann solves bob's TABLE
  for (let i = 0; i < 2; i++) {
    wh.guess(g4, "bob", "ABCDE", ids4);
    wh.guess(g4, "ann", "ABCDE", ids4);
  }
  check("no hint before guess 3", bobBoard().hint === null && annBoard().firstLetter === null);
  wh.guess(g4, "bob", "ABCDE", ids4);
  wh.guess(g4, "ann", "ABCDE", ids4);
  check("after guess 3: the category hint", bobBoard().hint === "a food");
  check("after guess 3, unverified word: its first letter instead", annBoard().firstLetter === "T" && annBoard().hint === null);
  check("prompted mode shows the prompt from the start", (() => {
    const { g: p, ids: pi } = newGame(2);
    setWord(p, "ann", "piano", undefined, pi);
    setWord(p, "bob", "tiger", undefined, pi);
    return typeof wh.getPrivateState(p, "ann").wordHeist.board.prompt === "string";
  })());
}

section("(b) solving rules");
{
  const { g, ids } = newGame(2);
  setWord(g, "ann", "speed", { ok: true, grid: "SPEED", display: "speed", corrected: false, hint: null }, ids);
  setWord(g, "bob", "violin", undefined, ids);
  // bob solves SPEED.
  check("wrong length refused", wh.guess(g, "bob", "SPEEDS", ids).ok === false);
  check("non-letters refused", wh.guess(g, "bob", "SP3ED", ids).ok === false);
  const r = wh.guess(g, "bob", "erase", ids);
  check("ANY letters accepted (no dictionary), feedback returned", r.ok && r.pattern === "yxxyy");
  check("board: length 5, 6 guesses allowed", wh.getPrivateState(g, "bob").wordHeist.board.maxGuesses === 6);
  check("setter's pill: their solver's guess count only", wh.getPrivateState(g, "ann").wordHeist.myWord.guessCount === 1 && !json(wh.getPrivateState(g, "ann")).includes("VIOLIN"));
  for (let i = 0; i < 5; i++) wh.guess(g, "bob", "QQQQQ", ids);
  check("out of guesses -> failed", g.round.boards.get("bob").status === "failed");
  check("no more guesses after failing", !wh.guess(g, "bob", "SPEED", ids).ok);
  check("public pairs: counts + status only", json(wh.getPublicState(g, ids).pairs.find((p) => p.solverId === "bob")) === json({ solverId: "bob", setterId: "ann", guessCount: 6, status: "failed" }));
}

section("(d) scoring examples in a game: solved in 1, solved on the last guess, failed");
{
  const { g, ids } = newGame(3, { mode: "free" });
  for (const [pid, w] of [["ann", "SPEED"], ["bob", "TABLE"], ["cat", "CHAIRS"]]) setWord(g, pid, w, undefined, ids);
  const by = (solver) => g.round.boards.get(solver);
  const solverOf = (setter) => g.round.pairs.find((p) => p.setterId === setter).solverId;
  // ann's SPEED: solved in 1. bob's TABLE: on the last (6th) guess. cat's CHAIRS: failed.
  wh.guess(g, solverOf("ann"), "SPEED", ids);
  for (let i = 0; i < 5; i++) wh.guess(g, solverOf("bob"), "XXXXX", ids);
  wh.guess(g, solverOf("bob"), "TABLE", ids);
  for (let i = 0; i < 7; i++) wh.guess(g, solverOf("cat"), "XXXXXX", ids);
  check("all three finished -> reveal right away", g.phase === "reveal");
  const row = (setter) => g.round.result.rows.find((x) => x.setterId === setter);
  check("solved in 1 (5 letters, pot 7): solver 6, setter 1", row("ann").solverPoints === 6 && row("ann").setterPoints === 1 && row("ann").pot === 7);
  check("solved on the last guess (6 of 6): solver 1, setter 6", row("bob").solverPoints === 1 && row("bob").setterPoints === 6 && row("bob").guessCount === 6);
  check("failed (6 letters, pot 8): solver 0, setter 8", row("cat").solverPoints === 0 && row("cat").setterPoints === 8 && row("cat").status === "failed");
  const total = [...g.scores.values()].reduce((a, b) => a + b, 0);
  check("totals = the sum of the three pots", total === 7 + 7 + 8, `${total}`);
  const pub = wh.getPublicState(g, ids);
  check("reveal shows words with their spelling + both players' points", pub.result.rows.every((x) => x.display && x.setterId && x.solverId) && pub.phase === "reveal");
  check("by-solver lookup sanity", by(solverOf("ann")).status === "solved");
}

section("(d) disconnects, voiding, force proceed");
{
  // Setter drops before locking: once everyone connected has a word, solving
  // starts and the absent setter gets a fallback.
  const { g, ids } = newGame(3);
  setWord(g, "ann", "piano", undefined, ["ann", "bob"]);
  setWord(g, "bob", "tiger", undefined, ["ann", "bob"]);
  wh.tick(g, ["ann", "bob"]);
  check("cat away + unlocked: everyone connected has a word, so solving starts", g.phase === "solve");
  check("…cat's word is a fallback", g.round.setters.get("cat").locked.source === "fallback");
  // cat reconnects: gets their own board and word back.
  const back = wh.getPrivateState(g, "cat").wordHeist;
  check("a reconnecting player gets their own board + word", back.phase === "solve" && back.board.length > 0 && back.myWord.grid === g.round.setters.get("cat").locked.grid);
  // Solver gone for good -> void, and that unblocks the reveal.
  wh.guess(g, "ann", targetOf(g, "ann"), ["ann", "bob"]);
  wh.guess(g, "bob", targetOf(g, "bob"), ["ann", "bob"]);
  check("still waiting on cat (in grace)", g.phase === "solve");
  wh.reconcilePresence(g, ["ann", "bob"], { final: true, roomPlayerIds: ["ann", "bob"] });
  check("cat's pairing is void once their grace runs out", g.round.boards.get("cat").status === "void");
  wh.tick(g, ["ann", "bob"]);
  const voidRow = g.round.result.rows.find((x) => x.solverId === "cat");
  check("void pairing: no points for either player", g.phase === "reveal" && voidRow.solverPoints === 0 && voidRow.setterPoints === 0);
  wh.nextRound(g);
  check("next round pairs the 2 left", g.phase === "set" && g.round.pairs.length === 2 && !g.round.participants.includes("cat"));

  // Solver disconnected when the clock runs out -> void, not failed.
  const { g: g2, ids: i2 } = newGame(2);
  setWord(g2, "ann", "piano", undefined, i2);
  setWord(g2, "bob", "tiger", undefined, i2);
  wh.tick(g2, ["ann"], g2.deadline + CONFIG.graceMs + 1);
  check("time out: present solver failed, away solver void", g2.round.boards.get("ann").status === "failed" && g2.round.boards.get("bob").status === "void");

  // Force proceed.
  const { g: g3, ids: i3 } = newGame(3);
  setWord(g3, "ann", "piano", undefined, i3);
  wh.forceAdvance(g3, i3);
  check("force in set: unlocked players get fallbacks, solving starts", g3.phase === "solve" && ["bob", "cat"].every((p) => g3.round.setters.get(p).locked.source === "fallback"));
  wh.guess(g3, "ann", targetOf(g3, "ann"), i3);
  wh.forceAdvance(g3, i3);
  check("force in solve: unfinished pairings void, finished kept", g3.phase === "reveal" && g3.round.boards.get("ann").status === "solved" && g3.round.boards.get("bob").status === "void");
  wh.forceAdvance(g3, i3);
  check("force in reveal: next round", g3.phase === "set" && g3.roundIndex === 1);

  // 2 players, one leaves -> game over.
  const { g: g4 } = newGame(2);
  wh.reconcilePresence(g4, ["ann"], { final: true, roomPlayerIds: ["ann"] });
  check("down to 1 player: game ends", g4.phase === "final");

  // Full game to final with standings.
  const { g: g5, ids: i5 } = newGame(2, { rounds: 1 });
  wh.forceAdvance(g5, i5);
  wh.forceAdvance(g5, i5);
  wh.forceAdvance(g5, i5);
  check("rounds done -> final, standings", g5.phase === "final" && wh.getFinalStandings(g5).length === 2);
}

section("Chaos");
{
  const { g } = newGame(3);
  const pool = eligibleModifiers("word-heist", MODIFIERS, { playerCount: 3, roundsLeft: 2, game: g }).map((m) => m.id);
  check("Point Reversal excluded", !pool.includes("point-reversal"));
  check("Speed Round + Countdown Chaos + Risk It kept", ["speed-round", "countdown-chaos", "risk-it"].every((m) => pool.includes(m)));
  const two = eligibleModifiers("word-heist", MODIFIERS, { playerCount: 2, roundsLeft: 2, game: g }).map((m) => m.id);
  check("2 players: no 3+-only transfers", !two.some((m) => ["steal", "score-swap", "rival", "tax-collector", "the-tyrant", "player-disable"].includes(m)));
  const t = g.round.setStartsAt;
  wh.onChaosAnnounced(g, { id: "speed-round" });
  check("Speed Round: set clock 20s, after the takeover", g.round.speed && g.windowMs === 20_000 && g.deadline === t + CONFIG.chaosTakeoverMs + 20_000);
  wh.forceAdvance(g, g.order);
  check("Speed Round: solve clock 60s", g.windowMs === 60_000);
  const { g: g2 } = newGame(3);
  g2.removed.add("cat");
  check("only this round's active participants are eligible", json(wh.chaosParticipants(g2, ["ann", "bob", "cat", "zed"])) === json(["ann", "bob"]));
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
