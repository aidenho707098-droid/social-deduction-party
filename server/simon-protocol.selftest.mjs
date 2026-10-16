// Bomb Squad input protocol selftest: Simon Lights (server-owned playback,
// stage/index gating, the inactivity replay) and the engine's numbered,
// acked actions, plus the same class of bug in Symbols, Memory Display,
// Switch Board and Maze.
//
// The latency section runs a small discrete-event simulation: a client that
// follows the same rules as client/src/games/bombSquad/Bomb.jsx + Simon.jsx
// (numbered actions, "server progress + in flight", newest view by rev,
// buttons disabled while the server says a playback is on), talking to the
// real engine over a link with 200ms each way (400ms round trip), with the
// server ticking every 100ms like server/index.js.
// Run:  node server/simon-protocol.selftest.mjs   (or npm run test:simon)

import * as bs from "./games/bomb-squad.js";
import { CONFIG } from "./games/bombSquad/config.js";
import { MODULES } from "./games/bombSquad/modules/index.js";
import { LENGTHS, playbackMs } from "./games/bombSquad/modules/simon.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);
const T = CONFIG.simon;

// A live bomb whose lineup has `type`, fuse lit at t0.
function liveWith(type, t0 = 1_000_000) {
  for (let seed = 1; seed < 500; seed++) {
    const g = bs.createGame(["ann", "bob"], { difficulty: "hard", rounds: 1, seed });
    if (!g.round.lineup.types.includes(type)) continue;
    bs.forceAdvance(g, ["ann", "bob"], t0);
    const turn = g.turn;
    const i = turn.modules.findIndex((m) => m.type === type);
    return { g, turn, i, m: turn.modules[i], def: turn.defuserId, t0 };
  }
  throw new Error(`no seed with ${type}`);
}
const ctxOf = (turn) => ({ serial: turn.serialNo, strikes: turn.strikes });
const answer = (b) => MODULES.simon.solve(b.m.rules, b.m.state, ctxOf(b.turn)).color;
const wrongColor = (b) => ["red", "blue", "green", "yellow"].find((c) => c !== answer(b));
// What the Expert would read out for the whole current stage, given the strikes now.
function stageAnswers(b) {
  const st = structuredClone(b.m.state);
  const out = [];
  for (let k = st.progress; k < LENGTHS[st.stage]; k++) {
    st.progress = k;
    out.push(MODULES.simon.solve(b.m.rules, st, ctxOf(b.turn)).color);
  }
  return out;
}
const tick = (b, now) => bs.tick(b.g, ["ann", "bob"], now);
const endOfPlayback = (b) => b.m.state.playback?.endAt ?? null;
// Let the current playback finish (as server/index.js's 100ms beat would).
function finishPlayback(b, now) {
  const end = endOfPlayback(b);
  if (end == null) return now;
  tick(b, end);
  return end;
}
let seqN = 0;
const press = (b, color, now, extra = {}) =>
  bs.act(b.g, b.def, { turn: b.turn.serial, module: b.i, kind: "press", color, stage: b.m.state.stage, index: b.m.state.progress, seq: ++seqN, ...extra }, { now });

// =====================================================================
section("playback is server-owned and gates presses");
{
  const b = liveWith("simon");
  check("the fuse lighting starts a playback", b.m.state.playback?.reason === "start");
  const v = MODULES.simon.view(b.m.state, b.t0 + 100);
  check("the view says a playback is on and how far in", v.playback && v.playback.elapsedMs === 100 && v.playback.totalMs === playbackMs(3), JSON.stringify(v.playback));
  const r = press(b, answer(b), b.t0 + 200);
  check("a press during playback is refused (reason: playing) with a message", !r.ok && r.reason === "playing" && /wait/i.test(r.message ?? ""));
  check("…and is not a strike, progress unchanged", b.turn.strikes === 0 && b.m.state.progress === 0);
  check("…and the ack carries the fresh view (playback still on)", r.module?.view?.playback?.id === b.m.state.playback.id);
  const before = b.m.rev;
  const end = endOfPlayback(b);
  check("the playback is still on 1ms before its end", tick(b, end - 1) === false && b.m.state.playback);
  check("the server ends it on its own beat (a change to push)", tick(b, end) === true && b.m.state.playback === null && b.m.rev === before + 1);
  check("the next view has no playback (the client may enable the buttons)", MODULES.simon.view(b.m.state, end).playback === null);
  const ok = press(b, answer(b), end + 10);
  check("after the playback the same press counts", ok.ok && b.m.state.progress === 1 && ok.module.view.progress === 1);
}

