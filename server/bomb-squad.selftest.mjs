// Bomb Squad engine selftest: pairing, roles, equal-difficulty lineups,
// turn order, the fuse, scoring, bets, privacy of every payload,
// disconnects and host controls. (Module solvability has its own harness:
// bomb-squad.solvability.mjs.)
// Run:  node server/bomb-squad.selftest.mjs   (or npm run test:bomb-squad)

import * as bs from "./games/bomb-squad.js";
import { CONFIG, defusePoints } from "./games/bombSquad/config.js";
import { MODULES } from "./games/bombSquad/modules/index.js";
import { CATALOG, FILTERS } from "../client/src/games/catalog.js";
import { isChaosEligible } from "./chaosGames.js";
import { GLYPHS } from "../client/src/games/bombSquad/glyphData.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n── ${t} ──`);
const json = (x) => JSON.stringify(x);
const IDS = ["ann", "bob", "cat", "dan", "eve", "fay", "gus", "hal", "ivy", "joe"];
const newGame = (n, opts = {}) => bs.createGame(IDS.slice(0, n), { difficulty: "medium", rounds: 2, seed: 7, ...opts });

// The client fills in the live input protocol (see simon-protocol.selftest.mjs):
// what step each action is for, and Simon waits for its playback to finish.
function actP(g, pid, a, { now = Date.now(), ...o } = {}) {
  const turn = bs.bombsOf(g).find((b) => b.defuserId === pid);
  const m = turn?.modules[a.module];
  const st = m?.state;
  const p = { ...a };
  if (m?.type === "symbols") p.index ??= st.progress;
  if (m?.type === "memory") p.stage ??= st.stage;
  if (m?.type === "switches" && a.kind === "toggle") p.to ??= st.switches[a.switch] !== "1";
  if (m?.type === "switches" && a.kind === "lock") p.pattern ??= st.switches;
  if (m?.type === "simon") {
    p.stage ??= st.stage;
    p.index ??= st.progress;
    if (st.playback) now = Math.max(now, st.playback.endAt);
  }
  return bs.act(g, pid, p, { now, ...o });
}

// Solve the live bomb the way a perfect pair would (via each module's solver).
function defuse(g, now = Date.now()) {
  const turn = g.turn;
  for (let i = 0; i < turn.modules.length; i++) {
    for (let guard = 0; guard < 30 && !turn.modules[i]?.solved && g.phase === "live"; guard++) {
      const m = turn.modules[i];
      const ctx = { serial: turn.serialNo, strikes: turn.strikes };
      const want = MODULES[m.type].solve(m.rules, m.state, ctx);
      doAction(g, turn.defuserId, i, want, now);
    }
  }
}
function doAction(g, pid, i, want, now = Date.now()) {
  const turn = g.turn;
  const base = { turn: turn.serial, module: i };
  if (want.kind === "tap" && turn.modules[i].type === "button") {
    actP(g, pid, { ...base, kind: "press" }, { now });
    return actP(g, pid, { ...base, kind: "release" }, { now: now + 100 });
  }
  if (want.kind === "hold") {
    actP(g, pid, { ...base, kind: "press" }, { now });
    let at = now + 1500;
    while (!bs.secondsAt(turn, at).includes(String(want.digit))) at += 100;
    return actP(g, pid, { ...base, kind: "release" }, { now: at });
  }
  return actP(g, pid, { ...base, ...want }, { now });
}
// One wrong action on module i (for a strike).
function wrong(g, i, now = Date.now()) {
  const turn = g.turn;
  const m = turn.modules[i];
  const want = MODULES[m.type].solve(m.rules, m.state, { serial: turn.serialNo, strikes: turn.strikes });
  const base = { turn: turn.serial, module: i };
  if (m.type === "wires") return actP(g, turn.defuserId, { ...base, kind: "cut", wire: (want.wire + 1) % m.state.wires.length }, { now });
  if (m.type === "symbols") return actP(g, turn.defuserId, { ...base, kind: "tap", symbol: m.state.shown.find((s) => s !== want.symbol && !m.state.order.slice(0, m.state.progress).includes(s)) }, { now });
  if (m.type === "button") {
    actP(g, turn.defuserId, { ...base, kind: "press" }, { now });
    return actP(g, turn.defuserId, { ...base, kind: "release" }, { now: now + (want.kind === "tap" ? 2500 : 100) });
  }
  if (m.type === "memory") {
    const b = m.state.buttons[m.state.stage];
    return actP(g, turn.defuserId, { ...base, kind: "press", position: (want.position + 1) % b.length }, { now });
  }
  if (m.type === "maze") {
    const open = m.rules.mazes[m.state.layout].open[m.state.pos];
    const dir = Object.entries({ up: 1, right: 2, down: 4, left: 8 }).find(([, bit]) => !(open & bit))[0];
    return actP(g, turn.defuserId, { ...base, kind: "move", dir }, { now });
  }
  if (m.type === "simon") return actP(g, turn.defuserId, { ...base, kind: "press", color: ["red", "blue", "green", "yellow"].find((c) => c !== want.color) }, { now });
  if (m.type === "switches") {
    actP(g, turn.defuserId, { ...base, kind: "toggle", switch: 0 }, { now });
    const r = actP(g, turn.defuserId, { ...base, kind: "lock" }, { now });
    if (!r.strike) {
      // landed on the answer by chance: undo, then lock wrong
      actP(g, turn.defuserId, { ...base, kind: "toggle", switch: 0 }, { now });
    }
    return r;
  }
}
const live = (g) => {
  if (g.phase === "ready") bs.forceAdvance(g, g.participants);
};

