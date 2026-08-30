import { useEffect, useState } from 'react'

// The visual scale bar shared by every Wavelength screen: a gradient track
// with the two pole labels, plus optional markers.
//
//   target   — a number; drawn as a needle/pin. With `animate` it glides in
//              from the centre to its spot on the first paint (reveal).
//   pick     — a number; a hollow "your current guess" marker (guess input).
//   guesses  — [{ id, value, color, label }]; dots that fade + drop into
//              place with a stagger (reveal).
//   blurred  — render the track only, poles hidden ("?") — used while the
//              Clue-Giver is still writing and guessers know nothing yet.
export default function Spectrum({
  min,
  max,
  poleA,
  poleB,
  target = null,
  pick = null,
  guesses = [],
  animate = false,
  blurred = false,
}) {
  const [shown, setShown] = useState(!animate)

  useEffect(() => {
    if (!animate) return undefined
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [animate])

  const span = Math.max(1, (max ?? 1) - (min ?? 0))
  const pct = (n) => {
    if (n == null) return 50
    return Math.max(0, Math.min(100, ((n - min) / span) * 100))
  }

  const targetPos = animate ? (shown ? pct(target) : 50) : pct(target)

  return (
    <div className="wv-spectrum">
      <div className="wv-poles">
        <span className="wv-pole wv-pole-a">{blurred ? '?' : poleA}</span>
        <span className="wv-pole wv-pole-b">{blurred ? '?' : poleB}</span>
      </div>

      <div className={`wv-track ${blurred ? 'wv-track-blur' : ''}`}>
        {pick != null && (
          <div className="wv-pick" style={{ left: `${pct(pick)}%` }} aria-hidden="true" />
        )}

        {guesses.map((g, i) => (
          <div
            key={g.id ?? i}
            className={`wv-guess-marker wv-guess-${g.cls ?? 'miss'}`}
            style={{
              left: `${pct(g.value)}%`,
              opacity: shown ? 1 : 0,
              transform: shown ? 'translate(-50%, 0)' : 'translate(-50%, -10px)',
              transitionDelay: `${0.15 + i * 0.07}s`,
              background: g.color || 'var(--muted)',
            }}
            title={g.label}
          >
            <span className="wv-guess-label">{g.label}</span>
          </div>
        ))}

        {target != null && (
          <div
            className="wv-needle"
            style={{
              left: `${targetPos}%`,
              transition: animate
                ? 'left .55s cubic-bezier(.34, 1.4, .5, 1)'
                : 'none',
            }}
          >
            <span className="wv-needle-value">{target}</span>
          </div>
        )}
      </div>
    </div>
  )
}
