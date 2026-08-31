import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

const ASSIGN_OPTIONS = [
  { key: 'host', label: 'Host picks each round' },
  { key: 'rotation', label: 'Rotate through players' },
]

export default function BlackMagicSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  // Pre-fill from the host's last settings for this game this room.
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [assignment, setAssignment] = useState(() =>
    ASSIGN_OPTIONS.some((o) => o.key === saved?.assignment) ? saved.assignment : 'host',
  )

  const notEnough = playerCount < 3

  return (
    <div className="screen setup-screen">
      <h1 className="title">Black Magic</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        One player secretly follows a hidden behaviour rule — The Curse.
        Everyone else tries to crack it by talking to them and spotting the
        pattern. First to say it out loud lifts The Curse.
      </p>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
      />

      <div>
        <span className="label">Who becomes The Witch?</span>
        <div className="pill-group pill-group-wrap">
          {ASSIGN_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`pill ${assignment === o.key ? 'pill-active' : ''}`}
              onClick={() => setAssignment(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {assignment === 'host'
            ? 'You choose The Witch at the start of every round.'
            : 'Each round The Witch role passes to the next player automatically.'}
        </p>
      </div>

      {notEnough && (
        <p className="hint">Black Magic needs at least 3 players.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds, assignment })}
        disabled={notEnough}
      >
        {submitLabel ?? "Start Game"}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
