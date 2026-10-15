import { GLYPHS } from './glyphData'

// One glyph, drawn as a line icon (see glyphData.js).
export function Glyph({ id, size = 28, className = '' }) {
  const g = GLYPHS[id]
  if (!g) return null
  return (
    <svg
      className={`bs-glyph ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={g.name}
    >
      <path d={g.d} />
    </svg>
  )
}
