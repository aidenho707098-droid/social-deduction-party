export default function PickWitch({ game, players, isHost, onPick }) {
  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>
      <h1 className="title">Choose The Witch</h1>

      {isHost ? (
        <>
          <p className="hint hint-block">
            Pick who secretly follows The Curse this round. Only they will see
            it — everyone else tries to crack it.
          </p>
          <ul className="player-list bm-pick-list">
            {players.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn-secondary bm-pick-btn"
                  onClick={() => onPick(p.id)}
                  disabled={p.connected === false}
                >
                  {p.name}
                  {p.connected === false && ' (disconnected)'}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint center-text">Waiting for the host to choose The Witch…</p>
      )}
    </div>
  )
}
