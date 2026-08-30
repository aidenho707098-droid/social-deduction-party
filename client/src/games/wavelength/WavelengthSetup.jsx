import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]

export default function WavelengthSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const [rounds, setRounds] = useState(() =>
    ROUND_OPTIONS.includes(saved?.rounds) ? saved.rounds : 5,
  )

  const notEnough = playerCount < 3

  return (
    <div className="screen">
      <h1 className="title">Wavelength</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round one player secretly gets a number on a scale and writes a
        clue for it. Everyone else guesses the number — the closer, the more
        points, for guessers and the Clue-Giver alike.
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
          A different player gives the clue each round, rotating through the
          group. Scales don't repeat within a game.
        </p>
      </div>

      {notEnough && (
        <p className="hint">Wavelength needs at least 3 players.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds })}
        disabled={notEnough}
      >
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
