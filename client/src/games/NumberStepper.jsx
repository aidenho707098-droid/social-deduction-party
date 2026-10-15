// A compact −/+ counter for a numeric setup option (round count, etc.) —
// replaces a long row of individual number buttons. Shared across every
// game's Setup screen.
export default function NumberStepper({ label, ariaLabel, value, min, max, onChange, hint, step: by = 1, suffix = '' }) {
  const clamp = (n) => Math.min(max, Math.max(min, n))
  const step = (delta) => onChange(clamp(value + delta * by))

  return (
    <div className="stepper-block">
      {label && <span className="label">{label}</span>}
      <div className="stepper" role="group" aria-label={ariaLabel ?? label ?? 'Amount'}>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label="Decrease"
        >
          −
        </button>
        <span className="stepper-value" aria-live="polite">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label="Increase"
        >
          +
        </button>
      </div>
      {hint && <p className="hint hint-block">{hint}</p>}
    </div>
  )
}
