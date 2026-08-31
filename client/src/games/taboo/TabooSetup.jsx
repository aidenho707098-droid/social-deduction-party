import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

// Keep in sync with CATEGORIES in server/games/tabooWords.js.
const CATEGORY_OPTIONS = [
  { key: 'objects', label: 'Objects' },
  { key: 'movies', label: 'Movies' },
  { key: 'places', label: 'Places' },
  { key: 'food', label: 'Food & Drink' },
  { key: 'animals', label: 'Animals' },
  { key: 'activities', label: 'Activities' },
]
const RANDOM = 'random'
const ALL_KEYS = CATEGORY_OPTIONS.map((c) => c.key)

export default function TabooSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const savedCats = Array.isArray(saved?.categories) ? saved.categories : []
  const [randomEach, setRandomEach] = useState(() => savedCats.includes(RANDOM))
  const [categories, setCategories] = useState(() => {
    const fromSaved = savedCats.filter((k) => ALL_KEYS.includes(k))
    return fromSaved.length ? fromSaved : ALL_KEYS
  })
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))

  const notEnough = playerCount < 3

  function toggleCategory(key) {
    setCategories((prev) => {
      if (prev.includes(key)) {
        // Never let the host turn off the last category.
        return prev.length === 1 ? prev : prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  function start() {
    onStart({ rounds, categories: randomEach ? [RANDOM] : categories })
  }

  return (
    <div className="screen setup-screen">
      <h1 className="title">Taboo</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round one player describes a secret word out loud without saying
        any of its forbidden words. Everyone else races to type the answer —
        the sooner the room gets it, the more everyone scores.
      </p>

      <div>
        <span className="label">Categories</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${randomEach ? 'pill-active' : ''}`}
            onClick={() => setRandomEach((v) => !v)}
          >
            🎲 Random each round
          </button>
        </div>
        <div
          className={`pill-group pill-group-wrap taboo-cat-pills ${
            randomEach ? 'taboo-cat-pills-off' : ''
          }`}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pill ${
                !randomEach && categories.includes(opt.key) ? 'pill-active' : ''
              }`}
              onClick={() => !randomEach && toggleCategory(opt.key)}
              disabled={randomEach}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {randomEach
            ? 'Every round pulls a fresh random category from all six.'
            : 'Rounds are drawn from the categories you turn on, no repeats.'}
        </p>
      </div>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
        hint="One player is the Describer each round; the role rotates evenly through the group."
      />

      {notEnough && <p className="hint">Taboo needs at least 3 players.</p>}
      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={start} disabled={notEnough}>
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
