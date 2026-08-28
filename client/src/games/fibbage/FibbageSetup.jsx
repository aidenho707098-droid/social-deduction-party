import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]

export default function FibbageSetup({ gameId, playerCount, onStart, onCancel, error }) {
  const [rounds, setRounds] = useState(5)

  const notEnough = playerCount < 3

  return (
    <div className="screen">
      <h1 className="title">Fact or Fake</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round shows a true-but-obscure fact with a blank. Everyone writes
        a fake answer to blend in with the real one, then votes for which
        answer they think is true. Fool people with your fake, and spot the
        truth yourself.
      </p>

      <div>
        <span className="label">How many rounds?</span>
        <div className="pill-group">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`pill ${rounds === n ? 'pill-active' : ''}`}
              onClick={() => setRounds(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          Facts are drawn at random with no repeats within a game.
        </p>
      </div>

      {notEnough && (
        <p className="hint">Fact or Fake needs at least 3 players — bluffing doesn't work with 2.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds })}
        disabled={notEnough}
      >
        Start Game
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
