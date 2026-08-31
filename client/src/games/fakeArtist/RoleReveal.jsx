// The "brief" phase: each player privately sees their role before the
// first pen goes down. room_update (which switches to this phase) and
// your_role arrive as separate messages, so show nothing until the role
// lands rather than guessing a default.
export default function RoleReveal({ game, myRole, isHost, onStart }) {
  const fa = myRole?.fakeArtist
  if (!fa) {
    return (
      <div className="screen center">
        <p className="hint">Dealing roles…</p>
      </div>
    )
  }
  const isImposter = fa.role === 'imposter'

  return (
    <div className="screen center">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
        <span className="emoji-cat">{game.category}</span>
      </p>

      <div className={`role-card ${isImposter ? 'role-card-imposter' : 'role-card-crew'}`}>
        {isImposter ? (
          <>
            <div className="role-card-icon">🎭</div>
            <h2>You're the Fake Artist!</h2>
            <p>
              Category: <strong>{fa.category}</strong>
            </p>
            <p>You don't know the word. Add small marks and blend in.</p>
          </>
        ) : (
          <>
            <div className="role-card-icon">🖌️</div>
            <h2>The secret word is:</h2>
            <div className="role-word">{fa.word}</div>
            <p>Draw ONE small piece each turn — don't give it all away.</p>
          </>
        )}
      </div>

      {isHost ? (
        <button className="btn btn-start" onClick={onStart}>
          Start Drawing
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start the round…</p>
      )}
    </div>
  )
}
