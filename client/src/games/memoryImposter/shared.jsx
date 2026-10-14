import { SequenceStrip } from './items'
import { TYPE_LABELS, seconds } from './memoryData'

// A plain timer bar (Countdown Chaos hides `.wyr-timer` + the line after it).
export function TimerBar({ msLeft, total, label }) {
  const frac = total ? Math.max(0, Math.min(1, msLeft / total)) : 0
  return (
    <>
      <div className="wyr-timer">
        <div className={`wyr-timer-fill ${frac < 0.3 ? 'low' : ''}`} style={{ width: `${frac * 100}%` }} />
      </div>
      <p className="hint center-text mi-timer-text">
        {label ? `${label} · ` : ''}
        {Math.ceil(msLeft / 1000)}s
      </p>
    </>
  )
}

// "Round 3 of 6" over "Colors · 8 items, 15s" — the round's type and
// difficulty on their own line, so the header stays clear of the step badge.
export function RoundLine({ game, detail = true }) {
  return (
    <p className="wyr-round mi-round">
      Round {game.roundIndex + 1} of {game.totalRounds}
      {detail && game.roundType && (
        <span className="mi-round-detail">
          {TYPE_LABELS[game.roundType]} · {game.length} items, {seconds(game.viewMs)}
          {game.speed && <span className="mi-speed"> · Speed Round</span>}
        </span>
      )}
    </p>
  )
}

// The strip pinned at the top for the rest of the round: the sequence for
// a Witness, the same-size blanks for the Imposter.
export function MySequence({ game, priv }) {
  const items = priv?.role === 'witness' ? priv.sequence : null
  return (
    <div className="mi-mine">
      <SequenceStrip items={items ?? null} length={game.length} size="sm" />
      <p className="mi-mine-label">
        {priv?.role === 'imposter' ? "You're the Imposter · bluff" : 'Your sequence · keep it private'}
      </p>
    </div>
  )
}

// The memorize countdown ring. Countdown Chaos hides its progress + count.
export function Ring({ frac, children }) {
  const R = 54
  const C = 2 * Math.PI * R
  return (
    <div className="mi-ring">
      <svg viewBox="0 0 120 120" className="mi-ring-svg" aria-hidden="true">
        <circle cx="60" cy="60" r={R} className="mi-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className="mi-ring-progress"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
        />
      </svg>
      <span className="mi-ring-count">{children}</span>
    </div>
  )
}
