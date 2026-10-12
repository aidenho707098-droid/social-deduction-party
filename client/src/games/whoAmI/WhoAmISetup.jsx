import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

// Keep in sync with CATEGORIES in server/games/whoAmIBank.js.
const CATEGORY_OPTIONS = [
  { key: 'animals', label: 'Animals' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'fictional', label: 'Fictional Characters' },
  { key: 'foods', label: 'Foods' },
  { key: 'places', label: 'Places & Landmarks' },
  { key: 'objects', label: 'Everyday Objects' },
]
const RANDOM = '__random__'
const ALL_KEYS = CATEGORY_OPTIONS.map((c) => c.key)

const MIN_PLAYERS = 3
const MAX_PLAYERS = 10

export default function WhoAmISetup({
  gameId,
  playerCount,
  saved,
  onStart,
  onCancel,
  error,
  submitLabel,
}) {
  const savedCats = Array.isArray(saved?.categories) ? saved.categories : []
  const [randomEach, setRandomEach] = useState(() => savedCats.includes(RANDOM))
  const [categories, setCategories] = useState(() => {
    const fromSaved = savedCats.filter((k) => ALL_KEYS.includes(k))
    return fromSaved.length ? fromSaved : ALL_KEYS
  })
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))

  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const blocked = tooFew || tooMany

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
      <h1 className="title">Who Am I?</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Everyone gets a secret identity that everyone else can see — except
        you. Ask yes/no questions out loud to work out who you are, then
        type your guess the moment you've got it.
      </p>

      <div>
        <span className="label">Categories</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${randomEach ? 'pill-active' : ''}`}
            onClick={() => setRandomEach((v) => !v)}
          >
            🎲 Random Category
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
            ? 'Every round pools identities from all six categories.'
            : 'Identities are drawn from the categories you turn on.'}
        </p>
      </div>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
        hint="Every round deals a fresh identity to everyone and shuffles who goes first."
      />

      {tooFew && <p className="hint">Who Am I? needs at least {MIN_PLAYERS} players.</p>}
      {tooMany && <p className="hint">Who Am I? supports at most {MAX_PLAYERS} players.</p>}
      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={start} disabled={blocked}>
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
