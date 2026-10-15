import { useRef, useState } from 'react'

// BUTTON: press and let go at once (tap), or keep holding and let go when
// the Expert says. The server judges both on its own clock: this only
// reports "pressed" and "let go".
export default function ButtonModule({ view, interactive, onAct }) {
  const [down, setDown] = useState(false)
  const pressed = useRef(false)

  function press(e) {
    if (!interactive || pressed.current) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pressed.current = true
    setDown(true)
    onAct({ kind: 'press' })
  }
  function release() {
    if (!pressed.current) return
    pressed.current = false
    setDown(false)
    onAct({ kind: 'release' })
  }

  const holding = down || view.held
  return (
    <div className="bs-button-mod">
      <button
        type="button"
        className={`bs-big-button bs-sw-${view.color} ${holding ? 'bs-big-button-down' : ''}`}
        disabled={!interactive}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${view.color} button labelled ${view.label}`}
      >
        <span className="bs-big-label">{view.label}</span>
      </button>
      <div className="bs-strip-wrap">
        <span className={`bs-strip bs-sw-${view.strip} ${holding ? 'bs-strip-lit' : ''}`} aria-hidden="true" />
        <span className="bs-strip-name">strip: {view.strip}</span>
        <span className="bs-strip-name">button: {view.color}</span>
      </div>
      {holding && <p className="bs-hold-note">Holding… let go when your Expert says.</p>}
    </div>
  )
}
