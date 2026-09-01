import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import AiCustomOption from '../AiCustomOption'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

// Keep in sync with CATEGORY_NAMES in server/fakeArtistWords.js.
const CATEGORY_OPTIONS = [
  'Animals',
  'Food & Drink',
  'Household Objects',
  'Places',
  'Nature',
  'Vehicles & Transport',
]
const RANDOM = '__random__'

export default function FakeArtistSetup({
  gameId,
  playerCount,
  saved,
  onStart,
  onCancel,
  error,
  submitLabel,
  aiContent = {},
  aiEnabled = false,
  onGenerateContent,
}) {
  const customThemes = aiContent[gameId] ?? [] // AI theme names this session
  const savedCats = Array.isArray(saved?.categories) ? saved.categories : []
  const [randomEach, setRandomEach] = useState(() => savedCats.includes(RANDOM))
  const [categories, setCategories] = useState(() => {
    const valid = new Set([...CATEGORY_OPTIONS, ...customThemes])
    const fromSaved = savedCats.filter((k) => valid.has(k))
    return fromSaved.length ? fromSaved : [...CATEGORY_OPTIONS]
  })
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))

  const notEnough = playerCount < 3

  function toggleCategory(key) {
    setCategories((prev) => {
      if (prev.includes(key)) {
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
      <h1 className="title">Fake Artist</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Everyone adds one small piece to a shared drawing of a secret word —
        except the Fake Artist, who's only told the category. Vote out the
        faker, then they get one guess at the word.
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
          {CATEGORY_OPTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className={`pill ${
                !randomEach && categories.includes(name) ? 'pill-active' : ''
              }`}
              onClick={() => !randomEach && toggleCategory(name)}
              disabled={randomEach}
            >
              {name}
            </button>
          ))}
          {customThemes.map((name) => (
            <button
              key={name}
              type="button"
              className={`pill ${
                !randomEach && categories.includes(name) ? 'pill-active' : ''
              }`}
              onClick={() => !randomEach && toggleCategory(name)}
              disabled={randomEach}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {randomEach
            ? 'Every round pulls a fresh random category.'
            : 'Words are drawn from the categories you turn on, no repeats. The category is shown to everyone.'}
        </p>
        {aiEnabled && (
          <AiCustomOption
            label="Custom Theme"
            placeholder="Christmas"
            noun="word set"
            hint="Name a theme. The app builds a batch of drawable secret words, each with a general category hint for the Fake Artist, and keeps it in this room for the session."
            onGenerate={(name, cb) => onGenerateContent(gameId, name, cb)}
            onGenerated={(name) => {
              setRandomEach(false)
              setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]))
            }}
          />
        )}
      </div>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
        hint="The Fake Artist role and turn order rotate through the group each round."
      />

      {notEnough && <p className="hint">Fake Artist needs at least 3 players.</p>}
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
