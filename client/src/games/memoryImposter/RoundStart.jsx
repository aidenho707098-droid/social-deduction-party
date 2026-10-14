import { useEffect, useRef } from 'react'
import { useSound } from '../../sound/SoundContext'
import { SequenceStrip } from './items'
import { RoundLine, Ring } from './shared'
import { usePhaseClock } from './memoryData'

function CancelledNote({ game, nameById }) {
  const ev = game.lastEvent
  if (ev?.type !== 'cancelled' || ev.serial !== game.roundSerial) return null
  const who = nameById[ev.playerId] ?? 'The Imposter'
  return (
    <p className="as-callout as-callout-coral">
      {who} left during the round, so it was cancelled with no points. Here's a fresh one, with a new Imposter.
    </p>
  )
}

// ROLE REVEAL (3s): private, nothing else. Waits for this deal's role.
export function RoleScreen({ game, priv, players }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  if (!priv) {
    return (
      <div className="screen center">
        <p className="hint">Dealing roles…</p>
      </div>
    )
  }
  const imposter = priv.role === 'imposter'
  return (
    <div className="screen center mi-roles">
      <RoundLine game={game} />
      <CancelledNote game={game} nameById={nameById} />
      <div className={`role-card mi-role-card ${imposter ? 'role-card-imposter' : 'role-card-crew'}`}>
        <div className="role-card-icon">{imposter ? '🎭' : '👁️'}</div>
        <h2>{imposter ? 'You are the Imposter' : 'You are a Witness'}</h2>
        <p>
          {imposter
            ? "You'll get one quick look at the sequence. After that, bluff like you can still see it."
            : "You'll see the sequence all round. Find the player who can't."}
        </p>
      </div>
    </div>
  )
}

// MEMORIZE. Witness and Imposter screens share one layout (the ring, the
// strip, the line under it), so a glance across the table doesn't give a
// role away. The Imposter's strip turns to blanks the moment their window
// ends locally, and the server stops sending it at the same deadline.
export function MemorizeScreen({ game, priv, players }) {
  const { play } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const msLeft = usePhaseClock(game)
  const total = game.viewMs ?? 1
  const imposter = priv?.role === 'imposter'
  const visible = Boolean(priv?.sequence) && (!imposter || msLeft > 0)

  // The last 3 seconds tick on EVERY phone (a sound only the Imposter's
  // phone made would give them away).
  const lastBeep = useRef(null)
  const sec = Math.ceil(msLeft / 1000)
  useEffect(() => {
    if (game.hold || sec > 3 || sec < 1 || lastBeep.current === sec) return
    lastBeep.current = sec
    play('potato-tick', { gain: 0.4 })
  }, [sec, game.hold, play])

  if (game.hold) {
    return (
      <div className="screen center mi-memorize">
        <RoundLine game={game} />
        <p className="as-callout">
          Waiting for {nameById[game.hold.playerId] ?? 'a player'} to reconnect…
        </p>
        <p className="hint center-text">
          If they don't come back soon, this round is cancelled and a new one is dealt.
        </p>
      </div>
    )
  }

  return (
    <div className="screen mi-memorize">
      <RoundLine game={game} />
      <CancelledNote game={game} nameById={nameById} />
      <h1 className="mi-headline">{imposter && !visible ? "It's gone." : 'Memorize it.'}</h1>
      <Ring frac={msLeft / total}>{visible ? sec : '·'}</Ring>
      <SequenceStrip type={game.sequenceType} items={visible ? priv.sequence : null} length={game.length} />
      <p className="mi-private-note">
        {imposter
          ? visible
            ? 'This disappears when the ring runs out. Then bluff.'
            : 'Bluff like you can still see it. Listen to what the others say.'
          : "Keep it private. Don't read it out loud."}
      </p>
    </div>
  )
}
