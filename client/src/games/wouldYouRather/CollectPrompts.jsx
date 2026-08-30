import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'

// Custom-mode "collect" phase: each player privately answers their assigned
// open-ended prompts one at a time, ~45s each. The server paces this — it
// hands us one prompt (plus the time left on it) via `myRole.collect`, and
// advances us to the next when we submit or the clock runs out. When our
// queue is done we wait for the rest of the group.
export default function CollectPrompts({ game, myRole, isHost, onSubmitPrompt, onForceGenerate }) {
  const collect = myRole?.collect ?? null
  const slotId = collect?.slotId ?? null

  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() =>
    collect?.msLeft != null ? Math.ceil(collect.msLeft / 1000) : 0,
  )
  const firedTimeout = useRef(false)
  const inputRef = useRef(null)
  const { play } = useSound()

  // New prompt (or first prompt): reset input + restart the countdown from
  // the server's remaining time. Keyed on slotId so it does NOT restart
  // every time someone else acts (that also pushes a room_update).
  useEffect(() => {
    setText('')
    setPending(false)
    firedTimeout.current = false
    setSeconds(collect?.msLeft != null ? Math.ceil(collect.msLeft / 1000) : 0)
    inputRef.current?.focus()
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round((collect?.collectMs ?? 45000) / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))

  function send(value) {
    if (pending) return
    setPending(true)
    onSubmitPrompt(slotId, value, () => {
      setPending(false)
      // The server advances us; the next prompt arrives as a fresh
      // `your_role`, which re-keys this component.
    })
  }

  function submit(e) {
    e?.preventDefault()
    const value = text.trim()
    if (!value || pending) return
    play('confirm')
    send(value)
  }

  // Clock ran out on this prompt — submit whatever's typed (may be empty;
  // the server treats an empty/late answer as a skip) so we advance.
  useEffect(() => {
    if (timeUp && !pending && !firedTimeout.current && collect && !collect.done) {
      firedTimeout.current = true
      if (!text.trim()) play('wrong')
      send(text.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  // --- Private state not here yet (just entered the phase) ---
  if (!collect) {
    return (
      <div className="screen">
        <p className="wyr-round">Custom Mode</p>
        <h1 className="title">Getting your prompts ready…</h1>
        <p className="hint center-text">Hang tight.</p>
      </div>
    )
  }

  // --- This player has finished their queue ---
  if (collect.done) {
    return (
      <div className="screen">
        <p className="wyr-round">Custom Mode</p>
        <h1 className="title">Answers in ✓</h1>
        <p className="hint center-text">
          {game.collect?.doneCount ?? 0} / {game.collect?.totalPlayers ?? game.totalPlayers} players
          finished — waiting for the rest…
        </p>
        {isHost && (
          <button className="btn btn-text" onClick={onForceGenerate}>
            Skip to questions now →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <p className="wyr-round">
        Your prompt {collect.promptNumber} of {collect.promptCount}
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">{timeUp ? "Time's up" : `${seconds}s left`}</p>

      <p className="wyr-prompt">{collect.prompt}</p>
      <p className="hint center-text">
        Write your own answer — it'll be one of the options later, shown without
        your name.
      </p>

      <form className="emoji-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect="on"
          enterKeyHint="go"
          placeholder="Your answer…"
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
        <button className="btn btn-text" onClick={onForceGenerate}>
          Skip to questions now →
        </button>
      )}
    </div>
  )
}