// =====================================================================
section("rapid presses (a burst before any ack comes back)");
{
  const b = liveWith("simon");
  let now = finishPlayback(b, b.t0);
  const want = stageAnswers(b);
  const st0 = b.m.state.stage;
  // The client numbers them progress + in flight: 0, 1, 2 — all sent at once.
  const res = want.map((c, k) => bs.act(b.g, b.def, { turn: b.turn.serial, module: b.i, kind: "press", color: c, stage: st0, index: k, seq: ++seqN }, { now: now + k }));
  check("every press in the burst is accepted, in order", res.every((r) => r.ok && !r.strike), res.map((r) => r.reason ?? "ok").join(","));
  check("the stage is cleared, no strikes", b.m.state.stage === st0 + 1 && b.turn.strikes === 0);
  check("each ack carries the expected index after it", res.slice(0, -1).every((r, k) => r.module.view.progress === k + 1) && res.at(-1).module.view.progress === 0);
}

// =====================================================================
section("presses at a stage transition");
{
  const b = liveWith("simon");
  let now = finishPlayback(b, b.t0);
  const want = stageAnswers(b);
  want.forEach((c, k) => press(b, c, now + k));
  check("clearing a stage starts the next, longer playback", b.m.state.stage === 1 && b.m.state.playback?.reason === "stage" && b.m.state.playback.endAt - b.m.state.playback.startAt === playbackMs(4));
  // A 4th press the client fired off right behind the last one (still
  // numbered for stage 0, index 3), and one for the new stage.
  const late = bs.act(b.g, b.def, { turn: b.turn.serial, module: b.i, kind: "press", color: "red", stage: 0, index: 3, seq: ++seqN }, { now: now + 5 });
  const early = press(b, "red", now + 6);
  check("a press that crossed the transition is refused, not judged", !late.ok && late.reason === "playing" && !early.ok && early.reason === "playing");
  check("no strike; the new stage starts at index 0", b.turn.strikes === 0 && b.m.state.progress === 0);
  now = finishPlayback(b, now);
  const stale = bs.act(b.g, b.def, { turn: b.turn.serial, module: b.i, kind: "press", color: answer(b), stage: 0, index: 3, seq: ++seqN }, { now: now + 1 });
  check("after the playback a press still numbered for the old stage is stale (no strike)", !stale.ok && stale.reason === "stale" && b.turn.strikes === 0);
  check("…and its ack says where the server is (stage 1, index 0)", stale.module.view.stage === 1 && stale.module.view.progress === 0);
}

