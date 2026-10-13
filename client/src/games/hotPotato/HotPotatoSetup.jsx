import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'
import CategorySelector from '../CategorySelector'
// Hot Potato shares Alphabet Soup's category bank (server/games/
// alphabetSoupBank.js); only the keys + names matter here, never letters.
import { CATEGORY_OPTIONS, normalizeSelection } from '../alphabetSoup/categories'

// A narrow custom category runs out of answers in a lap or two.
const narrowForPotato = (c) => (c.broad === false ? 'Too narrow for Hot Potato' : null)

const { minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('hot-potato')
const LIVES_MIN = 1
const LIVES_MAX = 5
const MATCHES_MAX = 5

const GAME_MODES = [
  {
    key: 'rounds',
    name: 'Short Rounds',
    desc: 'One potato per round. Whoever explodes scores 0 and everyone else +2.',
  },
  {
    key: 'elimination',
    name: 'Elimination',
    desc: 'Each explosion costs a life. Last one standing wins the match.',
  },
]

const TIMER_MODES = [
  { key: 'sprint', name: 'Sprint', desc: '8s turns that get shorter with every pass.' },
  { key: 'hidden', name: 'Hidden Fuse', desc: 'A secret 20–60s fuse, plus 5s per turn.' },
  { key: 'mixed', name: 'Mixed', desc: 'Sprint or Hidden Fuse at random, per potato.' },
]

const clamp = (n, lo, hi, dflt) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
}

export default function HotPotatoSetup({
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
  const [mode, setMode] = useState(() => (saved?.mode === 'elimination' ? 'elimination' : 'rounds'))
  const [timerMode, setTimerMode] = useState(() =>
    TIMER_MODES.some((t) => t.key === saved?.timerMode) ? saved.timerMode : 'sprint',
  )
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [lives, setLives] = useState(() => clamp(saved?.lives, LIVES_MIN, LIVES_MAX, 1))
  const [matches, setMatches] = useState(() => clamp(saved?.matches, 1, MATCHES_MAX, 1))
  // One selection set (narrow custom categories never count); the retired
  // "Random Category" (or nothing saved) migrates to every bank category.
  const [categories, setCategories] = useState(() =>
    normalizeSelection(savedCats, customCategories.filter((c) => !narrowForPotato(c)).map((c) => c.key)),
  )

  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const noCategories = categories.length === 0
  const blocked = tooFew || tooMany || noCategories


  function start() {
    const common = { mode, timerMode, categories }
    onStart(mode === 'rounds' ? { ...common, rounds } : { ...common, lives, matches })
  }

  return (
    <div className="screen setup-screen">
      <h1 className="title">Hot Potato</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Say something that fits the category, out loud, then pass it on fast.
        Don't be the one holding it when it blows.
      </p>

      <div>
        <span className="label">Game mode</span>
        <div className="tour-mode-choices">
          {GAME_MODES.map((m) => (
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

      {mode === 'rounds' ? (
        <NumberStepper label="How many rounds?" value={rounds} min={ROUND_MIN} max={ROUND_MAX} onChange={setRounds} />
      ) : (
        <>
          <NumberStepper
            label="Lives per player"
            value={lives}
            min={LIVES_MIN}
            max={LIVES_MAX}
            onChange={setLives}
          />
          <NumberStepper
            label="How many matches?"
            value={matches}
            min={1}
            max={MATCHES_MAX}
            onChange={setMatches}
            hint="Each match plays until one player is left. Points add up across matches."
          />
        </>
      )}

      <div>
        <span className="label">Timer</span>
        <div className="pill-group pill-group-wrap">
          {TIMER_MODES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`pill ${timerMode === t.key ? 'pill-active' : ''}`}
              onClick={() => setTimerMode(t.key)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="hint hint-block">{TIMER_MODES.find((t) => t.key === timerMode)?.desc}</p>
      </div>

      <div>
        <CategorySelector
          bank={CATEGORY_OPTIONS}
          customCategories={customCategories}
          value={categories}
          onChange={setCategories}
          isUnavailable={narrowForPotato}
          onCreate={onCreateCategory ? (name, { force }, cb) => onCreateCategory(gameId, name, force, cb) : null}
        />
        <p className="hint hint-block">
          Every potato draws a fresh category from your selection (no repeats until they've all come up).
        </p>
      </div>

      {tooFew && <p className="hint">Hot Potato needs at least {MIN_PLAYERS} players.</p>}
      {tooMany && <p className="hint">Hot Potato supports at most {MAX_PLAYERS} players.</p>}
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
