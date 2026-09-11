import { PlayerDot } from './PlayerDot'

// Cross-game "who's voted" strip for any simultaneous-ballot phase (Fake
// Artist, Imposter, Fibbage, …). Shows which players have already cast
// their vote this round WITHOUT revealing who or what they picked, so the
// group can see at a glance how many are still pending.
export function VotedIndicator({ players, votedPlayerIds, myId }) {
  const voted = new Set(votedPlayerIds ?? [])
  return (
    <div className="voted-indicator">
      {players.map((p) => {
        const done = voted.has(p.id)
        return (
          <span key={p.id} className={`voted-chip ${done ? 'voted-chip-done' : 'voted-chip-pending'}`}>
            <PlayerDot color={p.colorHex ?? p.color} className="player-cdot-inline" />
            {p.name}
            {p.id === myId ? ' (you)' : ''}
            {done && <span className="voted-chip-check">✓</span>}
          </span>
        )
      })}
    </div>
  )
}