// =====================================================================
section("the inactivity replay keeps progress; a strike resets it");
{
  const b = liveWith("simon");
  let now = finishPlayback(b, b.t0);
  const want = stageAnswers(b);
  press(b, want[0], now + 10);
  press(b, want[1], now + 20);
  check("two presses in", b.m.state.progress === 2);
  check("no replay before 8s of quiet", tick(b, now + 20 + T.idleMs - 1) === false && !b.m.state.playback);
  check("8s with no press replays the stage", tick(b, now + 20 + T.idleMs) === true && b.m.state.playback?.reason === "idle");
  check("the inactivity replay does NOT reset progress", b.m.state.progress === 2);
  const during = press(b, want[2], now + 20 + T.idleMs + 50);
  check("a press during the inactivity replay is refused, not a strike", !during.ok && during.reason === "playing" && b.turn.strikes === 0);
  now = finishPlayback(b, now);
  const r = press(b, want[2], now + 5);
  check("after the replay the Defuser carries on from press 3", r.ok && !r.strike && b.m.state.stage === 1);

  const c = liveWith("simon");
  let n2 = finishPlayback(c, c.t0);
  press(c, stageAnswers(c)[0], n2 + 1);
  const s = press(c, wrongColor(c), n2 + 2);
  check("a wrong press is a strike", s.ok && s.strike && c.turn.strikes === 1);
  check("a strike resets progress and replays the stage", c.m.state.progress === 0 && c.m.state.playback?.reason === "strike");
}

// =====================================================================
section("duplicate and out-of-order events");
{
  const b = liveWith("simon");
  const now = finishPlayback(b, b.t0);
  const want = stageAnswers(b);
  const a = { turn: b.turn.serial, module: b.i, kind: "press", color: want[0], stage: 0, index: 0, seq: ++seqN };
  const r1 = bs.act(b.g, b.def, a, { now: now + 1 });
  const r2 = bs.act(b.g, b.def, a, { now: now + 2 }); // the same event delivered twice
  check("the first copy counts", r1.ok && b.m.state.progress === 1);
  check("the second copy is dropped as a duplicate (no strike, no progress)", !r2.ok && r2.reason === "duplicate" && b.m.state.progress === 1 && b.turn.strikes === 0);
  // seq 10 arrives before seq 9 (a stale copy, e.g. after a reconnect).
  const r10 = bs.act(b.g, b.def, { ...a, color: want[1], index: 1, seq: seqN + 2 }, { now: now + 3 });
  const r9 = bs.act(b.g, b.def, { ...a, color: wrongColor(b), index: 1, seq: seqN + 1 }, { now: now + 4 });
  seqN += 2;
  check("an older action arriving late is dropped, never judged", r10.ok && !r9.ok && r9.reason === "duplicate" && b.turn.strikes === 0 && b.m.state.progress === 2);
  check("every refusal is acked with the module's view + lastSeq", r2.module?.view && r9.lastSeq === b.turn.lastSeq);
  const pv = bs.getPrivateState(b.g, b.def, now + 5).bombSquad.bomb;
  check("the pushed bomb carries lastSeq (a reloaded client keeps numbering) and each module's rev", pv.lastSeq === b.turn.lastSeq && pv.modules.every((m) => Number.isInteger(m.rev)));
}

// =====================================================================
section("pause and resume (stale state after a reconnect)");
{
  const b = liveWith("simon");
  let now = finishPlayback(b, b.t0);
  press(b, stageAnswers(b)[0], now + 1);
  bs.tick(b.g, ["bob", "ann"].filter((p) => p !== b.def), now + 100); // the Defuser drops: fuse pauses
  check("a Defuser dropping pauses the bomb", b.turn.fuse.paused);
  const r = press(b, stageAnswers(b)[0], now + 150);
  check("a press while paused is refused with a message and an ack", !r.ok && r.reason === "paused" && r.module);
  now += 5_000;
  check("no inactivity replay while paused", bs.tick(b.g, [b.def === "ann" ? "bob" : "ann"], now) === false && !b.m.state.playback);
  bs.tick(b.g, ["ann", "bob"], now + 100);
  check("on resume the stage replays for the returning Defuser, progress kept", b.m.state.playback?.reason === "resume" && b.m.state.progress === 1);
}

