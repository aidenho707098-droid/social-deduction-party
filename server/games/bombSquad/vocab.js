// The shared vocabulary of every manual: colours, ordinals, the serial
// number and its "facts", and the rich-text PARTS a manual is built from.
//
// A manual is data: chapters of blocks whose text is a list of parts —
//   { t: "plain text" }   { b: "bold text" }   { c: "red" } (colour chip)
//   { d: "4" } (digit chip)   { g: 12 } (glyph)   { k: "hold" } (action chip)
// The client draws them; the solvability harness reads them back as text
// (flatten) and follows them literally. Nothing else describes a rule.

export const COLORS = ["red", "blue", "yellow", "white", "black", "green"];

export const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

// ---- the serial number ----------------------------------------------
// Six characters, letters and digits, always ending in a digit (so "the
// last digit" always exists). No I or O, so nothing reads as 1 or 0: the
// only vowels that can appear are A, E and U.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXZ";
export const VOWELS = ["A", "E", "U"];

export function makeSerial(rng) {
  for (;;) {
    const chars = [];
    for (let i = 0; i < 5; i++) chars.push(rng.chance(0.55) ? rng.pick(LETTERS) : String(rng.int(0, 9)));
    chars.push(String(rng.int(0, 9)));
    const letters = chars.filter((c) => /[A-Z]/.test(c)).length;
    if (letters >= 2 && letters <= 4) return chars.join("");
  }
}

export const lastDigit = (serial) => Number([...serial].reverse().find((c) => /\d/.test(c)));
export const letterCount = (serial) => [...serial].filter((c) => /[A-Z]/.test(c)).length;
export const hasVowel = (serial) => [...serial].some((c) => VOWELS.includes(c));

// Serial facts a rule can ask about. `text` is how the manual says it.
export const SERIAL_FACTS = {
  odd: { text: "the serial number's last digit is odd", test: (s) => lastDigit(s) % 2 === 1 },
  even: { text: "the serial number's last digit is even", test: (s) => lastDigit(s) % 2 === 0 },
  vowel: { text: "the serial number contains a vowel", test: (s) => hasVowel(s) },
  noVowel: { text: "the serial number has no vowel", test: (s) => !hasVowel(s) },
  letters3: { text: "the serial number has 3 or more letters", test: (s) => letterCount(s) >= 3 },
};
export const SERIAL_FACT_IDS = Object.keys(SERIAL_FACTS);

export const STRIKE_TEXT = "the bomb has at least one strike";

// ---- parts -----------------------------------------------------------
export const t = (text) => ({ t: text });
export const b = (text) => ({ b: text });
export const chip = (color) => ({ c: color });
export const digit = (n) => ({ d: String(n) });
export const glyph = (id) => ({ g: id });
export const action = (word) => ({ k: word });

// Parts -> one line of plain text, the way the harness reads a manual.
export function flatten(parts) {
  return parts
    .map((p) => {
      if ("t" in p) return p.t;
      if ("b" in p) return p.b;
      if ("c" in p) return `[${p.c}]`;
      if ("d" in p) return `<${p.d}>`;
      if ("g" in p) return `{g${p.g}}`;
      if ("k" in p) return `(${p.k})`;
      throw new Error(`unknown part ${JSON.stringify(p)}`);
    })
    .join("");
}

// The general page ("Read this first"): the conventions of THIS game only,
// the same for every pair and every round (never built from a seed — any
// variant-specific detail belongs in a module's chapter). The client shows
// it as a static alert.
export const GENERAL_LINES = [
  [b("Serial number"), t(": ask the Defuser. “Last digit” means the last digit in it (it always ends in one).")],
  [b("Positions"), t(" count from 1: left to right, and wires top to bottom.")],
  [t("Rules are checked "), b("in order"), t(": use the first one that applies.")],
  [t("Each "), b("strike"), t(" makes the fuse run 25% faster. Three strikes and it explodes.")],
  [t("Rules that mention strikes mean strikes "), b("right now"), t(": after a strike, check them again.")],
];

export function generalPage() {
  return {
    id: "general",
    title: "Read this first",
    icon: "general",
    static: true,
    blocks: [{ type: "rules", heading: null, items: GENERAL_LINES }],
  };
}

// Short ordinals for strike entries ("Cut the 3rd wire").
export const SHORT_ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

// A fuse time as the bomb shows it.
export const clock = (ms) => {
  const secs = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};
