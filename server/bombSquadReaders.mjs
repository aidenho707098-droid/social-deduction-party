// Literal readers for Bomb Squad manuals: given ONLY the rendered manual
// (what an Expert's screen shows) and what the Defuser sees, work out the
// next action by reading the words. Used by the solvability harness and the
// network end-to-end test; deliberately independent of the module code.
import { ORDINALS, flatten } from "./games/bombSquad/vocab.js";

// ---- reading helpers (independent of the module code) -----------------
const json = (x) => JSON.stringify(x);
export const KNOWN = new Set(["t", "b", "c", "d", "g", "k"]);
export function checkParts(parts) {
  for (const p of parts) {
    const keys = Object.keys(p);
    if (keys.length !== 1 || !KNOWN.has(keys[0])) throw new Error(`bad part ${JSON.stringify(p)}`);
  }
  return flatten(parts);
}
export function renderOk(chapter) {
  if (!chapter.title || !Array.isArray(chapter.blocks) || !chapter.blocks.length) throw new Error("empty chapter");
  JSON.parse(JSON.stringify(chapter));
  for (const bl of chapter.blocks) {
    if (bl.type === "rules") bl.items.forEach(checkParts);
    else if (bl.type === "note") checkParts(bl.parts);
    else if (bl.type === "table") bl.rows.forEach((row) => row.forEach(checkParts));
    else if (bl.type === "glyphColumns") {
      if (!bl.columns.every((c) => c.every(Number.isInteger))) throw new Error("bad glyph column");
    } else throw new Error(`unknown block ${bl.type}`);
  }
}
export const lines = (chapter, heading) => chapter.blocks.find((bl) => bl.type === "rules" && bl.heading === heading).items.map(flatten);

// The reader's OWN understanding of serial phrases (not vocab's tests).
export function serialPhrase(phrase, serial) {
  const digits = [...serial].filter((c) => /\d/.test(c));
  const last = Number(digits.at(-1));
  const letters = [...serial].filter((c) => /[A-Z]/.test(c));
  const table = {
    "the serial number's last digit is odd": last % 2 === 1,
    "the serial number's last digit is even": last % 2 === 0,
    "the serial number contains a vowel": letters.some((c) => "AEU".includes(c)),
    "the serial number has no vowel": !letters.some((c) => "AEU".includes(c)),
    "the serial number has 3 or more letters": letters.length >= 3,
  };
  if (!(phrase in table)) throw new Error(`reader doesn't understand "${phrase}"`);
  return table[phrase];
}
const STRIKE = "the bomb has at least one strike";

