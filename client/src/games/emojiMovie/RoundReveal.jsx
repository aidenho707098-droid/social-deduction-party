const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export default function RoundReveal({ game, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const { title, emojis, entries, difficulty, categoryName } = game.result
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const solvedCount = entries.filter((e) => e.correct).length
  const diffLabel = DIFFICULTY_LABEL[difficulty]

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} answer
        {categoryName && <span className="emoji-cat">{categoryName}</span>}
        {diffLabel && (
          <span className={`emoji-diff emoji-diff-${difficulty}`}>{diffLabel}</span>
        )}
      </p>

      <div className="emoji-clue emoji-clue-sm">{emojis.join(' ')}</div>
      <div className="emoji-answer-title">{title}</div>
      <p className="hint center-text">
        {solvedCount} of {entries.length} got it
      </p>

      <div>
        <span className="label">Guesses</span>
        <div className="wyr-board">
          {entries.map((e) => (
            <div
              key={e.playerId}
              className={`wyr-board-row ${e.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span className={`emoji-verdict ${e.correct ? 'ok' : 'no'}`}>
                {e.correct ? '✓' : '✗'}
              </span>
              <span>{nameById[e.playerId] ?? 'Unknown'}</span>
              <span className="emoji-guess-text">{e.guess ? `"${e.guess}"` : '—'}</span>
              {e.correct && (
                <span className="wyr-plus">
                  +{e.points}
                  {e.revealedAtGuess != null && (
                    <span className="emoji-time">
                      {' '}
                      · {e.revealedAtGuess} emoji{e.revealedAtGuess === 1 ? '' : 's'}
                    </span>
                  )}
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
              <span>{nameById[s.playerId] ?? 'Unknown'}</span>
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
        <p className="hint center-text">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
