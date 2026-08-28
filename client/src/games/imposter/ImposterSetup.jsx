import { useState } from 'react'
import { CATEGORY_NAMES } from './words'
import HowToPlay from '../HowToPlay'

export default function ImposterSetup({ gameId, playerCount, onStart, onCancel, error }) {
  const [imposterCount, setImposterCount] = useState(1)
  const [category, setCategory] = useState(CATEGORY_NAMES[0])

  const canUseTwoImposters = playerCount >= 4

  return (
    <div className="screen">
      <h1 className="title">Imposter Setup</h1>
      <HowToPlay gameId={gameId} />

      <div>
        <span className="label">Number of Imposters</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${imposterCount === 1 ? 'pill-active' : ''}`}
            onClick={() => setImposterCount(1)}
          >
            1 Imposter
          </button>
          <button
            type="button"
            className={`pill ${imposterCount === 2 ? 'pill-active' : ''}`}
            onClick={() => setImposterCount(2)}
            disabled={!canUseTwoImposters}
          >
            2 Imposters
          </button>
        </div>
        {!canUseTwoImposters && (
          <p className="hint">Need at least 4 players for 2 imposters.</p>
        )}
      </div>

      <div>
        <span className="label">Category</span>
        <p className="hint hint-block">
          You'll pick a category — the app secretly draws the actual word, so even you won't know it.
        </p>
        <div className="pill-group pill-group-wrap">
          {CATEGORY_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`pill ${category === name ? 'pill-active' : ''}`}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={() => onStart({ imposterCount, category })}>
        Start Round
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
