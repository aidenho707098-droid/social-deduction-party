// How one sequence item looks, for each sequence type. Ids come from the
// server (server/games/memorySequence.js): digits "0"–"9", color ids, or
// the emoji themselves (Twemojify turns those into SVGs).
//
// Colors are colored SHAPES: every color has its own shape, so a player
// who can't tell red from green still tells a circle from a diamond.

import { COLOR_ITEMS, itemLabel } from './memoryData'

const SHAPES = {
  circle: <circle cx="12" cy="12" r="8.5" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  triangle: <path d="M12 3.2 21 19.6H3Z" />,
  diamond: <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" />,
  star: <path d="m12 2.8 2.75 5.9 6.45.75-4.78 4.4 1.28 6.37L12 17.02l-5.7 3.2 1.28-6.37L2.8 9.45l6.45-.75Z" />,
  hexagon: <path d="M7.2 3.7h9.6l4.8 8.3-4.8 8.3H7.2L2.4 12Z" />,
  heart: <path d="M12 20.4S3.2 15 3.2 8.9a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9c0 6.1-8.8 11.5-8.8 11.5Z" />,
  plus: <path d="M9 3.2h6v5.8h5.8v6H15v5.8H9V15H3.2V9H9Z" />,
}


// One item, drawn. `size` is the visual size in px.
export function ItemToken({ type, item, size = 32, className = '' }) {
  if (item == null) return <span className={`mi-token mi-token-none ${className}`}>—</span>
  if (typeof item === 'number') {
    return (
      <span className={`mi-token mi-token-num ${className}`} style={{ fontSize: size * 0.8 }}>
        {item}
      </span>
    )
  }
  if (type === 'colors') {
    const c = COLOR_ITEMS[item]
    return (
      <svg
        className={`mi-token mi-token-shape ${className}`}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label={c?.label ?? item}
      >
        <g fill={c?.hex ?? 'var(--muted)'} stroke="rgba(36, 31, 51, 0.55)" strokeWidth="1.1" strokeLinejoin="round">
          {SHAPES[c?.shape] ?? SHAPES.circle}
        </g>
      </svg>
    )
  }
  if (type === 'emoji') {
    return (
      <span className={`mi-token mi-token-emoji ${className}`} style={{ fontSize: size * 0.9 }} aria-label={item}>
        {item}
      </span>
    )
  }
  return (
    <span className={`mi-token mi-token-digit ${className}`} style={{ fontSize: size * 0.85 }}>
      {item}
    </span>
  )
}

// The sequence as a strip of cells. Without `items` it's the SAME strip of
// blank placeholders — same size, same layout — which is all the Imposter
// sees once their look is over.
export function SequenceStrip({ type, items, length, size = 'lg', className = '' }) {
  const n = items?.length ?? length ?? 0
  const cols = n <= 6 ? n : Math.ceil(n / 2)
  return (
    <div
      className={`mi-strip mi-strip-${size} ${items ? '' : 'mi-strip-blank'} ${className}`}
      style={{ '--mi-cols': cols }}
      aria-label={items ? `Sequence: ${items.map((x) => itemLabel(type, x)).join(', ')}` : 'Sequence hidden'}
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="mi-cell">
          {items ? <ItemToken type={type} item={items[i]} size={size === 'sm' ? 22 : 34} /> : null}
        </span>
      ))}
    </div>
  )
}

// A question's prompt with {item} drawn as a token.
export function Prompt({ question, type }) {
  const [before, after] = question.prompt.split('{item}')
  return (
    <p className="mi-prompt">
      {before}
      {after !== undefined && (
        <>
          <span className="mi-prompt-item">
            <ItemToken type={type} item={question.item} size={30} />
          </span>
          {after}
        </>
      )}
    </p>
  )
}
