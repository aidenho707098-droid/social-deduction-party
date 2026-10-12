import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'
import { CATEGORY_OPTIONS, RANDOM, ALL_KEYS } from './categories'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 10
const LETTER_POOL_SIZE = 20 // A–Z minus Q U V X Y Z

const MODES = [
  {
    key: 'typed',
    name: 'Typed',
    desc: 'Everyone answers at once on their phone — up to 5 answers in 40s. Rare answers score more.',
  },
  {
    key: 'spoken',
    name: 'Spoken',
    desc: 'Take turns saying answers out loud against a shrinking clock. 3 lives — last one standing wins.',
  },
]

export default function AlphabetSoupSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const savedCats = Array.isArray(saved?.categories) ? saved.categories : []
  const [mode, setMode] = useState(() => (saved?.mode === 'spoken' ? 'spoken' : 'typed'))
  const [randomEach, setRandomEach] = useState(() => savedCats.length === 0 || savedCats.includes(RANDOM))
  const [categories, setCategories] = useState(() => {
    const fromSaved = savedCats.filter((k) => ALL_KEYS.includes(k))
    return fromSaved.length ? fromSaved : ALL_KEYS
  })
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [burned, setBurned] = useState(() => saved?.burnedLetters === true)

  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const noCategories = !randomEach && categories.length === 0
  const blocked = tooFew || tooMany || noCategories
  const roundMax = burned ? Math.min(ROUND_MAX, LETTER_POOL_SIZE) : ROUND_MAX

  function toggleCategory(key) {
    setCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function start() {
    onStart({
      mode,
      rounds: Math.min(rounds, roundMax),
      categories: randomEach ? [RANDOM] : categories,
      burnedLetters: burned,
    })
  }

  return (
    <div className="screen setup-screen">
      <h1 className="title">Alphabet Soup</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round stirs up a category and a letter. Name things that fit —
        before the clock (or your lives) run out.
      </p>

      <div>
        <span className="label">Mode</span>
        <div className="tour-mode-choices">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`tour-mode-card ${mode === m.key ? 'tour-mode-active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              <span className="tour-mode-name">{m.name}</span>
              <span className="tour-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <NumberStepper
        label="How many rounds?"
        value={Math.min(rounds, roundMax)}
        min={ROUND_MIN}
        max={roundMax}
        onChange={setRounds}
        hint={
          burned
            ? 'With Burned Letters on, the game can run at most one round per usable letter.'
            : undefined
        }
      />

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
          {!randomEach && (
            <>
              <button type="button" className="pill" onClick={() => setCategories(ALL_KEYS)}>
                All
              </button>
              <button type="button" className="pill" onClick={() => setCategories([])}>
                None
              </button>
            </>
          )}
        </div>
        <div
          className={`pill-group pill-group-wrap taboo-cat-pills as-cat-pills ${
            randomEach ? 'taboo-cat-pills-off' : ''
          }`}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pill ${!randomEach && categories.includes(opt.key) ? 'pill-active' : ''}`}
              onClick={() => !randomEach && toggleCategory(opt.key)}
              disabled={randomEach}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {randomEach
            ? `Every round draws from all ${CATEGORY_OPTIONS.length} categories.`
            : noCategories
              ? 'Turn on at least one category.'
              : `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} on. Each category only ever comes up with letters that have plenty of answers.`}
        </p>
      </div>

      <div>
        <span className="label">Burned Letters</span>
        <div className="pill-group">
          <button type="button" className={`pill ${!burned ? 'pill-active' : ''}`} onClick={() => setBurned(false)}>
            Off
          </button>
          <button type="button" className={`pill ${burned ? 'pill-active' : ''}`} onClick={() => setBurned(true)}>
            🔥 On
          </button>
        </div>
        <p className="hint hint-block">
          {burned
            ? 'Once a letter comes up it\'s burned for the rest of the game.'
            : 'Letters can come up again in later rounds (never the same category + letter twice).'}
        </p>
      </div>

      {tooFew && <p className="hint">Alphabet Soup needs at least {MIN_PLAYERS} players.</p>}
      {tooMany && <p className="hint">Alphabet Soup supports at most {MAX_PLAYERS} players.</p>}
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
