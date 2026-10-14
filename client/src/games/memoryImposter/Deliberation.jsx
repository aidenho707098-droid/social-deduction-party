import { useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { VotedIndicator } from '../../VotedIndicator'
import { useSound } from '../../sound/SoundContext'
import EvidenceTable from './EvidenceTable'
import { MySequence, RoundLine, TimerBar } from './shared'
import { usePhaseClock } from './memoryData'

// EVIDENCE -> DISCUSSION -> VOTE share one screen shape: the evidence table
// stays up the whole time as the thing to argue about.
export default function Deliberation({ game, priv, players, myId, isHost, actions }) {
  const msLeft = usePhaseClock(game)
  const participants = players.filter((p) => game.participantIds.includes(p.id))

  return (
    <div className={`screen mi-delib mi-delib-${game.phase}`}>
      <RoundLine game={game} />
      <MySequence game={game} priv={priv} />

      {game.phase === 'evidence' && (
        <>
          <h1 className="mi-headline">The evidence</h1>
          <p className="hint center-text">Who couldn't see it? Remember: honest players slip up too.</p>
        </>
      )}

      {game.phase === 'discussion' && (
        <>
          <h1 className="mi-headline">Discuss</h1>
          <TimerBar msLeft={msLeft} total={game.windowMs} label="Vote opens in" />
          {isHost && (
            <div className="mi-host-row">
              <button type="button" className="btn btn-secondary" onClick={() => actions.memoryHost('extend')}>
                +30s
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => actions.memoryHost('skip')}>
                Vote now →
              </button>
            </div>
          )}
        </>
      )}

      {game.phase === 'vote' && (
        <VotePanel game={game} priv={priv} players={participants} myId={myId} msLeft={msLeft} actions={actions} />
      )}

      <EvidenceTable
        evidence={game.evidence}
        type={game.sequenceType}
        players={players}
        myId={myId}
        animate={game.phase === 'evidence'}
      />
    </div>
  )
}

function VotePanel({ game, priv, players, myId, msLeft, actions }) {
  const { play } = useSound()
  const colorById = playerColorMap(players)
  const [mine, setMine] = useState(null)
  const myVote = mine ?? priv?.myVote ?? null
  const candidates = players.filter((p) => p.id !== myId)
  const votedIds = game.votedIds ?? []

  function vote(id) {
    play('confirm')
    setMine(id)
    actions.memoryVote(id)
  }

  return (
    <>
      <h1 className="mi-headline">Who's the Imposter?</h1>
      <TimerBar msLeft={msLeft} total={game.windowMs} />
      <VotedIndicator players={players} votedPlayerIds={votedIds} myId={myId} />
      <ul className="player-list mi-vote-list">
        {candidates.map((p) => (
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
    </>
  )
}
