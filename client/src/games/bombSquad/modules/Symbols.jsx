import { Glyph } from '../glyphs'
import { tapProps } from './tap'

// SYMBOLS: four glyphs; tap them in the order the Expert gives. Tapped ones
// stay marked with their place in the order. Each tap says which place it
// is for (`index`: the server's count plus taps still in flight), so a
// quick run of taps is judged in order and a tap that crossed a strike in
// flight is refused, never judged as the next symbol.
export default function Symbols({ view, pending = 0, interactive, onAct }) {
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
            {...tapProps(() => onAct({ kind: 'tap', symbol: g, index: view.tapped.length + pending }))}
          >
            <Glyph id={g} size={40} />
            {n >= 0 && <span className="bs-symbol-n">{n + 1}</span>}
          </button>
        )
      })}
    </div>
  )
}
