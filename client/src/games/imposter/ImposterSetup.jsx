import { useState } from 'react'
import { CATEGORY_NAMES, RANDOM_CATEGORY } from './words'
import HowToPlay from '../HowToPlay'

export default function ImposterSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const canUseTwoImposters = playerCount >= 4

  // Pre-fill from the host's last settings for this game this room. Clamp
  // "2 imposters" back to 1 if there aren't enough players for it now.
  const [imposterCount, setImposterCount] = useState(() => {
    const wanted = [1, 2].includes(saved?.imposterCount) ? saved.imposterCount : 1
    return wanted === 2 && !canUseTwoImposters ? 1 : wanted
  })
  const [category, setCategory] = useState(() =>
    [...CATEGORY_NAMES, RANDOM_CATEGORY].includes(saved?.category)
      ? saved.category
      : CATEGORY_NAMES[0],
  )

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
          <button
            type="button"
            className={`pill ${category === RANDOM_CATEGORY ? 'pill-active' : ''}`}
            onClick={() => setCategory(RANDOM_CATEGORY)}
          >
            🎲 Random Category
          </button>
        </div>
        {category === RANDOM_CATEGORY && (
          <p className="hint">The app will pick a category at random when the round starts.</p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={() => onStart({ imposterCount, category })}>
        {submitLabel ?? 'Start Round'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
