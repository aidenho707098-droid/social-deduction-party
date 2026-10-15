// SWITCH BOARD: a row of five LEDs, five toggle switches under them, and
// LOCK. Flipping is free; only LOCK is judged.
export default function Switches({ view, interactive, onAct }) {
  return (
    <div className="bs-switches">
      <div className="bs-leds" aria-label={`LEDs: ${view.leds.map((on) => (on ? 'lit' : 'dark')).join(', ')}`}>
        {view.leds.map((on, i) => (
          <span key={i} className={`bs-led ${on ? 'bs-led-on' : ''}`} />
        ))}
      </div>
      <div className="bs-switch-row">
        {view.switches.map((up, i) => (
          <button
            key={i}
            type="button"
            className={`bs-switch ${up ? 'bs-switch-up' : ''}`}
            disabled={!interactive}
            onClick={() => onAct({ kind: 'toggle', switch: i })}
            aria-label={`Switch ${i + 1}, ${up ? 'up' : 'down'}`}
            aria-pressed={up}
          >
            <span className="bs-switch-knob" />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary bs-lock" disabled={!interactive} onClick={() => onAct({ kind: 'lock' })}>
        Lock
      </button>
    </div>
  )
}
