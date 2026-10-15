// The module plug-ins. The engine (../../bomb-squad.js) only ever talks to
// a module through this shape — adding one (Maze, Simon Lights …) means a
// new file here, one line below, and its Defuser UI on the client
// (client/src/games/bombSquad/modules/index.js). Nothing in the engine.
//
//   id, name, icon
//   params(rng)                      -> this round's size, the SAME for every pair
//   generateRules(seed, params)      -> the manual variant, as DATA
//   createInstance(rng, rules, params) -> one module's state
//   solve(rules, state, ctx)         -> the one valid next action
//   act(rules, state, action, ctx)   -> { valid, strike?, solved? }
//   view(state)                      -> what the Defuser / spectators see (never rules)
//   renderManual(rules, params)      -> the Expert's chapter, built ONLY from rules
//
// ctx = { serial, strikes, at, secondsAt(ms) } (see bomb-squad.js).
import wires from "./wires.js";
import symbols from "./symbols.js";
import button from "./button.js";
import memory from "./memory.js";
import switches from "./switches.js";
import maze from "./maze.js";
import simon from "./simon.js";

export const MODULES = Object.fromEntries([wires, symbols, button, memory, switches, maze, simon].map((m) => [m.id, m]));
export const MODULE_IDS = Object.keys(MODULES);
