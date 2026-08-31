import SharedCanvas from './SharedCanvas'

// Everyone's had a turn — a beat to study the finished picture before the
// vote.
export default function Gallery({ game, isHost, onStartVote }) {
  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} — the finished drawing
        <span className="emoji-cat">{game.category}</span>
      </p>

      <SharedCanvas src={game.canvas} label="The finished shared drawing" />

      <p className="hint center-text">
        Who added the piece that doesn't quite fit? Study it before you vote.
      </p>

      {isHost ? (
        <button className="btn btn-primary" onClick={onStartVote}>
          Start Voting
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start voting…</p>
      )}
    </div>
  )
}
