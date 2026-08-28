import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Easy only' },
  { key: 'medium', label: 'Medium only' },
  { key: 'hard', label: 'Hard only' },
  { key: 'mixed', label: 'Mixed' },
]

export default function EmojiMovieSetup({ gameId, onStart, onCancel, error }) {
  const [rounds, setRounds] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')

  return (
    <div className="screen">
      <h1 className="title">Emoji Movie Guess</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round a movie is spelled out in emojis, revealed one at a time.
        Type the title on your own phone the moment you think you've got it —
        guessing with fewer emojis showing scores far more. A wrong guess
        costs nothing; a correct one locks you in for the round.
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
        <span className="label">Difficulty</span>
        <div className="pill-group pill-group-wrap">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pill ${difficulty === opt.key ? 'pill-active' : ''}`}
              onClick={() => setDifficulty(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="hint hint-block">
          {difficulty === 'mixed'
            ? 'Movies of every tier — harder ones are worth more points.'
            : `Only ${difficulty} movies. If there aren't enough for ${rounds} rounds, the game runs fewer.`}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds, difficulty })}
      >
        Start Game
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
