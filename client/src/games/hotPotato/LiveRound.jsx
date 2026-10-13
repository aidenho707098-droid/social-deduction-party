import { useEffect, useRef, useState } from 'react'
import { playerColorMap } from '../../playerColors'
import { CategoryChip } from '../alphabetSoup/LetterTile'
import CycleStrip from './CycleStrip'
import { Potato } from './Potato'
import VoteOverlay from './VoteOverlay'
import { useClock } from './useClock'
import { usePotatoSounds } from './usePotatoSounds'

// The live potato. Two very different screens off one state:
//   HOLDER   — "Say one!", the big potato in its turn ring, Pass to X.
//   EVERYONE — "[Name] is up", how far away you are, the Challenge button.
// The vote overlay sits over both while a challenge is being decided.
//
// What each device may see of the clock:
//   * Sprint      — the public turn window (everyone: holder ring, others' bar).
//   * Hidden Fuse — ONLY the holder's private 5s cap, on the holder's phone.
//     Nobody gets a heat colour, a faster pulse or a tempo from it; the
//     secret fuse itself never reaches any client.

const EVENT_COPY = {
  overruled: (n) => `Challenge failed. ${n}'s answer stands`,
  skipped: (n) => `The host passed it on for ${n}`,
  left: (n) => `${n} left, so the potato moves on`,
}

function secondsLabel(ms) {
  return `${(ms / 1000).toFixed(2).replace(/\.?0+$/, '')}s`
}

