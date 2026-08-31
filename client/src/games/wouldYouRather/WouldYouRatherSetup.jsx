import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

const PROMPTS_PER_PLAYER_OPTIONS = [2, 3, 4]
const CUSTOM_MIN_PLAYERS = 3

export default function WouldYouRatherSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  // Pre-fill from the host's last settings for this game this room.
  const [mode, setMode] = useState(() => (saved?.mode === 'custom' ? 'custom' : 'bank'))
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))
  const [promptsPerPlayer, setPromptsPerPlayer] = useState(() =>
    PROMPTS_PER_PLAYER_OPTIONS.includes(saved?.promptsPerPlayer) ? saved.promptsPerPlayer : 3,
  )

  const customLocked = playerCount < CUSTOM_MIN_PLAYERS
  const activeMode = customLocked ? 'bank' : mode

  // Custom mode produces (players × prompts-per-player ÷ 2) questions.
  const estimatedRounds = Math.floor((playerCount * promptsPerPlayer) / 2)

  function start() {
    if (activeMode === 'custom') onStart({ mode: 'custom', promptsPerPlayer })
    else onStart({ mode: 'bank', rounds })
  }

  return (
    <div className="screen setup-screen">
      <h1 className="title">Majority Pick</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Each round everyone sees the same question and privately picks one of
        its options. Land on the majority answer to score — the bigger the
        majority, the more points, with a bonus for a streak of them.
      </p>

      <div>
        <span className="label">Question source</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${activeMode === 'bank' ? 'pill-active' : ''}`}
            onClick={() => setMode('bank')}
          >
            Question bank
          </button>
          <button
            type="button"
            className={`pill ${activeMode === 'custom' ? 'pill-active' : ''}`}
            onClick={() => !customLocked && setMode('custom')}
            disabled={customLocked}
          >
            Custom Mode
          </button>
        </div>
        {customLocked ? (
          <p className="hint hint-block">
            Custom Mode needs at least {CUSTOM_MIN_PLAYERS} players — with two,
            the answers can't stay anonymous.
          </p>
        ) : activeMode === 'custom' ? (
          <p className="hint hint-block">
            Questions are built from the group's own answers to open-ended
            prompts. The author of each round's most-voted answer earns a bonus
            point — revealed after voting.
          </p>
        ) : (
          <p className="hint hint-block">
            Questions are drawn from the built-in bank at random, no repeats
            within a game.
          </p>
        )}
      </div>

      {activeMode === 'bank' ? (
        <NumberStepper
          label="How many rounds?"
          value={rounds}
          min={ROUND_MIN}
          max={ROUND_MAX}
          onChange={setRounds}
        />
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
            Everyone answers {promptsPerPlayer} prompts (~45s each), then it's
            about {estimatedRounds} voting round{estimatedRounds === 1 ? '' : 's'}.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn btn-start" onClick={start}>
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