// ===================================================================
section("catalogue + config");
{
  const e = CATALOG.find((x) => x.id === "bomb-squad");
  check("catalogue: name constant, 2-10, the Active chip", e?.name === bs.name && e.minPlayers === 2 && e.maxPlayers === 10 && e.tags.join() === "active" && FILTERS.some((f) => f.key === "active"));
  check("difficulties: 2/3/4 modules, 4:00/4:30/5:00", json(Object.values(CONFIG.difficulties).map((d) => [d.modules, d.fuseMs / 1000])) === json([[2, 240], [3, 270], [4, 300]]));
  check("rounds 1-6, default 2", CONFIG.rounds.min === 1 && CONFIG.rounds.max === 6 && CONFIG.rounds.dflt === 2);
  check("Chaos excluded", !isChaosEligible("bomb-squad"));
  check("24 glyphs, all different", GLYPHS.length === CONFIG.symbols.pool && new Set(GLYPHS.map((g) => g.d)).size === 24 && new Set(GLYPHS.map((g) => g.name)).size === 24);
  check("scoring formula", defusePoints({ modules: 3, msLeft: 95_000, strikes: 1 }) === 3 + 3 + 3 - 1 && defusePoints({ modules: 2, msLeft: 500_000, strikes: 0 }) === 3 + 2 + 4 && defusePoints({ modules: 2, msLeft: 0, strikes: 2 }) === 3);
}

section("pairing + roles");
{
  for (const n of [2, 3, 5, 10]) {
    const groups = bs.makePairing(IDS.slice(0, n));
    const sizes = groups.map((x) => x.length).sort().join();
    const want = n % 2 ? [...Array((n - 3) / 2).fill(2), 3].join() : Array(n / 2).fill(2).join();
    check(`${n} players -> ${want.replaceAll(",", " + ")}`, sizes === want && new Set(groups.flat()).size === n, json(groups));
  }
  check("a host-rolled pairing is used if it still fits", json(newGame(4, { pairing: [["ann", "dan"], ["bob", "cat"]] }).groups.map((x) => x.members)) === json([["ann", "dan"], ["bob", "cat"]]));
  check("a stale pairing (someone new joined) is ignored", newGame(5, { pairing: [["ann", "dan"], ["bob", "cat"]] }).groups.flatMap((x) => x.members).length === 5);
  check("a trio only with an odd count", !bs.validPairing([["ann", "bob", "cat"], ["dan", "eve", "fay"]], IDS.slice(0, 6)));
  const g = newGame(5);
  const pair = g.groups.find((x) => x.members.length === 2);
  const trio = g.groups.find((x) => x.members.length === 3);
  const d = (grp, r) => bs.rolesFor(g, grp, r).defuserId;
  check("pair: the two swap every round", d(pair, 0) !== d(pair, 1) && d(pair, 0) === d(pair, 2));
  check("trio: the Defuser rotates through all three", new Set([0, 1, 2].map((r) => d(trio, r))).size === 3);
  check("trio: two Experts", bs.rolesFor(g, trio, 0).expertIds.length === 2);
}

