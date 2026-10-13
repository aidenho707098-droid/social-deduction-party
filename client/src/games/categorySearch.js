// Search + summary helpers for the shared category selector
// (CategorySelector.jsx). Matching reuses the answer checker's edit
// distance, so typos ("animls") and plurals find the right category.
import { editDistance } from './alphabetSoup/answerChecks.js'

function words(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const singular = (w) => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('es') ? w.slice(0, -2) : w.length > 2 && w.endsWith('s') ? w.slice(0, -1) : w)

// How well one typed token matches one word: 3 exact/plural, 2 prefix,
// 1 typo (same fuzzy distance rule answers use), 0 no match.
function tokenScore(token, word) {
  if (token === word || singular(token) === singular(word)) return 3
  if (token.length >= 2 && word.startsWith(token)) return 2
  if (token.length >= 4) {
    const tol = token.length >= 7 ? 2 : 1
    if (editDistance(token, word) <= tol) return 1
    if (editDistance(token, word.slice(0, token.length)) <= tol - (token.length < 7 ? 0 : 1) && word.length > token.length) return 1
  }
  return 0
}

// Every token must match a word in the name or tags; name hits rank higher.
export function searchCategories(items, query) {
  const tokens = words(query)
  if (!tokens.length) return []
  const scored = []
  for (const item of items) {
    const nameWords = words(item.label)
    const tagWords = item.tags.flatMap(words)
    let total = 0
    let ok = true
    for (const t of tokens) {
      const inName = Math.max(0, ...nameWords.map((w) => tokenScore(t, w)))
      const inTags = Math.max(0, ...tagWords.map((w) => tokenScore(t, w)))
      const best = Math.max(inName * 2, inTags)
      if (!best) {
        ok = false
        break
      }
      total += best
    }
    if (ok) scored.push({ item, total })
  }
  // Ties: the shorter name first ("Foods" before "Breakfast Foods").
  return scored
    .sort((a, b) => b.total - a.total || words(a.item.label).length - words(b.item.label).length || a.item.label.localeCompare(b.item.label))
    .map((s) => s.item)
}

export function sample(list, n) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

export function allOptions(bank, customCategories, isUnavailable) {
  return [
    ...bank.map((c) => ({ key: c.key, label: c.label, tags: c.tags ?? [], custom: false, unavailable: null })),
    ...customCategories.map((c) => ({
      key: c.key,
      label: c.name,
      tags: c.tags ?? [],
      custom: true,
      unverified: c.unverified,
      unavailable: isUnavailable?.(c) ?? null,
    })),
  ]
}

export function summarizeSelection(value, options) {
  const selectable = options.filter((o) => !o.unavailable)
  const chosen = selectable.filter((o) => value.includes(o.key))
  if (chosen.length === 0) return 'None selected'
  // "All" = the whole bank is selected (customs on top just add to the count).
  const bank = selectable.filter((o) => !o.custom)
  if (bank.length && bank.every((o) => value.includes(o.key))) return `All categories (${chosen.length})`
  if (chosen.length <= 2) return chosen.map((o) => o.label).join(', ')
  if (chosen.length <= 5) return `${chosen[0].label}, ${chosen[1].label}, +${chosen.length - 2}`
  return `${chosen.length} selected`
}