// =====================================================================
section("the same class of bug in the other tap modules");
{
  const sy = liveWith("symbols");
  const want = sy.m.state.order;
  const at = sy.t0 + 10;
  const tap = (sym, index) => bs.act(sy.g, sy.def, { turn: sy.turn.serial, module: sy.i, kind: "tap", symbol: sym, index, seq: ++seqN }, { now: at });
  const w0 = tap(sy.m.state.shown.find((s) => s !== want[0]), 0); // a wrong tap…
  const w1 = tap(want[1], 1); // …and the tap the client had already sent behind it
  check("symbols: a tap that crossed a strike in flight is refused, not a 2nd strike", w0.strike && !w1.ok && w1.reason === "stale" && sy.turn.strikes === 1);
  const burst = want.map((s, k) => tap(s, k));
  check("symbols: a rapid burst of 4 taps solves it", burst.every((r) => r.ok) && sy.m.solved);

  const me = liveWith("memory");
  const sol = MODULES.memory.solve(me.m.rules, me.m.state);
  const p = (stage) => bs.act(me.g, me.def, { turn: me.turn.serial, module: me.i, kind: "press", position: sol.position, stage, seq: ++seqN }, { now: me.t0 + 10 });
  const m1 = p(0);
  const m2 = p(0); // a double tap: same button, same stage
  check("memory: a double tap is refused, never judged against the next stage", m1.ok && !m2.ok && m2.reason === "stale" && me.m.state.stage === 1 && me.turn.strikes === 0);

  const sw = liveWith("switches");
  const up0 = sw.m.state.switches[0] === "1";
  const flip = () => bs.act(sw.g, sw.def, { turn: sw.turn.serial, module: sw.i, kind: "toggle", switch: 0, to: !up0, seq: ++seqN }, { now: sw.t0 + 10 });
  const f1 = flip();
  const f2 = flip(); // the same flip delivered again
  check("switches: a repeated flip is a no-op, not a flip back", f1.ok && !f2.ok && f2.reason === "noop" && (sw.m.state.switches[0] === "1") === !up0);
  const lock = bs.act(sw.g, sw.def, { turn: sw.turn.serial, module: sw.i, kind: "lock", pattern: "00000" === sw.m.state.switches ? "11111" : "00000", seq: ++seqN }, { now: sw.t0 + 11 });
  check("switches: LOCK on a pattern the server doesn't have is refused, not a strike", !lock.ok && lock.reason === "stale" && sw.turn.strikes === 0);

  const mz = liveWith("maze");
  const dir = MODULES.maze.solve(mz.m.rules, mz.m.state).dir;
  const pos0 = mz.m.state.pos;
  const mv = { turn: mz.turn.serial, module: mz.i, kind: "move", dir, seq: ++seqN };
  bs.act(mz.g, mz.def, mv, { now: mz.t0 + 10 });
  const again = bs.act(mz.g, mz.def, mv, { now: mz.t0 + 11 });
  check("maze: a duplicated move is dropped (the dot moves once)", again.reason === "duplicate" && mz.m.state.pos !== pos0 && mz.turn.strikes === 0);
}

