// The number picker for a round: a slider along the scale. Used for every
// range size (0-10, 1-24, 1-60, 1-100 alike) and identically for the
// Clue-Giver's number view (`readOnly`, just showing the secret target)
// and every guesser's input.
export default function NumberInput({ min, max, value, onChange, readOnly = false }) {
  const mid = Math.round((min + max) / 2)

  return (
    <div className="wv-slider-wrap">
      <input
        type="range"
        className="wv-slider"
        min={min}
        max={max}
        step={1}
        value={value ?? mid}
        disabled={readOnly}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
      <div className="wv-slider-legend">
        <span>{min}</span>
        <span className="wv-slider-value">{value ?? mid}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
