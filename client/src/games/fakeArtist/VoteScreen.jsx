import { useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import SharedCanvas from './SharedCanvas'

// One vote each, never yourself — same shape as the Imposter vote.
export default function VoteScreen({ game, players, myId, myRole, onVote }) {
  const colorById = playerColorMap(players)
  const [myVote, setMyVote] = useState(null)
  const { play } = useSound()

  const fa = myRole?.fakeArtist
  const votedIds = game.votedPlayerIds ?? []
  const iVoted = votedIds.includes(myId)
  const candidates = game.turnOrder.filter((id) => id !== myId)

  function pick(id) {
    play('confirm')
    setMyVote((cur) => (cur === id ? null : id))
    onVote(id)
  }

  return (
    <div className="screen">
      <h1 className="title">Who's the Fake Artist?</h1>
      <p className="hint center-text">
        {votedIds.length}/{game.totalVoters ?? candidates.length + 1} voted
        {fa?.role === 'imposter' && ' · (that’s you — vote anyone to blend in)'}
      </p>

      <SharedCanvas src={game.canvas} />

      <ul className="player-list">
        {candidates.map((id) => {
          const p = players.find((x) => x.id === id)
          const selected = myVote === id
          return (
            <li key={id}>
              <button
                type="button"
                className={`vote-btn ${selected ? 'vote-btn-selected' : ''}`}
                onClick={() => pick(id)}
              >
                <PlayerDot color={colorById[id]} className="player-cdot-inline" />
                {p?.name ?? 'Unknown'}
              </button>
            </li>
          )
        })}
      </ul>

      {iVoted ? (
        <p className="banner">✓ Vote in — tap another pick to change it</p>
      ) : (
        <p className="hint center-text waiting">Lock in a suspect</p>
      )}
    </div>
  )
}
