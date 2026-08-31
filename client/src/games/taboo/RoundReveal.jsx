import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function RoundReveal({ game, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const {
    word,
    taboo = [],
    categoryName,
    describerId,
    describerPoints,
    anyCorrect,
    rows = [],
  } = game.result
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const solvedCount = rows.filter((r) => r.correct).length

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} answer
        {categoryName && <span className="emoji-cat">{categoryName}</span>}
      </p>

      <div className="emoji-answer-title">{word}</div>
      <div className="taboo-forbidden taboo-forbidden-sm center-text">
        {taboo.map((w) => (
          <span key={w} className="taboo-forbidden-chip">{w}</span>
        ))}
      </div>
      <p className="hint center-text">
        {solvedCount} of {rows.length} guessed it
      </p>

      <div>
        <span className="label">Describer</span>
        <div className="wyr-board">
          <div
            className={`wyr-board-row ${describerId === myId ? 'wyr-me' : ''}`}
          >
            <span className="taboo-placing">🎤</span>
            <span>
              <PlayerDot color={colorById[describerId]} className="player-cdot-inline" />
              {nameById[describerId] ?? 'Unknown'}
            </span>
            {describerPoints > 0 ? (
              <span className="wyr-plus">+{describerPoints}</span>
            ) : (
              <span className="emoji-guess-text">
                {anyCorrect ? '—' : 'nobody got it'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <span className="label">Guesses</span>
        <div className="wyr-board">
          {rows.map((r) => (
            <div
              key={r.playerId}
              className={`wyr-board-row ${r.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span className={`emoji-verdict ${r.correct ? 'ok' : 'no'}`}>
                {r.correct ? '✓' : '✗'}
              </span>
              <span>
                <PlayerDot color={colorById[r.playerId]} className="player-cdot-inline" />
                {nameById[r.playerId] ?? 'Unknown'}
              </span>
              <span className="emoji-guess-text">{r.guess ? `"${r.guess}"` : '—'}</span>
              {r.correct && (
                <span className="wyr-plus">
                  +{r.points}
                  <span className="emoji-time"> · {ordinal(r.placing)}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Leaderboard</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div
              key={s.playerId}
              className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}
            >
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

      {isHost ? (
        <button className="btn btn-primary" onClick={onNext}>
          {isLastRound ? 'See Final Results' : 'Next Round'}
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
