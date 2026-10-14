// Memory Imposter selftest, one section per separately testable piece:
//   (a) sequence + question generation — unambiguous, no trivial patterns,
//       no format twice in a row, tricky formats present
//   (b) role + view-window privacy — the sequence and the correct answers
//       never leave the server when they shouldn't
//   (c) the phase engine + timers — turn passing (never skips), auto-submit
//       on expiry, holds and cancellations, host controls
//   (d) the evidence table + voting + scoring
//   (e) integrations — Chaos wiring, tournament defaults
// Run:  node server/memory-imposter.selftest.mjs   (or npm run test:memory-imposter)

import {
  SEQUENCE_TYPES,
  DIFFICULTIES,
  COLOR_ITEMS,
  EMOJI_POOL,
  COUNT_MAX,
  alphabetFor,
  countsOf,
  isTrivial,
  generateSequence,
  generateQuestions,
  generateRound,
  answerOf,
  satisfies,
} from "./games/memorySequence.js";
import * as mi from "./games/memory-imposter.js";
import { MODIFIERS } from "./chaos.js";
import { chaosGameConfig, eligibleModifiers } from "./chaosGames.js";
import { chaosTick } from "./chaosRuntime.js";
import { createTournament, eligibleGameIds, isGameOver, finalStandingsOf } from "./tournament.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);

// Small seeded RNG so failures reproduce.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P4 = ["a", "b", "c", "d"];
const P6 = ["a", "b", "c", "d", "e", "f"];

