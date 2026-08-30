import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'

// Personal-mode "truth" phase: each player, one prompt-slot at a time,
// first PICKS one of two offered prompts (no category shown), then answers
// it truthfully in ~45s. The server paces this and hands us the current
// step via `myRole.truth`; a fresh `your_role` arrives each time we
// advance, re-keying this component.
export default function TruthPhase({ game, myRole, isHost, onChoose, onSubmit, onForce }) {
  const truth = myRole?.truth ?? null
  const stepKey = truth ? `${truth.slotNumber}-${truth.choosing ? 'choose' : 'answer'}` : 'none'

  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() =>
    truth?.msLeft != null ? Math.ceil(truth.msLeft / 1000) : 0,
  )
  const firedTimeout = useRef(false)
  const inputRef = useRef(null)
  const { play } = useSound()

  useEffect(() => {
    setText('')
    setPending(false)
    firedTimeout.current = false
    setSeconds(truth?.msLeft != null ? Math.ceil(truth.msLeft / 1000) : 0)
    inputRef.current?.focus()
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round((truth?.stepMs ?? 45000) / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))

  function choose(i) {
    if (pending) return
    setPending(true)
    play('confirm')
    onChoose(truth.slotNumber - 1, i, () => setPending(false))
  }

  function sendAnswer(value) {
    if (pending) return
    setPending(true)
    onSubmit(value, () => setPending(false))
  }

  function submitAnswer(e) {
    e?.preventDefault()
    const value = text.trim()
    if (!value || pending) return
    play('confirm')
    sendAnswer(value)
  }

  // Clock ran out on the ANSWER step — submit whatever's typed (may be
  // empty; the server treats that as a skip) so we advance.
  useEffect(() => {
    if (timeUp && truth && !truth.choosing && !truth.done && !pending && !firedTimeout.current) {
      firedTimeout.current = true
      if (!text.trim()) play('wrong')
      sendAnswer(text.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  if (!truth) {
    return (
      <div className="screen">
        <p className="wyr-round">Personal Mode</p>
        <h1 className="title">Getting your prompts ready…</h1>
        <p className="hint center-text">Hang tight.</p>
      </div>
    )
  }

  if (truth.done) {
    return (
      <div className="screen">
        <p className="wyr-round">Personal Mode</p>
        <h1 className="title">Answers in ✓</h1>
        <p className="hint center-text">
          {game.truth?.doneCount ?? 0} / {game.truth?.totalPlayers ?? game.totalPlayers} players
          finished — waiting for the rest…
        </p>
        {isHost && (
          <button className="btn btn-text" onClick={onForce}>
            Skip to the rounds now →
          </button>
        )}
      </div>
    )
  }

  // --- Step 1: pick which prompt to answer ---
  if (truth.choosing) {
    return (
      <div className="screen">
        <p className="wyr-round">
          Your prompt {truth.slotNumber} of {truth.slotCount}
        </p>
        <div className="wyr-timer">
          <div className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="hint">{timeUp ? "Time's up" : `${seconds}s left`}</p>

        <p className="wyr-prompt">Pick one to answer about yourself</p>

        <div className="wyr-choices">
          {truth.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className="wyr-choice"
              onClick={() => choose(i)}
              disabled={pending}
            >
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --- Step 2: answer the chosen prompt truthfully ---
  return (
    <div className="screen">
      <p className="wyr-round">
        Your prompt {truth.slotNumber} of {truth.slotCount}
      </p>
      <div className="wyr-timer">
        <div className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">{timeUp ? "Time's up" : `${seconds}s left`}</p>

      <p className="wyr-prompt">{truth.prompt}</p>
      <p className="hint center-text">
        Answer truthfully — the others will try to fake this answer about you.
      </p>

      <form className="emoji-form" onSubmit={submitAnswer}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect="on"
          enterKeyHint="go"
          placeholder="Your real answer…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={timeUp || pending}
          maxLength={120}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!text.trim() || timeUp || pending}
        >
          Submit answer
        </button>
      </form>

      {isHost && (
        <button className="btn btn-text" onClick={onForce}>
          Skip to the rounds now →
        </button>
      )}
    </div>
  )
}
