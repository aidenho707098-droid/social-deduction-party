import { tapProps } from './tap'

// WIRES: tap a wire to cut it. Wires are numbered from the top, each with
// its colour's pattern mark (no colour-only information).
export default function Wires({ view, interactive, onAct }) {
  return (
    <ol className="bs-wires" aria-label="Wires, from the top">
      {view.wires.map((w, i) => (
        <li key={i}>
          <button
            type="button"
            className={`bs-wire ${w.cut ? 'bs-wire-cut' : ''}`}
            disabled={!interactive || w.cut}
            {...tapProps(() => onAct({ kind: 'cut', wire: i }))}
            aria-label={`Wire ${i + 1}, ${w.color}${w.cut ? ', cut' : ''}`}
          >
            <span className="bs-wire-n">{i + 1}</span>
            <span className={`bs-wire-line bs-sw-${w.color}`}>
              <span className="bs-wire-gap" />
            </span>
            <span className="bs-wire-name">{w.color}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
