import Stopwatch from './Stopwatch'
import HintFeed from './HintFeed'
import { PlayerDot } from '../../PlayerDot'

export default function ActiveRound({ game, players, myId, myRole, isHost, onAward, onReveal }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const iAmWitch = myId === game.witchId // from public state — reliable even before myRole lands
  const witchName = nameById[game.witchId] ?? 'someone'
  const others = players.filter((p) => p.id !== game.witchId)

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>

      <Stopwatch elapsedMs={game.elapsedMs} limitMs={game.limitMs} />

      {iAmWitch ? (
        <>
          <div className="bm-witch-banner">🔮 You are The Witch</div>

          <div className="bm-curse-card">
            <span className="bm-curse-label">
              The Curse
              {myRole?.curse?.category && (
                <span className={`bm-curse-cat bm-curse-cat-${myRole.curse.category}`}>
                  {myRole.curse.category}
                </span>
              )}
            </span>
            <p className="bm-curse-text">{myRole?.curse?.text ?? '…'}</p>
          </div>

          <p className="hint hint-block">
            Follow it as naturally as you can. When a Player says The Curse out
            loud, tap their name to give them the point and end the round.
          </p>

          <span className="label">Who lifted The Curse?</span>
          <ul className="player-list bm-award-list">
            {others.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn-secondary bm-award-btn"
                  onClick={() => onAward(p.id)}
                  disabled={p.connected === false}
                >
                  <PlayerDot color={p.colorHex ?? p.color} className="player-cdot-inline" />
                  {p.name}
                  {p.connected === false && ' (disconnected)'}
                </button>
              </li>
            ))}
          </ul>

          <button className="btn btn-text" onClick={onReveal}>
            Reveal The Curse →
          </button>
        </>
      ) : (
        <>
          <p className="bm-role-player">
            The Witch this round is <strong>{witchName}</strong>
          </p>
          <p className="wyr-prompt">Crack The Curse</p>
          <p className="hint hint-block">
            {witchName} is secretly following a hidden behaviour rule. Talk to
            them, watch for the pattern, and be the first to say The Curse out
            loud — {witchName} will award the point.
          </p>
          <p className="hint center-text">The round ends when someone lifts The Curse.</p>

          <HintFeed hints={game.hints} />

          {isHost && (
            <button className="btn btn-text" onClick={onReveal}>
              End round &amp; reveal (host)
            </button>
          )}
        </>
      )}
    </div>
  )
}
