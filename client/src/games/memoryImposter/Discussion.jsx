import { HINTS, usePhaseClock } from './memoryData'
import { MySequence, RoundLine, TimerBar } from './shared'

// DISCUSSION: one shared clock, everyone talks freely out loud. No turns,
// no per-player buttons; the app judges nothing. The host can skip to the
// vote (plus the usual host controls).
export default function Discussion({ game, priv, isHost, actions }) {
  const msLeft = usePhaseClock(game)
  return (
    <div className="screen mi-discussion">
      <RoundLine game={game} />
      <MySequence game={game} priv={priv} />
      <h1 className="mi-headline">Talk it out</h1>
      <TimerBar msLeft={msLeft} total={game.windowMs} label="Vote opens in" />
      <div className="mi-hint-card">
        <p className="mi-hint-title">Make claims or ask about a position, out loud:</p>
        {(HINTS[game.roundType] ?? HINTS.digits).map((line) => (
          <p key={line} className="mi-hint-line">
            {line}
          </p>
        ))}
      </div>
      {isHost && (
        <button type="button" className="btn btn-secondary" onClick={() => actions.memoryHost('skip')}>
          Skip to vote →
        </button>
      )}
    </div>
  )
}
