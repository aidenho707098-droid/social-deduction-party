// The ONE list of game metadata every game list reads: the host's game
// menu, the lobby's read-only catalogue, Tournament Mode's lineup builder
// and the Random Mode wheel (via its accent colours). Plain data only (no
// React), so server/catalog.selftest.mjs can import it and check the
// player limits against the server's game modules, which are the
// authority that actually enforces them.
//
// To add a game: one entry here (order = menu order, and drives the accent
// colour), its icon in gameStyle.jsx, and its Setup / Game / rules in
// registry.js.
//
// Fields:
//   minPlayers / maxPlayers — the range across ALL modes (maxPlayers null =
//     no cap beyond the room's own).
//   modes — only where a mode's minimum differs: { [options.mode]: { label,
//     minPlayers } }. The menu shows it ("2–10, Spoken 3+") and the setup
//     screen locks that mode below it.
//   tags — filter chips (see CHIP_LABELS): at least one, at most two.
//   isNew — shows the mustard NEW pill.

// Echo Chain's tier names (plain data, like this file).
import { TIERS as ECHO_TIERS } from './echoChain/tiers.js'

// The menu's filter chips, in order: key -> label. The ONE place to rename
// a chip (labels are single words). Shared by the host's game menu, the
// lobby catalogue, Tournament Mode's lineup builder and Surprise me (which
// picks from whichever chip is on).
export const CHIP_LABELS = {
  all: 'All',
  deduction: 'Deduction', // find the liar, work out the secret
  words: 'Words', // describe, list, spell
  brain: 'Brain', // guess, remember, think fast
  active: 'Active', // draw, shout, pass, talk it down together
}

export const FILTERS = Object.entries(CHIP_LABELS).map(([key, label]) => ({ key, label }))

export const CATALOG = [
  {
    id: 'imposter',
    name: 'Imposter',
    genre: 'social deduction',
    description: 'Everyone shares a secret word except the Imposter, who only knows the category. Talk around it and sniff out the faker.',
    minPlayers: 3,
    maxPlayers: null,
    tags: ['deduction'],
  },
  {
    id: 'would-you-rather',
    name: 'Majority Pick',
    genre: 'read the room',
    description: 'Everyone answers the same question in secret. You score by matching the crowd, not by picking your favourite.',
    minPlayers: 2,
    maxPlayers: null,
    tags: ['brain'],
  },
  {
    id: 'emoji-movie',
    name: 'Crack the Code',
    genre: 'emoji guessing',
    description: 'A title spelled out in emojis, revealed one at a time. Type it the moment you crack it: fewer emojis, more points.',
    minPlayers: 2,
    maxPlayers: null,
    tags: ['brain'],
  },
  {
    id: 'fibbage',
    name: 'Fact or Fake',
    genre: 'bluffing trivia',
    description: 'Fill the blank in an obscure true fact with a convincing fake, then spot the real answer among everyone’s lies.',
    minPlayers: 3,
    maxPlayers: null,
    tags: ['deduction', 'brain'],
  },
  {
    id: 'black-magic',
    name: 'Black Magic',
    genre: 'hidden behaviour',
    description: 'The Witch secretly follows a hidden behaviour rule. Chat with them, spot the pattern and say The Curse out loud first.',
    minPlayers: 2,
    maxPlayers: null,
    tags: ['deduction'],
  },
  {
    id: 'wavelength',
    name: 'Wavelength',
    genre: 'spectrum guessing',
    description: 'A clue points at a secret number on a scale like Quiet ↔ Loud. Guess where it lands: the closer, the more you score.',
    minPlayers: 2,
    maxPlayers: null,
    tags: ['brain'],
  },
  {
    id: 'taboo',
    name: 'Taboo',
    genre: 'describe & guess',
    description: 'Describe the secret word without saying any of the forbidden ones while everyone races to type it.',
    minPlayers: 2,
    maxPlayers: null,
    tags: ['words'],
  },
  {
    id: 'fake-artist',
    name: 'Fake Artist',
    genre: 'draw & deduce',
    description: 'Everyone adds one stroke to a shared drawing of a secret word. One artist is faking it. Vote them out.',
    minPlayers: 3,
    maxPlayers: null,
    tags: ['deduction', 'active'],
  },
  {
    id: 'who-am-i',
    name: 'Who Am I?',
    genre: 'yes/no deduction',
    description: 'Everyone can see your secret identity but you. Ask yes/no questions out loud until you can name yourself.',
    minPlayers: 2,
    maxPlayers: 10,
    tags: ['deduction', 'brain'],
    isNew: true,
  },
  {
    id: 'alphabet-soup',
    name: 'Alphabet Soup',
    genre: 'category & letter',
    description: 'A category and a letter. Name things that fit, typed against the clock or out loud with your lives on the line.',
    minPlayers: 2,
    maxPlayers: 10,
    modes: { spoken: { label: 'Spoken', minPlayers: 3 } },
    tags: ['words'],
    isNew: true,
  },
  {
    id: 'hot-potato',
    name: 'Hot Potato',
    genre: 'pass it on',
    description: 'Shout something that fits the category and pass the potato on before it blows up in your hands.',
    minPlayers: 3,
    maxPlayers: 10,
    tags: ['words', 'active'],
    isNew: true,
  },
  {
    id: 'memory-imposter',
    // Working title: every screen reads the name from here (and the server
    // module's `name`, which server/catalog.selftest.mjs keeps in sync).
    name: 'Memory Imposter',
    genre: 'memory & bluff',
    description: 'Everyone memorizes the same secret sequence, then one player loses theirs. Talk it out, spot the bluffer, and vote them out.',
    minPlayers: 3,
    maxPlayers: 10,
    tags: ['deduction', 'brain'],
    isNew: true,
  },
  {
    id: 'echo-chain',
    name: 'Echo Chain',
    genre: 'memory showdown',
    description: `Tap back the whole chain of tiles from memory, then add one more. Miss and lose a life. From ${ECHO_TIERS.recall.name} up to ${ECHO_TIERS.savant.name}, where a miss is never replayed.`,
    minPlayers: 2,
    maxPlayers: 10,
    tags: ['brain'],
    isNew: true,
  },
  {
    id: 'word-heist',
    // Working title: every screen reads the name from here (and the server's
    // wordHeistRules.js NAME, which server/catalog.selftest.mjs keeps in sync).
    name: 'Word Heist',
    genre: 'wordle duel',
    description: 'Everyone secretly sets one word, then cracks someone else’s, Wordle-style. Crack it fast to score, or set a word that stumps your solver.',
    minPlayers: 2,
    maxPlayers: 10,
    tags: ['words', 'brain'],
    isNew: true,
  },
  {
    id: 'bomb-squad',
    // Working title: every screen reads the name from here (and the server's
    // bombSquad/config.js NAME, which server/catalog.selftest.mjs keeps in sync).
    name: 'Bomb Squad',
    genre: 'talk it down',
    description: 'One of you sees the bomb, the other has the manual. Talk each other through the wires before the fuse runs out.',
    minPlayers: 2,
    maxPlayers: 10,
    tags: ['active'],
    isNew: true,
  },
]

