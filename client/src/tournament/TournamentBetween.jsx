const MEDALS = ['🥇', '🥈', '🥉']

// Shown after each game: that game's final standings converted to
// tournament points, plus the running overall leaderboard.
export default function TournamentBetween({ t, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const nameOf = (id) => nameById[id] ?? 'Unknown'
  const last = t.history[t.history.length - 1]
  const isFinalGame = t.currentIndex + 1 >= t.totalGames

  const gameRanks = last?.skipped
    ? []
    : [...(last?.ranks ?? [])].sort((a, b) => a.rank - b.rank || nameOf(a.playerId).localeCompare(nameOf(b.playerId)))

  return (
    <div className="screen">
      <p className="wyr-round">
        Game {t.gamesPlayed} of {t.totalGames} complete
      </p>
      <h1 className="title">{last?.gameName ?? 'Game'}</h1>

      {last?.skipped ? (
        <p className="hint hint-block">Skipped — not enough players for this game.</p>
      ) : (
        <div>
          <span className="label">This game → tournament points</span>
          <div className="wyr-board">
            {gameRanks.map((r) => (
              <div
                key={r.playerId}
                className={`wyr-board-row ${r.playerId === myId ? 'wyr-me' : ''}`}
              >
                <span className="wyr-board-rank">{r.rank}</span>
                <span>{nameOf(r.playerId)}</span>
                <span className="tour-game-score">{r.gameScore} in game</span>
                <span className={`wyr-plus ${r.points === 0 ? 'tour-zero' : ''}`}>
                  +{r.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="label">🏆 Tournament leaderboard</span>
        <div className="wyr-board">
          {t.leaderboard.map((p, i) => (
            <div
              key={p.playerId}
              className={`wyr-board-row ${p.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span className="wyr-board-rank">{MEDALS[i] ?? i + 1}</span>
              <span>{nameOf(p.playerId)}</span>
              <span className="wyr-board-score">
                {p.points} {p.points === 1 ? 'pt' : 'pts'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onNext}>
          {isFinalGame ? 'See Tournament Winner →' : 'Next Game →'}
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
