import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import { SIZES, colorFor } from './board'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('echo-chain')

// Mirrors server/games/echoChainRules.js (DIFFICULTIES, LIVES).
const DIFFICULTIES = [
  { key: 'easy', name: 'Easy' },
  { key: 'medium', name: 'Medium' },
  { key: 'hard', name: 'Hard' },
]
const LIVES = { min: 1, max: 3, dflt: 2 }

const clampTo = (v, min, max, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

// A tiny preview of the board for the chosen difficulty.
function MiniBoard({ size }) {
  return (
    <span className="ec-mini" style={{ '--ec-size': size }} aria-hidden="true">
      {Array.from({ length: size * size }, (_, t) => (
        <span key={t} style={{ background: colorFor(size, t) }} />
      ))}
    </span>
  )
}

export default function EchoChainSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const [difficulty, setDifficulty] = useState(() =>
    DIFFICULTIES.some((d) => d.key === saved?.difficulty) ? saved.difficulty : 'easy',
  )
  const [lives, setLives] = useState(() => clampTo(saved?.lives, LIVES.min, LIVES.max, LIVES.dflt))
  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const size = SIZES[difficulty]

  return (
    <div className="screen setup-screen ec-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Tap back the whole chain from memory, then add one tile. Miss and lose a life. Last one standing wins.
      </p>

      <div>
        <span className="label">Difficulty</span>
        <div className="pill-group pill-group-wrap" role="group" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`pill ec-diff-pill ${difficulty === d.key ? 'pill-active' : ''}`}
              onClick={() => setDifficulty(d.key)}
              aria-pressed={difficulty === d.key}
            >
              <MiniBoard size={SIZES[d.key]} />
              {d.name}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {size} × {size} grid, {size * size} tiles.
        </p>
      </div>

      <div className="ec-setup-lives">
        <NumberStepper label="Lives each" value={lives} min={LIVES.min} max={LIVES.max} onChange={setLives} />
      </div>

      <p className="hint hint-block">
        Chaos Events don&apos;t apply to {GAME_NAME}: points are rounds survived, and its turn timers are already faster than
        a Speed Round.
      </p>

      {tooFew && (
        <p className="hint">
          {GAME_NAME} needs at least {MIN_PLAYERS} players.
        </p>
      )}
      {tooMany && (
        <p className="hint">
          {GAME_NAME} supports at most {MAX_PLAYERS} players.
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={() => onStart({ difficulty, lives })} disabled={tooFew || tooMany}>
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
