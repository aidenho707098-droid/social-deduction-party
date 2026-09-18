// Standalone check for the Wavelength scale bank — two playtest fixes:
//   1. No pole label should be a raw number/figure (e.g. "1 million USD") —
//      those force the Clue-Giver to reason in exact digits instead of an
//      intuitive quality. Every pole should read as a plain descriptor.
//   5. For scales with a clear positive/negative connotation, the more
//      desirable pole must be on the right (poleB) and the less desirable
//      on the left (poleA) — clue-givers and guessers read left-to-right.
// Run:  node server/wavelengthScales.selftest.mjs
// Prints PASS/FAIL per case, exits non-zero on any failure.

import { SCALES } from "./games/wavelengthScales.js";

let failures = 0;
function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const byCategory = Object.fromEntries(SCALES.map((s) => [s.category, s]));

// --- 1. no numeric/figure-based pole labels --------------------------------
for (const s of SCALES) {
  check(
    `"${s.category}" poles have no digits`,
    !/\d/.test(s.poleA) && !/\d/.test(s.poleB),
    `poleA="${s.poleA}" poleB="${s.poleB}"`
  );
}

// --- 5. desirable pole is on the right (poleB) for clearly-valenced scales -
// Deliberately NOT every scale: magnitude scales like Temperature, Effort,
// Time of Day, Transport, Distance, Age, Height, Weight, Rarity, Fame,
// Price, Brightness, Volume, Permanence, Resources, Strength, Activities,
// Facts and Subjects have no universally-agreed "good" end (fast transport
// and a one-of-a-kind item both already happen to read left-to-right as
// undesirable-to-desirable, but that's not the same as an objective value
// judgment) — only scales whose poles are inherently value-laden are
// checked here.
const expectedOrder = {
  Comedy: ["Not funny at all", "Hilarious"],
  Spice: ["Bland", "Flavorful"],
  Danger: ["Certain death", "Totally safe"],
  Money: ["Poor", "Rich"],
  Movies: ["Terrible", "Masterpiece"],
  School: ["Terrible", "Incredible"],
  Looks: ["Repulsive", "Attractive"],
  Punishment: ["Torturous", "Pleasurable"],
  "World News": ["Horrific", "Incredible"],
  Morality: ["Evil", "Good"],
};

for (const [category, [poleA, poleB]] of Object.entries(expectedOrder)) {
  const s = byCategory[category];
  check(`setup: "${category}" scale exists`, Boolean(s));
  if (!s) continue;
  check(
    `"${category}" has the undesirable pole on the left`,
    s.poleA === poleA && s.poleB === poleB,
    `poleA="${s.poleA}" poleB="${s.poleB}"`
  );
}

console.log(failures === 0 ? "\nALL WAVELENGTH SCALE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
