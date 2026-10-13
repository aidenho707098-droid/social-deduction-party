import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry, minPlayersFor } from '../catalog'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'
import CategorySelector from '../CategorySelector'
import { CATEGORY_OPTIONS, normalizeSelection } from './categories'

const ENTRY = catalogEntry('alphabet-soup')
const MAX_PLAYERS = ENTRY.maxPlayers
const LETTER_POOL_SIZE = 26 // Burned Letters: one round per letter, at most

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

export default function AlphabetSoupSetup({
  gameId,
  playerCount,
  saved,
  onStart,
  onCancel,
  error,
  submitLabel,
  // The room's shared custom categories + "Create category" (Lobby.jsx).
  customCategories = [],
  onCreateCategory,
}) {
  const savedCats = Array.isArray(saved?.categories) ? saved.categories : []
  // Spoken needs more players than Typed (challenge votes need a third
  // person), so it's locked below its own minimum.
  const modeLocked = (key) => playerCount < minPlayersFor(ENTRY, key)
  const [mode, setMode] = useState(() =>
    saved?.mode === 'spoken' && !modeLocked('spoken') ? 'spoken' : 'typed',
  )
  // One selection set; the retired "Random Category" (or nothing saved)
  // migrates to every bank category.
  const [categories, setCategories] = useState(() =>
    normalizeSelection(savedCats, customCategories.map((c) => c.key)),
  )
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [burned, setBurned] = useState(() => saved?.burnedLetters === true)

  const minForMode = minPlayersFor(ENTRY, mode)
  const tooFew = playerCount < minForMode
  const tooMany = playerCount > MAX_PLAYERS
  const noCategories = categories.length === 0
  const blocked = tooFew || tooMany || noCategories
  const roundMax = burned ? Math.min(ROUND_MAX, LETTER_POOL_SIZE) : ROUND_MAX

  function start() {
    onStart({
      mode,
      rounds: Math.min(rounds, roundMax),
      categories,
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
              disabled={modeLocked(m.key)}
            >
              <span className="tour-mode-name">{m.name}</span>
              <span className="tour-mode-desc">
                {modeLocked(m.key) ? `Needs ${minPlayersFor(ENTRY, m.key)}+ players. ${m.desc}` : m.desc}
              </span>
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
        <CategorySelector
          bank={CATEGORY_OPTIONS}
          customCategories={customCategories}
          value={categories}
          onChange={setCategories}
          withLetters
          isUnavailable={(c) => (c.noLetters ? 'Too narrow for Alphabet Soup' : null)}
          onCreate={onCreateCategory ? (name, { force }, cb) => onCreateCategory(gameId, name, force, cb) : null}
        />
        <p className="hint hint-block">
          Each round draws a category from your selection (no repeats until they've all come up), and only pairs it
          with letters that have plenty of answers.
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

      {tooFew && <p className="hint">Alphabet Soup needs at least {minForMode} players{mode === 'spoken' ? ' in Spoken mode' : ''}.</p>}
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
