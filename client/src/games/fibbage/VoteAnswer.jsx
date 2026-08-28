import { useEffect, useRef, useState } from 'react'
import FactPrompt from './FactPrompt'

export default function VoteAnswer({ game, myRole, isHost, onVote, onForceReveal }) {
  const [votedId, setVotedId] = useState(null)
  const [ownWarning, setOwnWarning] = useState(false)
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedForce = useRef(false)

  const myOptionId = myRole?.myOptionId ?? null

  useEffect(() => {
    setVotedId(null)
    setOwnWarning(false)
    setPending(false)
    firedForce.current = false
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

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round(game.voteMs / 1000))
  const pct = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))
  const votedCount = game.votedPlayerIds?.length ?? 0

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
      } else if (res?.ownAnswer) {
        setOwnWarning(true)
      }
    })
  }

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} · which one is TRUE?
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">
        {timeUp ? "Time's up" : `${seconds}s left`} · {votedCount}/
        {game.totalPlayers} voted
      </p>

      <FactPrompt prompt={game.prompt} />

      <div className="wyr-choices">
        {(game.options ?? []).map((o) => {
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
              disabled={isMine || pending || timeUp}
            >
              <span>{o.text}</span>
              {isMine && <span className="fibbage-tag">your fib</span>}
              {isVoted && <span className="fibbage-tag fibbage-tag-vote">your vote</span>}
            </button>
          )
        })}
      </div>

      {ownWarning && (
        <p className="hint center-text">That's your own answer — pick a different one.</p>
      )}
      {votedId ? (
        <p className="banner">✓ Vote locked — tap another to change it</p>
      ) : (
        <p className="hint center-text">Vote for the answer you think is real</p>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onForceReveal}>
          Reveal answers now →
        </button>
      )}
    </div>
  )
}
