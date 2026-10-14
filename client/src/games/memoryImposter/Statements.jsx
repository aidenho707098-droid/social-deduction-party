import { useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { MySequence, RoundLine, TimerBar } from './shared'
import { usePhaseClock } from './memoryData'

const IDEAS = [
  'How many times something repeats',
  'Compare the first and last',
  'Mention something that is NOT in it',
  'Where something sits (2nd, 3rd…)',
  'What comes right after something',
]

// STATEMENTS: one speaker at a time, in a random order. The speaker says
// ONE true thing out loud and taps Done; a timeout passes to exactly the
// next player (the server owns that; Done carries the turnId so a double
// tap can never skip anyone).
export default function Statements({ game, priv, players, myId, isHost, actions }) {
  const { play } = useSound()
  const t = game.turns
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const connected = new Set(players.filter((p) => p.connected).map((p) => p.id))
  const msLeft = usePhaseClock(game, t.turnId)
  const mine = t.speakerId === myId
  const [pending, setPending] = useState(null) // turnId we tapped Done on

  const lastTurn = useRef(null)
  useEffect(() => {
    if (lastTurn.current === t.turnId) return
    lastTurn.current = t.turnId
    if (mine) play('confirm')
  }, [t.turnId, mine, play])

  function done() {
    if (pending === t.turnId) return
    setPending(t.turnId)
    actions.memoryStatementDone(t.turnId)
  }

  const slot = t.index % t.order.length
  return (
    <div className="screen mi-statements">
      <RoundLine game={game} />
      <MySequence game={game} priv={priv} />

      <div className={`mi-speaker ${mine ? 'mi-speaker-me' : ''}`}>
        <p className="mi-speaker-kicker">
          Statements{t.passes > 1 ? ` · pass ${t.pass} of ${t.passes}` : ''}
        </p>
        <h1 className="mi-headline">
          {mine ? 'Your turn!' : `${nameById[t.speakerId] ?? 'Someone'} is speaking`}
        </h1>
        <p className="hint center-text">
          {mine
            ? 'Say ONE true thing about the sequence, out loud. Then tap Done.'
            : 'Listen closely. Does it match what you saw?'}
        </p>
        {!connected.has(t.speakerId) && !mine && (
          <p className="hint center-text">They're disconnected. Their turn runs out on its own.</p>
        )}
      </div>

      <TimerBar key={t.turnId} msLeft={msLeft} total={game.windowMs} />

      {mine && (
        <>
          <div className="mi-ideas" aria-label="Ideas">
            {IDEAS.map((idea) => (
              <span key={idea} className="mi-idea">
                {idea}
              </span>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={done} disabled={pending === t.turnId}>
            Done
          </button>
        </>
      )}
      {!mine && isHost && (
        <button type="button" className="btn btn-text" onClick={done} disabled={pending === t.turnId}>
          Skip {nameById[t.speakerId] ?? 'this'}'s turn
        </button>
      )}

      <ol className="mi-order" aria-label="Speaking order">
        {t.order.map((pid, i) => {
          const cls = i === slot ? 'mi-order-now' : i < slot ? 'mi-order-done' : ''
          return (
            <li key={pid} className={`mi-order-item ${cls}`}>
              <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
              {pid === myId ? 'You' : nameById[pid] ?? 'Player'}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