export default function LiveRound({ game, players, myId, myRole, actions }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nm = (id) => (id === myId ? 'You' : nameById[id] ?? 'Player')

  const holderId = game.holderId
  const isHolder = holderId === myId
  const hidden = game.potatoKind === 'hidden'
  const priv = myRole?.hotPotato?.turnId === game.turnId ? myRole.hotPotato : null
  const running = !game.frozen

  // The clock this device is allowed to see (see header).
  const serverMs = hidden ? (isHolder ? priv?.capMsLeft : null) : game.msLeft
  const totalMs = hidden ? (isHolder ? priv?.capMs ?? null : null) : game.turnMs
  const msLeft = useClock(serverMs ?? 0, `${game.turnId}:${hidden ? (priv ? 'p' : '-') : 's'}`, running && serverMs != null)
  const msLeftRef = useRef(msLeft)
  useEffect(() => {
    msLeftRef.current = msLeft
  }, [msLeft])
  const frac = totalMs ? Math.max(0, Math.min(1, msLeft / totalMs)) : 1

  usePotatoSounds({ turnId: game.turnId, holderId, myId, running, msLeftRef, totalMs: serverMs != null ? totalMs : null })

  // Pass lock: 0.8s after the potato lands on you (the server enforces it
  // too — this just stops the button inviting a tap it would refuse).
  const [unlockedTurn, setUnlockedTurn] = useState(null)
  useEffect(() => {
    if (!isHolder) return undefined
    const t = setTimeout(() => setUnlockedTurn(game.turnId), game.passLockMs ?? 800)
    return () => clearTimeout(t)
  }, [isHolder, game.turnId, game.passLockMs])
  const locked = isHolder && unlockedTurn !== game.turnId

  const [pending, setPending] = useState(false)
  const [note, setNote] = useState('')
  const [seenTurn, setSeenTurn] = useState(game.turnId)
  if (seenTurn !== game.turnId) {
    setSeenTurn(game.turnId)
    setPending(false)
    setNote('')
  }

  // A short-lived banner for things that happened without an explosion.
  const [toast, setToast] = useState(null)
  const evKey = game.lastEvent ? `${game.lastEvent.type}:${game.lastEvent.turnId}` : null
  const seenEv = useRef(evKey)
  useEffect(() => {
    if (!evKey || seenEv.current === evKey) return undefined
    seenEv.current = evKey
    const text = EVENT_COPY[game.lastEvent.type]?.(nm(game.lastEvent.playerId))
    if (!text) return undefined
    setToast(text)
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evKey])

  function pass() {
    if (pending || locked || !running) return
    setPending(true)
    actions.hotPotatoPass(game.turnId, (res) => {
      if (!res?.ok) {
        setPending(false)
        if (res?.message && res.reason !== 'stale') setNote(res.message)
      }
    })
  }

  // ---- challenges (mirrors the server's canChallenge) ----
  const lp = game.lastPass
  const activeIds = game.activeIds ?? []
  const amActive = activeIds.includes(myId)
  const used = game.challengesUsed?.[myId] ?? 0
  const left = Math.max(0, (game.challengeLimit ?? 2) - used)
  const twoLeft = activeIds.length <= 2
  const mayChallenge =
    amActive && !!lp && lp.fromId !== myId && (!isHolder || twoLeft) && !game.vote
  const challengeOpen = mayChallenge && !lp.challenged && left > 0
  const [challenging, setChallenging] = useState(false)

  function challenge() {
    if (!challengeOpen || challenging) return
    setChallenging(true)
    actions.hotPotatoChallenge(lp.seq, (res) => {
      setChallenging(false)
      if (!res?.ok && res?.message) setNote(res.message)
    })
  }

  const challengeButton = amActive && lp && lp.fromId !== myId && (!isHolder || twoLeft) && (
    <div className="hp-challenge">
      <p className="hint center-text hp-last-pass">
        {lp.challenged ? 'Already challenged: ' : 'Last answer: '}
        <strong>{nm(lp.fromId)}</strong> → {nm(lp.toId)}
      </p>
      <button
        type="button"
        className="btn btn-secondary hp-challenge-btn"
        onClick={challenge}
        disabled={!challengeOpen || challenging}
      >
        ✋ Challenge that answer · {left} left
      </button>
    </div>
  )

  // How far the potato is from me, in passes along the active cycle.
  const away = (() => {
    const hi = activeIds.indexOf(holderId)
    const mi = activeIds.indexOf(myId)
    if (hi < 0 || mi < 0) return null
    return (mi - hi + activeIds.length) % activeIds.length
  })()

  const caption = game.speed
    ? `⚡ Speed Round · ${secondsLabel(totalMs ?? 2000)} turns`
    : hidden
      ? 'Hidden Fuse · the fuse is secret'
      : `Sprint · ${secondsLabel(game.turnMs ?? 8000)} turns`

  const strip = (
    <CycleStrip
      cycle={game.cycle}
      activeIds={activeIds}
      removedIds={game.removedIds}
      holderId={holderId}
      nextId={game.nextId}
      myId={myId}
      turnId={game.turnId}
      lives={game.mode === 'elimination' ? game.lives : null}
      startLives={game.startLives}
      colorById={colorById}
      nameById={nameById}
    />
  )

  const roundLine =
    game.mode === 'rounds'
      ? `Round ${game.roundIndex + 1} of ${game.totalRounds}`
      : `Match ${game.matchIndex + 1}${game.totalMatches > 1 ? ` of ${game.totalMatches}` : ''} · ${activeIds.length} left`

  return (
    <div className={`screen hp-live ${isHolder ? 'hp-live-holder' : ''}`}>
      <p className="wyr-round">{roundLine}</p>

      {isHolder ? (
        <>
          <div className="hp-head">
            <h1 className="hp-say">Say one!</h1>
            <CategoryChip name={game.category?.name} />
          </div>

          <div className={`hp-ring-wrap ${msLeft <= 1500 && totalMs ? 'hp-ring-low' : ''}`}>
            {totalMs ? <TurnRing frac={frac} /> : null}
            <Potato
              key={game.turnId}
              size={150}
              heat={hidden ? 0 : 0.65 * (1 - frac) + 0.35 * Math.min(1, ((8000 - (game.turnMs ?? 8000)) / 6000))}
              className="hp-ring-potato"
            />
            {totalMs ? <span className="hp-ring-count">{Math.ceil(msLeft / 1000)}</span> : null}
          </div>
          <p className="hp-caption">{caption}</p>

          <button
            type="button"
            className="btn hp-pass-btn"
            onClick={pass}
            disabled={pending || locked || !running}
          >
            {locked ? 'Catch it…' : `Pass to ${nameById[game.nextId] ?? 'next'} →`}
          </button>
          {twoLeft && challengeButton}
        </>
      ) : (
        <>
          <div className="hp-head">
            <h1 className="hp-up">
              <span className="hp-up-dot" style={{ background: colorById[holderId] }} />
              {nameById[holderId] ?? 'Someone'} is up
            </h1>
            <CategoryChip name={game.category?.name} />
          </div>

          <p className={`hp-away ${away === 1 ? 'hp-away-next' : ''}`}>
            {!amActive
              ? "You're out. You can still vote on challenges."
              : away === 1
                ? "You're next. Be ready!"
                : `You're ${away} passes away. Be ready!`}
          </p>

          {!hidden && totalMs ? (
            <>
              <div className="wyr-timer hp-bar">
                <div className={`wyr-timer-fill ${frac < 0.3 ? 'low' : ''}`} style={{ width: `${frac * 100}%` }} />
              </div>
              <p className="hp-caption">{caption}</p>
            </>
          ) : (
            <p className="hp-caption">{caption}</p>
          )}
          {challengeButton}
        </>
      )}

      {game.frozen === 'disconnect' && !isHolder && (
        <p className="as-callout">
          {nameById[holderId] ?? 'The holder'} dropped out. The potato is on hold until they're back.
        </p>
      )}
      {toast && <div className="as-toast">{toast}</div>}
      {note && <p className="error center-text">{note}</p>}

      {strip}

      {game.vote && <VoteOverlay game={game} myId={myId} priv={priv} nameById={nameById} actions={actions} />}
    </div>
  )
}

// The turn window as a ring around the potato.
function TurnRing({ frac }) {
  const R = 54
  const C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 120 120" className="hp-ring-svg" aria-hidden="true">
      <circle cx="60" cy="60" r={R} className="hp-ring-track" />
      <circle
        cx="60"
        cy="60"
        r={R}
        className="hp-ring-progress"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - frac)}
      />
    </svg>
  )
}
