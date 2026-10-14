import { useEffect, useRef } from 'react'
import { useSound } from '../../sound/SoundContext'
import { SequenceStrip } from './items'
import { usePhaseClock } from './memoryData'
import { RoundLine, Ring } from './shared'

// MEMORIZE. Every phone renders exactly this, from public state plus a
// private payload that's identical for everyone (just the sequence) — no
// role exists on any client yet, so no screen can give one away. The only
// per-player input is the sequence itself, which is the same for all.
export default function Memorize({ game, priv, players }) {
  const { play } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const msLeft = usePhaseClock(game)
  const ready = (game.leadMsLeft ?? 0) <= 0 && !game.hold
  const visible = ready && Boolean(priv?.sequence) && msLeft > 0
  const sec = Math.ceil(msLeft / 1000)

  // The last 3 seconds tick on every phone alike.
  const lastBeep = useRef(null)
  useEffect(() => {
    if (!visible || sec > 3 || sec < 1 || lastBeep.current === sec) return
    lastBeep.current = sec
    play('potato-tick', { gain: 0.4 })
  }, [sec, visible, play])

  const ev = game.lastEvent
  const cancelled = ev?.type === 'cancelled' && ev.serial === game.roundSerial

  if (game.hold) {
    return (
      <div className="screen center mi-memorize">
        <RoundLine game={game} />
        <p className="as-callout">Waiting for {nameById[game.hold.playerId] ?? 'a player'} to reconnect…</p>
        <p className="hint center-text">The look is paused for everyone until they're back.</p>
      </div>
    )
  }

  return (
    <div className="screen mi-memorize">
      <RoundLine game={game} />
      {cancelled && (
        <p className="as-callout as-callout-coral">
          {nameById[ev.playerId] ?? 'A player'} left, so that round was cancelled with no points. Same round again,
          new sequence.
        </p>
      )}
      <h1 className="mi-headline">Memorize this</h1>
      <Ring frac={ready ? msLeft / (game.viewMs || 1) : 1}>{ready ? sec : '·'}</Ring>
      <SequenceStrip items={visible ? priv.sequence : null} length={game.length} />
      <p className="mi-private-note">Keep it private. Don't read it out loud.</p>
    </div>
  )
}
