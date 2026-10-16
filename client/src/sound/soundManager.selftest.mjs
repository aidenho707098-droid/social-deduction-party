// Sound manager selftest: hidden tab, catch-up, cooldown, coalescing and
// the 3-per-second cap, on a fake clock and a fake engine.
// Run:  node client/src/sound/soundManager.selftest.mjs

import { SoundManager, COOLDOWN_MS, CATCH_UP_GRACE_MS } from "./soundManager.js";

let failures = 0;
function check(name, cond, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
function setup() {
  const played = [];
  let t = 1000;
  let hidden = false;
  const m = new SoundManager({ play: (k) => (played.push(k), {}), stop() {} }, { now: () => t, hidden: () => hidden });
  return { m, played, at: (x) => (t = x), adv: (d) => (t += d), hide: (h) => (hidden = h) };
}

{
  const s = setup();
  s.m.play("reveal");
  s.m.play("reveal"); // the same render / StrictMode double effect
  check("the same sound twice at once plays once (cooldown)", s.played.length === 1);
  s.adv(COOLDOWN_MS);
  s.m.play("reveal");
  check(`…and again after ${COOLDOWN_MS}ms`, s.played.length === 2);
}
{
  const s = setup();
  for (let i = 0; i < 5; i++) {
    s.m.play("player-join");
    s.adv(200); // five joins over a second
  }
  check("five players joining in a burst = one blip (coalesced)", s.played.filter((k) => k === "player-join").length === 1);
}
{
  const s = setup();
  for (const k of ["reveal", "confirm", "correct", "wrong", "game-start"]) s.m.play(k);
  check("at most 3 event sounds per second", s.played.length === 3, s.played.join(","));
  s.adv(1000);
  s.m.play("wrong");
  check("…the cap is a rolling second", s.played.length === 4);
  const before = s.played.length;
  for (let i = 0; i < 6; i++) {
    s.m.play(`echo-note-${i}`);
    s.adv(50);
  }
  check("rhythm sounds (game notes / ticks) skip the cap", s.played.length === before + 6);
}
{
  const s = setup();
  s.hide(true);
  s.m.play("reveal");
  check("nothing plays while the tab is hidden", s.played.length === 0);
}
{
  const s = setup();
  s.m.beginCatchUp("initial sync");
  s.m.play("player-join");
  s.m.play("game-start");
  check("nothing plays while catching up (reload / initial sync)", s.played.length === 0 && s.m.catchingUp());
  s.m.endCatchUp("initial sync");
  s.m.play("game-start");
  check("…nor during the grace right after the server caught us up", s.played.length === 0);
  s.adv(CATCH_UP_GRACE_MS);
  s.m.play("game-start");
  check("…then events sound again", s.played.length === 1 && !s.m.catchingUp());
  s.m.beginCatchUp("reconnect");
  s.m.beginCatchUp("initial sync");
  s.m.endCatchUp("reconnect");
  check("catch-up holds until every reason has ended", s.m.catchingUp());
}
{
  const s = setup();
  let rang = 0;
  s.m.run("chaos-sting", () => rang++);
  s.m.run("chaos-sting", () => rang++);
  check("synthesised sounds (the Chaos sting) obey the same rules", rang === 1);
}
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
