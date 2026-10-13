// The potato: a coral spud with a fuse and a flickering spark. `heat`
// (0..1) deepens its colour and quickens its pulse. Only a SPRINT potato
// ever passes a heat; a Hidden Fuse potato is drawn at a steady 0 so
// nothing on screen can hint at the secret fuse.

const COOL = [255, 122, 80] // --coral
const HOT = [194, 74, 36] // --coral-ink

function mix(heat) {
  const h = Math.max(0, Math.min(1, heat))
  return `rgb(${COOL.map((c, i) => Math.round(c + (HOT[i] - c) * h)).join(',')})`
}

export function Potato({ size = 120, heat = 0, pulse = true, label, className = '' }) {
  // 1.1s per beat when cool, down to 0.28s when red hot.
  const beat = 1.1 - 0.82 * Math.max(0, Math.min(1, heat))
  return (
    <span
      className={`hp-potato ${pulse ? 'hp-potato-pulse' : ''} ${className}`}
      style={{ '--hp-size': `${size}px`, '--hp-beat': `${beat.toFixed(2)}s`, '--hp-fill': mix(heat) }}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" className="hp-potato-svg">
        <path className="hp-fuse" d="M58 22 C 62 12, 70 10, 74 4" />
        <g className="hp-spark">
          <circle cx="75" cy="4" r="5" />
          <path d="M75 -4 v6 M75 6 v6 M67 4 h6 M77 4 h6" />
        </g>
        <path
          className="hp-body"
          d="M50 22 C 74 20, 90 38, 88 60 C 86 82, 66 94, 46 92 C 24 90, 10 76, 12 56 C 14 34, 30 23, 50 22 Z"
        />
        <ellipse className="hp-shine" cx="34" cy="42" rx="9" ry="5" transform="rotate(-30 34 42)" />
        <circle className="hp-eye" cx="40" cy="58" r="3.2" />
        <circle className="hp-eye" cx="60" cy="58" r="3.2" />
        <circle className="hp-spot" cx="70" cy="76" r="2.4" />
        <circle className="hp-spot" cx="28" cy="72" r="2" />
      </svg>
    </span>
  )
}

// A small potato used as the hopping token on the cycle strip.
export function PotatoToken() {
  return <Potato size={30} pulse={false} />
}
