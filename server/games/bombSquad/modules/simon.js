// SIMON LIGHTS — four lights (red, blue, green, yellow, each with its own
// shape) flash a sequence; the Defuser presses the TRANSLATED colours.
//
// Three stages: 3 flashes, then 4, then 5 (each extending the last). The
// manual has six rows — serial has a vowel (yes / no) x strikes so far (0,
// 1, 2 or more) — each mapping every flashed colour to the colour to press.
// Every row is a permutation of the four colours and no two rows match.
// A wrong press is a strike: the stage's flashes replay and its progress
// resets (and with a new strike count, a different row may apply).
//
// PLAYBACK is owned by the SERVER (state.playback): it starts when the fuse
// lights, after a stage is cleared, after a strike, when a paused bomb
// resumes, and after CONFIG.simon.idleMs with no press (the inactivity
// replay). Presses that arrive while it runs are refused (reason
// "playing"), and the client keeps the buttons disabled until a view with
// no playback arrives. The inactivity replay does NOT reset progress within
// the stage; a strike does.
//
// Every live press carries { stage, index }: what the client thinks it is
// pressing (plus the engine's per-bomb seq number, see bomb-squad.js). A
// press for a stage or index the server isn't on is stale (a strike or a
// replay crossed it in flight) and is refused without a strike; the ack
// carries the fresh view so the client resyncs.
//
// The flashes are part of the bomb (Defuser + spectators); the Expert only
// ever hears them described.
import { CONFIG } from "../config.js";
import { makeRng } from "../rng.js";
import { b, chip, hasVowel, t } from "../vocab.js";

export const SIMON_COLORS = ["red", "blue", "green", "yellow"];
export const LENGTHS = [3, 4, 5];
const KEYS = [];
for (const vowel of [true, false]) for (const strikes of [0, 1, 2]) KEYS.push({ vowel, strikes });

const T = CONFIG.simon;
export const playbackMs = (n) => T.leadMs + n * (T.onMs + T.gapMs);
const stageLen = (state) => LENGTHS[Math.min(state.stage, LENGTHS.length - 1)];

// Start (or restart) the current stage's flashes at server time `now`.
export function beginPlayback(state, now, reason) {
  if (state.stage >= LENGTHS.length) return;
  state.playId += 1;
  state.playback = { id: state.playId, reason, startAt: now, endAt: now + playbackMs(stageLen(state)) };
}

const strikeLabel =(n) => (n >= 2 ? "2 or more" : String(n));

function rowFor(rules, ctx) {
  const vowel = hasVowel(ctx.serial);
  const strikes = Math.min(2, ctx.strikes ?? 0);
  return rules.rows.find((r) => r.vowel === vowel && r.strikes === strikes);
}