section("rounds: equal lineups, turn order");
{
  const g = newGame(6, { difficulty: "hard", rounds: 4 });
  const seen = [];
  let orderOk = true;
  for (let r = 0; r < 4; r++) {
    const lineups = [];
    const played = [];
    while (g.phase !== "summary") {
      if (g.phase === "ready") {
        played.push(g.turn.groupId);
        lineups.push(json({ t: g.turn.modules.map((m) => m.type), p: g.round.lineup.params }));
        live(g);
      }
      if (g.phase === "live") bs.forceAdvance(g, g.participants); // forfeit
      if (g.phase === "result") bs.forceAdvance(g, g.participants);
    }
    if (json(played) !== json(g.round.order)) orderOk = false;
    check(`round ${r + 1}: every pair got the same module types + sizes`, new Set(lineups).size === 1, lineups[0]);
    seen.push([...g.round.lineup.types].sort().join());
    bs.nextRound(g);
  }
  check("turns went strictly in order, each pair exactly once", orderOk);
  // (Hard = 4 module types; with 5 to choose from there's always another set.)
  const e = newGame(2, { difficulty: "easy", rounds: 6 });
  const sets = [];
  for (let r = 0; r < 6; r++) {
    sets.push([...e.round.lineup.types].sort().join());
    live(e);
    bs.forceAdvance(e, e.participants);
    bs.forceAdvance(e, e.participants);
    bs.forceAdvance(e, e.participants);
  }
  check("no round repeats the previous round's exact lineup", sets.every((x, i) => i === 0 || x !== sets[i - 1]), sets.join(" | "));
  const g2 = newGame(4);
  const a = g2.turn;
  live(g2);
  bs.forceAdvance(g2, g2.participants);
  bs.forceAdvance(g2, g2.participants);
  const b = g2.turn;
  check("pairs differ in serial and manual variant", a.serialNo !== b.serialNo && json(a.modules.map((m) => m.rules)) !== json(b.modules.map((m) => m.rules)));
}

section("the fuse, strikes, defuse, explosion");
{
  const g = newGame(2, { difficulty: "easy" });
  check("starts in get-ready (10s)", g.phase === "ready" && g.windowMs === 10_000);
  const t0 = Date.now();
  bs.tick(g, g.participants, t0 + 10_001);
  check("the fuse starts after the get-ready", g.phase === "live" && g.turn.fuse.anchorAt === t0 + 10_001);
  const now = g.turn.fuse.anchorAt + 10_000;
  const plain = g.turn.modules.findIndex((m) => m.type !== "button");
  const before = bs.fuseLeft(g.turn, now);
  const r = wrong(g, plain, now);
  check("a wrong action is a strike", r.strike && g.turn.strikes === 1);
  check("each strike runs the fuse 25% faster", g.turn.fuse.rate === 1.25 && Math.abs(bs.fuseLeft(g.turn, now + 1000) - (before - 1250)) < 2);
  wrong(g, plain, now);
  check("2 strikes: rate 1.5625", g.turn.fuse.rate === 1.25 ** 2);
  wrong(g, plain, now);
  check("3 strikes: it explodes, 0 points", g.phase === "result" && g.turn.outcome === "exploded" && g.turn.points === 0);

  const g2 = newGame(2, { difficulty: "easy" });
  live(g2);
  const t = Date.now();
  wrong(g2, 1, t);
  defuse(g2, t);
  const res = g2.round.results.at(-1);
  check("all modules solved: defused", res?.outcome === "defused");
  const expect = defusePoints({ modules: 2, msLeft: res.msLeft, strikes: 1 });
  check(`defused with 1 strike: ${expect} points each, both partners`, res.points === expect && g2.turn.defuserId && [g2.turn.defuserId, ...g2.turn.expertIds].every((p) => g2.scores.get(p) === expect));

  const g3 = newGame(2);
  live(g3);
  bs.tick(g3, g3.participants, Date.now() + 10 * 60_000);
  check("the fuse running out explodes it", g3.turn.outcome === "exploded" && g3.round.results.at(-1).reason === "time");
}

