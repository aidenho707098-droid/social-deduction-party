// MEMORY DISPLAY: a big display number, four labelled buttons (positions
// 1-4 from the left) and five stage lights.
export default function Memory({ view, interactive, onAct }) {
  return (
    <div className="bs-memory">
      <div className="bs-memory-top">
        <span className="bs-memory-display" aria-label={`Display shows ${view.display}`}>
          {view.display}
        </span>
        <span className="bs-memory-stages" aria-label={`Stage ${Math.min(view.stage + 1, view.stages)} of ${view.stages}`}>
          {Array.from({ length: view.stages }, (_, i) => (
            <span key={i} className={`bs-stage-light ${i < view.stage ? 'bs-stage-done' : ''}`} />
          ))}
        </span>
      </div>
      <div className="bs-memory-buttons">
        {view.labels.map((label, pos) => (
          <button
            key={pos}
            type="button"
            className="bs-memory-btn"
            disabled={!interactive}
            onClick={() => onAct({ kind: 'press', position: pos })}
            aria-label={`Position ${pos + 1}, labelled ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
