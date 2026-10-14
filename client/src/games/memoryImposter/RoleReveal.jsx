import { SequenceStrip } from './items'
import { RoundLine } from './shared'

// ROLE REVEAL (3s, right after the look). Private: the Imposter's strip
// turns to blanks of the same size; everyone else keeps theirs.
export default function RoleReveal({ game, priv }) {
  if (!priv?.role) {
    return (
      <div className="screen center">
        <p className="hint">Dealing roles…</p>
      </div>
    )
  }
  const imposter = priv.role === 'imposter'
  return (
    <div className="screen mi-roles">
      <RoundLine game={game} />
      <div className={`role-card mi-role-card ${imposter ? 'role-card-imposter' : 'role-card-crew'}`}>
        <h2>{imposter ? 'You are the Imposter' : 'You can see the sequence'}</h2>
        <p>
          {imposter
            ? "Your sequence is gone. Bluff like you still have it, and don't get voted out."
            : 'It stays on your screen all round. Find the player who lost theirs.'}
        </p>
      </div>
      <SequenceStrip items={imposter ? null : priv.sequence} length={game.length} />
    </div>
  )
}
