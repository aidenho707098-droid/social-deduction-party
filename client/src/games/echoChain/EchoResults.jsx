import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import CountUp from '../CountUp'
import { GameIcon } from '../gameStyle'

// The end: each player's rounds survived (their points) and the final
// chain length. Ties share a place (players out in the same round, or
// everyone still in when the host ended it early).
export default function EchoResults({ game, players, myId, isHost, onBackToLobby }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const r = game.result
  const rows = r?.rows ?? []
  const winnerIds = game.winnerIds ?? []
  const iWon = winnerIds.includes(myId)
  const names = winnerIds.map((id) => nameById[id] ?? 'Unknown')

  let headline
  if (r?.endedEarly) headline = names.length > 1 ? `Ended early: ${names.join(' & ')} share first` : `Ended early: ${names[0] ?? 'nobody'} wins`
  else if (names.length === 1) headline = `${names[0]} is the last one standing!`
  else if (names.length > 1) headline = `It's a tie: ${names.join(' & ')}`
  else headline = 'Nobody made it.'

  // Places: ties share the higher one (1, 1, 3 ...).
  const placed = rows.map((row, i) => {
    let place = i + 1
    for (let j = i - 1; j >= 0 && rows[j].score === row.score; j--) place = j + 1
    return { ...row, place }
  })

  const outIn = game.eliminatedIn ?? {}
  const detail = (row) => {
    if (row.alive) return r?.endedEarly ? 'still in' : 'winner'
    return outIn[row.playerId] ? `out in round ${outIn[row.playerId]}` : 'out'
  }

  return (
    <div className="screen ec-results">
      <div className={`outcome-banner ${iWon ? 'outcome-win' : 'outcome-lose'}`}>
        <div className="outcome-icon">
          <span className="ec-final-icon">
            <GameIcon id="echo-chain" />
          </span>
        </div>
        <div className="outcome-title">{iWon ? 'You Win!' : 'Game Over'}</div>
        <div className="outcome-subtitle">{headline}</div>
      </div>

      <div className="ec-final-stats">
        <div>
          <span className="ec-final-num">{r?.chainLength ?? game.chainLength}</span>
          <span className="ec-final-cap">final chain</span>
        </div>
        <div>
          <span className="ec-final-num">{r?.round ?? game.round}</span>
          <span className="ec-final-cap">rounds</span>
        </div>
      </div>

      <div>
        <span className="label">Rounds survived</span>
        <div className="wyr-board">
          {placed.map((row) => (
            <div key={row.playerId} className={`wyr-board-row ${row.playerId === myId ? 'wyr-me' : ''}`}>
              <span className="wyr-board-rank">{row.place}</span>
              <span>
                <PlayerDot color={colorById[row.playerId]} className="player-cdot-inline" />
                {nameById[row.playerId] ?? 'Unknown'}
                <span className="ec-row-detail">{detail(row)}</span>
              </span>
              <span className="wyr-board-score">
                <CountUp value={row.score} /> {row.score === 1 ? 'pt' : 'pts'}
              </span>
            </div>
          ))}
        </div>
        <p className="hint hint-block">One point per round survived.</p>
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to return to the lobby…</p>
      )}
    </div>
  )
}
