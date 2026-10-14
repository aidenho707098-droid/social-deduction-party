import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import { ItemFace } from './items'
import { SEQUENCE_TYPES, TYPE_LABELS, savedSequenceTypes } from './memoryData'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('memory-imposter')

// Mirrors server/games/memory-imposter.js resolveSettings().
const SAMPLES = {
  digits: ['d:4', 'd:7'],
  colors: ['c:violet', 'c:mustard'],
  shapes: ['s:star', 's:heart'],
  mixed: ['d:3', 'c:blue', 's:circle'],
}
const DIFFICULTIES = [
  { key: 'easy', name: 'Easy', length: 4, viewSec: 10 },
  { key: 'medium', name: 'Medium', length: 6, viewSec: 15 },
  { key: 'hard', name: 'Hard', length: 8, viewSec: 15 },
  { key: 'custom', name: 'Custom' },
]
const LENGTH = { min: 4, max: 12 }
const VIEW_SEC = { min: 3, max: 20 }
const DISCUSSION = { min: 30, max: 240, step: 15, dflt: 90 }
const ROUNDS_MIN = 1

const clampTo = (v, min, max, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

export default function MemoryImposterSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const maxRounds = Math.max(ROUNDS_MIN, 2 * Math.max(MIN_PLAYERS, playerCount))
  const [types, setTypes] = useState(() => savedSequenceTypes(saved))
  const [difficulty, setDifficulty] = useState(() =>
    DIFFICULTIES.some((d) => d.key === saved?.difficulty) ? saved.difficulty : 'easy',
  )
  const [customLength, setCustomLength] = useState(() => clampTo(saved?.customLength, LENGTH.min, LENGTH.max, 6))
  const [customViewSec, setCustomViewSec] = useState(() => clampTo(saved?.customViewSec, VIEW_SEC.min, VIEW_SEC.max, 15))
  const [discussionSec, setDiscussionSec] = useState(() => {
    const v = clampTo(saved?.discussionSec, DISCUSSION.min, DISCUSSION.max, DISCUSSION.dflt)
    return Math.round(v / DISCUSSION.step) * DISCUSSION.step
  })
  const [rounds, setRounds] = useState(() => clampTo(saved?.rounds, ROUNDS_MIN, maxRounds, playerCount))

  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const preset = DIFFICULTIES.find((d) => d.key === difficulty)

  // Multi-select; the last chip still on can't be turned off.
  function toggle(t) {
    setTypes((cur) => {
      if (!cur.includes(t)) return SEQUENCE_TYPES.filter((x) => x === t || cur.includes(x))
      return cur.length === 1 ? cur : cur.filter((x) => x !== t)
    })
  }

  function start() {
    onStart({
      sequenceTypes: types,
      difficulty,
      ...(difficulty === 'custom' ? { customLength, customViewSec } : {}),
      discussionSec,
      rounds: Math.min(rounds, maxRounds),
    })
  }

  return (
    <div className="screen setup-screen mi-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Everyone memorizes the same sequence. Then one player's disappears. Bluff, talk, and vote out the Imposter.
      </p>

      <div>
        <span className="label">Sequence types</span>
        <div className="mi-chips" role="group" aria-label="Sequence types">
          {SEQUENCE_TYPES.map((t) => {
            const on = types.includes(t)
            const locked = on && types.length === 1
            return (
              <button
                key={t}
                type="button"
                className={`pill mi-chip ${on ? 'pill-active' : ''}`}
                onClick={() => toggle(t)}
                aria-pressed={on}
                aria-disabled={locked}
                title={locked ? 'At least one type stays on' : undefined}
              >
                <span className="mi-chip-sample" aria-hidden="true">
                  {SAMPLES[t].map((x) => (
                    <span key={x} className={`mi-chip-tile ${x.startsWith('c:') ? 'mi-cell-swatch' : ''}`}>
                      <ItemFace item={x} />
                    </span>
                  ))}
                </span>
                {TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>
        <p className="hint hint-block">
          {types.length === 1
            ? `Every round is ${TYPE_LABELS[types[0]]}.`
            : `Each round uses one of these, taking turns.`}
        </p>
      </div>

      <div>
        <span className="label">Difficulty</span>
        <div className="pill-group pill-group-wrap mi-diff">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`pill ${difficulty === d.key ? 'pill-active' : ''}`}
              onClick={() => setDifficulty(d.key)}
              aria-pressed={difficulty === d.key}
            >
              {d.name}
            </button>
          ))}
        </div>
        {preset?.length ? (
          <p className="hint hint-block">
            Starts at {preset.length} items, {preset.viewSec}s to look. +1 item every round.
          </p>
        ) : (
          <div className="mi-setup-pair">
            <NumberStepper label="Start items" value={customLength} min={LENGTH.min} max={LENGTH.max} onChange={setCustomLength} />
            <NumberStepper
              label="Look time"
              value={customViewSec}
              min={VIEW_SEC.min}
              max={VIEW_SEC.max}
              onChange={setCustomViewSec}
              suffix="s"
            />
          </div>
        )}
      </div>

      <div className="mi-setup-pair">
        <NumberStepper label="Rounds" value={Math.min(rounds, maxRounds)} min={ROUNDS_MIN} max={maxRounds} onChange={setRounds} />
        <NumberStepper
          label="Discussion"
          value={discussionSec}
          min={DISCUSSION.min}
          max={DISCUSSION.max}
          step={DISCUSSION.step}
          onChange={setDiscussionSec}
          suffix="s"
        />
      </div>

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

      <button className="btn btn-start" onClick={start} disabled={tooFew || tooMany}>
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
