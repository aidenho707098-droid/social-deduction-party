// Word Heist's on-screen keyboard: QWERTY, Enter and Backspace. Plain data
// (no React), so server/word-heist.selftest.mjs checks it against the
// server's own keyStates (server/games/wordHeistRules.js).

export const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

// Each letter's best-known state across every guess so far: green ("g")
// beats yellow ("y") beats grey ("x").
export function keyStates(guesses) {
  const rank = { x: 1, y: 2, g: 3 }
  const out = {}
  for (const { guess, pattern } of guesses ?? []) {
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i]
      const st = pattern[i]
      if (!out[ch] || rank[st] > rank[out[ch]]) out[ch] = st
    }
  }
  return out
}

export const STATE_LABEL = { g: 'right spot', y: 'in the word, wrong spot', x: 'not in the word' }