section("button: the release is judged on the server's fuse clock");
{
  // Find a game whose bomb has a button that must be HELD.
  let g;
  let i;
  for (let seed = 1; seed < 500; seed++) {
    g = bs.createGame(["ann", "bob"], { difficulty: "medium", seed });
    i = g.turn.modules.findIndex((m) => m.type === "button" && MODULES.button.solve(m.rules, m.state, { serial: g.turn.serialNo, strikes: 0 }).kind === "hold");
    if (i >= 0) break;
  }
  live(g);
  const turn = g.turn;
  const m = turn.modules[i];
  const want = MODULES.button.solve(m.rules, m.state, { serial: turn.serialNo, strikes: 0 });
  const t0 = turn.fuse.anchorAt;
  let good = t0 + 3000;
  while (!bs.secondsAt(turn, good).includes(String(want.digit))) good += 50;
  let bad = t0 + 3000;
  while ([-1300, -650, 0, 650, 1300].some((d) => bs.secondsAt(turn, bad + d).includes(String(want.digit)))) bad += 50;
  const base = { turn: turn.serial, module: i };
  actP(g, turn.defuserId, { ...base, kind: "press" }, { now: bad - 2000 });
  const late = actP(g, turn.defuserId, { ...base, kind: "release" }, { now: bad });
  check("letting go when the seconds don't show the digit: strike", late.strike);
  // Arrives 400ms late, but the RTT was 800ms: judged at the real moment.
  actP(g, turn.defuserId, { ...base, kind: "press" }, { now: good - 2000 });
  const ok = actP(g, turn.defuserId, { ...base, kind: "release" }, { now: good + 400, halfRttMs: 400 });
  check("a release on the right digit, latency-compensated: solved", ok.solved && !ok.strike);
}

section("Phase 2 modules: a wrong Memory press restarts; Switch Board locks");
{
  let g;
  for (let seed = 1; seed < 300; seed++) {
    g = bs.createGame(["ann", "bob"], { difficulty: "hard", seed });
    if (g.turn.modules.some((m) => m.type === "memory") && g.turn.modules.some((m) => m.type === "switches")) break;
  }
  live(g);
  const turn = g.turn;
  const mi = turn.modules.findIndex((m) => m.type === "memory");
  const mem = turn.modules[mi];
  // Two right presses, then a wrong one.
  for (let k = 0; k < 2; k++) doAction(g, turn.defuserId, mi, MODULES.memory.solve(mem.rules, mem.state));
  const before = json(mem.state.displays) + json(mem.state.buttons);
  check("memory: two correct presses -> stage 3", mem.state.stage === 2);
  const r = wrong(g, mi);
  check("memory: a wrong press is a strike and restarts at stage 1 with a new display", r.strike && mem.state.stage === 0 && json(mem.state.displays) + json(mem.state.buttons) !== before);
  const si = turn.modules.findIndex((m) => m.type === "switches");
  const sw = turn.modules[si];
  const lockEarly = actP(g, turn.defuserId, { turn: turn.serial, module: si, kind: "lock" });
  check("switches: LOCK with the wrong pattern is a strike", lockEarly.strike);
  for (let k = 0; k < 6 && !sw.solved; k++) doAction(g, turn.defuserId, si, MODULES.switches.solve(sw.rules, sw.state));
  check("switches: set the pattern + LOCK solves it", sw.solved);
}

section("bets");
{
  const g = newGame(4);
  const spectators = g.participants.filter((p) => !g.groups[g.turn.groupId].members.includes(p));
  check("the pair on the bomb can't bet", !bs.bet(g, g.turn.defuserId, "boom").ok);
  check("spectators can bet during the get-ready", bs.bet(g, spectators[0], "defused").ok && bs.bet(g, spectators[1], "boom").ok);
  live(g);
  check("bets close when the fuse starts", !bs.bet(g, spectators[0], "boom").ok);
  defuse(g);
  check("a correct bet earns 1, a wrong one nothing", g.scores.get(spectators[0]) === 1 && g.scores.get(spectators[1]) === 0);
  check("public state: a bet count, not who bet what", g.turn && json(bs.getPublicState(g, g.participants)).includes('"betCount":2') && !json(bs.getPublicState(g, g.participants)).includes('"defused","boom"'));
}

