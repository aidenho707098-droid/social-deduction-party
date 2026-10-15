// Word Heist's client-side constants. Mirrors server/games/wordHeistRules.js
// CONFIG (the authority) for the setup screen and the live letter counter;
// the timers themselves come down in the public game state.
export const ROUNDS = { min: 1, max: 8, dflt: 3 }
export const WORD = { min: 4, max: 8 }
export const HINT_AFTER_GUESS = 3

export const MODES = [
  { key: 'prompted', name: 'Prompted', meta: 'pick 1 of 2 prompts', description: 'Everyone picks one of two prompts, like “Name an instrument”. Your solver sees the prompt the whole time.' },
  { key: 'free', name: 'Free choice', meta: 'any word', description: 'Any word you like. Your solver gets a short category hint after their 3rd guess.' },
]
export const MODE_KEYS = MODES.map((m) => m.key)
export const modeName = (key) => MODES.find((m) => m.key === key)?.name ?? MODES[0].name

// Same shape rules as the server's structuralCheck: one word, letters only
// (accents, hyphens and apostrophes allowed and dropped), 4-8 letters.
export function stripDiacritics(s) {
  return String(s ?? '')
    .replace(/[ßæÆœŒøØ]/g, (c) => ({ ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ø: 'o', Ø: 'O' })[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function shapeOf(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const letters = stripDiacritics(text).toUpperCase().replace(/[^A-Z]/g, '').length
  let problem = null
  if (!text) problem = 'empty'
  else if (/\s/.test(text)) problem = 'One word only, no spaces.'
  else if (!/^[A-Za-z'’\-.]+$/.test(stripDiacritics(text))) problem = 'Letters only: no numbers or symbols.'
  else if (letters < WORD.min || letters > WORD.max) problem = `${WORD.min} to ${WORD.max} letters, please.`
  return { letters, ok: !problem, problem }
}

// This device's private payload for the CURRENT round, or null (a stale one
// from last round is never shown).
export function privateFor(game, myRole) {
  const p = myRole?.wordHeist
  return p && p.serial === game.serial ? p : null
}
