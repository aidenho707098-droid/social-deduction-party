import { useCallback, useEffect, useRef, useState } from 'react'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import CycleStrip from '../hotPotato/CycleStrip'
import { useClock } from '../hotPotato/useClock'
import { buzz } from '../hotPotato/usePotatoSounds'
import EchoBoard from './EchoBoard'
import { noteKey } from './board'
import { tierOf } from './tiers'

const TAP_FLASH_MS = 280
// A wrong tap stays up longer, marked with a cross, so nobody takes it for
// part of the chain (in Savant it's the only thing a miss shows).
const WRONG_FLASH_MS = 900

// One screen for the whole game up to the results: the board never
// remounts, so flashes and notes carry across turns. What changes is the
// header, the status line and whether this phone's board takes taps.
//
//   countdown  3-2-1 over the board
//   echo/add   the ACTIVE player taps; everyone else watches the same taps
//              live (they arrive as one-off `echo_chain_tap` events)
//   miss       "Missed! [Name] loses a life" (Savant: "No replay. Remember it.")
//   replay     "Watch the chain": the correct chain flashes through once —
//              the only time the server ever sends it. Never in Savant.
//
// The app never shows the chain or hints at the next tile: the status line
// is a count, and taps are lit only as they happen.
export default function EchoPlay({ game, players, myId, isHost, actions }) {
  const { play, muted } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nm = (id) => nameById[id] ?? 'Someone'
  const size = game.size
  const tier = tierOf(game.difficulty)
  const L = game.chainLength
  const isTurnPhase = game.phase === 'echo' || game.phase === 'add'
  const amActive = isTurnPhase && game.activeId === myId
  const amOut = !(game.activeIds ?? []).includes(myId)
  const frozen = isTurnPhase && !!game.frozen

  // ---- flashes ------------------------------------------------------
  const [flashes, setFlashes] = useState({})
  const timers = useRef(new Set())
  const later = useCallback((ms, fn) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
    return t
  }, [])
  useEffect(() => {
    const set = timers.current
    return () => set.forEach(clearTimeout)
  }, [])

  const flash = useCallback(
    (tile, kind, ms) => {
      const id = `${tile}:${performance.now()}:${Math.random()}`
      setFlashes((f) => ({ ...f, [tile]: { id, kind, ms } }))
      later(ms, () =>
        setFlashes((f) => {
          if (f[tile]?.id !== id) return f
          const next = { ...f }
          delete next[tile]
          return next
        }),
      )
    },
    [later],
  )

  // ---- live taps from everyone else ----------------------------------
  useEffect(
    () =>
      actions.onEchoTap((ev) => {
        if (!ev || ev.playerId === myId) return // my own taps lit locally already
        flash(ev.tile, ev.kind, ev.kind === 'wrong' ? WRONG_FLASH_MS : TAP_FLASH_MS)
        play(noteKey(size, ev.tile))
      }),
    [actions, myId, flash, play, size],
  )

  // ---- my taps ------------------------------------------------------
  // Taps go straight to the server in order (it validates each one); the
  // count sent this turn only stops a tap after my ADD, and keeps the
  // status line in step with my finger instead of the network.
  const [sent, setSent] = useState({ turnId: game.turnId, n: 0 })
  const mine = sent.turnId === game.turnId ? sent : { turnId: game.turnId, n: 0 }
  const doneAdding = mine.n > L
  const canTap = amActive && !frozen && !doneAdding
  const [note, setNote] = useState('')

  function tap(tile) {
    if (!canTap) return
    flash(tile, 'mine', TAP_FLASH_MS)
    play(noteKey(size, tile))
    setNote('')
    const turnId = game.turnId
    setSent((s) => (s.turnId === turnId ? { ...s, n: s.n + 1 } : { turnId, n: 1 }))
    actions.echoTap(tile, turnId, (res) => {
      if (res?.ok && res.correct === false) flash(tile, 'wrong', WRONG_FLASH_MS)
      if (res && !res.ok && res.reason !== 'notActive' && res.reason !== 'closed' && res.message) setNote(res.message)
    })
  }

  // ---- the replay after a miss ---------------------------------------
  const replayKey = game.phase === 'replay' && game.replay ? `${game.turnId}:${game.miss?.playerId}` : null
  const [replayAt, setReplayAt] = useState(-1) // index of the tile flashing now
  useEffect(() => {
    if (!replayKey) return undefined
    const r = game.replay
    const pending = timers.current
    const scheduled = []
    r.tiles.forEach((tile, i) => {
      const at = r.msUntilStart + i * r.intervalMs
      if (at < 0) return // already past (joined mid-replay)
      scheduled.push(
        later(at, () => {
          flash(tile, 'replay', r.flashMs)
          play(noteKey(size, tile))
          setReplayAt(i)
        }),
      )
    })
    return () => {
      scheduled.forEach((t) => {
        clearTimeout(t)
        pending.delete(t)
      })
      setReplayAt(-1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey])

  // ---- clocks + cues ----------------------------------------------------
  const clockKey = `${game.phase}:${game.turnId}:${game.echoPos ?? ''}`
  const msLeft = useClock(game.msLeft ?? 0, clockKey, !frozen)
  const count = Math.max(1, Math.ceil(msLeft / 1000))

  const lastBeep = useRef(null)
  useEffect(() => {
    if (game.phase !== 'countdown' || lastBeep.current === count) return
    lastBeep.current = count
    play('potato-tick', { gain: 0.55 })
  }, [game.phase, count, play])

  const missKey = game.phase === 'miss' ? `${game.turnId}:${game.miss?.playerId}` : null
  useEffect(() => {
    if (missKey && game.miss?.playerId === myId) buzz([60, 40, 60], muted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missKey])

  // ---- copy ---------------------------------------------------------
  const up = game.activeId ?? game.activeIds?.[0]
  let header
  if (game.phase === 'countdown') header = up === myId ? 'You start' : `${nm(up)} starts`
  else if (isTurnPhase) {
    if (amActive) header = 'Your turn'
    else header = game.phase === 'add' ? `${nm(game.activeId)} is adding a tile` : `${nm(game.activeId)} is echoing`
  } else if (game.phase === 'miss' || game.phase === 'replay') {
    header = game.miss?.cause === 'left' ? `${nm(game.miss.playerId)} left` : 'Missed!'
  }

  let status = null
  if (game.phase === 'countdown') status = 'Get ready'
  else if (isTurnPhase && amActive) {
    const echoed = Math.min(L, Math.max(game.echoPos ?? 0, mine.n))
    if (L === 0) status = 'Start the chain: add one tile'
    else if (game.phase === 'add' || echoed >= L) status = doneAdding ? 'Added' : 'Now add one tile'
    else status = `Echo it: ${echoed + 1} of ${L}`
  } else if (isTurnPhase) status = `Chain: ${L}`

  const missLine = (() => {
    const m = game.miss
    if (!m) return null
    const who = m.playerId === myId ? 'You' : nm(m.playerId)
    if (m.cause === 'left') return `${who} left the game and ${m.playerId === myId ? 'are' : 'is'} out`
    if (m.eliminated) return `${who} ${m.playerId === myId ? 'are' : 'is'} out of lives`
    return `${who} ${m.playerId === myId ? 'lose' : 'loses'} a life`
  })()
  const missWhy = { timeout: 'Time ran out.', wrong: 'Wrong tile.', skipped: 'The host moved the game on.' }[game.miss?.cause]

  const ringFrac = game.turnMs ? Math.max(0, Math.min(1, msLeft / game.turnMs)) : 0

  return (
    <div className="screen ec-play">
      <div className="ec-head">
        <div className="ec-head-text">
          <h2 className="ec-title">{header}</h2>
          <p className="ec-round">
            Round {game.round} · {tier.name}
          </p>
        </div>
        {amActive && !frozen && (
          <TimerRing frac={ringFrac} label={`${Math.ceil(msLeft / 1000)}`} />
        )}
      </div>

      <div className="ec-status-row" aria-live="polite">
        {status && <p className={`ec-status ${amActive ? 'ec-status-me' : ''}`}>{status}</p>}
        {game.phase === 'replay' && (
          <p className="ec-replay-label" role="status">
            Watch the chain
            <span className="ec-replay-count">
              {replayAt >= 0 ? `${replayAt + 1} / ${game.replay?.tiles.length ?? L}` : `${L} tiles`}
            </span>
          </p>
        )}
        {amOut && game.phase !== 'countdown' && <span className="ec-out-pill">You&apos;re out · watching</span>}
      </div>

      <div className="ec-board-wrap">
        <EchoBoard size={size} interactive={canTap} flashes={flashes} onTap={tap} />

        {game.phase === 'countdown' && (
          <div className="ec-over ec-over-count" aria-live="assertive">
            <span key={count} className="hp-count">
              {count}
            </span>
          </div>
        )}
        {game.phase === 'miss' && (
          <div className={`ec-over ec-over-miss ${game.miss?.cause === 'wrong' ? 'ec-over-after-wrong' : ''}`} role="status">
            <p className="ec-miss-title">{game.miss?.cause === 'left' ? 'Out!' : 'Missed!'}</p>
            <p className="ec-miss-line">{missLine}</p>
            {missWhy && <p className="ec-miss-why">{missWhy}</p>}
            {game.replays === false && game.chainLength > 0 && (
              <p className="ec-miss-savant">No replay. Remember it.</p>
            )}
          </div>
        )}
        {frozen && (
          <div className="ec-over ec-over-wait" role="status">
            <p>
              Waiting for {nm(game.activeId)} to reconnect… Their turn is paused.
            </p>
          </div>
        )}
      </div>

      {note && <p className="hint center-text">{note}</p>}

      <div className="ec-strip">
        <CycleStrip
          cycle={game.cycle}
          activeIds={game.activeIds}
          removedIds={game.removedIds}
          holderId={isTurnPhase ? game.activeId : game.phase === 'countdown' ? up : null}
          nextId={isTurnPhase ? game.nextId : null}
          myId={myId}
          lives={game.lives}
          startLives={game.startLives}
          colorById={colorById}
          nameById={nameById}
          popId={game.phase === 'miss' ? game.miss?.playerId : null}
          showToken={false}
          ariaLabel="Turn order"
          activeLabel="their turn"
        />
      </div>

      {isHost && <EndEarly onEnd={actions.echoEnd} />}
    </div>
  )
}

function TimerRing({ frac, label }) {
  const R = 20
  const C = 2 * Math.PI * R
  return (
    <span className={`ec-ring ${frac < 0.3 ? 'ec-ring-low' : ''}`} role="timer" aria-label={`${label} seconds left`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={R} className="ec-ring-track" />
        <circle cx="24" cy="24" r={R} className="ec-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <span className="ec-ring-num">{label}</span>
    </span>
  )
}

// Host: stop here and go to the results (everyone still in shares the top
// place). Two taps, like the host panel's destructive actions — and the
// second only counts after a beat, so a quick double tap can't do both.
const CONFIRM_AFTER_MS = 400
function EndEarly({ onEnd }) {
  const [armedAt, setArmedAt] = useState(null)
  useEffect(() => {
    if (armedAt == null) return undefined
    const t = setTimeout(() => setArmedAt(null), 5000)
    return () => clearTimeout(t)
  }, [armedAt])
  const armed = armedAt != null
  return (
    <button
      type="button"
      className={`btn btn-text ec-end ${armed ? 'ec-end-armed' : ''}`}
      onClick={(e) => {
        if (!armed) setArmedAt(e.timeStamp)
        else if (e.timeStamp - armedAt >= CONFIRM_AFTER_MS) onEnd()
      }}
    >
      {armed ? 'Tap again to end the game here' : 'End the game here'}
    </button>
  )
}
