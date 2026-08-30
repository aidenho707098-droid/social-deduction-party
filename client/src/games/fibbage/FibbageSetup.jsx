import { useState } from 'react'
import HowToPlay from '../HowToPlay'

const ROUND_OPTIONS = [3, 5, 7, 10]
const PROMPTS_PER_PLAYER_OPTIONS = [1, 2]

export default function FibbageSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  // Pre-fill from the host's last settings for this game this room.
  const [mode, setMode] = useState(() => (saved?.mode === 'personal' ? 'personal' : 'bank'))
  const [rounds, setRounds] = useState(() =>
    ROUND_OPTIONS.includes(saved?.rounds) ? saved.rounds : 5,
  )
  const [promptsPerPlayer, setPromptsPerPlayer] = useState(() =>
    PROMPTS_PER_PLAYER_OPTIONS.includes(saved?.promptsPerPlayer) ? saved.promptsPerPlayer : 1,
  )

  const notEnough = playerCount < 3
  const estimatedRounds = playerCount * promptsPerPlayer

  function start() {
    if (mode === 'personal') onStart({ mode: 'personal', promptsPerPlayer })
    else onStart({ mode: 'bank', rounds })
  }

  return (
    <div className="screen">
      <h1 className="title">Fact or Fake</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Everyone writes a fake answer to blend in with the real one, then votes
        for which answer they think is true. Fool people with your fake, and
        spot the truth yourself.
      </p>

      <div>
        <span className="label">Question source</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${mode === 'bank' ? 'pill-active' : ''}`}
            onClick={() => setMode('bank')}
          >
            Trivia bank
          </button>
          <button
            type="button"
            className={`pill ${mode === 'personal' ? 'pill-active' : ''}`}
            onClick={() => setMode('personal')}
          >
            Personal Mode
          </button>
        </div>
        {mode === 'personal' ? (
          <p className="hint hint-block">
            Rounds are built from players' real answers about themselves — a
            test of how well you know each other. Each player answers a prompt
            or two privately; then everyone tries to fake each other's answers.
          </p>
        ) : (
          <p className="hint hint-block">
            Obscure true facts from the built-in bank, drawn at random with no
            repeats within a game.
          </p>
        )}
      </div>

      {mode === 'bank' ? (
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
      ) : (
        <div>
          <span className="label">Prompts per player</span>
          <div className="pill-group">
            {PROMPTS_PER_PLAYER_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`pill ${promptsPerPlayer === n ? 'pill-active' : ''}`}
                onClick={() => setPromptsPerPlayer(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="hint hint-block">
            Everyone answers {promptsPerPlayer} prompt{promptsPerPlayer === 1 ? '' : 's'}{' '}
            (~45s each) — about {estimatedRounds} rounds total, one per answer.
          </p>
        </div>
      )}

      {notEnough && (
        <p className="hint">Fact or Fake needs at least 3 players.</p>
      )}
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
