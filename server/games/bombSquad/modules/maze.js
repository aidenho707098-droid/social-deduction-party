// MAZE — a 6x6 grid (columns A-F, rows 1-6). The Defuser sees two marker
// circles, a white dot and a target triangle, but NOT the walls. The Expert
// has nine mazes: the markers say which one, and the Expert talks the dot
// to the triangle. Walking into a wall is a strike (the dot stays put).
//
// Manual: a lookup table (marker cells -> layout number, sorted), then
// nine generated PERFECT mazes (exactly one path between any two cells),
// each drawn with its markers. Every variant: nine mazes, nine different
// marker pairs. The dot and target sit on two other cells, the shortest
// path between them 6-9 steps on Easy, 8-12 on Medium, 10-14 on Hard.
//
// Walls live only in the rules (so only in the Expert's manual): the
// Defuser's and spectators' view is markers, dot and target.
import { makeRng } from "../rng.js";
import { b, t } from "../vocab.js";

export const SIZE = 6;
const CELLS = SIZE * SIZE;
const LAYOUTS = 9;
export const STEPS = { easy: [6, 9], medium: [8, 12], hard: [10, 14] };

// Walls: each cell holds the directions it's OPEN to (bit flags).
export const DIRS = {
  up: { bit: 1, dr: -1, dc: 0, back: 4 },
  right: { bit: 2, dr: 0, dc: 1, back: 8 },
  down: { bit: 4, dr: 1, dc: 0, back: 1 },
  left: { bit: 8, dr: 0, dc: -1, back: 2 },
};
const DIR_KEYS = Object.keys(DIRS);

export const cellName = (cell) => `${"ABCDEF"[cell % SIZE]}${Math.floor(cell / SIZE) + 1}`;

function step(cell, dir) {
  const d = DIRS[dir];
  const r = Math.floor(cell / SIZE) + d.dr;
  const c = (cell % SIZE) + d.dc;
  return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? -1 : r * SIZE + c;
}

// Randomised depth-first carving: a perfect maze.
function carve(rng) {
  const open = Array(CELLS).fill(0);
  const stack = [rng.int(0, CELLS - 1)];
  const seen = new Set(stack);
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const next = rng.shuffle(DIR_KEYS).find((dir) => {
      const n = step(cell, dir);
      return n >= 0 && !seen.has(n);
    });
    if (!next) {
      stack.pop();
      continue;
    }
    const n = step(cell, next);
    open[cell] |= DIRS[next].bit;
    open[n] |= DIRS[next].back;
    seen.add(n);
    stack.push(n);
  }
  return open;
}

// Distances from `from` through open passages.
export function distances(open, from) {
  const dist = Array(CELLS).fill(-1);
  dist[from] = 0;
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift();
    for (const dir of DIR_KEYS) {
      if (!(open[cell] & DIRS[dir].bit)) continue;
      const n = step(cell, dir);
      if (n >= 0 && dist[n] < 0) {
        dist[n] = dist[cell] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

// Every (dot, target) pair with the right path length, avoiding markers.
function startPairs(maze, [min, max]) {
  const pairs = [];
  for (let a = 0; a < CELLS; a++) {
    if (maze.markers.includes(a)) continue;
    const dist = distances(maze.open, a);
    for (let z = 0; z < CELLS; z++) {
      if (z !== a && !maze.markers.includes(z) && dist[z] >= min && dist[z] <= max) pairs.push([a, z]);
    }
  }
  return pairs;
}

const markerKey = (m) => [...m].sort((x, y) => x - y).join("-");

export default {
  id: "maze",
  name: "Maze",
  icon: "maze",
  weight: 1,

  params(rng, difficulty = "easy") {
    const [min, max] = STEPS[difficulty] ?? STEPS.easy;
    return { min, max };
  },

  generateRules(seed, params = { min: 6, max: 9 }) {
    const rng = makeRng(seed);
    const mazes = [];
    const used = new Set();
    while (mazes.length < LAYOUTS) {
      const open = carve(rng);
      const markers = rng.sample([...Array(CELLS).keys()], 2).sort((x, y) => x - y);
      if (used.has(markerKey(markers))) continue;
      const maze = { open, markers };
      if (!startPairs(maze, [params.min, params.max]).length) continue; // no fitting start: carve again
      used.add(markerKey(markers));
      mazes.push(maze);
    }
    return { mazes };
  },

  createInstance(rng, rules, params) {
    const layout = rng.int(0, LAYOUTS - 1);
    const [pos, target] = rng.pick(startPairs(rules.mazes[layout], [params.min, params.max]));
    // The markers are copied in: they're what the Defuser sees (the walls
    // stay in the rules).
    return { layout, markers: [...rules.mazes[layout].markers], pos, target };
  },

  // The next step along the one path to the target.
  solve(rules, state) {
    const maze = rules.mazes[state.layout];
    const dist = distances(maze.open, state.target);
    const dir = DIR_KEYS.find((d) => maze.open[state.pos] & DIRS[d].bit && dist[step(state.pos, d)] === dist[state.pos] - 1);
    return { kind: "move", dir };
  },

  act(rules, state, a) {
    if (a.kind !== "move" || !DIRS[a.dir]) return { valid: false };
    const maze = rules.mazes[state.layout];
    if (!(maze.open[state.pos] & DIRS[a.dir].bit)) return { valid: true, strike: true }; // a wall (or the edge)
    state.pos = step(state.pos, a.dir);
    return { valid: true, solved: state.pos === state.target };
  },

  // Free moves exist (any open way is allowed); the step that counts is
  // the one that gets closer to the target.
  progress(rules, before, after) {
    const dist = distances(rules.mazes[before.layout].open, before.target);
    return dist[after.pos] < dist[before.pos];
  },

  candidates() {
    return DIR_KEYS.map((dir) => ({ kind: "move", dir }));
  },

  describe(rules, before, a) {
    const want = this.solve(rules, before);
    return { did: [t(`Moved ${a.dir} from `), b(cellName(before.pos)), t(" into a wall")], expected: [t(`Move ${want.dir} from `), b(cellName(before.pos))] };
  },

  view(state) {
    return { markers: state.markers, pos: state.pos, target: state.target, size: SIZE };
  },

  renderManual(rules) {
    const lookup = rules.mazes
      .map((m, i) => ({ key: m.markers.map(cellName).join(" + "), n: i + 1, first: m.markers[0] }))
      .sort((x, y) => x.key.localeCompare(y.key));
    return {
      id: "maze",
      title: "Maze",
      icon: "maze",
      blocks: [
        {
          type: "note",
          parts: [
            t("Ask where the two "),
            b("circles"),
            t(" are (columns A-F, rows 1-6) and find the layout below. Guide the "),
            b("white dot"),
            t(" to the "),
            b("triangle"),
            t(" one step at a time. The Defuser can't see the walls: walking into one is a strike."),
          ],
        },
        { type: "table", columns: ["Circles at", "Layout"], rows: lookup.map((r) => [[t(r.key)], [b(String(r.n))]]) },
        ...rules.mazes.map((m, i) => ({ type: "maze", n: i + 1, size: SIZE, markers: m.markers, open: m.open })),
      ],
    };
  },
};
