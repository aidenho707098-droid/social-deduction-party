import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import NumberStepper from '../NumberStepper'
import { ROUND_MIN, ROUND_MAX, ROUND_DEFAULT, clampRounds } from '../roundConfig'

export default function WavelengthSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const [rounds, setRounds] = useState(() => clampRounds(saved?.rounds ?? ROUND_DEFAULT))

  const notEnough = playerCount < 3

  return (
    <div className="screen setup-screen">
      <h1 className="title">Wavelength</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint hint-block">
        Every Clue-Giver writes their clues up front, all at once. Then each
        round the rest guess the secret number from the clue — the closer,
        the more points, for guessers and the Clue-Giver alike.
      </p>

      <NumberStepper
        label="How many rounds?"
        value={rounds}
        min={ROUND_MIN}
        max={ROUND_MAX}
        onChange={setRounds}
        hint="Clue-Givers rotate through the group (some write more than one if rounds outnumber players). Scales don't repeat within a game."
      />

      {notEnough && (
        <p className="hint">Wavelength needs at least 3 players.</p>
      )}
      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-start"
        onClick={() => onStart({ rounds })}
        disabled={notEnough}
      >
        {submitLabel ?? 'Start Game'}
      </button>
      <button className="btn btn-text" onClick={onCancel}>
        ← Back
      </button>
    </div>
  )
}