section("privacy of every payload");
{
  const g = newGame(5, { difficulty: "hard" });
  const turn = g.turn;
  const team = g.groups[turn.groupId].members;
  const spec = g.participants.find((p) => !team.includes(p));
  live(g);
  const pub = json(bs.getPublicState(g, g.participants));
  const def = json(bs.getPrivateState(g, turn.defuserId));
  const exps = turn.expertIds.map((p) => json(bs.getPrivateState(g, p)));
  const spc = json(bs.getPrivateState(g, spec));
  const rulesBits = turn.modules.map((m) => json(m.rules));
  check("public: no serial, no module states, no rules, no manual", !pub.includes(turn.serialNo) && !/"view"|"rules"|"chapters"|"shown"|"state"|"blocks"/.test(pub));
  check("Defuser: the bomb, never the manual or the rules", def.includes(turn.serialNo) && !/"chapters"|"blocks"|"rules"|"general"/.test(def) && rulesBits.every((r) => !def.includes(r)));
  check("Experts: the manual, never the serial or any module state", exps.every((e) => e.includes('"chapters"') && !e.includes(turn.serialNo) && !/"view"|"modules"|"bomb"/.test(e)));
  check("spectator: the read-only mirror, never the manual", spc.includes(turn.serialNo) && spc.includes('"spectator"') && !/"chapters"|"blocks"|"rules"/.test(spc));
  check("every Expert gets the general page", exps.every((e) => e.includes('"general"') && e.includes("serial number")));
  if (turn.expertIds.length === 2) {
    const ch = turn.expertIds.map((p) => bs.getPrivateState(g, p).bombSquad.manual.chapters.map((c) => c.id));
    check("trio: the two Experts split the chapters (alternating, no overlap)", ch[0].length + ch[1].length === turn.modules.length && ch[0].every((c) => !ch[1].includes(c)), json(ch));
  } else check("(this turn is a pair)", true);
  // Get a trio on the bomb and check the split there.
  const g2 = bs.createGame(["ann", "bob", "cat"], { difficulty: "hard", seed: 3 });
  const ch = g2.turn.expertIds.map((p) => bs.getPrivateState(g2, p).bombSquad.manual.chapters.map((c) => c.id));
  const order = g2.turn.modules.map((m) => m.type);
  check("trio: alternating chapters, no overlap, all covered", ch[0].length + ch[1].length === order.length && ch.flat().sort().join() === [...order].sort().join() && ch.every((c) => c.every((id) => order.indexOf(id) % 2 === order.indexOf(c[0]) % 2)), json(ch));
}

section("disconnects + host controls");
{
  const g = newGame(2);
  live(g);
  const turn = g.turn;
  const t = Date.now();
  const expert = turn.expertIds[0];
  bs.tick(g, [expert], t);
  check("Defuser drops: the fuse pauses", turn.fuse.paused);
  const left = bs.fuseLeft(turn, t + 30_000);
  check("…and stays put while paused", Math.abs(left - bs.fuseLeft(turn, t)) < 1);
  check("…and the bomb can't be touched", !actP(g, turn.defuserId, { turn: turn.serial, module: 0, kind: "cut", wire: 0 }).ok);
  bs.tick(g, g.participants, t + 30_000);
  check("Defuser back: the fuse runs again", !turn.fuse.paused);
  bs.tick(g, [turn.defuserId], t + 31_000);
  check("the only Expert drops: paused", turn.fuse.paused);
  bs.reconcilePresence(g, [turn.defuserId], { final: true, roomPlayerIds: [turn.defuserId] });
  check("…gone for good: the pair forfeits (0 points), game ends at 1 player", g.phase === "final" || g.round.results.at(-1)?.outcome === "forfeit");

  const g3 = bs.createGame(["ann", "bob", "cat", "dan", "eve"], { difficulty: "hard", seed: 11 });
  // Move to the trio's turn.
  while (g3.groups[g3.turn.groupId].members.length !== 3) {
    live(g3);
    bs.forceAdvance(g3, g3.participants);
    bs.forceAdvance(g3, g3.participants);
  }
  live(g3);
  const tr = g3.turn;
  const gone = tr.expertIds[0];
  const stay = tr.expertIds[1];
  const room = g3.participants.filter((p) => p !== gone);
  bs.reconcilePresence(g3, room, { final: true, roomPlayerIds: room });
  check("trio Expert leaves: the bomb goes on", g3.phase === "live");
  check("…and the remaining Expert gets the full manual", bs.getPrivateState(g3, stay).bombSquad.manual.chapters.length === tr.modules.length);
  bs.reconcilePresence(g3, room.filter((p) => p !== tr.defuserId), { final: true, roomPlayerIds: room.filter((p) => p !== tr.defuserId) });
  check("Defuser leaves for good: forfeit, then the NEXT pair only", g3.phase === "result" && g3.round.results.at(-1).outcome === "forfeit");

  const g4 = newGame(4);
  const first = g4.turn.groupId;
  bs.skipPair(g4);
  check("host skips a pair: forfeit, result card", g4.phase === "result" && g4.round.results.at(-1).reason === "skipped");
  bs.forceAdvance(g4, g4.participants);
  check("force proceed after a result: the next pair in order", g4.turn.groupId === g4.round.order[1] && g4.turn.groupId !== first);
  bs.forceAdvance(g4, g4.participants);
  check("force proceed in get-ready: the fuse starts", g4.phase === "live");
}

