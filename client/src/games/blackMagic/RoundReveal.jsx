import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

function format(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function RoundReveal({ game, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const { curse, witchId, outcome, guesserId, elapsedMs, witchPts, playerPts } = game.result
  const witchName = nameById[witchId] ?? 'The Witch'
  const guesserName = guesserId ? nameById[guesserId] ?? 'A Player' : null
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const mmss = format(elapsedMs)

  let headline
  let sub
  let won = false
  if (outcome === 'lifted') {
    headline = `${guesserName} lifted The Curse!`
    sub = `Cracked in ${mmss}`
    won = true
  } else if (outcome === 'unbroken') {
    headline = 'Curse Unbroken'
    sub = `${witchName} lasted the full ${format(game.limitMs)}`
  } else if (outcome === 'revealed') {
    headline = `${witchName} revealed The Curse`
    sub = `Round ended at ${mmss}`
  } else {
    headline = 'Round abandoned'
    sub = 'The Witch left the game — no points this round'
  }

  return (
    <div className="screen">
      <p className="wyr-round">Round {game.roundIndex + 1} result</p>

      <div className={`outcome-banner ${won ? 'outcome-win' : 'outcome-lose'}`}>
        <div className="outcome-icon">🔮</div>
        <div className="outcome-title">{headline}</div>
        <div className="outcome-subtitle">{sub}</div>
      </div>

      {curse?.text && (
        <div className="bm-curse-card bm-curse-reveal">
          <span className="bm-curse-label">
            The Curse was
            {curse.category && (
              <span className={`bm-curse-cat bm-curse-cat-${curse.category}`}>
                {curse.category}
              </span>
            )}
          </span>
          <p className="bm-curse-text">{curse.text}</p>
        </div>
      )}

      <div>
        <span className="label">Points this round</span>
        <div className="wyr-board">
          <div className="wyr-board-row">
            <span>
              🔮 {witchName} <span className="hint">The Witch</span>
            </span>
            <span className="wyr-plus">{witchPts > 0 ? `+${witchPts}` : '+0'}</span>
          </div>
          {outcome === 'lifted' && guesserName && (
            <div className="wyr-board-row">
              <span>
                🗝️ {guesserName} <span className="hint">lifted it</span>
              </span>
              <span className="wyr-plus">{playerPts > 0 ? `+${playerPts}` : '+0'}</span>
            </div>
          )}
        </div>
        {outcome === 'revealed' && (
          <p className="hint hint-block">
            Ended by The Witch — no Player points awarded this round.
          </p>
        )}
        {outcome === 'unbroken' && (
          <p className="hint hint-block">No one cracked it in time — no Player points.</p>
        )}
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
              <span>
                <PlayerDot color={colorById[s.playerId]} className="player-cdot-inline" />
                {nameById[s.playerId] ?? 'Unknown'}
              </span>
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
