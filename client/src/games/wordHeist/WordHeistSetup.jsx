import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import SettingRow, { SettingList } from '../SettingRow'
import { MODES, MODE_KEYS, ROUNDS } from './config'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('word-heist')

const clampTo = (v, min, max, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

// Two settings, remembered per room (`saved` is the room's last-used
// options for this game). The mode cards share Echo Chain's card styles.
export default function WordHeistSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  const [mode, setMode] = useState(() => (MODE_KEYS.includes(saved?.mode) ? saved.mode : MODE_KEYS[0]))
  const [rounds, setRounds] = useState(() => clampTo(saved?.rounds, ROUNDS.min, ROUNDS.max, ROUNDS.dflt))
  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS

  return (
    <div className="screen setup-screen wh-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint">Everyone sets a secret word, then cracks someone else&apos;s, Wordle-style.</p>

      <SettingList>
        <SettingRow label="Mode" note={MODES.find((m) => m.key === mode).description}>
          <div className="ec-tiers wh-modes" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => {
              const on = mode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`ec-tier ${on ? 'ec-tier-on' : ''}`}
                  onClick={() => setMode(m.key)}
                >
                  <span className="ec-tier-name">{m.name}</span>
                  <span className="ec-tier-meta">{m.meta}</span>
                </button>
              )
            })}
          </div>
        </SettingRow>

        <SettingRow label="Rounds">
          <div className="ec-lives">
            <NumberStepper
              ariaLabel="Rounds"
              value={rounds}
              min={ROUNDS.min}
              max={ROUNDS.max}
              onChange={setRounds}
              suffix={rounds === 1 ? ' round' : ' rounds'}
            />
          </div>
        </SettingRow>
      </SettingList>

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

      <div className="ec-setup-actions">
        <button className="btn btn-start" onClick={() => onStart({ mode, rounds })} disabled={tooFew || tooMany}>
          {submitLabel ?? 'Start Game'}
        </button>
        <button className="btn btn-text" onClick={onCancel}>
          ← Back
        </button>
      </div>
    </div>
  )
}
