import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]

export default function WouldYouRatherSetup({ gameId, onStart, onCancel, error }) {
  const [rounds, setRounds] = useState(5)

  return (
    <div className="screen">
      <h1 className="title">Would You Rather</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round everyone sees the same question and privately picks one of
        its options. Land on the majority answer to score — the bigger the
        majority, the more points, with a bonus for a streak of them.
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
          Questions are drawn at random with no repeats within a game.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={() => onStart({ rounds })}>
        Start Game
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
