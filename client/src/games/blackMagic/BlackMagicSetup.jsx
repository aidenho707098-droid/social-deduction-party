import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]

const ASSIGN_OPTIONS = [
  { key: 'host', label: 'Host picks each round' },
  { key: 'rotation', label: 'Rotate through players' },
]

export default function BlackMagicSetup({ gameId, playerCount, onStart, onCancel, error }) {
  const [rounds, setRounds] = useState(5)
  const [assignment, setAssignment] = useState('host')

  const notEnough = playerCount < 3

  return (
    <div className="screen">
      <h1 className="title">Black Magic</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        One player secretly follows a hidden behaviour rule — The Curse.
        Everyone else tries to crack it by talking to them and spotting the
        pattern. First to say it out loud lifts The Curse.
      </p>

      <div>
        <span className="label">How many rounds?</span>
        <div className="pill-group">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`pill ${rounds === n ? 'pill-active' : ''}`}
              onClick={() => setRounds(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

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
        Start Game
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
