import { useEffect, useRef, useState } from 'react'
import Spectrum from './Spectrum'
import NumberInput from './NumberInput'
import { useSound } from '../../sound/SoundContext'

const REASON_TEXT = {
  pole: (t) => `Your clue can't include "${t}" — that's one of the scale's ends.`,
  number: (t) => `Your clue can't include "${t}" — no numbers allowed.`,
  empty: () => 'Write something first.',
}

export default function CluePhase({ game, myRole, myId, isHost, onSubmitClue, onReveal }) {
  const wv = myRole?.wavelength ?? null
  const iAmGiver = game.clueGiverId === myId

  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [rejection, setRejection] = useState(null) // { reason, term }
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedForce = useRef(false)
  const inputRef = useRef(null)
  const { play } = useSound()

  useEffect(() => {
    setText('')
    setPending(false)
    setRejection(null)
    firedForce.current = false
    setSeconds(Math.ceil(game.msLeft / 1000))
    inputRef.current?.focus()
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // Time's up on the clue — the host's device moves the game on (the round
  // is skipped, since there's no clue to guess against).
  useEffect(() => {
    if (seconds <= 0 && isHost && !firedForce.current) {
      firedForce.current = true
      onReveal()
    }
  }, [seconds, isHost, onReveal])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round(game.clueMs / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))

  function submit(e) {
    e?.preventDefault()
    const value = text.trim()
    if (!value || pending || timeUp) return
    setPending(true)
    onSubmitClue(value, (res) => {
      setPending(false)
      if (res?.ok) {
        play('confirm')
      } else if (res?.reason) {
        setRejection({ reason: res.reason, term: res.term })
        play('wrong')
      }
    })
  }

  const timerBlock = (
    <>
      <div className="wyr-timer">
        <div className={`wyr-timer-fill ${seconds <= 10 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">{timeUp ? "Time's up" : `${seconds}s left`}</p>
    </>
  )

  // --- Everyone else: no scale info yet, just wait ---
  if (!iAmGiver || !wv) {
    return (
      <div className="screen">
        <p className="wyr-round">
          Round {game.roundIndex + 1} of {game.totalRounds}
        </p>
        {timerBlock}
        <h1 className="title">The Clue-Giver is thinking…</h1>
        <Spectrum min={0} max={10} poleA="?" poleB="?" blurred />
        <p className="hint center-text">
          They're looking at a secret scale and a hidden number, writing a clue.
          You'll see the clue in a moment.
        </p>
      </div>
    )
  }

  // --- The Clue-Giver ---
  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds} · you're the Clue-Giver
      </p>
      {timerBlock}

      <p className="wyr-prompt">{wv.category}</p>
      <Spectrum
        min={wv.min}
        max={wv.max}
        poleA={wv.poleA}
        poleB={wv.poleB}
        target={wv.target}
      />
      <NumberInput min={wv.min} max={wv.max} value={wv.target} readOnly />

      <p className="hint center-text">
        Write a short clue that lands on <strong>{wv.target}</strong>. No pole
        words ({wv.poleA.toLowerCase()} / {wv.poleB.toLowerCase()}) and no
        numbers.
      </p>

      <form className="emoji-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect="on"
          enterKeyHint="send"
          placeholder="Your clue…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (rejection) setRejection(null)
          }}
          disabled={timeUp || pending}
          maxLength={120}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!text.trim() || timeUp || pending}
        >
          Submit clue
        </button>
      </form>

      {rejection && (
        <p className="error">
          ⚠ {(REASON_TEXT[rejection.reason] ?? (() => 'That clue was rejected — try again.'))(rejection.term)} Try again.
        </p>
      )}
    </div>
  )
}
