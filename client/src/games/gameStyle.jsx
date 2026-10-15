// Per-game visual identity for the menu: a simple line-style icon housed in
// a circular colour-filled badge. The accent colour (violet / coral /
// mustard / light violet, cycling) comes from catalog.js by position.

// Line icons — stroke only, 24x24, no fills, one 2px stroke weight. Colour
// is inherited from the badge (`currentColor`); a badge may nudge the
// weight via CSS stroke-width (light violet runs slightly heavier).
const ICONS = {
  // Imposter — a watchful eye.
  imposter: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  // Majority Pick (id "would-you-rather") — a balance weighing two options.
  'would-you-rather': (
    <>
      <path d="M12 3.5v17" />
      <path d="M7 20.5h10" />
      <path d="M4.5 7.5h15" />
      <path d="M4.5 7.5 2 13.2a3 3 0 0 0 5 0Z" />
      <path d="M19.5 7.5 17 13.2a3 3 0 0 0 5 0Z" />
    </>
  ),
  // Emoji Movie Guess — a film clapperboard.
  'emoji-movie': (
    <>
      <rect x="3" y="9" width="18" height="11" rx="1.6" />
      <path d="M3.5 9 6 4.2h13.5L17 9" />
      <path d="m9 4.2-2 4.8" />
      <path d="m13.5 4.2-2 4.8" />
    </>
  ),
  // Fact or Fake — a speech bubble asking a question.
  fibbage: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M10 8.6a2 2 0 1 1 2.7 1.9c-.7.3-1.1.8-1.1 1.6" />
      <path d="M11.6 14.2h.01" />
    </>
  ),
  // Black Magic — a crystal ball on its stand.
  'black-magic': (
    <>
      <circle cx="12" cy="9.5" r="6" />
      <path d="M7 19.5h10" />
      <path d="M9 19.5c0-1.8 1.2-3 3-3s3 1.2 3 3" />
      <path d="m12 6.5.9 1.8 1.8.9-1.8.9-.9 1.8-.9-1.8-1.8-.9 1.8-.9Z" />
    </>
  ),
  // Wavelength — a gauge dial with a needle.
  wavelength: (
    <>
      <path d="M3 15a9 9 0 0 1 18 0" />
      <path d="M12 15 16 8" />
      <circle cx="12" cy="15" r="1.4" />
      <path d="M5.5 15h.01M18.5 15h.01M8 9.5h.01M16 9.5h.01" />
    </>
  ),
  // Taboo — a speech bubble with a "no" slash through it.
  taboo: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M18 4.5 6.5 16.5" />
    </>
  ),
  // Fake Artist — a paintbrush over a canvas corner.
  'fake-artist': (
    <>
      <path d="M4 4h10v7" />
      <path d="M4 4v13a1 1 0 0 0 1 1h6" />
      <path d="m14.5 14.5 4-4a1.8 1.8 0 0 1 2.5 2.5l-4 4-3 1Z" />
      <path d="m14.5 17.5-2.5 3.5" />
    </>
  ),
  // Who Am I? — a "Hello, my name is" sticker: header strip on top, a "?"
  // where the name should be.
  'who-am-i': (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.6" />
      <path d="M2.5 9.2h19" />
      <path d="M10.2 12.6a1.85 1.85 0 1 1 2.75 1.6c-.6.33-.95.75-.95 1.4v.15" />
      <path d="M12 17.6h.01" />
    </>
  ),
  // Alphabet Soup — a bowl with a letter tile floating above it.
  'alphabet-soup': (
    <>
      <path d="M3 12.5h18a9 7.5 0 0 1-18 0Z" />
      <path d="M8.5 20h7" />
      <rect x="8.8" y="3" width="6.4" height="6.4" rx="1.4" />
      <path d="m10.6 8 1.4-3.4L13.4 8" />
      <path d="M11.1 6.9h1.8" />
    </>
  ),
  // Hot Potato — a lumpy potato with a lit fuse.
  'hot-potato': (
    <>
      <path d="M12 7.5c4.6-.3 7.8 2.9 7.4 7-.4 4-3.9 6.2-7.6 6-4-.2-7-2.8-6.8-6.6.2-3.6 2.8-6.2 7-6.4Z" />
      <path d="M13.5 7.4c.6-2 1.8-3 3.4-3.4" />
      <path d="m18.4 2.2.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" />
      <path d="M9.6 13.4h.01M14.2 13.4h.01" />
    </>
  ),
  // Memory Imposter — a brain: two lobes split down the middle, a fold in each.
  'memory-imposter': (
    <>
      <path d="M12 5.2a3 3 0 0 0-5.4-1.2A3 3 0 0 0 4 7.8a3.2 3.2 0 0 0-.6 5.4A3.4 3.4 0 0 0 6.6 18a3 3 0 0 0 5.4 1.4Z" />
      <path d="M12 5.2a3 3 0 0 1 5.4-1.2A3 3 0 0 1 20 7.8a3.2 3.2 0 0 1 .6 5.4 3.4 3.4 0 0 1-3.2 4.8 3 3 0 0 1-5.4 1.4" />
      <path d="M12 5.2v14.2" />
      <path d="M7.4 9.4c1 .1 1.8.8 2 1.8M16.6 9.4c-1 .1-1.8.8-2 1.8M8 14.6c.9-.5 1.9-.4 2.6.3M16 14.6c-.9-.5-1.9-.4-2.6.3" />
    </>
  ),
  // Echo Chain — a 2x2 grid of rounded tiles, the top-right one lit.
  'echo-chain': (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
      <path d="M17 7h.01" strokeWidth="3.4" />
    </>
  ),
  // Word Heist — a padlock with a keyhole.
  'word-heist': (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2.2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="14.6" r="1.4" />
      <path d="M12 16v2" />
    </>
  ),
  // Bomb Squad — a round bomb with a short lit fuse.
  'bomb-squad': (
    <>
      <circle cx="10.5" cy="14" r="6.5" />
      <path d="M14.8 9.2 17 7" />
      <path d="M17 7c1-1 2.2-1 3 0" />
      <path d="M20.6 3.4v1.4M22 5h-1.4M19.2 3.8l.8.8" />
      <path d="M7.5 12.5a3 3 0 0 1 2-2" />
    </>
  ),
}

export function GameIcon({ id }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[id] ?? ICONS.imposter}
    </svg>
  )
}