// Badge accents, cycled by catalogue position: violet, coral, mustard,
// light violet.
export const ACCENTS = ['violet', 'coral', 'gold', 'lilac']

export function catalogEntry(id) {
  return CATALOG.find((g) => g.id === id)
}

export function accentOf(id) {
  const i = CATALOG.findIndex((g) => g.id === id)
  return ACCENTS[(i < 0 ? 0 : i) % ACCENTS.length]
}

// "2–10 players", "3+ players", "2–10 players, Spoken 3+".
export function playerRangeLabel(g) {
  const base = g.maxPlayers ? `${g.minPlayers}–${g.maxPlayers}` : `${g.minPlayers}+`
  const extra = Object.values(g.modes ?? {})
    .map((m) => `${m.label} ${m.minPlayers}+`)
    .join(', ')
  return `${base} players${extra ? `, ${extra}` : ''}`
}

// The compact form for menu tiles: "2–10", "3+", "2–10, Spoken 3+".
export function tileRangeLabel(g) {
  return playerRangeLabel(g).replace(' players', '')
}

// The minimum for one specific mode (options.mode), else the game-wide one.
export function minPlayersFor(g, mode) {
  return g.modes?.[mode]?.minPlayers ?? g.minPlayers
}

// Why `count` players can't play `g` (in `mode`, if given), or null if
// they can. Phrased for the greyed-out menu rows.
export function fitReason(g, count, mode) {
  const min = mode ? minPlayersFor(g, mode) : g.minPlayers
  if (count < min) return `needs ${min}+ players`
  if (g.maxPlayers && count > g.maxPlayers) return `max ${g.maxPlayers} players`
  return null
}

export function matchesFilter(g, filter) {
  return filter === 'all' || g.tags.includes(filter)
}

export function fits(g, count, mode) {
  return fitReason(g, count, mode) === null
}
