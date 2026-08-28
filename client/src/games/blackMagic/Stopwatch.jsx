import { useEffect, useState } from 'react'

function format(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

// The server owns the round clock and pushes `elapsedMs` roughly once a
// second. We snap to each push and tick locally in between so the display
// stays smooth without drifting away from the authoritative value.
export default function Stopwatch({ elapsedMs, limitMs }) {
  const [shown, setShown] = useState(elapsedMs)
  const [syncedTo, setSyncedTo] = useState(elapsedMs)

  // Snap to the authoritative value whenever a fresh server push changes
  // it (React's "adjust state during render" pattern — no effect needed).
  if (elapsedMs !== syncedTo) {
    setSyncedTo(elapsedMs)
    setShown(elapsedMs)
  }

  useEffect(() => {
    const t = setInterval(() => {
      setShown((s) => Math.min(limitMs, s + 250))
    }, 250)
    return () => clearInterval(t)
  }, [limitMs])

  const pct = Math.max(0, Math.min(100, (shown / limitMs) * 100))
  const nearLimit = shown >= limitMs - 30_000

  return (
    <div className="bm-stopwatch-wrap">
      <div className={`bm-stopwatch ${nearLimit ? 'bm-stopwatch-near' : ''}`}>
        {format(shown)}
      </div>
      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${nearLimit ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">{format(limitMs)} limit</p>
    </div>
  )
}