// ===================================================================
section("(a) sequence + question generation");
{
  let bad = { repeat: 0, trivial: 0, run3: 0, twice: 0, absent: 0, singles: 0, length: 0, alpha: 0 };
  let qBad = { ambiguous: 0, sameFamily: 0, noTricky: 0, dup: 0, count: 0 };
  const lengths = [5, 6, 8, 10, 12];
  let rounds = 0;
  for (const type of SEQUENCE_TYPES) {
    for (const length of lengths) {
      for (let seed = 1; seed <= 150; seed++) {
        const rng = seeded(seed * 97 + length);
        for (const questionCount of [3, 4, 5, 6]) {
          const r = generateRound({ type, length, questionCount }, rng);
          rounds++;
          const seq = r.sequence;
          const counts = countsOf(seq);
          if (seq.length !== length) bad.length++;
          if (!seq.every((x) => r.alphabet.includes(x))) bad.alpha++;
          if (![...counts.values()].some((c) => c > 1)) bad.repeat++;
          if (isTrivial(seq)) bad.trivial++;
          if (seq.some((x, i) => i >= 2 && x === seq[i - 1] && x === seq[i - 2])) bad.run3++;
          if ([...counts.values()].filter((c) => c === 2).length !== 1) bad.twice++;
          if (!r.alphabet.some((x) => !counts.has(x))) bad.absent++;
          if ([...counts.values()].filter((c) => c === 1).length < 2) bad.singles++;

          const qs = r.questions;
          if (qs.length !== questionCount) qBad.count++;
          for (let i = 0; i < qs.length; i++) {
            const q = qs[i];
            // Exactly one possible input satisfies the question.
            const space = q.input === "count" ? Array.from({ length: COUNT_MAX + 1 }, (_, k) => k) : r.alphabet;
            const hits = space.filter((v) => satisfies(seq, q, v));
            if (hits.length !== 1 || hits[0] !== q.answer || answerOf(seq, q) !== q.answer) qBad.ambiguous++;
            if (i > 0 && qs[i - 1].family === q.family) qBad.sameFamily++;
            if (qs.slice(0, i).some((p) => p.kind === q.kind && p.n === q.n && p.item === q.item)) qBad.dup++;
          }
          if (questionCount >= 4 && !qs.some((q) => q.tricky)) qBad.noTricky++;
        }
      }
    }
  }
  check(`${rounds} rounds: every sequence has the asked length`, bad.length === 0, JSON.stringify(bad));
  check("every item comes from the round's alphabet", bad.alpha === 0);
  check("every sequence has at least one repeated item", bad.repeat === 0);
  check("no trivial pattern (all same / monotone / 2-period)", bad.trivial === 0);
  check("no run of three identical items", bad.run3 === 0);
  check("exactly one item appears exactly twice", bad.twice === 0);
  check("at least one alphabet item is absent (decoy)", bad.absent === 0);
  check("at least two singletons", bad.singles === 0);
  check("every question has exactly one correct answer", qBad.ambiguous === 0, JSON.stringify(qBad));
  check("never the same format twice in a row", qBad.sameFamily === 0);
  check("no duplicate question in a round", qBad.dup === 0);
  check("4+ questions always include a tricky one", qBad.noTricky === 0);
  check("question count honoured", qBad.count === 0);

  // Format coverage + the tricky mix across many rounds.
  const kinds = new Set();
  let tricky = 0;
  let total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const r = generateRound({ type: "digits", length: 8, questionCount: 4 }, seeded(seed));
    for (const q of r.questions) {
      kinds.add(q.kind);
      total++;
      if (q.tricky) tricky++;
    }
  }
  check("all six formats appear", ["position", "fromEnd", "last", "count", "twice", "after"].every((k) => kinds.has(k)), [...kinds].join());
  check("tricky questions are a minority mix (15–60%)", tricky / total > 0.15 && tricky / total < 0.6, `${Math.round((100 * tricky) / total)}%`);

  check("isTrivial catches the obvious ones", isTrivial(["1", "2", "3", "4", "5", "6"]) && isTrivial(["4", "4", "4", "4"]) && isTrivial(["1", "2", "1", "2", "1", "2"]) && isTrivial(["9", "7", "7", "5", "3", "1"]));
  check("isTrivial leaves a real one alone", !isTrivial(["3", "8", "1", "8", "5", "0"]));
  check("Colors alphabet = the 8 shapes", alphabetFor("colors").length === 8 && alphabetFor("colors").every((x) => COLOR_ITEMS.includes(x)));
  check("Emoji alphabet = 8 distinct from the pool", new Set(alphabetFor("emoji")).size === 8 && alphabetFor("emoji").every((x) => EMOJI_POOL.includes(x)));
  check("difficulty presets", DIFFICULTIES.easy.length === 6 && DIFFICULTIES.easy.viewMs === 8000 && DIFFICULTIES.medium.length === 8 && DIFFICULTIES.medium.viewMs === 6000 && DIFFICULTIES.hard.length === 10 && DIFFICULTIES.hard.viewMs === 5000);
  const qs = generateQuestions(generateSequence(10, alphabetFor("digits")), alphabetFor("digits"), 6);
  check("6 questions over 5 formats still never repeat back to back", qs.every((q, i) => i === 0 || qs[i - 1].family !== q.family));
}

// ===================================================================
// Helpers to drive a game through its phases with fake time.
function newGame(ids = P4, options = {}, seed = 7) {
  return mi.createGame(ids, { difficulty: "medium", sequenceType: "digits", questions: 4, answerSec: 8, rounds: 3, ...options }, seeded(seed));
}
function tickTo(game, present, at) {
  return mi.tick(game, present, at);
}
// Run the clock forward until the phase changes (or a cap).
function runPhase(game, present, from) {
  let t = from;
  const phase = game.phase;
  const serial = game.roundSerial;
  for (let i = 0; i < 400 && game.phase === phase && game.roundSerial === serial; i++) {
    t += 500;
    mi.tick(game, present, t);
  }
  return t;
}
const imp = (g) => g.round.imposterId;
const wit = (g, ids) => ids.find((p) => p !== imp(g));
const json = (x) => JSON.stringify(x);

