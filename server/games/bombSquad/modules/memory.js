// MEMORY DISPLAY — five stages. Each shows a display number (1-4) and four
// buttons labelled 1-4 in a shuffled order. Press the right one to move on.
//
// Manual: for each stage, one instruction per display number: press by
// LABEL, by POSITION, or (from stage 2) look back at an earlier stage:
//   * POSITION memory ("the same position you pressed in stage two") on
//     every difficulty;
//   * LABEL memory ("the same label you pressed in stage two") on HARD only.
// Every variant of a difficulty has the same shape: stage 1 has four direct
// instructions; stages 2-5 have two direct + two that look back (Easy and
// Medium: two position look-backs; Hard: one position + one label). Only
// stages that already happened are referred to.
//
// A wrong press is a strike and starts over at stage 1 with a new display.
import { CONFIG } from "../config.js";
import { hashSeed, makeRng } from "../rng.js";
import { b, digit, t } from "../vocab.js";

const STAGES = CONFIG.memory.stages;
const STAGE_WORDS = ["one", "two", "three", "four", "five"];

function layout(seed) {
  const rng = makeRng(seed);
  return {
    displays: Array.from({ length: STAGES }, () => rng.int(1, 4)),
    buttons: Array.from({ length: STAGES }, () => rng.shuffle([1, 2, 3, 4])), // labels, left to right
  };
}

function instructionParts(ins) {
  if (ins.type === "label") return [t("press the button labelled "), digit(ins.n)];
  if (ins.type === "pos") return [t("press the button in position "), digit(ins.n)];
  if (ins.type === "sameLabel") return [t("press the button with the "), b("same label"), t(` you pressed in stage ${STAGE_WORDS[ins.stage]}`)];
  return [t("press the button in the "), b("same position"), t(` you pressed in stage ${STAGE_WORDS[ins.stage]}`)];
}

export default {
  id: "memory",
  name: "Memory Display",
  icon: "memory",
  weight: 1,

  // Label memory only on Hard.
  params(rng, difficulty) {
    return { stages: STAGES, labelMemory: difficulty === "hard" };
  },

  generateRules(seed, params = {}) {
    const rng = makeRng(seed);
    const lookBack = params.labelMemory ? ["sameLabel", "samePos"] : ["samePos", "samePos"];
    const stages = [];
    for (let s = 0; s < STAGES; s++) {
      const kinds = s === 0 ? ["label", "label", "pos", "pos"] : rng.shuffle([rng.pick(["label", "pos"]), rng.pick(["label", "pos"]), ...lookBack]);
      const byDisplay = rng.shuffle(kinds).map((type) =>
        type === "label" || type === "pos" ? { type, n: rng.int(1, 4) } : { type, stage: rng.int(0, s - 1) },
      );
      stages.push(byDisplay); // byDisplay[d - 1] = what to do when the display shows d
    }
    return { stages };
  },

  createInstance(rng) {
    const seed = rng.seed();
    return { seed, resets: 0, stage: 0, history: [], ...layout(seed) };
  },

  // The one button (by position, 0-3) to press now.
  solve(rules, state) {
    const ins = rules.stages[state.stage][state.displays[state.stage] - 1];
    const labels = state.buttons[state.stage];
    let position;
    if (ins.type === "label") position = labels.indexOf(ins.n);
    else if (ins.type === "pos") position = ins.n - 1;
    else if (ins.type === "sameLabel") position = labels.indexOf(state.history[ins.stage].label);
    else position = state.history[ins.stage].position;
    return { kind: "press", position };
  },

  act(rules, state, a) {
    if (a.kind !== "press" || !Number.isInteger(a.position) || a.position < 0 || a.position > 3) return { valid: false };
    const want = this.solve(rules, state);
    if (a.position !== want.position) {
      // Strike: back to stage 1 with a brand-new display.
      state.resets += 1;
      Object.assign(state, { stage: 0, history: [] }, layout(hashSeed(`${state.seed}:${state.resets}`)));
      return { valid: true, strike: true };
    }
    state.history.push({ label: state.buttons[state.stage][a.position], position: a.position });
    state.stage += 1;
    return { valid: true, solved: state.stage === STAGES };
  },

  describe(rules, before, a) {
    const want = this.solve(rules, before);
    const labels = before.buttons[before.stage];
    const btn = (p) => [t("position "), digit(p + 1), t(" (label "), digit(labels[p]), t(")")];
    return { did: [t(`Stage ${before.stage + 1}: pressed `), ...btn(a.position)], expected: [t("Press "), ...btn(want.position)] };
  },

  candidates() {
    return [0, 1, 2, 3].map((position) => ({ kind: "press", position }));
  },

  view(state) {
    const s = Math.min(state.stage, STAGES - 1);
    return { stage: state.stage, stages: STAGES, display: state.displays[s], labels: state.buttons[s] };
  },

  renderManual(rules) {
    return {
      id: "memory",
      title: "Memory Display",
      icon: "memory",
      blocks: [
        {
          type: "note",
          parts: [
            t("Five stages. Each shows a big "),
            b("display number"),
            t(" and four buttons. Positions are counted "),
            b("1 to 4 from the left"),
            t(". Remember each press (its label and position): later stages ask about them. A wrong press is a strike and starts over at stage one."),
          ],
        },
        ...rules.stages.map((byDisplay, s) => ({
          type: "rules",
          heading: `Stage ${STAGE_WORDS[s]}`,
          items: byDisplay.map((ins, d) => [t("If the display shows "), digit(d + 1), t(", "), ...instructionParts(ins), t(".")]),
        })),
      ],
    };
  },
};