section("Part A: what went wrong (strike log)");
{
  const g = newGame(2, { difficulty: "medium" });
  live(g);
  const plain = g.turn.modules.findIndex((m) => m.type !== "button");
  wrong(g, plain);
  const pubLive = json(bs.getPublicState(g, g.participants));
  check("during play: no strike details anywhere public", !/strikeLog|"did"|"expected"/.test(pubLive));
  check("…nor in the Defuser's or Expert's payload", ![g.turn.defuserId, ...g.turn.expertIds].some((p) => /strikeLog|"did"/.test(json(bs.getPrivateState(g, p)))));
  wrong(g, plain);
  wrong(g, plain);
  const res = bs.getPublicState(g, g.participants).turn.result;
  check("3 strikes: the log lists all three, in order, with module, did, expected and fuse time", res.strikeLog.length === 3 && res.strikeLog.every((e) => e.module && e.did.length && e.expected.length && typeof e.msLeft === "number"), json(res.strikeLog[0]));
  const text = (parts) => parts.map((p) => p.t ?? p.b ?? `[${p.c}]`).join("");
  check("…a wires entry reads like 'Cut the 3rd wire (yellow)'", g.turn.modules[plain].type !== "wires" || /^Cut the \d(st|nd|rd|th) wire \(\[\w+\]\)$/.test(text(res.strikeLog[0].did)), text(res.strikeLog[0].did));
  const g2 = newGame(2, { difficulty: "medium" });
  live(g2);
  wrong(g2, g2.turn.modules.findIndex((m) => m.type !== "button"));
  bs.tick(g2, g2.participants, Date.now() + 10 * 60_000);
  const r2 = g2.turn.result;
  check("fuse ran out: reason 'time', the strike log, and the unsolved modules", r2.reason === "time" && r2.strikeLog.length === 1 && r2.unsolved.length === g2.turn.modules.filter((m) => !m.solved).length && r2.unsolved.length > 0);
  for (const [type, mod] of Object.entries(MODULES)) {
    check(`${type}: a plug-in with describe + candidates, weight 1`, typeof mod.describe === "function" && typeof mod.candidates === "function" && mod.weight === 1);
  }
}

section("Part A: Memory Display label memory only on Hard");
{
  const count = (difficulty) => {
    let label = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = MODULES.memory.generateRules(seed, MODULES.memory.params(null, difficulty));
      if (r.stages.flat().some((x) => x.type === "sameLabel")) label++;
    }
    return label;
  };
  check("Easy + Medium: no label-memory rule in 300 variants each", count("easy") === 0 && count("medium") === 0);
  check("Hard: label-memory rules appear", count("hard") > 0);
}

section("Part A: the general page is static and short");
{
  const g1 = newGame(2, { seed: 1 });
  const g2 = newGame(4, { seed: 99, difficulty: "hard" });
  const page = (g) => bs.getPrivateState(g, g.turn.expertIds[0]).bombSquad.manual.general;
  check("identical for every pair and round", json(page(g1)) === json(page(g2)));
  check("5 short lines or fewer, marked static", page(g1).static === true && page(g1).blocks.flatMap((b) => b.items).length <= 5);
  check("no 'odd means 1, 3, 5…' or vowel list", !/1, 3, 5|A, E or U/.test(json(page(g1))));
}

section("Part A: runtime safety check");
{
  const orig = MODULES.wires.candidates;
  let calls = 0;
  MODULES.wires.candidates = function (...args) {
    calls += 1;
    return calls <= 1 ? [] : orig.apply(this, args); // the first attempt fails the check
  };
  let g;
  for (let seed = 1; seed < 200; seed++) {
    calls = 0;
    g = bs.createGame(["ann", "bob"], { difficulty: "hard", seed });
    if (g.round.lineup.types.includes("wires")) break;
  }
  check("a bomb that fails is regenerated with a new seed (and logged)", g.checkFailures >= 1 && !g.turn.broken && g.phase === "ready");
  MODULES.wires.candidates = () => [];
  let g2;
  for (let seed = 1; seed < 200; seed++) {
    g2 = bs.createGame(["ann", "bob"], { difficulty: "hard", seed });
    if (g2.round.lineup.types.includes("wires")) break;
  }
  check("never passes in 5 tries: the bomb is never started (forfeit 'check')", g2.checkFailures === 5 && g2.phase === "result" && g2.turn.result.reason === "check");
  MODULES.wires.candidates = orig;
}

