import { PlayerDot } from '../../PlayerDot'
import { useCountdown } from '../alphabetSoup/useCountdown'
import { roundLabel } from './labels'

// After every round: each pairing (who set what, who cracked it in how
// many, the points both ways) and the running leaderboard.
export default function RoundReveal({ game, myId, isHost, nameById, colorById, actions }) {
  const msLeft = useCountdown(game.msLeft ?? 0, `${game.serial}:reveal`, 250)
  const rows = game.result?.rows ?? []
  const points = game.result?.points ?? {}
  const last = game.roundIndex + 1 >= game.totalRounds
  const nm = (id) => (id === myId ? 'You' : nameById[id] ?? 'Someone')
  const dot = (id) => <PlayerDot color={colorById[id]} className="player-cdot-inline" />

  // Your own pairings first: the word you cracked, then the word you set.
  const order = (r) => (r.solverId === myId ? 0 : r.setterId === myId ? 1 : 2)
  const sorted = [...rows].sort((a, b) => order(a) - order(b))

  return (
    <div className="screen wh-reveal">
      <div>
        <p className="wyr-round">{roundLabel(game)} · Results</p>
        <h2 className="wh-title">The words</h2>
      </div>

      <ul className="wh-pairs stagger-in">
        {sorted.map((r) => {
          const outcome =
            r.status === 'solved'
              ? `Cracked in ${r.guessCount} of ${r.maxGuesses}`
              : r.status === 'failed'
                ? r.guessCount >= r.maxGuesses
                  ? 'Not cracked: out of guesses'
                  : 'Not cracked: out of time'
                : 'Void: no points'
          return (
            <li key={r.solverId} className={`wh-pair wh-pair-${r.status}`}>
              <div className="wh-pair-word">
                <span className="wh-pair-display">{r.display}</span>
                {r.display.toUpperCase() !== r.word && <span className="wh-pair-grid">{r.word}</span>}
              </div>
              <p className="wh-pair-sub">
                {r.prompt ?? (r.hint ? `Hint: ${r.hint}` : 'Free choice')}
                {r.fallback && ' · assigned word'}
                {!r.verified && ' · unchecked'}
              </p>
              {r.patterns.length > 0 && (
                <div className="wh-mini" aria-hidden="true" style={{ '--wh-cols': r.word.length }}>
                  {r.patterns.map((p, i) => (
                    <div key={i} className="wh-mini-row">
                      {[...p].map((s, j) => (
                        <span key={j} className={`wh-mini-tile wh-t-${s}`} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <p className="wh-pair-outcome">{outcome}</p>
              <div className="wh-pair-scores">
                <span>
                  {dot(r.setterId)}
                  {nm(r.setterId)} set it <strong>+{r.setterPoints}</strong>
                </span>
                <span>
                  {dot(r.solverId)}
                  {nm(r.solverId)} solved <strong>+{r.solverPoints}</strong>
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div>
        <span className="label">Leaderboard</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div key={s.playerId} className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}>
              <span className="wyr-board-rank">{i + 1}</span>
              <span>
                {dot(s.playerId)}
                {nameById[s.playerId] ?? 'Unknown'}
              </span>
              <span className="wyr-board-score">
                {s.score}
                {points[s.playerId] ? <span className="wh-gain"> +{points[s.playerId]}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="ec-setup-actions">
        {isHost && (
          <button type="button" className="btn btn-primary" onClick={() => actions.wordHeistNext()}>
            {last ? 'See final results' : 'Next round'}
          </button>
        )}
        <p className="hint center-text">
          {last ? 'Final results' : 'Next round'} in {Math.ceil(msLeft / 1000)}s
        </p>
      </div>
    </div>
  )
}
