// The category selection shared by Alphabet Soup and Hot Potato: ONE bank
// (alphabetSoupBank.js) plus this room's custom categories, the host's
// selection (a plain set of keys), and the per-game draw "bag".
//
// Selection: a list of keys — bank keys and/or custom keys ("custom:3").
// "All" is just what the client calls the set when it equals the whole bank.
// An old saved setting that used the retired "Random Category" option (or an
// empty list) means the whole bank.
//
// Draw: each draw is uniform over what's left of the selection this cycle —
// no repeats until the selection is used up, then a fresh cycle whose first
// draw is never the category just drawn (when more than one is selected).

import { CATEGORIES, CATEGORY_KEYS, RANDOM_CATEGORY } from "./alphabetSoupBank.js";

export const CUSTOM_PREFIX = "custom:";

// The 20 everyday letters a custom category falls back to when its letters
// couldn't be checked (no AI, or "Add anyway"): everything but Q U V X Y Z.
export const COMMON_LETTERS = "ABCDEFGHIJKLMNOPRSTW".split("");

const BANK_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// Bank + custom categories as one key -> category map, bank-shaped. Custom
// categories carry no anti-farming flags; their letters come from the AI
// (or the common-letters fallback). Hot Potato drops the narrow ones.
export function categoryMapFor(customCategories = [], { game } = {}) {
  const map = { ...BANK_MAP };
  for (const c of customCategories ?? []) {
    if (!c?.key || !c.name) continue;
    if (game === "hot-potato" && c.broad === false) continue;
    // Checked and no letter has 5+ answers: not playable in Alphabet Soup.
    if (game === "alphabet-soup" && Array.isArray(c.letters) && c.letters.length === 0) continue;
    map[c.key] = {
      key: c.key,
      name: c.name,
      letters: Array.isArray(c.letters) && c.letters.length ? [...c.letters] : [...COMMON_LETTERS],
      blockNumberedSequels: false,
      blockRepeatedLeadWord: false,
      custom: true,
    };
  }
  return map;
}

// The host's selection, resolved against `map`. Unknown keys are dropped;
// nothing usable (or the retired Random option) means the whole bank.
export function resolveSelection(asked, map) {
  const list = Array.isArray(asked) ? asked : [];
  if (list.length === 0 || list.includes(RANDOM_CATEGORY)) return [...CATEGORY_KEYS];
  const keys = [...new Set(list.filter((k) => k in map))];
  return keys.length ? keys : [...CATEGORY_KEYS];
}

// A per-game bag. `seen` = categories this room met in earlier games this
// session: the first cycle skips them while any unseen ones remain, so a run
// of games keeps moving through the bank.
export function newCategoryDeck(keys, seen = []) {
  const fresh = keys.filter((k) => !seen.includes(k));
  return { keys: [...keys], bag: new Set(fresh.length ? fresh : keys), last: null };
}

// The categories the next draw may take (all equally likely), given an
// `allowed` filter (Alphabet Soup: still has a usable letter). `refill` says
// the current cycle is spent and this draw starts a new one.
export function deckCandidates(deck, allowed = () => true) {
  const inBag = [...deck.bag].filter(allowed);
  if (inBag.length) return { keys: inBag, refill: false };
  const fresh = deck.keys.filter((k) => (deck.keys.length < 2 || k !== deck.last) && allowed(k));
  if (fresh.length) return { keys: fresh, refill: true };
  // Only the category just drawn is still usable: allowed, rather than
  // ending the game early.
  return { keys: deck.keys.filter(allowed), refill: true };
}

export function deckTake(deck, key, refill = false) {
  if (refill || !deck.bag.has(key)) deck.bag = new Set(deck.keys);
  deck.bag.delete(key);
  deck.last = key;
}