section("(b) role + view-window privacy");
{
  const g = newGame(P4);
  let t = Date.now();
  const I = imp(g);
  const W = wit(g, P4);
  const seq = g.round.sequence;
  const seqNeedle = (state) => {
    // The exact sequence, in order, anywhere in the payload.
    const s = json(state);
    return s.includes(json(seq));
  };

  check("roles: nobody gets the sequence yet", !seqNeedle(mi.getPrivateState(g, I, t)) && !seqNeedle(mi.getPrivateState(g, W, t)));
  check("roles: role is private and correct", mi.getPrivateState(g, I, t).memoryImposter.role === "imposter" && mi.getPrivateState(g, W, t).memoryImposter.role === "witness");
  check("roles: public state names no Imposter", !json(mi.getPublicState(g, P4, t)).includes('"imposterId"'));

  t = runPhase(g, P4, t);
  check("-> memorize", g.phase === "memorize");
  const pImp = mi.getPrivateState(g, I, t).memoryImposter;
  check("memorize: the Imposter sees the sequence inside the window", json(pImp.sequence) === json(seq) && pImp.viewMsLeft > 0 && pImp.viewMs === 6000);
  check("memorize: Witness sees it", json(mi.getPrivateState(g, W, t).memoryImposter.sequence) === json(seq));
  check("memorize: public state never has the sequence", !seqNeedle(mi.getPublicState(g, P4, t)));

  // One ms before the window ends vs. at the deadline.
  const end = g.deadline;
  check("Imposter payload at deadline-1ms still has it", Boolean(mi.getPrivateState(g, I, end - 1).memoryImposter.sequence));
  check("Imposter payload AT the deadline has none (even before the tick)", !mi.getPrivateState(g, I, end).memoryImposter.sequence);

  t = runPhase(g, P4, t);
  check("-> statements", g.phase === "statements");
  const after = mi.getPrivateState(g, I, t).memoryImposter;
  check("after the window: Imposter gets length only", after.sequence === undefined && after.length === seq.length && !seqNeedle(after));
  check("after the window: Witness still has it", json(mi.getPrivateState(g, W, t).memoryImposter.sequence) === json(seq));

  // Walk every remaining phase and check every payload the Imposter or the
  // public could ever receive.
  const correct = g.round.questions.map((q) => q.answer);
  let leaks = 0;
  let answerLeaks = 0;
  let guard = 0;
  while (g.phase !== "reveal" && guard++ < 200) {
    const pub = mi.getPublicState(g, P4, t);
    if (seqNeedle(pub) || seqNeedle(mi.getPrivateState(g, I, t))) leaks++;
    if (["statements", "questions"].includes(g.phase)) {
      const s = json(pub) + json(mi.getPrivateState(g, I, t)) + json(mi.getPrivateState(g, W, t));
      if (s.includes('"answer"') || s.includes('"correct"')) answerLeaks++;
      if (g.phase === "questions" && pub.question.answer !== undefined) answerLeaks++;
    }
    if (g.phase === "questions") {
      // Witness answers right, Imposter guesses "0".
      const i = g.round.questionIndex;
      const q = g.round.questions[i];
      for (const p of P4) mi.submitAnswer(g, p, i, p === I ? (q.input === "count" ? 0 : "0") : q.answer, true, P4, t);
      continue;
    }
    t = runPhase(g, P4, t);
  }
  check("no state ever carries the sequence before the final reveal", leaks === 0, `${leaks}`);
  check("no correct answer / correctness before the evidence", answerLeaks === 0, `${answerLeaks}`);
  const ev = g.round.evidence;
  check("evidence carries the correct answers", ev.questions.map((q) => q.answer).join() === correct.join());
  check("reveal: public result has the sequence + Imposter", json(mi.getPublicState(g, P4, t).result.sequence) === json(seq) && mi.getPublicState(g, P4, t).result.imposterId === I);

  // Reconnect after the window: still nothing.
  const g2 = newGame(P4, {}, 11);
  let t2 = runPhase(g2, P4, Date.now());
  t2 = runPhase(g2, P4, t2);
  check("a reconnecting Imposter after the window gets no sequence", g2.phase === "statements" && mi.getPrivateState(g2, imp(g2), t2 + 10).memoryImposter.sequence === undefined);

  // Other players' answers never in my private state.
  const g3 = newGame(P4, { statements: false }, 12);
  let t3 = runPhase(g3, P4, Date.now());
  t3 = runPhase(g3, P4, t3);
  check("statements off -> straight to questions", g3.phase === "questions");
  const [p1, p2] = P4;
  mi.submitAnswer(g3, p1, 0, g3.round.questions[0].input === "count" ? 2 : "7", false, P4, t3);
  const priv2 = mi.getPrivateState(g3, p2, t3).memoryImposter;
  check("my private state never holds anyone else's answer", priv2.myAnswer === null);
  check("public shows nobody locked for a draft", mi.getPublicState(g3, P4, t3).answeredIds.length === 0);
}

