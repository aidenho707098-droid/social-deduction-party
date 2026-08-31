import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

// The pre-round beat. The Describer sees only that they're up — the secret
// word and forbidden list stay hidden until they tap "Reveal", which is also
// what starts the shared clock (so they get a moment to prepare and don't
// lose time before they've seen the word). Everyone else just sees who's
// describing and gets ready to type.
export default function DescribeIntro({ game, players, myRole, isHost, onStart }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const amDescriber = myRole?.taboo?.role === 'describer'
  const describerName = nameById[game.describerId] ?? 'Someone'

  const roundLine = (
    <p className="wyr-round">
      Round {game.roundIndex + 1} of {game.totalRounds}
      {game.categoryName && <span className="emoji-cat">{game.categoryName}</span>}
    </p>
  )

  if (amDescriber) {
    return (
      <div className="screen center">
        {roundLine}

        <div className="role-card taboo-secret-card">
          <div className="role-card-icon">🎤</div>
          <h2>You're the Describer</h2>
          <p>
            Take a breath. Tap below to reveal your secret word and forbidden
            list — the 3:00 clock only starts the moment you do.
          </p>
        </div>

        <button className="btn btn-start" onClick={onStart}>
          Reveal word &amp; start
        </button>
      </div>
    )
  }

  return (
    <div className="screen center">
      {roundLine}

      <div className="role-card taboo-guesser-card">
        <div className="role-card-icon">👂</div>
        <h2>
          <PlayerDot color={colorById[game.describerId]} className="player-cdot-inline" />
          {describerName} is describing
        </h2>
        <p>Get ready to type your guess the second you think you know it.</p>
      </div>

      {isHost ? (
        <button className="btn btn-text" onClick={onStart}>
          Start the round for them →
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for {describerName} to start…</p>
      )}
    </div>
  )
}
