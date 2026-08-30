import { useEffect, useRef, useState } from 'react'

// Escalating hints for Players during an active round. The server unlocks
// tiers on its own clock (~1min category, ~2.5min subcategory, ~4min a
// vague Curse-specific clue) and ships the revealed set in public state as
// `game.hints`; we just render them and briefly flash the newest one as it
// lands so nobody misses it. Rendered only on Players' screens, never The
// Witch's — see ActiveRound.
export default function HintFeed({ hints = [] }) {
  const [flashLevel, setFlashLevel] = useState(null)
  // Start from the count already on screen so a mid-round join / refresh
  // doesn't flash hints the player has effectively already had.
  const seenCount = useRef(hints.length)

  useEffect(() => {
    if (hints.length > seenCount.current) {
      const newest = hints[hints.length - 1]
      seenCount.current = hints.length
      setFlashLevel(newest.level)
      const t = setTimeout(() => setFlashLevel(null), 3000)
      return () => clearTimeout(t)
    }
    seenCount.current = hints.length
  }, [hints])

  return (
    <div className="bm-hint-feed" aria-live="polite">
      <span className="bm-hint-feed-label">Hints</span>

      {hints.length === 0 ? (
        <p className="bm-hint-waiting">
          The first hint appears about a minute in, then more as the round
          goes on.
        </p>
      ) : (
        <ul className="bm-hint-list">
          {hints.map((h) => (
            <li
              key={h.level}
              className={`bm-hint-item bm-hint-item-l${h.level}${
                flashLevel === h.level ? ' bm-hint-item-new' : ''
              }`}
            >
              <span className="bm-hint-tier">{h.label}</span>
              <span className="bm-hint-text">{h.text}</span>
              {flashLevel === h.level && (
                <span className="bm-hint-badge">New hint</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