// ===================================================================
section("(c) phase engine + timers");
{
  // Statement turns: timeout passes to EXACTLY the next player.
  const g = newGame(P6, {}, 21);
  let t = runPhase(g, P6, Date.now());
  t = runPhase(g, P6, t);
  check("6 players: one statement pass", g.phase === "statements" && g.round.turns.passes === 1);
  const order = g.round.turns.order;
  const seen = [];
  for (let i = 0; i < order.length; i++) {
    seen.push(mi.getPublicState(g, P6, t).turns.speakerId);
    if (i % 2) {
      const turnId = g.round.turns.turnId;
      mi.statementDone(g, seen.at(-1), turnId, {}, t);
      // A double tap carrying the same turnId does nothing.
      check(`turn ${i + 1}: double "Done" can't skip the next player`, !mi.statementDone(g, seen.at(-1), turnId, {}, t).ok);
    } else {
      t = g.deadline + 1;
      mi.tick(g, P6, t); // timeout
      mi.tick(g, P6, t); // a second tick at the same instant must NOT pass again
    }
  }
  check("every player got exactly one turn, in order (timeouts never skip)", seen.join() === order.join(), `${seen} vs ${order}`);
  check("-> questions after the last turn", g.phase === "questions");

  const g5 = newGame(["a", "b", "c", "d", "e"], {}, 22);
  let t5 = runPhase(g5, ["a", "b", "c", "d", "e"], Date.now());
  t5 = runPhase(g5, ["a", "b", "c", "d", "e"], t5);
  check("5 players: two statement passes (10 turns)", g5.round.turns.passes === 2 && mi.getPublicState(g5, ["a", "b", "c", "d", "e"], t5).turns.total === 10);
  const notSpeaker = g5.round.turns.order[1];
  check("only the speaker can tap Done", !mi.statementDone(g5, notSpeaker, g5.round.turns.turnId, {}, t5).ok);
  check("the host can skip a turn", mi.statementDone(g5, notSpeaker, g5.round.turns.turnId, { asHost: true }, t5).ok && g5.round.turns.index === 1);

  // Questions: drafts auto-submit on expiry; locks advance early.
  const q = newGame(P4, { statements: false }, 23);
  let tq = runPhase(q, P4, Date.now());
  tq = runPhase(q, P4, tq);
  const q0 = q.round.questions[0];
  const draftVal = q0.input === "count" ? 1 : "5";
  mi.submitAnswer(q, "a", 0, draftVal, false, P4, tq); // draft only
  mi.submitAnswer(q, "b", 0, q0.answer, true, P4, tq);
  check("drafts don't close the question", q.round.questionIndex === 0);
  tq = q.deadline + 600;
  mi.tick(q, P4, tq);
  check("expiry moves to question 2", q.round.questionIndex === 1);
  check("a's draft was auto-submitted", q.round.answers.get("a")[0].value === draftVal);
  check("c never answered -> no answer", !q.round.answers.get("c")?.[0]);
  check("a stale answer for question 1 is refused", !mi.submitAnswer(q, "c", 0, draftVal, true, P4, tq).ok);
  check("a late answer past the grace is refused", !mi.submitAnswer(q, "c", 1, draftVal, true, P4, q.deadline + 2000).ok);
  const q1 = q.round.questions[1];
  check("a junk answer is refused", !mi.submitAnswer(q, "c", 1, q1.input === "count" ? 99 : "🍕", true, P4, tq).ok);
  for (const p of P4) mi.submitAnswer(q, p, 1, q1.answer, true, P4, tq);
  check("everyone locking in moves on at once", q.round.questionIndex === 2);
  check("a locked answer can't be changed", (() => {
    const i = q.round.questionIndex;
    const qq = q.round.questions[i];
    mi.submitAnswer(q, "a", i, qq.answer, true, ["x"], tq);
    return !mi.submitAnswer(q, "a", i, qq.input === "count" ? 4 : "1", true, ["x"], tq).ok;
  })());
  // A disconnected player isn't waited on.
  const i2 = q.round.questionIndex;
  for (const p of ["a", "b", "c"]) mi.submitAnswer(q, p, i2, q.round.questions[i2].answer, true, ["a", "b", "c"], tq);
  check("a disconnected player isn't waited on", q.round.questionIndex === i2 + 1 || q.phase === "evidence");

  // Imposter drops during the view window: hold, then resume.
  const h = newGame(P4, {}, 24);
  let th = runPhase(h, P4, Date.now());
  const I = imp(h);
  const away = P4.filter((p) => p !== I);
  th += 2000;
  mi.reconcilePresence(h, away, { final: false });
  check("Imposter blip in memorize -> view window holds", h.phase === "memorize" && h.round.hold === true);
  const frozen = h.round.viewLeftMs;
  mi.tick(h, away, th + 30_000);
  check("held: no clock runs while they're away", h.phase === "memorize" && h.round.viewLeftMs === frozen);
  check("held: the Imposter gets no sequence while away", mi.getPrivateState(h, I, th).memoryImposter.sequence === undefined);
  check("held: public shows who we're waiting on", mi.getPublicState(h, away, th).hold?.playerId === I);
  mi.tick(h, P4, th + 31_000);
  check("they're back -> window resumes with the time they had left", h.round.hold === false && h.deadline - (th + 31_000) === frozen);
  check("...and they get the sequence again for the rest of the window", Boolean(mi.getPrivateState(h, I, th + 31_000).memoryImposter.sequence));

  // Imposter doesn't come back: cancelled, no points, a NEW Imposter.
  const c = newGame(P4, {}, 25);
  let tc = runPhase(c, P4, Date.now());
  const I2 = imp(c);
  const serial = c.roundSerial;
  const left = P4.filter((p) => p !== I2);
  mi.reconcilePresence(c, left, { final: false });
  mi.reconcilePresence(c, left, { final: true }); // grace expired
  check("grace expired -> round cancelled and redealt", c.phase === "roles" && c.roundSerial === serial + 1 && c.roundIndex === 0);
  check("cancelled round: a new Imposter, not the leaver", imp(c) !== I2 && left.includes(imp(c)));
  check("cancelled round: no points", [...c.scores.values()].every((v) => v === 0));
  check("cancelled round: event for the screen", c.lastEvent?.type === "cancelled" && c.lastEvent.playerId === I2);

  // Host force-proceed during a hold cancels too.
  const f = newGame(P4, {}, 26);
  let tf = runPhase(f, P4, Date.now());
  const I3 = imp(f);
  mi.reconcilePresence(f, P4.filter((p) => p !== I3), { final: false });
  mi.forceAdvance(f, P4.filter((p) => p !== I3));
  check("force proceed while held -> cancel + redeal", f.phase === "roles" && imp(f) !== I3);

  // Imposter rotation: nobody twice until everyone's had a go.
  const rot = newGame(P6, { rounds: 12, statements: false }, 27);
  const imps = [];
  let tr = Date.now();
  for (let r = 0; r < 12 && rot.phase !== "final"; r++) {
    imps.push(imp(rot));
    mi.forceAdvance(rot, P6); // roles
    mi.forceAdvance(rot, P6); // memorize
    while (rot.phase === "questions") mi.forceAdvance(rot, P6);
    mi.forceAdvance(rot, P6); // evidence
    mi.forceAdvance(rot, P6); // discussion
    mi.forceAdvance(rot, P6); // vote
    mi.forceAdvance(rot, P6); // reveal -> next
  }
  check("rotation: first 6 Imposters are all different", new Set(imps.slice(0, 6)).size === 6, imps.join());
  check("rotation: next 6 are all different again", new Set(imps.slice(6, 12)).size === 6, imps.join());
  check("force proceed walks a whole game to the end", rot.phase === "final");

  // Discussion host controls.
  const d = newGame(P4, { statements: false, discussionSec: 60 }, 28);
  for (let k = 0; k < 2; k++) mi.forceAdvance(d, P4);
  while (d.phase === "questions") mi.forceAdvance(d, P4);
  mi.forceAdvance(d, P4); // evidence -> discussion
  const td = Date.now();
  const before = d.deadline;
  check("discussion uses the host's time", d.phase === "discussion" && d.windowMs === 60_000);
  mi.extendDiscussion(d, td);
  check("extend adds 30s", d.deadline - before === 30_000 && d.windowMs === 90_000);
  mi.skipDiscussion(d, td);
  check("skip goes straight to the vote", d.phase === "vote");

  // A Witness leaving for good mid-statements: their turn skipped once.
  const w = newGame(P6, {}, 29);
  let tw = runPhase(w, P6, Date.now());
  tw = runPhase(w, P6, tw);
  const order2 = w.round.turns.order;
  const speaker0 = order2[0];
  if (speaker0 !== imp(w)) {
    const present = P6.filter((p) => p !== speaker0);
    mi.reconcilePresence(w, present, { final: true });
    check("current speaker leaving -> exactly the next player", mi.getPublicState(w, present, tw).turns.speakerId === order2[1]);
  } else {
    check("current speaker leaving -> (seed made it the Imposter; cancelled instead)", true);
  }
}

