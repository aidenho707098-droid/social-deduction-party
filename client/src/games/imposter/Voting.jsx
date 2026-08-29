import { useState } from 'react'
import WordPeek from './WordPeek'

export default function Voting({ players, myId, myRole, votedPlayerIds, totalVoters, voteLimit, onToggleVote }) {
  const [myVotes, setMyVotes] = useState([])

  const hasFinished = votedPlayerIds.includes(myId)
  const remaining = voteLimit - myVotes.length

  function handleToggle(playerId) {
    const isSelected = myVotes.includes(playerId)
    if (!isSelected && myVotes.length >= voteLimit) return // already used all votes

    setMyVotes((prev) => (isSelected ? prev.filter((id) => id !== playerId) : [...prev, playerId]))
    onToggleVote(playerId)
  }

  return (
    <div className="screen">
      <h1 className="title">{voteLimit > 1 ? 'Who Are the Imposters?' : "Who's the Imposter?"}</h1>
      <p className="hint center-text">
        {voteLimit > 1 ? `Pick ${voteLimit} suspects` : 'Pick 1 suspect'} · {votedPlayerIds.length}/{totalVoters} done
      </p>

      <WordPeek word={myRole?.word ?? null} />

      <ul className="player-list">
        {players.map((p) => {
          const selected = myVotes.includes(p.id)
          const disabled = !selected && myVotes.length >= voteLimit
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`vote-btn ${selected ? 'vote-btn-selected' : ''}`}
                disabled={disabled}
                onClick={() => handleToggle(p.id)}
              >
                {p.name}
              </button>
            </li>
          )
        })}
      </ul>

      {hasFinished ? (
        <p className="banner">✓ Votes submitted — tap a pick to change it</p>
      ) : voteLimit > 1 ? (
        <p className="hint center-text">
          {remaining} vote{remaining === 1 ? '' : 's'} left to use
        </p>
      ) : null}
    </div>
  )
}
