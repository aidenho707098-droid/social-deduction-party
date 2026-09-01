import { useState } from 'react'
import { CATEGORY_NAMES, RANDOM_CATEGORY } from './words'
import HowToPlay from '../HowToPlay'
import AiCustomOption from '../AiCustomOption'

export default function ImposterSetup({
  gameId,
  playerCount,
  saved,
  onStart,
  onCancel,
  error,
  submitLabel,
  // Shared AI custom-content wiring (see Lobby `aiProps`).
  aiContent = {},
  aiEnabled = false,
  onGenerateContent,
}) {
  const canUseTwoImposters = playerCount >= 4
  const customCategories = aiContent[gameId] ?? [] // names generated this session

  // Pre-fill from the host's last settings for this game this room. Clamp
  // "2 imposters" back to 1 if there aren't enough players for it now.
  const [imposterCount, setImposterCount] = useState(() => {
    const wanted = [1, 2].includes(saved?.imposterCount) ? saved.imposterCount : 1
    return wanted === 2 && !canUseTwoImposters ? 1 : wanted
  })

  const validCategory = (name) =>
    [...CATEGORY_NAMES, ...customCategories, RANDOM_CATEGORY].includes(name)

  const [category, setCategory] = useState(() =>
    validCategory(saved?.category) ? saved.category : CATEGORY_NAMES[0],
  )

  return (
    <div className="screen setup-screen">
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
          {customCategories.map((name) => (
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

        {aiEnabled && (
          <AiCustomOption
            label="Custom Category"
            placeholder="Kitchen Utensils"
            noun="word list"
            hint="Name any category (e.g. “Kitchen Utensils”, “90s Cartoons”). The app generates a word list for it and keeps it in this room for the rest of the session."
            onGenerate={(name, cb) => onGenerateContent(gameId, name, cb)}
            onGenerated={(name) => setCategory(name)}
          />
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ imposterCount, category })}
      >
        {submitLabel ?? 'Start Round'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