// ===================================================================
section("(d) evidence table + voting + scoring");
{
  const g = newGame(P4, { statements: false, questions: 3 }, 31);
  let t = runPhase(g, P4, Date.now());
  t = runPhase(g, P4, t);
  const I = imp(g);
  const W = P4.filter((p) => p !== I);
  for (let i = 0; i < 3; i++) {
    const q = g.round.questions[i];
    for (const p of P4) {
      if (p === I && i === 1) continue; // Imposter misses one
      const wrong = q.input === "count" ? (q.answer + 1) % (COUNT_MAX + 1) : g.round.alphabet.find((x) => x !== q.answer);
      mi.submitAnswer(g, p, i, p === I && i === 0 ? wrong : q.answer, true, P4, t);
    }
    if (g.phase === "questions" && g.round.questionIndex === i) {
      t = g.deadline + 600;
      mi.tick(g, P4, t);
    }
  }
  check("-> evidence", g.phase === "evidence");
  const ev = mi.getPublicState(g, P4, t).evidence;
  const rowI = ev.rows.find((r) => r.playerId === I);
  check("evidence: Imposter's wrong answer flagged", rowI.answers[0].correct === false);
  check("evidence: Imposter's missing answer = no answer", rowI.answers[1].value === null && rowI.answers[1].correct === false);
  check("evidence: Witness rows all correct", ev.rows.filter((r) => r.playerId !== I).every((r) => r.answers.every((a) => a.correct)));
  check("evidence: header row has every correct answer", ev.questions.every((q) => q.answer !== undefined));
  check("evidence doesn't name the Imposter", !json(mi.getPublicState(g, P4, t)).includes("imposterId"));

  t = runPhase(g, P4, t); // -> discussion
  t = runPhase(g, P4, t); // -> vote
  check("-> vote", g.phase === "vote");
  check("can't vote for yourself", !mi.submitVote(g, W[0], W[0], P4, t).ok);
  mi.submitVote(g, W[0], I, P4, t);
  mi.submitVote(g, W[1], I, P4, t);
  mi.submitVote(g, W[2], W[0], P4, t);
  check("voted indicator shows who voted, not for whom", json(mi.getPublicState(g, P4, t).votedIds.sort()) === json([W[0], W[1], W[2]].sort()) && !("votes" in mi.getPublicState(g, P4, t)));
  mi.submitVote(g, I, W[2], P4, t);
  check("everyone voted -> reveal", g.phase === "reveal");
  const res = g.round.result;
  check("plurality eliminates the Imposter -> caught", res.caught && res.eliminatedId === I);
  check("scoring when caught: voters +3, other Witness +1, Imposter 0",
    res.points[W[0]] === 3 && res.points[W[1]] === 3 && res.points[W[2]] === 1 && res.points[I] === 0, json(res.points));

  // Tie -> evades.
  const tie = mi.tallyVotes(new Map([["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"]]), P4);
  check("a tie eliminates nobody", tie.eliminatedId === null && tie.tie);
  const none = mi.tallyVotes(new Map(), P4);
  check("no votes eliminates nobody", none.eliminatedId === null);

  const g2 = newGame(P4, { statements: false, questions: 3 }, 32);
  while (g2.phase !== "vote") mi.forceAdvance(g2, P4);
  const I2 = imp(g2);
  const W2 = P4.filter((p) => p !== I2);
  mi.submitVote(g2, W2[0], W2[1], P4);
  mi.submitVote(g2, W2[1], W2[0], P4);
  mi.forceAdvance(g2, P4); // vote closes on a 1-1 tie
  check("tie -> Imposter evades: +4, everyone else 0", !g2.round.result.caught && g2.round.result.points[I2] === 4 && W2.every((p) => g2.round.result.points[p] === 0), json(g2.round.result.points));

  const g3 = newGame(P4, { statements: false, questions: 3 }, 33);
  while (g3.phase !== "vote") mi.forceAdvance(g3, P4);
  const I3 = imp(g3);
  const W3 = P4.filter((p) => p !== I3);
  for (const p of W3) mi.submitVote(g3, p, W3.find((x) => x !== p), P4);
  mi.submitVote(g3, W3[0], W3[1], P4);
  mi.submitVote(g3, W3[2], W3[1], P4);
  mi.forceAdvance(g3, P4);
  check("wrong player eliminated -> Imposter evades", g3.round.result.eliminatedId === W3[1] && !g3.round.result.caught && g3.round.result.points[I3] === 4);

  // A Witness leaving drops out of the vote and the table.
  const g4 = newGame(P6, { statements: false, questions: 3 }, 34);
  while (g4.phase !== "vote") mi.forceAdvance(g4, P6);
  const I4 = imp(g4);
  const W4 = P6.filter((p) => p !== I4);
  mi.submitVote(g4, W4[0], W4[1], P6);
  const present = P6.filter((p) => p !== W4[1]);
  mi.reconcilePresence(g4, present, { final: true });
  check("leaver removed from the evidence rows", !mi.getPublicState(g4, present).evidence.rows.some((r) => r.playerId === W4[1]));
  check("votes for the leaver are void", !g4.round.votes.has(W4[0]));
  check("the leaver can't be voted for", !mi.submitVote(g4, W4[0], W4[1], present).ok);
}

