import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

// A compact, numbered legend of the turn order. The shared drawing is built
// up one layer per turn in this exact sequence, so once the live "X is
// drawing…" status is gone (studying the picture before voting, during the
// vote, at the reveal) this is what lets players match a layer back to who
// added it.
export default function TurnAttribution({ game, players, myId }) {
  const colorById = playerColorMap(players)
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))

  return (
    <div className="fa-attribution">
      {game.turnOrder.map((pid, i) => (
        <span key={pid} className="fa-attribution-chip">
          <span className="fa-attribution-rank">{i + 1}</span>
          <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
          {nameById[pid] ?? 'Unknown'}
          {pid === myId && ' (you)'}
        </span>
      ))}
    </div>
  )
}