// =====================================================================
section("400ms round trip: a simulated client against the real engine");
{
  const ONE_WAY = 200;
  const b = liveWith("simon");
  const events = []; // [time, fn]
  let clock = b.t0;
  const at = (t, fn) => events.push([t, fn]);
  const log = [];

  // ---- the client: Bomb.jsx + Simon.jsx rules ----
  const client = {
    seq: 0,
    pending: 0,
    view: null, // newest Simon view (by rev)
    rev: -1,
    acks: [],
    take(rev, view) {
      if (rev >= this.rev) {
        this.rev = rev;
        this.view = view;
      }
    },
    disabled() {
      return !this.view || !!this.view.playback;
    },
    press(color) {
      if (this.disabled()) return false;
      const a = { turn: b.turn.serial, module: b.i, kind: "press", color, stage: this.view.stage, index: this.view.progress + this.pending, seq: ++this.seq };
      this.pending += 1;
      log.push(`${clock - b.t0}ms tap ${color} (stage ${a.stage}, index ${a.index}, seq ${a.seq})`);
      at(clock + ONE_WAY, () => {
        const res = bs.act(b.g, b.def, a, { now: clock });
        pushAll(); // server/index.js broadcasts after an accepted action
        at(clock + ONE_WAY, () => {
          this.pending -= 1;
          if (res.module) this.take(res.module.rev, res.module.view);
          this.acks.push(res);
        });
      });
      return true;
    },
  };
  const pushAll = () => {
    const pv = bs.getPrivateState(b.g, b.def, clock)?.bombSquad?.bomb;
    if (!pv) return;
    const m = pv.modules[b.i];
    at(clock + ONE_WAY, () => client.take(m.rev, m.view));
  };
  pushAll(); // the bomb arrives as the fuse lights

  // ---- the server's 100ms beat ----
  const idleAt = [];
  for (let t = b.t0 + 100; t < b.t0 + 120_000; t += 100)
    at(t, () => {
      if (!tick(b, clock)) return;
      if (b.m.state.playback?.reason === "idle") idleAt.push({ stage: b.m.state.stage, progress: b.m.state.progress });
      pushAll();
    });

  // ---- the player: knows the stage's answers once the lights stop, taps
  // as fast as the buttons allow (every 60ms), makes ONE wrong press in
  // stage 2 and keeps tapping straight after it, and goes quiet for 9s in
  // the middle of stage 3. ----
  let plan = [];
  let planFor = null;
  let madeMistake = false;
  let wentQuiet = false;
  let quietUntil = 0;
  for (let t = b.t0 + 30; t < b.t0 + 120_000; t += 60) {
    at(t, () => {
      if (b.m.solved || client.disabled() || clock < quietUntil) return;
      const v = client.view;
      const key = `${v.stage}:${v.replay}:${b.turn.strikes}`;
      if (planFor !== key && client.pending === 0) {
        plan = stageAnswers(b).slice(0); // the Expert reads out the rest of the stage
        planFor = key;
      }
      if (!plan.length) return;
      if (v.stage === 1 && !madeMistake && v.progress + client.pending === 1) {
        madeMistake = true;
        client.press(wrongColor(b));
        return;
      }
      if (v.stage === 2 && !wentQuiet && v.progress + client.pending === 2) {
        if (client.pending > 0) return; // stop at press 3 and let the first two land
        wentQuiet = true;
        quietUntil = clock + 9_000;
        log.push(`${clock - b.t0}ms player goes quiet for 9s at stage 3, press 3`);
        return;
      }
      client.press(plan.shift());
    });
  }

  events.sort((x, y) => x[0] - y[0]);
  while (events.length) {
    events.sort((x, y) => x[0] - y[0]);
    const [t, fn] = events.shift();
    clock = t;
    fn();
    if (b.m.solved && client.pending === 0) break;
  }

  const reasons = client.acks.reduce((acc, r) => ((acc[r.ok ? (r.strike ? "strike" : "ok") : r.reason] = (acc[r.ok ? (r.strike ? "strike" : "ok") : r.reason] ?? 0) + 1), acc), {});
  for (const l of log) console.log(`      ${l}`);
  console.log(`      taps: ${client.acks.length}, acks: ${JSON.stringify(reasons)}, solved at ${clock - b.t0}ms`);
  check("400ms RTT: the module is solved", b.m.solved);
  check("400ms RTT: exactly the one intended strike (presses in flight behind it were refused, not judged)", b.turn.strikes === 1, `strikes ${b.turn.strikes}`);
  check("400ms RTT: no correct press was ever judged as wrong", (reasons.strike ?? 0) === 1);
  check("400ms RTT: the inactivity replay happened mid-stage and kept progress", idleAt.length === 1 && idleAt[0].stage === 2 && idleAt[0].progress === 2, JSON.stringify(idleAt));
  check("400ms RTT: the client never drifted (its final view matches the server)", client.view.stage === b.m.state.stage && client.view.progress === b.m.state.progress);
  check("400ms RTT: every press got an ack", client.acks.length === client.seq);
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
