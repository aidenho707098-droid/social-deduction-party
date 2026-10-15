// The Symbols module's 24 original glyphs: simple line shapes that are easy
// to describe out loud ("the comb", "the tent with a pole") but not
// letters or icons people already know. The server only knows their ids
// (0-23); server/bomb-squad.selftest.mjs checks there are 24.
export const GLYPHS = [
  { name: 'comb', d: 'M5 6h14M7 6v11M11 6v11M15 6v11M19 6v11' },
  { name: 'ladder', d: 'M8 4v16M16 4v16M8 9h8M8 15h8' },
  { name: 'hook', d: 'M15 4v9a4 4 0 0 1-8 0v-1M15 4h-3' },
  { name: 'snail', d: 'M12 12a1 1 0 1 1 1 1M12 12m2 0a3 3 0 1 1-3-3a5 5 0 1 1-5 5' },
  { name: 'bow', d: 'M4 6l16 12V6L4 18Z' },
  { name: 'trident', d: 'M12 6v14M6 6v5a6 6 0 0 0 12 0V6' },
  { name: 'moon with dot', d: 'M15 4a8 8 0 1 0 0 16a6 6 0 1 1 0-16ZM17 12h.01' },
  { name: 'crossed ring', d: 'M18 12a6 6 0 1 1-12 0a6 6 0 0 1 12 0ZM4 20L20 4' },
  { name: 'zigzag', d: 'M3 8l4.5 8 4.5-8 4.5 8 4.5-8' },
  { name: 'key', d: 'M11 8a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM10 10l9 9M15 15l2-2M17.5 17.5l2-2' },
  { name: 'raindrop with tail', d: 'M12 4c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11ZM9 14l7 6' },
  { name: 'stairs', d: 'M4 20h5v-5h5v-5h5V5' },
  { name: 'tent with pole', d: 'M3 20L12 4l9 16M12 20v-7' },
  { name: 'hourglass', d: 'M7 4h10M7 20h10M8 4c0 6 8 8 8 16M16 4c0 6-8 8-8 16' },
  { name: 'antenna', d: 'M12 21V9M7 4l5 5 5-5M8 15h8' },
  { name: 'three bubbles', d: 'M10 8a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM20 8a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM15 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z' },
  { name: 'twisted ribbon', d: 'M8 4c8 4-8 12 0 16M16 4c-8 4 8 12 0 16' },
  { name: 'loop arrow', d: 'M6 19V9a5 5 0 0 1 10 0v5M13 11l3 3 3-3' },
  { name: 'gate', d: 'M6 4v16M18 4v16M6 9h12M6 18l12-9' },
  { name: 'brackets with dot', d: 'M9 4H6v16h3M15 4h3v16h-3M12 12h.01' },
  { name: 'wave on a line', d: 'M3 11c3-6 6 6 9 0s6 6 9 0M3 18h18' },
  { name: 'pin', d: 'M12 21v-9M16 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z' },
  { name: 'double arrow', d: 'M6 6l6 6-6 6M12 6l6 6-6 6' },
  { name: 'cut square', d: 'M5 5h14v14H5ZM5 19L19 5M8.5 8.5h.01' },
]