export default {
  id: "simon",
  name: "Simon Lights",
  icon: "simon",
  weight: 1,

  params() {
    return { lengths: LENGTHS };
  },

  generateRules(seed) {
    const rng = makeRng(seed);
    const seen = new Set();
    const rows = KEYS.map((key) => {
      let perm;
      do perm = rng.shuffle(SIMON_COLORS);
      while (seen.has(perm.join()));
      seen.add(perm.join());
      return { ...key, map: Object.fromEntries(SIMON_COLORS.map((c, i) => [c, perm[i]])) };
    });
    return { rows };
  },

  createInstance(rng) {
    return {
      seq: Array.from({ length: LENGTHS.at(-1) }, () => rng.pick(SIMON_COLORS)),
      stage: 0,
      progress: 0,
      replay: 0,
      playId: 0,
      playback: null, // { id, reason, startAt, endAt } while the flashes run
      idleFrom: null, // server ms the inactivity replay counts from
    };
  },

  // ---- live-only hooks: the engine calls these, verify.js never does ----

  // The fuse lit, or a paused bomb resumed: show the flashes.
  start(state, now, reason = "start") {
    beginPlayback(state, now, reason);
  },

  // Playback ending, and the inactivity replay. True on a change.
  tick(state, now) {
    if (state.stage >= LENGTHS.length) return false;
    if (state.playback) {
      if (now < state.playback.endAt) return false;
      state.playback = null;
      state.idleFrom = now;
      return true;
    }
    if (state.idleFrom != null && now - state.idleFrom >= T.idleMs) {
      beginPlayback(state, now, "idle"); // progress is KEPT
      return true;
    }
    return false;
  },

  // Is this press for the step the server is on? null = judge it.
  gate(state, a, now) {
    if (state.playback && now < state.playback.endAt) return { reason: "playing", message: "Wait for the lights to finish." };
    if (!Number.isInteger(a.stage) || !Number.isInteger(a.index)) return { reason: "stale" };
    if (a.stage !== state.stage || a.index !== state.progress) return { reason: "stale" };
    return null;
  },

  // The colour to press next: the flashed colour, translated by the row for
  // this serial and the strikes right now.
  solve(rules, state, ctx) {
    return { kind: "press", color: rowFor(rules, ctx).map[state.seq[state.progress]] };
  },

  act(rules, state, a, ctx) {
    if (a.kind !== "press" || !SIMON_COLORS.includes(a.color)) return { valid: false };
    const live = Number.isFinite(ctx.now);
    if (a.color !== this.solve(rules, state, ctx).color) {
      state.progress = 0; // a strike restarts the stage
      state.replay += 1; // the stage's flashes play again
      if (live) beginPlayback(state, ctx.now, "strike");
      return { valid: true, strike: true };
    }
    state.progress += 1;
    if (live) state.idleFrom = ctx.now;
    if (state.progress === LENGTHS[state.stage]) {
      state.stage += 1;
      state.progress = 0;
      state.replay += 1; // the next, longer sequence plays
      if (live) beginPlayback(state, ctx.now, "stage");
    }
    return { valid: true, solved: state.stage === LENGTHS.length };
  },

  candidates() {
    return SIMON_COLORS.map((color) => ({ kind: "press", color }));
  },

  describe(rules, before, a, ctx) {
    const want = this.solve(rules, before, ctx);
    return {
      did: [t("Pressed "), chip(a.color)],
      expected: [t("Press "), chip(want.color), t(` (stage ${before.stage + 1}, flash ${before.progress + 1})`)],
    };
  },

  // Playback goes out as "how far in it is" (no clock sync needed).
  view(state, now = Date.now()) {
    const pb = state.playback && now < state.playback.endAt ? state.playback : null;
    return {
      stage: state.stage,
      stages: LENGTHS.length,
      flashes: state.seq.slice(0, stageLen(state)),
      progress: state.progress,
      replay: state.replay,
      playback: pb ? { id: pb.id, reason: pb.reason, elapsedMs: now - pb.startAt, totalMs: pb.endAt - pb.startAt } : null,
      timing: { leadMs: T.leadMs, onMs: T.onMs, gapMs: T.gapMs },
    };
  },

  renderManual(rules) {
    return {
      id: "simon",
      title: "Simon Lights",
      icon: "simon",
      blocks: [
        {
          type: "note",
          parts: [
            t("The Defuser reads out the "),
            b("flashes"),
            t(" in order. Find the row for the serial number and the strikes "),
            b("right now"),
            t(", translate each flashed colour, and tell them what to press. Three stages: 3, 4, then 5 flashes. A wrong press is a strike and the stage starts over. If nobody presses for 8 seconds the flashes replay, but presses already made in the stage still count."),
          ],
        },
        {
          type: "table",
          columns: ["Vowel?", "Strikes", "Flash → press"],
          rows: rules.rows.map((r) => [
            [b(r.vowel ? "Yes" : "No")],
            [t(strikeLabel(r.strikes))],
            SIMON_COLORS.flatMap((c, i) => [...(i ? [t(" · ")] : []), chip(c), t(" → "), chip(r.map[c])]),
          ]),
        },
      ],
    };
  },
};
