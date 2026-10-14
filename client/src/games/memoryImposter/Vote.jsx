import { useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { VotedIndicator } from '../../VotedIndicator'
import { useSound } from '../../sound/SoundContext'
import { usePhaseClock } from './memoryData'
import { MySequence, RoundLine, TimerBar } from './shared'

// VOTE (20s): one vote each, never yourself, changeable until it closes.
// Most votes is out; a tie means nobody is.
export default function Vote({ game, priv, players, myId, actions }) {
  const { play } = useSound()
  const msLeft = usePhaseClock(game)
  const participants = players.filter((p) => game.participantIds.includes(p.id))
  const colorById = playerColorMap(players)
  const [mine, setMine] = useState(null)
  const myVote = mine ?? priv?.myVote ?? null

  function vote(id) {
    play('confirm')
    setMine(id)
    actions.memoryVote(id)
  }

  return (
    <div className="screen mi-vote">
      <RoundLine game={game} />
      <MySequence game={game} priv={priv} />
      <h1 className="mi-headline">Who's the Imposter?</h1>
      <TimerBar msLeft={msLeft} total={game.windowMs} />
      <VotedIndicator players={participants} votedPlayerIds={game.votedIds ?? []} myId={myId} />
      <ul className="player-list mi-vote-list">
        {participants
          .filter((p) => p.id !== myId)
          .map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`vote-btn ${myVote === p.id ? 'vote-btn-selected' : ''}`}
                onClick={() => vote(p.id)}
                aria-pressed={myVote === p.id}
              >
                <PlayerDot color={colorById[p.id]} className="player-cdot-inline" />
                {p.name}
              </button>
            </li>
          ))}
      </ul>
      <p className="hint center-text">
        {myVote ? 'Vote in. Tap another name to change it.' : 'Most votes is out. A tie means nobody is.'}
      </p>
    </div>
  )
}
