import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { HOST_GRACE_SECONDS } from '../timing'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function GuessRound({ game, players, myId, myRole, isHost, onGuess, onReveal }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const secret = myRole?.taboo
  const amDescriber = secret?.role === 'describer'

  const [guess, setGuess] = useState('')
  const [lockedIn, setLockedIn] = useState(false)
  const [lockedPlacing, setLockedPlacing] = useState(0)
  const [lockedPoints, setLockedPoints] = useState(0)
  const [shake, setShake] = useState(false)
  const [pending, setPending] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [flash, setFlash] = useState(false)
  const [msLeft, setMsLeft] = useState(game.msLeft ?? game.startMs)

  const firedReveal = useRef(false)
  const firedTimeout = useRef(false)
  const prevDrop = useRef(game.timeDropCount ?? 0)
  const inputRef = useRef(null)
  const { play } = useSound()

  // New round: reset everything, restart the local clock from the server.
  useEffect(() => {
    setGuess('')
    setLockedIn(false)
    setLockedPlacing(0)
    setLockedPoints(0)
    setShake(false)
    setPending(false)
    setAttempted(false)
    firedReveal.current = false
    firedTimeout.current = false
    prevDrop.current = game.timeDropCount ?? 0
    setMsLeft(game.msLeft ?? game.startMs)
    if (!amDescriber) inputRef.current?.focus()
    const timer = setInterval(() => setMsLeft((m) => Math.max(0, m - 250)), 250)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // Snap the local clock to the server's whenever a push drifts us by ~1s.
  // The dynamic 30s drops land here as a big jump and snap immediately.
  useEffect(() => {
    setMsLeft((m) => (Math.abs(m - game.msLeft) > 900 ? game.msLeft : m))
  }, [game.msLeft])

  // DYNAMIC TIMER alert: a guesser's first answer just shaved 30s off.
  useEffect(() => {
    if ((game.timeDropCount ?? 0) > prevDrop.current) {
      prevDrop.current = game.timeDropCount
      setFlash(true)
      play('time-drop')
      const t = setTimeout(() => setFlash(false), 1400)
      return () => clearTimeout(t)
    }
  }, [game.timeDropCount, play])

  const secondsLeft = Math.ceil(msLeft / 1000)
  const timeUp = msLeft <= 0
  const pct = Math.max(0, Math.min(100, (msLeft / Math.max(1, game.startMs)) * 100))

  // Host device tells the server to reveal once the clock is up (+ grace).
  useEffect(() => {
    if (timeUp && isHost && !firedReveal.current) {
      firedReveal.current = true
      const t = setTimeout(onReveal, HOST_GRACE_SECONDS * 1000)
      return () => clearTimeout(t)
    }
  }, [timeUp, isHost, onReveal])

  // Time's up and this guesser never locked in — fire whatever's typed.
  useEffect(() => {
    if (amDescriber || !timeUp || lockedIn || firedTimeout.current) return
    firedTimeout.current = true
    const value = guess.trim()
    if (value && !pending) {
      setPending(true)
      onGuess(value, (res) => {
        setPending(false)
        if (res?.correct) {
          setLockedIn(true)
          setLockedPlacing(res.placing ?? 0)
          setLockedPoints(res.points ?? 0)
          play('correct')
        } else {
          play('wrong')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, lockedIn, amDescriber])

  function submit(e) {
    e?.preventDefault()
    const value = guess.trim()
    if (!value || lockedIn || pending || timeUp) return
    setPending(true)
    onGuess(value, (res) => {
      setPending(false)
      if (res?.correct) {
        setLockedIn(true)
        setLockedPlacing(res.placing ?? 0)
        setLockedPoints(res.points ?? 0)
        play('correct')
      } else {
        setAttempted(true)
        setShake(true)
        setTimeout(() => setShake(false), 450)
        play('wrong')
      }
    })
  }

  const solvedIds = game.solvedPlayerIds ?? []
  const guessedIds = game.guessedPlayerIds ?? []
  const placingOf = (pid) => solvedIds.indexOf(pid) + 1

  const header = (
    <>
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
        {game.categoryName && <span className="emoji-cat">{game.categoryName}</span>}
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${secondsLeft <= 15 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint center-text">
        {timeUp ? "Time's up" : `${secondsLeft}s left`} · {solvedIds.length}/
        {game.guesserCount} got it
      </p>

      {flash && <div className="taboo-drop-alert">⏱️ −30 seconds — someone got it!</div>}
    </>
  )

  // ---- Describer's view: their word + banned list, front and centre ----
  if (amDescriber) {
    const forbidden = secret?.forbidden ?? []
    return (
      <div className="screen">
        {header}

        <div className="taboo-describer-panel">
          <div className="taboo-secret-strip">
            <span className="taboo-secret-label">Your word</span>
            <span className="taboo-secret-word">{secret?.word ?? '…'}</span>
          </div>
          <div className="taboo-banned-block">
            <span className="taboo-banned-label">🚫 Don't say any of these</span>
            <div className="taboo-forbidden taboo-forbidden-lg">
              {forbidden.map((w) => (
                <span key={w} className="taboo-forbidden-chip">{w}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="wyr-prompt">Describe it out loud!</p>

        <div>
          <span className="label">Guessers</span>
          <div className="wyr-board">
            {players
              .filter((p) => p.id !== game.describerId)
              .map((p) => {
                const place = placingOf(p.id)
                return (
                  <div key={p.id} className="wyr-board-row">
                    <span className={`emoji-verdict ${place ? 'ok' : ''}`}>
                      {place ? '✓' : guessedIds.includes(p.id) ? '…' : ''}
                    </span>
                    <span>
                      <PlayerDot color={colorById[p.id]} className="player-cdot-inline" />
                      {p.name}
                    </span>
                    {place > 0 && (
                      <span className="taboo-placing">{ordinal(place)}</span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

        {isHost && (
          <button className="btn btn-text" onClick={onReveal}>
            End round now →
          </button>
        )}
      </div>
    )
  }

  // ---- Guesser's view ----
  return (
    <div className="screen">
      {header}

      {lockedIn ? (
        <div className="emoji-solved">
          <div className="emoji-solved-title">🔒 Locked in — {ordinal(lockedPlacing)}!</div>
          <div className="emoji-solved-points">+{lockedPoints} points</div>
        </div>
      ) : (
        <form className="emoji-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className={`input ${shake ? 'input-shake' : ''}`}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="go"
            placeholder="Your guess…"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={timeUp || pending}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!guess.trim() || timeUp || pending}
          >
            {timeUp ? "Time's up" : 'Submit guess'}
          </button>
          <p className="hint center-text">
            {attempted
              ? 'Not quite — keep guessing, spelling can be rough.'
              : 'First right answer scores most. Wrong guesses are free and never touch the clock.'}
          </p>
        </form>
      )}

      <div>
        <span className="label">Cracked it</span>
        <div className="wyr-board">
          {solvedIds.length === 0 ? (
            <p className="hint center-text">Nobody yet — get in first.</p>
          ) : (
            solvedIds.map((pid, i) => (
              <div
                key={pid}
                className={`wyr-board-row ${pid === myId ? 'wyr-me' : ''}`}
              >
                <span className="taboo-placing">{ordinal(i + 1)}</span>
                <span>
                  <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
                  {nameById[pid] ?? 'Unknown'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {isHost && (
        <button className="btn btn-text" onClick={onReveal}>
          End round now →
        </button>
      )}
    </div>
  )
}
