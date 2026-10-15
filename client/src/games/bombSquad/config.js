// Bomb Squad's client-side constants. Mirrors server/games/bombSquad/config.js
// (the authority) for the setup screen; the live numbers come down in the
// game state.
export const DIFFICULTIES = [
  { key: 'easy', name: 'Easy', modules: 2, fuseMs: 240_000 },
  { key: 'medium', name: 'Medium', modules: 3, fuseMs: 270_000 },
  { key: 'hard', name: 'Hard', modules: 4, fuseMs: 300_000 },
]
export const DIFFICULTY_KEYS = DIFFICULTIES.map((d) => d.key)
export const ROUNDS = { min: 1, max: 6, dflt: 2 }
export const difficultyOf = (key) => DIFFICULTIES.find((d) => d.key === key) ?? DIFFICULTIES[0]

export const fmtFuse = (ms) => {
  const secs = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// Colours used on wires, buttons, strips and LEDs — each with a pattern
// mark, so nobody has to rely on colour alone.
export const COLOR_STYLE = {
  red: { hex: '#d84a3a', mark: 'stripes' },
  blue: { hex: '#3b6fd8', mark: 'dots' },
  yellow: { hex: '#f0c419', mark: 'bars' },
  white: { hex: '#f6f3ec', mark: 'plain' },
  black: { hex: '#2a2730', mark: 'cross' },
  green: { hex: '#3e9b52', mark: 'waves' },
}

export const MODULE_NAMES = { wires: 'Wires', symbols: 'Symbols', button: 'Button', memory: 'Memory Display', switches: 'Switch Board', maze: 'Maze', simon: 'Simon Lights' }

export const PLAY_STYLES = [
  { key: 'turns', name: 'One at a time', meta: 'others watch + bet', description: 'Pairs take turns; everyone else watches the bomb live and bets on it.' },
  { key: 'together', name: 'All pairs at once', meta: 'every pair, one bomb each', description: 'Every pair plays its own bomb at the same time. Several pairs will be talking at once, so spread out.' },
]
export const PLAY_STYLE_KEYS = PLAY_STYLES.map((p) => p.key)
export const playStyleOf = (key) => PLAY_STYLES.find((p) => p.key === key) ?? PLAY_STYLES[0]

// This device's private payload for the CURRENT bomb, or null. ("All pairs
// at once": for this round — each player only ever gets their own bomb.)
export function privateFor(game, myRole) {
  const p = myRole?.bombSquad
  if (!p) return null
  if (game.style === 'together') return p.roundIndex === game.roundIndex ? p : null
  return game.turn && p.serial === game.turn.serial ? p : null
}