// ===================================================================
section("(e) integrations");
{
  const cfg = chaosGameConfig("memory-imposter");
  check("Chaos: configured", cfg && cfg.rollPhases.includes("roles") && cfg.scoredPhases.includes("reveal"));
  const pool = eligibleModifiers("memory-imposter", MODIFIERS, { playerCount: 4, roundsLeft: 2, game: null });
  check("Chaos: Point Reversal filtered out", !pool.some((m) => m.id === "point-reversal"));
  check("Chaos: Speed Round kept (handled in-game)", pool.some((m) => m.id === "speed-round"));

  // Real chaos glue: Speed Round shortens the answer time; the role reveal
  // waits for the takeover.
  process.env.CHAOS_FORCE = "1";
  process.env.CHAOS_FORCE_MODIFIER = "speed-round";
  const g = newGame(P4, { statements: false }, 41);
  const room = { code: "T", status: "in-game", chaosFrequency: "low", chaos: null, chaosCarry: null, game: g };
  const before = g.deadline;
  chaosTick(room, { connectedPlayerIds: () => P4 });
  check("Chaos: rolled on the role reveal", room.chaos?.modifier?.id === "speed-round");
  check("Chaos: role reveal pushed back by the takeover", g.deadline > before);
  mi.forceAdvance(g, P4);
  mi.forceAdvance(g, P4);
  check("Speed Round: 5s answer window", g.phase === "questions" && g.windowMs === 5000);

  process.env.CHAOS_FORCE_MODIFIER = "double-points";
  const g2 = newGame(P4, { statements: false }, 42);
  const room2 = { code: "T", status: "in-game", chaosFrequency: "low", chaos: null, chaosCarry: null, game: g2 };
  chaosTick(room2, { connectedPlayerIds: () => P4 });
  while (g2.phase !== "vote") mi.forceAdvance(g2, P4);
  const I = imp(g2);
  for (const p of P4.filter((x) => x !== I)) mi.submitVote(g2, p, I, P4);
  mi.submitVote(g2, I, P4.find((x) => x !== I), P4);
  chaosTick(room2, { connectedPlayerIds: () => P4 });
  check("Chaos: Double Points doubles a caught round (3 -> 6)", P4.filter((x) => x !== I).every((p) => g2.scores.get(p) === 6), json([...g2.scores]));
  delete process.env.CHAOS_FORCE;
  delete process.env.CHAOS_FORCE_MODIFIER;

  // Tournament Mode: manual lineup with per-game settings, the wheel pool,
  // standings, and a game ended by force-proceeding to the end.
  const manual = createTournament({ mode: "manual", lineup: ["memory-imposter", "taboo"], lineupSettings: [{ sequenceType: "emoji", difficulty: "hard", rounds: 2 }, {}] }, P4);
  check("tournament: manual lineup accepts it at 4 players with settings", manual.lineupSettings[0].sequenceType === "emoji");
  let tErr = "";
  try { createTournament({ mode: "manual", lineup: ["memory-imposter", "taboo"] }, ["a", "b", "c"]); } catch (e) { tErr = e.message; }
  check("tournament: manual lineup refuses it at 3 players", /at least 4/.test(tErr), tErr);
  check("tournament: on the Random wheel at 4, not at 3", eligibleGameIds(4).includes("memory-imposter") && !eligibleGameIds(3).includes("memory-imposter"));
  const tg2 = mi.createGame(P4, { ...mi.tournamentOptions(), ...manual.lineupSettings[0] });
  check("tournament: slot settings reach the game", tg2.settings.sequenceType === "emoji" && tg2.settings.length === 10 && tg2.totalRounds === 2);
  let steps = 0;
  while (tg2.phase !== "final" && steps++ < 200) mi.forceAdvance(tg2, P4);
  check("tournament: force proceed reaches final -> isGameOver", isGameOver(mi, tg2));
  check("tournament: standings come from the scores", finalStandingsOf(mi, tg2, P4).length === 4);

  check("chaos participants = everyone still in", json(mi.chaosParticipants({ removed: new Set(["b"]) }, P4)) === json(["a", "c", "d"]));
  const to = mi.tournamentOptions();
  const tg = mi.createGame(P4, to);
  check("tournament defaults create a game", tg.totalRounds === 4 && tg.settings.difficulty === "medium");
  check("min 4 / max 10 enforced", (() => {
    try { mi.createGame(["a", "b", "c"], {}); return false; } catch { /* expected */ }
    try { mi.createGame(Array.from({ length: 11 }, (_, i) => `p${i}`), {}); return false; } catch { /* expected */ }
    return true;
  })());
  const s = mi.resolveSettings({ difficulty: "custom", customLength: 99, customViewSec: 1, questions: 9, answerSec: 2, discussionSec: 1000 });
  check("custom settings clamp", s.length === 12 && s.viewMs === 3000 && s.questionCount === 6 && s.answerMs === 6000 && s.discussionMs === 180_000);
  const d = mi.resolveSettings({});
  check("defaults: Digits, Easy, 4 questions, 8s, statements on, 60s", d.sequenceType === "digits" && d.difficulty === "easy" && d.questionCount === 4 && d.answerMs === 8000 && d.statements && d.discussionMs === 60_000);
}

console.log(failures === 0 ? "\nALL MEMORY IMPOSTER CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
