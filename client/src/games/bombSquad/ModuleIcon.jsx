// Small line icons for each module (and the manual's general page), drawn
// like the game-menu icons: stroke only, 24x24.
const PATHS = {
  general: 'M6 4h9l3 3v13H6ZM9 10h6M9 14h6M9 18h3',
  wires: 'M4 7c5 0 5 4 10 4h6M4 12h16M4 17c5 0 5-4 10-4',
  symbols: 'M5 5h5v5H5ZM14 7.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 0 0-5 0M5 19l2.5-5 2.5 5ZM14 14l5 5M19 14l-5 5',
  button: 'M12 16a5 5 0 1 0 0-10a5 5 0 0 0 0 10ZM5 20h14',
  memory: 'M4 5h16v5H4ZM5 14h3v5H5ZM10.5 14h3v5h-3ZM16 14h3v5h-3Z',
  switches: 'M6 4v16M12 4v16M18 4v16M4 8h4M10 15h4M16 10h4',
  maze: 'M4 4h16v16H4ZM4 10h6M14 4v6h-4M10 14h10M14 14v6M8 14v6',
  simon: 'M12 4a3.5 3.5 0 1 1 0 .01M5 13.5h5v5H5ZM16.5 13l3 5.5h-6Z',
}

export function ModuleIcon({ id, size = 16 }) {
  return (
    <svg
      className="bs-mod-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[id] ?? PATHS.general} />
    </svg>
  )
}
