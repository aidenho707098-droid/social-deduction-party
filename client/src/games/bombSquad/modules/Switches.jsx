import { useState } from 'react'
import { tapProps } from './tap'

// SWITCH BOARD: a row of five LEDs, five toggle switches under them, and
// LOCK. Flipping is free; only LOCK is judged. A flip says where the
// switch should END UP and shows it straight away (a repeat is a no-op on
// the server); LOCK sends the pattern on screen, and the server refuses it
// (no strike) if that isn't the pattern it has.
export default function Switches({ view, pending = 0, interactive, onAct }) {
  const [want, setWant] = useState({}) // switch -> where a flip still in flight puts it
  const shown = view.switches.map((up, i) => (pending > 0 && i in want ? want[i] : up))
  function flip(i) {
    const to = !shown[i]
    setWant((w) => ({ ...w, [i]: to }))
    onAct({ kind: 'toggle', switch: i, to })
  }
  return (
    <div className="bs-switches">
      <div className="bs-leds" aria-label={`LEDs: ${view.leds.map((on) => (on ? 'lit' : 'dark')).join(', ')}`}>
        {view.leds.map((on, i) => (
          <span key={i} className={`bs-led ${on ? 'bs-led-on' : ''}`} />
        ))}
      </div>
      <div className="bs-switch-row">
        {shown.map((up, i) => (
          <button
            key={i}
            type="button"
            className={`bs-switch ${up ? 'bs-switch-up' : ''}`}
            disabled={!interactive}
            {...tapProps(() => flip(i))}
            aria-label={`Switch ${i + 1}, ${up ? 'up' : 'down'}`}
            aria-pressed={up}
          >
            <span className="bs-switch-knob" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary bs-lock"
        disabled={!interactive}
        {...tapProps(() => onAct({ kind: 'lock', pattern: shown.map((up) => (up ? '1' : '0')).join('') }))}
      >
        Lock
      </button>
    </div>
  )
}
