// Per-game visual identity for the menu: a simple line-style icon housed in
// a circular colour-filled badge. The accent colour (violet / coral /
// mustard, cycling) is chosen in GameMenu from the game's position.

// Line icons — stroke only, 24x24, no fills. Colour is inherited from the
// badge (`currentColor`).
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
}

export function GameIcon({ id }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[id] ?? ICONS.imposter}
    </svg>
  )
}
