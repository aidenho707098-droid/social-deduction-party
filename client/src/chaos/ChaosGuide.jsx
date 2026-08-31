import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHAOS_ICONS, CHAOS_MODIFIERS } from './chaosCopy'

// A tap-to-learn reference for Chaos modifiers, in the same spirit as the
// shared "How to Play" popup. Rendered as a small trigger (the active
// modifier's chip, or a bare "?") that opens a scrollable list of every
// modifier with a one-line description — so a player who's never seen
// "Kingbreaker" can look it up mid-game instead of guessing.
export default function ChaosGuide({ trigger, highlightId }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="chaos-guide-trigger"
        onClick={() => setOpen(true)}
        aria-label="What do Chaos Events do?"
      >
        {trigger ?? '?'}
      </button>
      {open &&
        createPortal(
          <GuideModal highlightId={highlightId} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}

function GuideModal({ highlightId, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Chaos Events reference"
    >
      <div className="modal-card chaos-guide-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">⚡ Chaos Events</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="modal-summary">
          When Chaos is on, a random modifier can warp any round. Here's the full deck.
        </p>
        <ul className="chaos-guide-list">
          {CHAOS_MODIFIERS.map((m) => (
            <li
              key={m.id}
              className={`chaos-guide-item ${m.id === highlightId ? 'chaos-guide-item-on' : ''}`}
            >
              <span className="chaos-guide-glyph">{CHAOS_ICONS[m.id] ?? '🎲'}</span>
              <span className="chaos-guide-text">
                <strong>{m.name}</strong>
                <span>{m.blurb}</span>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
