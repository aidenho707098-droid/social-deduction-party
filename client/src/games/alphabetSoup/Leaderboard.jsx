import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

// Running totals between rounds.
export default function Leaderboard({ scores, players, myId, label = 'Leaderboard' }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  return (
    <div>
      <span className="label">{label}</span>
      <div className="wyr-board">
        {(scores ?? []).map((s, i) => (
          <div key={s.playerId} className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}>
            <span className="wyr-board-rank">{i + 1}</span>
            <span>
              <PlayerDot color={colorById[s.playerId]} className="player-cdot-inline" />
              {nameById[s.playerId] ?? 'Unknown'}
            </span>
            <span className="wyr-board-score">{s.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