section("Part A: all pairs at once");
{
  const g = bs.createGame(["ann", "bob", "cat", "dan", "eve"], { difficulty: "hard", rounds: 2, playStyle: "together", seed: 21 });
  const bombs = [...g.bombs.values()];
  check("every pair has its own bomb, same lineup, different serials", bombs.length === 2 && new Set(bombs.map((b) => b.modules.map((m) => m.type).join())).size === 1 && bombs[0].serialNo !== bombs[1].serialNo);
  check("one shared 10s get-ready", g.phase === "ready" && g.windowMs === 10_000);
  const t = Date.now() + 10_001;
  bs.tick(g, g.participants, t);
  check("every fuse lit at the same server time", g.phase === "live" && bombs.every((b) => b.fuse.anchorAt === t));
  const [A, B] = bombs;
  const cross = actP(g, A.defuserId, { turn: B.serial, module: 0, kind: "cut", wire: 0 }, { now: t + 100 });
  check("a Defuser's action is checked against their own bomb only", !cross.ok);
  const save = g.turn;
  g.turn = A; // reuse the 'wrong' helper on bomb A
  wrong(g, A.modules.findIndex((m) => m.type !== "button"), t + 200);
  g.turn = save;
  check("strikes are per bomb", A.strikes === 1 && B.strikes === 0 && A.fuse.rate === 1.25 && B.fuse.rate === 1);
  const pub = json(bs.getPublicState(g, g.participants, t + 300));
  check("public: each bomb's status only — no fuse, strikes, serials or results", !pub.includes(A.serialNo) && !pub.includes(B.serialNo) && !/"strikes"|"fuse"|strikeLog/.test(pub) && pub.includes('"status":"live"'));
  const bPriv = [B.defuserId, ...B.expertIds].map((p) => json(bs.getPrivateState(g, p, t + 300)));
  check("pair B's payloads carry nothing of pair A's bomb", bPriv.every((x) => !x.includes(A.serialNo) && !x.includes('"strikes":1')));
  const aPriv = json(bs.getPrivateState(g, A.expertIds[0], t + 300));
  check("pair A's Expert sees their own fuse + strikes privately", aPriv.includes('"strikes":1') && aPriv.includes('"rate":1.25'));
  A.fuse.leftMs = 50;
  A.fuse.anchorAt = t + 400;
  bs.tick(g, g.participants, t + 1000);
  check("one bomb ends: its result (with the log) goes to that pair; the round goes on", A.result?.outcome === "exploded" && g.phase === "live" && json(bs.getPrivateState(g, A.defuserId, t + 1000)).includes("strikeLog"));
  const pub2 = json(bs.getPublicState(g, g.participants, t + 1000));
  check("…others see only its status", pub2.includes('"status":"exploded"') && !pub2.includes("strikeLog") && !pub2.includes('"points"'));
  check("no spectators, no bets", !bs.bet(g, A.defuserId, "boom").ok);
  bs.skipPair(g, B.groupId, t + 1100);
  check("host skips one pair (by group): forfeit; every bomb ended -> a last result beat, then summary", B.result?.outcome === "forfeit" && g.phase === "result" && (bs.forceAdvance(g, g.participants), g.phase === "summary"));
  const sum = bs.getPublicState(g, g.participants).results;
  check("summary ranks the pairs (points, then time left)", sum.length === 2 && sum[0].points >= sum[1].points);
  const d0 = Object.fromEntries(bombs.map((b) => [b.groupId, b.defuserId]));
  bs.forceAdvance(g, g.participants);
  check("next round: new bombs, shared get-ready, the pair's roles swapped", g.phase === "ready" && g.roundIndex === 1 && [...g.bombs.values()].some((b) => g.groups[b.groupId].members.length === 2 && b.defuserId !== d0[b.groupId]));
  bs.forceAdvance(g, g.participants);
  bs.forceAdvance(g, g.participants);
  check("force proceed while live: every running bomb forfeits", g.phase === "result" && g.round.results.every((r) => r.outcome === "forfeit"));
  const h = bs.createGame(["ann", "bob", "cat", "dan"], { playStyle: "together", seed: 3 });
  bs.forceAdvance(h, h.participants);
  const [H1, H2] = [...h.bombs.values()];
  const rest = h.participants.filter((p) => p !== H1.defuserId);
  bs.tick(h, rest);
  check("a Defuser drops: only their bomb pauses", H1.fuse.paused && !H2.fuse.paused);
  bs.reconcilePresence(h, rest, { final: true, roomPlayerIds: rest });
  check("…gone for good: only that bomb forfeits", H1.result?.outcome === "forfeit" && !H2.outcome && h.phase === "live");
}

