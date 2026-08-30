import { useEffect, useRef, useState } from 'react'
import FactPrompt from './FactPrompt'
import PersonalQuestion from './PersonalQuestion'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'

export default function VoteAnswer({ game, players = [], myId, myRole, isHost, onVote, onForceReveal }) {
  const [votedId, setVotedId] = useState(null)
  const [ownWarning, setOwnWarning] = useState(false)
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedForce = useRef(false)
  const firedTimeout = useRef(false)
  const { play } = useSound()

  const myOptionId = myRole?.myOptionId ?? null
  const personal = !!game.personal
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const subjectName = personal ? nameById[game.subjectId] : null
  const subjectColor = personal ? colorById[game.subjectId] : null
  const iAmSubject = personal && game.subjectId === myId
  const denom = game.expectedCount ?? game.totalPlayers

  useEffect(() => {
    setVotedId(null)
    setOwnWarning(false)
    setPending(false)
    firedForce.current = false
    firedTimeout.current = false
    setSeconds(Math.ceil(game.msLeft / 1000))
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  useEffect(() => {
    if (seconds <= 0 && isHost && !firedForce.current) {
      firedForce.current = true
      onForceReveal()
    }
  }, [seconds, isHost, onForceReveal])

  // Didn't get a vote in before the clock ran out — soft buzzer, this device only.
  useEffect(() => {
    if (seconds <= 0 && !votedId && !firedTimeout.current && !iAmSubject) {
      firedTimeout.current = true
      play('wrong')
    }
  }, [seconds, votedId, iAmSubject, play])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round(game.voteMs / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))
  const votedCount = game.votedPlayerIds?.length ?? 0
  const options = game.options ?? []

  function vote(optionId) {
    if (optionId === myOptionId) {
      setOwnWarning(true)
      return
    }
    if (pending || timeUp) return
    setPending(true)
    onVote(optionId, (res) => {
      setPending(false)
      if (res?.ok) {
        setVotedId(optionId)
        setOwnWarning(false)
        play('confirm')
      } else if (res?.ownAnswer) {
        setOwnWarning(true)
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
        {timeUp ? "Time's up" : `${seconds}s left`} · {votedCount}/{denom} voted
      </p>
    </>
  )

  return (
    <div className="screen">
      <p className="wyr-round">
        {personal
          ? `Round ${game.roundIndex + 1} · which one is really ${subjectName || 'theirs'}?`
          : `Round ${game.roundIndex + 1} · which one is TRUE?`}
      </p>

      {timerBlock}

      {personal ? (
        <PersonalQuestion
          template={game.prompt}
          name={subjectName}
          color={subjectColor}
          className="wyr-prompt"
        />
      ) : (
        <FactPrompt prompt={game.prompt} />
      )}

      <div className="wyr-choices">
        {options.map((o) => {
          const isMine = o.id === myOptionId
          const isVoted = o.id === votedId
          return (
            <button
              key={o.id}
              type="button"
              className={`wyr-choice fibbage-option ${isVoted ? 'fibbage-option-voted' : ''} ${
                isMine ? 'fibbage-option-mine' : ''
              }`}
              onClick={() => vote(o.id)}
              disabled={isMine || pending || timeUp || iAmSubject}
            >
              <span>{o.text}</span>
              {isMine && <span className="fibbage-tag">your fib</span>}
              {isVoted && <span className="fibbage-tag fibbage-tag-vote">your vote</span>}
            </button>
          )
        })}
      </div>

      {iAmSubject ? (
        <p className="banner">
          🫵 The others are guessing which of these is your real answer.
        </p>
      ) : (
        <>
          {ownWarning && (
            <p className="hint center-text">That's your own answer — pick a different one.</p>
          )}
          {votedId ? (
            <p className="banner">✓ Vote locked — tap another to change it</p>
          ) : (
            <p className="hint center-text">
              {personal
                ? `Vote for the answer you think is really ${subjectName || 'theirs'}`
                : 'Vote for the answer you think is real'}
            </p>
          )}
        </>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onForceReveal}>
          Reveal answers now →
        </button>
      )}
    </div>
  )
}
