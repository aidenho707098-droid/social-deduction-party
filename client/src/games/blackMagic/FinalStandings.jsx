import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

const MEDALS = ['🥇', '🥈', '🥉']

export default function FinalStandings({ game, players, myId, isHost, onBackToLobby }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const winnerIds = game.winnerIds ?? []
  const iWon = winnerIds.includes(myId)
  const winnerNames = winnerIds.map((id) => nameById[id] ?? 'Unknown')

  let headline
  if (winnerNames.length === 0) headline = 'Nobody scored a point!'
  else if (winnerNames.length === 1) headline = `${winnerNames[0]} wins!`
  else headline = `It's a tie: ${winnerNames.join(' & ')}`

  return (
    <div className="screen">
      <div className={`outcome-banner ${iWon ? 'outcome-win' : 'outcome-lose'}`}>
        <div className="outcome-icon">🔮</div>
        <div className="outcome-title">{iWon ? 'You Win!' : 'Game Over'}</div>
        <div className="outcome-subtitle">{headline}</div>
      </div>

      <div>
        <span className="label">Final standings</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div
              key={s.playerId}
              className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span className="wyr-board-rank">{MEDALS[i] ?? i + 1}</span>
              <span>
                <PlayerDot color={colorById[s.playerId]} className="player-cdot-inline" />
                {nameById[s.playerId] ?? 'Unknown'}
              </span>
              <span className="wyr-board-score">
                {s.score} {s.score === 1 ? 'pt' : 'pts'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to return to the lobby…</p>
      )}
    </div>
  )
}
