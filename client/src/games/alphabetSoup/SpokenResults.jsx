import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { LetterTile } from './LetterTile'
import Leaderboard from './Leaderboard'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Spoken round over: placement by reverse elimination order, then the
// running leaderboard.
export default function SpokenResults({ game, players, myId, isHost, actions }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const rows = game.result?.rows ?? []
  const winner = rows[0]
  const isLastRound = game.roundIndex + 1 >= game.totalRounds

  return (
    <div className="screen as-results">
      <p className="wyr-round">Round {game.roundIndex + 1} results</p>
      <div className="as-results-head">
        <LetterTile letter={game.letter} size="sm" />
        <span className="as-results-cat">{game.category?.name}</span>
      </div>
      {winner && (
        <h1 className="title center-text">
          {winner.playerId === myId ? 'You' : nameById[winner.playerId] ?? 'Someone'} outlasted everyone!
        </h1>
      )}

      <div>
        <span className="label">Last one standing</span>
        <div className="wyr-board">
          {rows.map((r) => (
            <div key={r.playerId} className={`wyr-board-row ${r.playerId === myId ? 'wyr-me' : ''}`}>
              <span className="wyr-board-rank">{ordinal(r.placement)}</span>
              <span>
                <PlayerDot color={colorById[r.playerId]} className="player-cdot-inline" />
                {nameById[r.playerId] ?? 'Player'}
              </span>
              <span className="wyr-plus">+{r.points}</span>
            </div>
          ))}
        </div>
      </div>

      <Leaderboard scores={game.scores} players={players} myId={myId} />

      {isHost ? (
        <button className="btn btn-primary" onClick={actions.alphabetSoupNextRound}>
          {isLastRound ? 'See Final Results' : 'Next Round'}
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
