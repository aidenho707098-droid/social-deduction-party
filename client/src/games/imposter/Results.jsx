import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

export default function Results({
  players,
  myRole,
  category,
  word,
  imposterIds,
  tally,
  detectivesWin,
  isHost,
  onBackToLobby,
}) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const sortedPlayers = [...players].sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0))

  const amImposter = myRole?.role === 'imposter'
  const personalWin = amImposter ? !detectivesWin : detectivesWin

  return (
    <div className="screen">
      <div className={`outcome-banner ${personalWin ? 'outcome-win' : 'outcome-lose'}`}>
        <div className="outcome-icon">{personalWin ? '🎉' : '💀'}</div>
        <div className="outcome-title">{personalWin ? 'You Win!' : 'You Lose!'}</div>
        <div className="outcome-subtitle">
          {detectivesWin ? '🕵️ Detectives Win!' : '😈 Imposters Win!'}
        </div>
      </div>

      <p className="hint center-text">
        {category} — the secret word was <strong>{word}</strong>
      </p>

      <div>
        <span className="label">{imposterIds.length > 1 ? 'The Imposters' : 'The Imposter'}</span>
        <ul className="player-list">
          {imposterIds.map((id) => (
            <li key={id} className="player-item player-item-imposter">
              <PlayerDot color={colorById[id]} />
              {nameById[id] ?? 'Unknown'}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="label">Votes</span>
        <ul className="player-list">
          {sortedPlayers.map((p) => (
            <li key={p.id} className="player-item">
              <PlayerDot color={p.colorHex ?? p.color} />
              {p.name}
              <span className="vote-count">
                {tally[p.id] ?? 0} vote{(tally[p.id] ?? 0) === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
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
