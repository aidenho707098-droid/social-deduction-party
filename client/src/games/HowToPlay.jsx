import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGame } from './registry'
import WalkthroughOverlay from '../walkthrough/WalkthroughOverlay'
import { WALKTHROUGHS } from '../walkthrough/content'

// Shared, reusable "How to Play" affordance. Drop it anywhere with a
// `gameId` and it renders a small trigger that opens a closable popup of
// that game's rules — pulled from the game's own `rules` (see each
// game folder's rules.js, wired through the registry).
//
// It's purely local UI: opening it never touches the server or other
// players. Any player can open it any time.
//
// variant:
//   'link' (default) — a small underlined text button, for setup screens
//   'fab'            — a floating "?" button, for use during a live game
//
// `walkthroughKey` (in a game): the popup also offers the game's guided
// walkthrough again — the only way to see it after its one automatic
// showing (walkthrough/FirstTimeWalkthrough.jsx).
export default function HowToPlay({ gameId, variant = 'link', label = 'How to Play', walkthroughKey = null }) {
  const [open, setOpen] = useState(false)
  const [tour, setTour] = useState(false)
  const wt = walkthroughKey ? WALKTHROUGHS[walkthroughKey] : null
  const game = getGame(gameId)
  if (!game?.rules) return null

  const iconOnly = variant === 'fab'
  const triggerClass = variant === 'fab' ? 'htp-fab' : 'htp-trigger'

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen(true)}
        aria-label={`How to play ${game.name}`}
        title={`How to play ${game.name}`}
      >
        {iconOnly ? '?' : label}
      </button>
      {open && createPortal(
        <RulesModal
          game={game}
          onClose={() => setOpen(false)}
          onWalkthrough={
            wt
              ? () => {
                  setOpen(false)
                  setTour(true)
                }
              : null
          }
        />,
        document.body
      )}
      {tour && wt && <WalkthroughOverlay title={wt.title} steps={wt.steps} onDone={() => setTour(false)} />}
    </>
  )
}

// The rules text itself (summary + bullets from the game's rules.js), shared
// by this popup and the game menu's sheet so it lives in exactly one place.
export function RulesBody({ rules }) {
  const { summary, bullets = [] } = rules
  return (
    <>
      <p className="modal-summary">{summary}</p>
      {bullets.length > 0 && (
        <ul className="modal-bullets">
          {bullets.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      )}
    </>
  )
}

export function RulesModal({ game, onClose, onWalkthrough = null }) {

  // Close on Escape, like a normal dialog.
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
      aria-label={`How to play ${game.name}`}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">How to play: {game.name}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <RulesBody rules={game.rules} />

        {onWalkthrough && (
          <button type="button" className="btn btn-text" onClick={onWalkthrough}>
            Show the walkthrough again
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
