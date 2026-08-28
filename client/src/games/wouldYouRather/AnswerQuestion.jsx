import { useEffect, useRef, useState } from 'react'

const OPTION_CLASSES = ['wyr-a', 'wyr-b', 'wyr-c', 'wyr-d']

export default function AnswerQuestion({ game, isHost, onAnswer, onReveal }) {
  const [choice, setChoice] = useState(null)
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedReveal = useRef(false)

  // New round: clear the previous pick and restart the countdown from the
  // server's remaining time. Keyed on roundIndex so it does NOT restart
  // every time someone else answers (that also pushes a room_update).
  useEffect(() => {
    setChoice(null)
    firedReveal.current = false
    setSeconds(Math.ceil(game.msLeft / 1000))
    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // When time runs out, the host's device is the one that tells the server
  // to reveal (everyone runs this screen, but only one client should fire).
  // Guarded so it fires at most once per round.
  useEffect(() => {
    if (seconds <= 0 && isHost && !firedReveal.current) {
      firedReveal.current = true
      onReveal()
    }
  }, [seconds, isHost, onReveal])

  function pick(next) {
    setChoice(next)
    onAnswer(next)
  }

  const totalSeconds = Math.max(1, Math.round(game.answerMs / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))
  const answered = game.answeredPlayerIds.length

  const options = game.question.options.map((text, i) => ({
    key: String.fromCharCode(65 + i),
    text,
    cls: OPTION_CLASSES[i],
  }))

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">
        {seconds > 0 ? `${seconds}s left` : "Time's up"} · {answered}/{game.totalPlayers} locked in
      </p>

      <p className="wyr-prompt">Would you rather…</p>

      <div className="wyr-choices">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`wyr-choice ${o.cls} ${choice === o.key ? 'wyr-choice-selected' : ''}`}
            onClick={() => pick(o.key)}
          >
            <span className="wyr-badge-letter">{o.key}</span>
            <span>{o.text}</span>
          </button>
        ))}
      </div>

      {choice ? (
        <p className="banner">✓ Locked in — tap another option to switch</p>
      ) : (
        <p className="hint center-text">Pick one before the timer runs out</p>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onReveal}>
          Reveal results now →
        </button>
      )}
    </div>
  )
}