section("Part B: Maze + Simon Lights");
{
  check("a bomb draws from seven modules", Object.keys(MODULES).length === 7 && ["maze", "simon"].every((m) => MODULES[m]));
  let g;
  for (let seed = 1; seed < 400; seed++) {
    g = bs.createGame(["ann", "bob", "cat", "dan"], { difficulty: "hard", seed });
    const types = g.round.lineup.types;
    if (types.includes("maze") && types.includes("simon")) break;
  }
  check("never the same module twice in a bomb", new Set(g.round.lineup.types).size === g.round.lineup.types.length);
  live(g);
  const turn = g.turn;
  const mi = turn.modules.findIndex((m) => m.type === "maze");
  const si = turn.modules.findIndex((m) => m.type === "simon");
  const maze = turn.modules[mi];
  const spec = g.participants.find((p) => !g.groups[turn.groupId].members.includes(p));
  const defView = json(bs.getPrivateState(g, turn.defuserId).bombSquad.bomb.modules[mi]);
  check("maze: the Defuser's view has markers, dot and target — no walls", !/"open"|"layout"/.test(defView) && /"markers"/.test(defView));
  check("maze: the spectator mirror has the dot, never the walls", !/"open"/.test(json(bs.getPrivateState(g, spec))) && json(bs.getPrivateState(g, spec)).includes('"pos"'));
  const expJ = json(bs.getPrivateState(g, turn.expertIds[0]));
  check("simon: the Expert never receives the flashes", !/"flashes":|"seq":/.test(expJ));
  check("simon: the Defuser + spectators see the flashes", json(bs.getPrivateState(g, turn.defuserId)).includes('"flashes"') && json(bs.getPrivateState(g, spec)).includes('"flashes"'));
  // A wall bump: strike, the dot stays put, entry "Moved up from C3 into a wall".
  const D = { up: 1, right: 2, down: 4, left: 8 };
  const wallDir = Object.keys(D).find((d) => !(maze.rules.mazes[maze.state.layout].open[maze.state.pos] & D[d]));
  const pos = maze.state.pos;
  const r = actP(g, turn.defuserId, { turn: turn.serial, module: mi, kind: "move", dir: wallDir });
  const flat = (parts) => parts.map((p) => p.t ?? p.b ?? `[${p.c}]`).join("");
  check("maze: walking into a wall is a strike and the dot doesn't move", r.strike && maze.state.pos === pos);
  check("maze: entry reads like 'Moved up from C3 into a wall'", /^Moved (up|down|left|right) from [A-F][1-6] into a wall$/.test(flat(turn.strikeLog.at(-1).did)), flat(turn.strikeLog.at(-1).did));
  const sim = turn.modules[si];
  const want = MODULES.simon.solve(sim.rules, sim.state, { serial: turn.serialNo, strikes: turn.strikes });
  const bad = ["red", "blue", "green", "yellow"].find((c) => c !== want.color);
  const replay = sim.state.replay;
  actP(g, turn.defuserId, { turn: turn.serial, module: si, kind: "press", color: bad });
  check("simon: a wrong press is a strike, the stage replays, progress resets", turn.strikes === 2 && sim.state.replay === replay + 1 && sim.state.progress === 0);
  const e = turn.strikeLog.at(-1);
  check("simon: entry reads like 'Pressed yellow' / 'Press blue (stage 1, flash 1)'", /^Pressed \[\w+\]$/.test(flat(e.did)) && /^Press \[\w+\] \(stage \d, flash \d\)$/.test(flat(e.expected)), `${flat(e.did)} / ${flat(e.expected)}`);
  for (const d of ["easy", "medium", "hard"]) {
    const p = MODULES.maze.params(null, d);
    check(`maze ${d}: shortest path ${p.min}-${p.max} steps`, json([p.min, p.max]) === json({ easy: [6, 9], medium: [8, 12], hard: [10, 14] }[d]));
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
