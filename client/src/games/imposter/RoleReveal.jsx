export default function RoleReveal({ myRole, isHost, onStartTurns }) {
  // Briefly true right as a round starts: room_update (which switches the
  // screen to this phase) and your_role (which fills this in) are two
  // separate messages, so there's a beat where we know a round has begun
  // but haven't been told our own role yet. Showing nothing here — rather
  // than falling through to a guessed default — is what keeps this safe.
  if (!myRole) {
    return (
      <div className="screen center">
        <p className="hint">Revealing your role…</p>
      </div>
    )
  }

  const isImposter = myRole.role === 'imposter'

  return (
    <div className="screen center">
      <div className={`role-card ${isImposter ? 'role-card-imposter' : 'role-card-crew'}`}>
        {isImposter ? (
          <>
            <div className="role-card-icon">🕵️</div>
            <h2>You are the Imposter!</h2>
            <p>
              Category: <strong>{myRole.category}</strong>
            </p>
            <p>You don't know the word. Listen closely and bluff.</p>
          </>
        ) : (
          <>
            <div className="role-card-icon">✅</div>
            <h2>The secret word is:</h2>
            <div className="role-word">{myRole.word}</div>
          </>
        )}
      </div>

      {isHost ? (
        <button className="btn btn-start" onClick={onStartTurns}>
          Start Discussion
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to start discussion…</p>
      )}
    </div>
  )
}
