// Seeded randomness: the same seed always builds the same manual variant
// and the same bomb, so a pair's rules can be regenerated (and tested) from
// one number.

// 32-bit FNV-1a, for turning a string seed into a number.
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: small, fast, good enough for game content.
export function makeRng(seed) {
  let a = (typeof seed === "number" ? seed : hashSeed(seed)) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)), // inclusive
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (list, n) => rng.shuffle(list).slice(0, n),
    chance: (p) => next() < p,
    seed: () => Math.floor(next() * 4294967296) >>> 0,
  };
  return rng;
}
