// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'Defuse bombs in pairs. The DEFUSER sees the bomb but not the manual; the EXPERT has the manual but can’t see the bomb. Talk it down before the fuse runs out.',
  bullets: [
    'SIT APART: sit so you can’t see each other’s screens, and talk. Describing what you see is the whole game.',
    'TEAMS: players are paired at random (with an odd number, one team is a trio: one Defuser, two Experts who each hold half the manual). Roles swap every round.',
    'PLAY STYLE, one at a time: teams take turns. Each gets a briefing and 10 seconds to get ready (the Expert can start reading), then the fuse lights. Everyone else watches quietly and bets.',
    'PLAY STYLE, all pairs at once: every team plays its own bomb at the same time, after one shared 10-second get-ready. Several pairs will be talking at once, so spread out. Teams that finish wait for the rest; the round ranks every team.',
    'THE BOMB: a fuse timer, a six-character serial number, three strike lights and 2 to 4 modules. Solve every module to defuse it. A solved module lights green.',
    'STRIKES: a wrong action is a strike, and each one makes the fuse run 25% faster. Three strikes and it explodes.',
    'MODULES: Wires (cut the right one), Symbols (tap four symbols in order), Button (tap it, or hold it and let go on the right digit), Memory Display (five stages of picking the right button), Switch Board (set five switches and lock them in), Maze (guide a dot through walls only the Expert can see) and Simon Lights (press the translated colours of a flashing sequence). A bomb never has the same module twice.',
    'FAIR PLAY: every team in a round gets the same kinds of modules at the same size, but its own manual, so overhearing another team doesn’t help.',
    'WHAT WENT WRONG: when a bomb explodes, the result shows every strike in order (what was done, and what the manual said), and what was left if the fuse ran out.',
    'SCORING: a defused bomb gives each teammate 3 + 1 per module + up to 4 for time left (1 per 30 seconds), minus 1 per strike, at least 1. A bomb that explodes scores 0. In “one at a time”, spectators can bet Defused or Boom before each bomb: right bets score 1.',
    'If a Defuser or the only Expert disconnects, the fuse pauses until they’re back. If they don’t come back in time, that bomb is forfeit.',
  ],
}
