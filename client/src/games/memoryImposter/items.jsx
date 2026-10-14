// How one sequence item looks. Every item fills the same tile size:
//   digits — a large numeral in neutral ink on a neutral tile
//   colors — a plain swatch (nothing drawn on it)
//   shapes — an SVG in ONE neutral colour, so only the shape matters
// No emoji and no icon fonts anywhere in this game.

import { COLORS, itemLabel } from './memoryData'

const SHAPES = {
  circle: <circle cx="12" cy="12" r="8.6" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  triangle: <path d="M12 3.4 21 19.4H3Z" />,
  star: <path d="m12 2.8 2.75 5.9 6.45.75-4.78 4.4 1.28 6.37L12 17.02l-5.7 3.2 1.28-6.37L2.8 9.45l6.45-.75Z" />,
  diamond: <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" />,
  heart: <path d="M12 20.4S3.2 15 3.2 8.9a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9c0 6.1-8.8 11.5-8.8 11.5Z" />,
}

// One tile's content (the tile itself is the cell around it).
export function ItemFace({ item }) {
  const kind = item.slice(0, 1)
  const value = item.slice(2)
  if (kind === 'c') {
    return <span className="mi-swatch" style={{ background: COLORS[value]?.hex }} role="img" aria-label={itemLabel(item)} />
  }
  if (kind === 's') {
    return (
      <svg className="mi-shape" viewBox="0 0 24 24" role="img" aria-label={itemLabel(item)}>
        {SHAPES[value]}
      </svg>
    )
  }
  return <span className="mi-digit">{value}</span>
}

// The sequence as a strip of uniform tiles. Without `items` it's the SAME
// strip of blank placeholders — same size, same layout — which is all the
// Imposter sees once the look is over.
export function SequenceStrip({ items, length, size = 'lg', className = '' }) {
  const n = items?.length ?? length ?? 0
  const cols = n <= 6 ? n : Math.ceil(n / 2)
  return (
    <div
      className={`mi-strip mi-strip-${size} ${items ? '' : 'mi-strip-blank'} ${className}`}
      style={{ '--mi-cols': cols }}
      aria-label={items ? `Sequence: ${items.map(itemLabel).join(', ')}` : 'Sequence hidden'}
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`mi-cell ${items?.[i]?.startsWith('c:') ? 'mi-cell-swatch' : ''}`}>
          {items ? <ItemFace item={items[i]} /> : null}
        </span>
      ))}
    </div>
  )
}
