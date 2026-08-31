import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Easy only' },
  { key: 'medium', label: 'Medium only' },
  { key: 'hard', label: 'Hard only' },
  { key: 'mixed', label: 'Mixed' },
]

// Keep in sync with CATEGORIES in server/games/emoji-movie.js.
const CATEGORY_OPTIONS = [
  { key: 'movies', label: 'Movies' },
  { key: 'tv', label: 'TV Shows' },
  { key: 'countries', label: 'Countries' },
  { key: 'video-games', label: 'Video Games' },
  { key: 'mashup', label: 'Mashup' },
]

export default function EmojiMovieSetup({ gameId, saved, onStart, onCancel, error, submitLabel }) {
  // Pre-fill from the last settings the host used for this game THIS room
  // (`saved`), falling back to defaults the first time / in a fresh room.
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [difficulty, setDifficulty] = useState(() =>
    DIFFICULTY_OPTIONS.some((o) => o.key === saved?.difficulty) ? saved.difficulty : 'mixed',
  )
  const [categories, setCategories] = useState(() => {
    const valid = CATEGORY_OPTIONS.map((c) => c.key)
    const fromSaved = Array.isArray(saved?.categories)
      ? saved.categories.filter((k) => valid.includes(k))
      : []
    return fromSaved.length ? fromSaved : valid
  })

  function toggleCategory(key) {
    setCategories((prev) => {
      if (prev.includes(key)) {
        // Never let the host turn off the last category.
        return prev.length === 1 ? prev : prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  return (
    <div className="screen setup-screen">
      <h1 className="title">Crack the Code</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round an answer is spelled out in emojis, revealed one at a time.
        Type it on your own phone the moment you think you've got it — guessing
        with fewer emojis showing scores far more.
      </p>

      <div>
        <span className="label">Categories</span>
        <div className="pill-group pill-group-wrap">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pill ${categories.includes(opt.key) ? 'pill-active' : ''}`}
              onClick={() => toggleCategory(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          Rounds are drawn from the categories you turn on. Countries always end
          on the flag; Mashup combines two emojis into one word (⭐ + 🚢 =
          starship).
        </p>
      </div>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
      />

      <div>
        <span className="label">Difficulty</span>
        <div className="pill-group pill-group-wrap">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pill ${difficulty === opt.key ? 'pill-active' : ''}`}
              onClick={() => setDifficulty(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {difficulty === 'mixed'
            ? 'Answers of every tier — harder ones are worth more points.'
            : `Only ${difficulty} answers. If there aren't enough for ${rounds} rounds, the game runs fewer.`}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds, difficulty, categories })}
      >
        {submitLabel ?? "Start Game"}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
