import { useEffect, useRef, useState } from 'react'
import FactPrompt from './FactPrompt'
import PersonalQuestion from './PersonalQuestion'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'

// Free-text entry, same input treatment as Emoji Movie Guess's guess box.
// In Personal Mode the prompt is a question about a specific player (the
// "subject"), who sits this round out.
export default function WriteAnswer({ game, players = [], myId, isHost, onSubmit, onForceVote }) {
  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState(null)
  const [editing, setEditing] = useState(true)
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedForce = useRef(false)
  const firedTimeout = useRef(false)
  const inputRef = useRef(null)
  const { play } = useSound()

  const personal = !!game.personal
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const subjectName = personal ? nameById[game.subjectId] : null
  const subjectColor = personal ? colorById[game.subjectId] : null
  const iAmSubject = personal && game.subjectId === myId
  const denom = game.expectedCount ?? game.totalPlayers

  const questionEl = (
    <PersonalQuestion
      template={game.prompt}
      name={subjectName}
      color={subjectColor}
      className="wyr-prompt"
    />
  )

  // New round: reset and restart the countdown from the server's remaining
  // time. Keyed on roundIndex so it doesn't restart when someone else submits.
  useEffect(() => {
    setText('')
    setSubmittedText(null)
    setEditing(true)
    setPending(false)
    firedForce.current = false
    firedTimeout.current = false
    setSeconds(Math.ceil(game.msLeft / 1000))
    inputRef.current?.focus()
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // Time's up: the host's device asks the server to move everyone to voting.
  useEffect(() => {
    if (seconds <= 0 && isHost && !firedForce.current) {
      firedForce.current = true
      onForceVote()
    }
  }, [seconds, isHost, onForceVote])

  // Clock ran out with no answer submitted — soft buzzer, this device only.
  useEffect(() => {
    if (seconds <= 0 && !submittedText && !firedTimeout.current && !iAmSubject) {
      firedTimeout.current = true
      play('wrong')
    }
  }, [seconds, submittedText, iAmSubject, play])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round(game.writeMs / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))
  const submittedCount = game.submittedPlayerIds?.length ?? 0

  function submit(e) {
    e?.preventDefault()
    const value = text.trim()
    if (!value || pending || timeUp) return
    setPending(true)
    onSubmit(value, (res) => {
      setPending(false)
      if (res?.ok) {
        setSubmittedText(res.text ?? value)
        setEditing(false)
        play('confirm')
      }
    })
  }

  const timerBlock = (
    <>
      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">
        {timeUp ? "Time's up" : `${seconds}s left`} · {submittedCount}/{denom} submitted
      </p>
    </>
  )

  // --- Personal Mode: the subject sits this round out entirely ---
  if (iAmSubject) {
    return (
      <div className="screen">
        <p className="wyr-round">
          Round {game.roundIndex + 1} of {game.totalRounds}
        </p>
        {timerBlock}
        {questionEl}
        <div className="emoji-solved">
          <div className="emoji-solved-title">🫵 This round is about you</div>
          <div className="emoji-solved-points">
            Everyone else is making up an answer that sounds like you. Sit tight.
          </div>
        </div>
        {isHost && (
          <button className="btn btn-text" onClick={onForceVote}>
            Start voting now →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>

      {timerBlock}

      {personal ? (
        <>
          {questionEl}
          <p className="hint center-text">
            Write an answer that sounds like something {subjectName || 'they'} would
            actually say.
          </p>
        </>
      ) : (
        <>
          <p className="wyr-prompt">Fill in the blank with a convincing lie</p>
          <FactPrompt prompt={game.prompt} />
        </>
      )}

      {editing ? (
        <form className="emoji-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize={personal ? 'sentences' : 'none'}
            autoCorrect={personal ? 'on' : 'off'}
            spellCheck={personal ? 'true' : 'false'}
            enterKeyHint="go"
            placeholder={personal ? `A fake answer for ${subjectName || 'them'}…` : 'Your fake answer…'}
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
            {submittedText ? 'Update answer' : 'Submit answer'}
          </button>
        </form>
      ) : (
        <div className="emoji-solved">
          <div className="emoji-solved-title">✓ Answer submitted</div>
          <div className="emoji-solved-points">"{submittedText}"</div>
        </div>
      )}

      {!editing && !timeUp && (
        <button
          className="btn btn-text"
          onClick={() => {
            setText(submittedText ?? '')
            setEditing(true)
          }}
        >
          Change my answer
        </button>
      )}

      {!editing && (
        <p className="hint center-text">Waiting for the other players…</p>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onForceVote}>
          Start voting now →
        </button>
      )}
    </div>
  )
}
