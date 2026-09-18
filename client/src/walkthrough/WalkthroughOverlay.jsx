import { useState } from 'react'
import { createPortal } from 'react-dom'

// Full-screen, dismissible step carousel — shown automatically the first
// time a complex mode is selected in a session (see FirstTimeWalkthrough).
// Reuses the app's existing modal shell tokens (see .modal-overlay /
// .modal-card in index.css) rather than inventing a new dialog style.
export default function WalkthroughOverlay({ title, steps, onDone }) {
  const [i, setI] = useState(0)
  const last = i === steps.length - 1
  const step = steps[i]

  return createPortal(
    <div className="modal-overlay wt-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card wt-card">
        <div className="wt-head">
          <div className="wt-dots">
            {steps.map((_, idx) => (
              <span key={idx} className={`wt-dot ${idx === i ? 'wt-dot-active' : ''}`} />
            ))}
          </div>
          <button type="button" className="btn btn-text wt-skip" onClick={onDone}>
            Skip
          </button>
        </div>

        <div className="wt-step" key={i}>
          <div className="wt-icon">{step.icon}</div>
          <h2 className="wt-title">{step.title}</h2>
          <p className="wt-text">{step.text}</p>
        </div>

        <div className="wt-nav">
          {i > 0 ? (
            <button type="button" className="btn btn-text" onClick={() => setI(i - 1)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (last ? onDone() : setI(i + 1))}
          >
            {last ? "Let's go" : 'Next →'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
