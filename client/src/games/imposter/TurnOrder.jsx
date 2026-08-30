import WordPeek from './WordPeek'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

export default function TurnOrder({ players, turnOrder, currentTurnPlayerId, imposterCount, myId, myRole, onNextTurn }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const awayIds = new Set(players.filter((p) => p.connected === false).map((p) => p.id))
  const isMyTurn = myId === currentTurnPlayerId
  const currentIndex = turnOrder.indexOf(currentTurnPlayerId)
  const isLastTurn = currentIndex === turnOrder.length - 1

  return (
    <div className="screen">
      <h1 className="title">Give Your Clue</h1>
      <p className="hint center-text">
        Say one word out loud related to the secret word — {imposterCount === 1 ? 'the imposter has' : 'the imposters have'} to bluff.
      </p>

      <WordPeek word={myRole?.word ?? null} />

      <ul className="player-list">
        {turnOrder.map((id) => (
          <li
            key={id}
            className={`player-item ${id === currentTurnPlayerId ? 'player-item-active' : ''} ${
              awayIds.has(id) ? 'player-item-away' : ''
            }`}
          >
            <PlayerDot color={colorById[id]} />
            {nameById[id] ?? 'Unknown'}
            {id === currentTurnPlayerId && <span className="turn-badge">Speaking</span>}
            {awayIds.has(id) && <span className="player-away-tag">disconnected</span>}
          </li>
        ))}
      </ul>

      {isMyTurn ? (
        <button className="btn btn-start" onClick={onNextTurn}>
          {isLastTurn ? 'Start Voting' : 'Next Player'}
        </button>
      ) : (
        <p className="hint center-text">
          Waiting for {nameById[currentTurnPlayerId] ?? '…'} to give their clue…
        </p>
      )}
    </div>
  )
}
