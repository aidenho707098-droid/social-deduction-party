import { useEffect, useRef, useState } from 'react'
import Spectrum from './Spectrum'
import NumberInput from './NumberInput'
import { useSound } from '../../sound/SoundContext'

const REASON_TEXT = {
  pole: (t) => `Your clue can't include "${t}" — that's one of the scale's ends.`,
  number: (t) => `Your clue can't include "${t}" — no numbers allowed.`,
  empty: () => 'Write something first.',
}

// Writing phase — every Clue-Giver writes ALL their clues for the whole
// game up front, in parallel, each with a private 60s-per-clue timer.
// Mirrors Majority Pick's Custom-Mode collect phase: the server paces one
// clue at a time via `myRole.wavelength` and advances us on submit /
// timeout. Finished writers wait for the rest; then the guess rounds run
// straight through with no more clue-writing waits.
export default function WritePhase({ game, myRole, isHost, onSubmitClue, onForceAdvance }) {
  const wv = myRole?.wavelength ?? null
  const stepKey = wv?.done ? 'done' : (wv?.clueNumber ?? null)

  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [rejection, setRejection] = useState(null) // { reason, term }
  const [seconds, setSeconds] = useState(() =>
    wv?.msLeft != null ? Math.ceil(wv.msLeft / 1000) : 0,
  )
  const firedTimeout = useRef(false)
  const inputRef = useRef(null)
  const { play } = useSound()

  // New clue (or first one): reset the input + restart the countdown from
  // the server's remaining time. Keyed on the queue position so it does NOT
  // restart every time another player's submit pushes a room update.
  useEffect(() => {
    setText('')
    setPending(false)
    setRejection(null)
    firedTimeout.current = false
    setSeconds(wv?.msLeft != null ? Math.ceil(wv.msLeft / 1000) : 0)
    inputRef.current?.focus()
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round((wv?.writeMs ?? 60000) / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))

  function send(value) {
    if (pending) return
    setPending(true)
    onSubmitClue(value, (res) => {
      setPending(false)
      if (res?.ok) {
        play('confirm')
        // The server advances us; the next clue (or "done") arrives as a
        // fresh your_role, which re-keys this component.
      } else if (res?.reason) {
        setRejection({ reason: res.reason, term: res.term })
        play('wrong')
      }
    })
  }

  function submit(e) {
    e?.preventDefault()
    const value = text.trim()
    if (!value || pending || timeUp) return
    send(value)
  }

  // Clock ran out on this clue — fire whatever's typed (maybe empty, maybe
  // still failing the rule check). The server treats a late clue as a skip
  // and moves us on.
  useEffect(() => {
    if (timeUp && !pending && !firedTimeout.current && wv && !wv.done) {
      firedTimeout.current = true
      if (!text.trim()) play('wrong')
      send(text.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  const w = game.write ?? {}

  // --- Not a Clue-Giver this game (or private state not here yet) ---
  if (!wv) {
    return (
      <div className="screen">
        <p className="wyr-round">Wavelength</p>
        <h1 className="title waiting">Clue-Givers are writing…</h1>
        <Spectrum min={0} max={10} poleA="?" poleB="?" blurred />
        <p className="hint center-text">
          Every Clue-Giver is writing their clues for the whole game at once —{' '}
          {w.cluesIn ?? 0} / {w.totalRounds ?? game.totalRounds} ready. Once
          they're all in, the rounds run straight through with no more waiting.
        </p>
        {isHost && (
          <button className="btn btn-text" onClick={onForceAdvance}>
            Skip to guessing now →
          </button>
        )}
      </div>
    )
  }

  // --- This Clue-Giver has finished their queue ---
  if (wv.done) {
    return (
      <div className="screen">
        <p className="wyr-round">Wavelength</p>
        <h1 className="title">Clues in ✓</h1>
        <Spectrum min={0} max={10} poleA="?" poleB="?" blurred />
        <p className="hint center-text">
          {w.writersDone ?? 0} / {w.writers ?? 0} Clue-Givers done — guessing
          starts once everyone's finished.
        </p>
        {isHost && (
          <button className="btn btn-text" onClick={onForceAdvance}>
            Skip to guessing now →
          </button>
        )}
      </div>
    )
  }

  // --- Writing a clue ---
  const multi = (wv.clueCount ?? 1) > 1
  const more = multi && wv.clueNumber < wv.clueCount
  return (
    <div className="screen">
      <p className="wyr-round">
        {multi ? `Your clue ${wv.clueNumber} of ${wv.clueCount}` : 'Write your clue'}
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${seconds <= 10 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">{timeUp ? "Time's up" : `${seconds}s left`}</p>

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
          {more ? 'Next clue' : 'Submit clue'}
        </button>
      </form>

      {rejection && (
        <p className="error">
          ⚠ {(REASON_TEXT[rejection.reason] ?? (() => 'That clue was rejected — try again.'))(rejection.term)} Try again.
        </p>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onForceAdvance}>
          Skip to guessing now →
        </button>
      )}
    </div>
  )
}