// ---- literal readers ---------------------------------------------------
export const READERS = {
  wires(chapter, view, ctx) {
    const w = view.wires.map((x) => x.color);
    const n = (c) => w.filter((x) => x === c).length;
    const cond = (s) => {
      let m;
      if ((m = s.match(/^there are no \[(\w+)\] wires$/))) return n(m[1]) === 0;
      if ((m = s.match(/^there is more than one \[(\w+)\] wire$/))) return n(m[1]) > 1;
      if ((m = s.match(/^there is exactly one \[(\w+)\] wire$/))) return n(m[1]) === 1;
      if ((m = s.match(/^the last wire is \[(\w+)\]$/))) return w.at(-1) === m[1];
      if ((m = s.match(/^the first wire is \[(\w+)\]$/))) return w[0] === m[1];
      if ((m = s.match(new RegExp(`^${STRIKE} and there are no \\[(\\w+)\\] wires$`)))) return ctx.strikes >= 1 && n(m[1]) === 0;
      if ((m = s.match(/^(.+) and there is at least one \[(\w+)\] wire$/))) return serialPhrase(m[1], ctx.serial) && n(m[2]) >= 1;
      throw new Error(`wires reader can't parse "${s}"`);
    };
    const target = (s) => {
      let m;
      if ((m = s.match(/^last wire$/))) return w.length - 1;
      if ((m = s.match(/^(\w+) wire$/))) return ORDINALS.indexOf(m[1]);
      if ((m = s.match(/^first \[(\w+)\] wire$/))) return w.indexOf(m[1]);
      if ((m = s.match(/^last \[(\w+)\] wire$/))) return w.lastIndexOf(m[1]);
      throw new Error(`wires reader can't parse target "${s}"`);
    };
    for (const line of lines(chapter, `${w.length} wires`)) {
      let m;
      if ((m = line.match(/^If (.+), cut the (.+)\.$/)) && cond(m[1])) return [{ kind: "cut", wire: target(m[2]) }];
      if ((m = line.match(/^Otherwise, cut the (.+)\.$/))) return [{ kind: "cut", wire: target(m[1]) }];
    }
    throw new Error("wires: no rule applied");
  },

  symbols(chapter, view) {
    const cols = chapter.blocks.find((bl) => bl.type === "glyphColumns").columns;
    const hits = cols.filter((c) => view.shown.every((g) => c.includes(g)));
    if (hits.length !== 1) throw new Error(`symbols: ${hits.length} columns hold all four`);
    return hits[0].filter((g) => view.shown.includes(g) && !view.tapped.includes(g)).map((g) => ({ kind: "tap", symbol: g }));
  },

  button(chapter, view, ctx) {
    const cond = (s) => {
      let m;
      if ((m = s.match(/^the button is \[(\w+)\] and its label says (\w+)$/))) return view.color === m[1] && view.label === m[2];
      if ((m = s.match(new RegExp(`^${STRIKE} and the label says (\\w+)$`)))) return ctx.strikes >= 1 && view.label === m[1];
      if ((m = s.match(/^the label says (\w+)$/))) return view.label === m[1];
      if ((m = s.match(/^the strip is \[(\w+)\]$/))) return view.strip === m[1];
      if ((m = s.match(/^the button is \[(\w+)\] and (.+)$/))) return view.color === m[1] && serialPhrase(m[2], ctx.serial);
      if ((m = s.match(/^the button is \[(\w+)\]$/))) return view.color === m[1];
      throw new Error(`button reader can't parse "${s}"`);
    };
    let what = null;
    for (const line of lines(chapter, "Tap or hold?")) {
      let m;
      if ((m = line.match(/^If (.+), \((tap|hold)\) it\.$/)) && cond(m[1])) {
        what = m[2];
        break;
      }
      if ((m = line.match(/^Otherwise, \((tap|hold)\) it\.$/))) {
        what = m[1];
        break;
      }
    }
    if (what === "tap") return [{ kind: "tap" }];
    for (const line of lines(chapter, "Holding: when to let go")) {
      const m = line.match(/^If the strip is \[(\w+)\], let go when the seconds show a <(\d)>\.$/);
      if (m && m[1] === view.strip) return [{ kind: "hold", digit: Number(m[2]) }];
    }
    throw new Error("button: no release rule for the strip");
  },

  // Keeps its own memory of what was pressed (an Expert would), in `memo`.
  memory(chapter, view, ctx, memo = {}) {
    if (view.stage === 0 || !memo.history) memo.history = [];
    const words = ["one", "two", "three", "four", "five"];
    const line = lines(chapter, `Stage ${words[view.stage]}`).find((l) => l.startsWith(`If the display shows <${view.display}>, `));
    if (!line) throw new Error("memory: no line for this display");
    const what = line.replace(/^If the display shows <\d>, /, "");
    let m;
    let position;
    if ((m = what.match(/^press the button labelled <(\d)>\.$/))) position = view.labels.indexOf(Number(m[1]));
    else if ((m = what.match(/^press the button in position <(\d)>\.$/))) position = Number(m[1]) - 1;
    else if ((m = what.match(/^press the button with the same label you pressed in stage (\w+)\.$/))) position = view.labels.indexOf(memo.history[words.indexOf(m[1])].label);
    else if ((m = what.match(/^press the button in the same position you pressed in stage (\w+)\.$/))) position = memo.history[words.indexOf(m[1])].position;
    else throw new Error(`memory reader can't parse "${what}"`);
    memo.history[view.stage] = { label: view.labels[position], position };
    return [{ kind: "press", position }];
  },

  switches(chapter, view) {
    const table = chapter.blocks.find((bl) => bl.type === "table");
    const leds = view.leds.map((x) => (x ? "○" : "●")).join(" "); // ○ lit, ● dark
    const row = table.rows.find((r) => flatten(r[0]) === leds);
    if (!row) throw new Error("switches: no row for these LEDs");
    const want = flatten(row[1]).split(" ").map((c) => c === "▲");
    const i = view.switches.findIndex((on, k) => on !== want[k]);
    return [i < 0 ? { kind: "lock" } : { kind: "toggle", switch: i }];
  },

  // Reads the lookup table for the layout, then walks the drawn maze (the
  // walls are the Expert's picture: `open` per cell) toward the triangle.
  maze(chapter, view) {
    const name = (c) => `${"ABCDEF"[c % 6]}${Math.floor(c / 6) + 1}`;
    const key = [...view.markers].sort((x, y) => x - y).map(name).join(" + ");
    const table = chapter.blocks.find((bl) => bl.type === "table");
    const hits = table.rows.filter((r) => flatten(r[0]) === key);
    if (hits.length !== 1) throw new Error(`maze: ${hits.length} layouts for circles at ${key}`);
    const n = Number(flatten(hits[0][1]));
    const maze = chapter.blocks.find((bl) => bl.type === "maze" && bl.n === n);
    if (json(maze.markers) !== json([...view.markers].sort((x, y) => x - y))) throw new Error("maze: the drawing's markers don't match");
    const D = { up: [1, -6, 4], right: [2, 1, 8], down: [4, 6, 1], left: [8, -1, 2] };
    const okMove = (c, d) => maze.open[c] & D[d][0];
    // BFS from the target over the drawing.
    const dist = Array(36).fill(-1);
    dist[view.target] = 0;
    const q = [view.target];
    while (q.length) {
      const c = q.shift();
      for (const d of Object.keys(D)) if (okMove(c, d) && dist[c + D[d][1]] < 0) (dist[c + D[d][1]] = dist[c] + 1), q.push(c + D[d][1]);
    }
    const dir = Object.keys(D).find((d) => okMove(view.pos, d) && dist[view.pos + D[d][1]] === dist[view.pos] - 1);
    if (!dir) throw new Error("maze: no way forward in the drawing");
    return [{ kind: "move", dir }];
  },

  // Picks the row by the serial (vowel?) and the strikes, then translates.
  simon(chapter, view, ctx) {
    const table = chapter.blocks.find((bl) => bl.type === "table");
    const vowel = [...ctx.serial].some((c) => "AEU".includes(c)) ? "Yes" : "No";
    const strikes = ctx.strikes >= 2 ? "2 or more" : String(ctx.strikes);
    const rows = table.rows.filter((r) => flatten(r[0]) === vowel && flatten(r[1]) === strikes);
    if (rows.length !== 1) throw new Error(`simon: ${rows.length} rows match`);
    const map = Object.fromEntries(flatten(rows[0][2]).split(" · ").map((pair) => pair.match(/^\[(\w+)\] → \[(\w+)\]$/).slice(1)));
    return [{ kind: "press", color: map[view.flashes[view.progress]] }];
  },
};
