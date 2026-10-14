import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'
import { ItemToken } from './items'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('memory-imposter')

// Mirrors server/games/memory-imposter.js resolveSettings().
const TYPES = [
  { key: 'digits', name: 'Digits', sample: ['4', '7', '1'] },
  { key: 'colors', name: 'Colors', sample: ['red', 'green', 'blue'] },
  { key: 'emoji', name: 'Emoji', sample: ['🍎', '🐸', '⭐'] },
]
const DIFFICULTIES = [
  { key: 'easy', name: 'Easy', length: 6, viewSec: 8 },
  { key: 'medium', name: 'Medium', length: 8, viewSec: 6 },
  { key: 'hard', name: 'Hard', length: 10, viewSec: 5 },
  { key: 'custom', name: 'Custom' },
]
const LIMITS = {
  customLength: { min: 5, max: 12, dflt: 8 },
  customViewSec: { min: 3, max: 12, dflt: 6 },
  questions: { min: 3, max: 6, dflt: 4 },
  answerSec: { min: 6, max: 12, dflt: 8 },
  discussionSec: { min: 30, max: 180, dflt: 60 },
}

const clampTo = (v, { min, max, dflt }) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

export default function MemoryImposterSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const [sequenceType, setSequenceType] = useState(() =>
    TYPES.some((t) => t.key === saved?.sequenceType) ? saved.sequenceType : 'digits',
  )
  const [difficulty, setDifficulty] = useState(() =>
    DIFFICULTIES.some((d) => d.key === saved?.difficulty) ? saved.difficulty : 'easy',
  )
  const [customLength, setCustomLength] = useState(() => clampTo(saved?.customLength, LIMITS.customLength))
  const [customViewSec, setCustomViewSec] = useState(() => clampTo(saved?.customViewSec, LIMITS.customViewSec))
  const [questions, setQuestions] = useState(() => clampTo(saved?.questions, LIMITS.questions))
  const [answerSec, setAnswerSec] = useState(() => clampTo(saved?.answerSec, LIMITS.answerSec))
  const [statements, setStatements] = useState(() => saved?.statements !== false)
  const [discussionSec, setDiscussionSec] = useState(() => clampTo(saved?.discussionSec, LIMITS.discussionSec))
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))

  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const preset = DIFFICULTIES.find((d) => d.key === difficulty)

  function start() {
    onStart({
      sequenceType,
      difficulty,
      ...(difficulty === 'custom' ? { customLength, customViewSec } : {}),
      questions,
      answerSec,
      statements,
      discussionSec,
      rounds,
    })
  }

  return (
    <div className="screen setup-screen mi-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Everyone sees a secret sequence except the Imposter, who gets one quick look. Prove you can see it. Spot
        who can't.
      </p>

      <div>
        <span className="label">Sequence</span>
        <div className="pill-group">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`pill mi-type-pill ${sequenceType === t.key ? 'pill-active' : ''}`}
              onClick={() => setSequenceType(t.key)}
              aria-pressed={sequenceType === t.key}
            >
              <span className="mi-type-sample" aria-hidden="true">
                {t.sample.map((x) => (
                  <ItemToken key={x} type={t.key} item={x} size={16} />
                ))}
              </span>
              {t.name}
            </button>
          ))}
        </div>
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
            {preset.length} items · the Imposter gets {preset.viewSec}s to look
          </p>
        ) : (
          <div className="mi-setup-pair">
            <NumberStepper
              label="Items"
              value={customLength}
              min={LIMITS.customLength.min}
              max={LIMITS.customLength.max}
              onChange={setCustomLength}
            />
            <NumberStepper
              label="Look time"
              value={customViewSec}
              min={LIMITS.customViewSec.min}
              max={LIMITS.customViewSec.max}
              onChange={setCustomViewSec}
              suffix="s"
            />
          </div>
        )}
      </div>

      <div className="mi-setup-pair">
        <NumberStepper
          label="Proof questions"
          value={questions}
          min={LIMITS.questions.min}
          max={LIMITS.questions.max}
          onChange={setQuestions}
        />
        <NumberStepper
          label="Answer time"
          value={answerSec}
          min={LIMITS.answerSec.min}
          max={LIMITS.answerSec.max}
          onChange={setAnswerSec}
          suffix="s"
        />
      </div>

      <div className="mi-setup-pair">
        <div>
          <span className="label">Statements</span>
          <div className="pill-group">
            <button
              type="button"
              className={`pill ${statements ? 'pill-active' : ''}`}
              onClick={() => setStatements(true)}
              aria-pressed={statements}
            >
              On
            </button>
            <button
              type="button"
              className={`pill ${!statements ? 'pill-active' : ''}`}
              onClick={() => setStatements(false)}
              aria-pressed={!statements}
            >
              Off
            </button>
          </div>
        </div>
        <NumberStepper
          label="Discussion"
          value={discussionSec}
          min={LIMITS.discussionSec.min}
          max={LIMITS.discussionSec.max}
          step={15}
          onChange={setDiscussionSec}
          suffix="s"
        />
      </div>

      <NumberStepper label="How many rounds?" value={rounds} min={ROUND_MIN} max={ROUND_MAX} onChange={setRounds} />

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
