import { useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import SharedCanvas from './SharedCanvas'

export default function RevealScreen({
  game,
  players,
  myId,
  isHost,
  onGuess,
  onSkipGuess,
  onNext,
}) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const r = game.result
  const [guess, setGuess] = useState('')
  const [sent, setSent] = useState(false)

  if (!r) return <div className="screen center"><p className="hint">Tallying votes…</p></div>

  const impName = nameById[r.imposterId] ?? 'Unknown'
  const amImposter = r.imposterId === myId
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const maxVotes = Math.max(1, ...Object.values(r.counts ?? {}))
  const ranked = [...game.turnOrder].sort((a, b) => (r.counts[b] ?? 0) - (r.counts[a] ?? 0))

  function submitGuess() {
    const v = guess.trim()
    if (!v || sent) return
    setSent(true)
    onGuess(v)
  }

  return (
    <div className="screen">
      <div className={`outcome-banner ${r.caught ? 'outcome-win' : 'outcome-lose'}`}>
        <div className="outcome-icon">{r.caught ? '🎯' : '🎭'}</div>
        <div className="outcome-title">{r.caught ? 'Caught!' : 'Got away with it'}</div>
        <div className="outcome-subtitle">
          The Fake Artist was <strong>{impName}</strong>
        </div>
      </div>

      <SharedCanvas src={game.canvas} />

      <p className="emoji-answer-title">
        The word was: <strong>{r.word}</strong>
        <span className="emoji-cat">{r.category}</span>
      </p>

      <div>
        <span className="label">Votes</span>
        <div className="wyr-board">
          {ranked.map((pid) => {
            const c = r.counts[pid] ?? 0
            const isImp = pid === r.imposterId
            return (
              <div key={pid} className={`wyr-board-row ${pid === myId ? 'wyr-me' : ''}`}>
                <span className={`emoji-verdict ${isImp ? 'ok' : 'no'}`}>{isImp ? '🎭' : ''}</span>
                <span>
                  <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
                  {nameById[pid] ?? 'Unknown'}
                </span>
                <span className="fa-vote-meter">
                  <span className="fa-vote-fill" style={{ width: `${(c / maxVotes) * 100}%` }} />
                </span>
                <span className="wyr-board-score">{c}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fake Artist's word-guess bonus — every round, win or lose the vote */}
      <div className="fa-guess-box">
        {r.guessPending ? (
          amImposter ? (
            <>
              <span className="label">Your guess at the real word (+{r.guessBonus} if right)</span>
              {sent ? (
                <p className="hint center-text waiting">Guess locked in…</p>
              ) : (
                <form
                  className="emoji-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitGuess()
                  }}
                >
                  <input
                    className="input"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="What was the word?"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!guess.trim()}>
                    Lock in guess
                  </button>
                </form>
              )}
            </>
          ) : (
            <p className="hint center-text waiting">
              Waiting for <strong>{impName}</strong> to guess the word…
            </p>
          )
        ) : (
          <p className="fa-guess-result">
            {r.imposterGuess?.text
              ? r.imposterGuess.correct
                ? `🎯 ${impName} guessed “${r.imposterGuess.text}” — nailed it! +${r.guessBonus}`
                : `❌ ${impName} guessed “${r.imposterGuess.text}” — no bonus.`
              : `${impName} didn't get a guess in.`}
          </p>
        )}
      </div>

      <div>
        <span className="label">Leaderboard</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div key={s.playerId} className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}>
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
        r.guessPending ? (
          <button className="btn btn-text" onClick={onSkipGuess}>
            Skip the guess →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onNext}>
            {isLastRound ? 'See Final Results' : 'Next Round'}
          </button>
        )
      ) : (
        <p className="hint center-text waiting">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
