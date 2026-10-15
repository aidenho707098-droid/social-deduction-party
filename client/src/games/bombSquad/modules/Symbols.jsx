import { Glyph } from '../glyphs'

// SYMBOLS: four glyphs; tap them in the order the Expert gives. Tapped ones
// stay marked with their place in the order.
export default function Symbols({ view, interactive, onAct }) {
  return (
    <div className="bs-symbols">
      {view.shown.map((g) => {
        const n = view.tapped.indexOf(g)
        return (
          <button
            key={g}
            type="button"
            className={`bs-symbol ${n >= 0 ? 'bs-symbol-on' : ''}`}
            disabled={!interactive || n >= 0}
            onClick={() => onAct({ kind: 'tap', symbol: g })}
          >
            <Glyph id={g} size={40} />
            {n >= 0 && <span className="bs-symbol-n">{n + 1}</span>}
          </button>
        )
      })}
    </div>
  )
}
