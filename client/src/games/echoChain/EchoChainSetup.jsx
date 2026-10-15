import { useState } from 'react'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import SettingRow, { SettingList } from '../SettingRow'
import { TIERS, TIER_KEYS, tierKey, tierMeta } from './tiers'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('echo-chain')

// Mirrors server/games/echoChainRules.js LIVES.
const LIVES = { min: 1, max: 3, dflt: 2 }

const clampTo = (v, min, max, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

export default function EchoChainSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel }) {
  // tierKey() also migrates a room saved before the rename (easy -> recall ...).
  const [difficulty, setDifficulty] = useState(() => tierKey(saved?.difficulty))
  const [lives, setLives] = useState(() => clampTo(saved?.lives, LIVES.min, LIVES.max, LIVES.dflt))
  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS

  return (
    <div className="screen setup-screen ec-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint">
        Tap back the whole chain from memory, then add one tile. Miss and lose a life. Last one standing wins.
      </p>

      <SettingList>
        <SettingRow label="Difficulty" note={TIERS[difficulty].description}>
          <div className="ec-tiers" role="radiogroup" aria-label="Difficulty">
            {TIER_KEYS.map((k) => {
              const on = difficulty === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`ec-tier ${on ? 'ec-tier-on' : ''}`}
                  onClick={() => setDifficulty(k)}
                >
                  <span className="ec-tier-name">{TIERS[k].name}</span>
                  <span className="ec-tier-meta">{tierMeta(k)}</span>
                </button>
              )
            })}
          </div>
        </SettingRow>

        <SettingRow label="Lives each">
          <div className="ec-lives">
            <NumberStepper
              ariaLabel="Lives each"
              value={lives}
              min={LIVES.min}
              max={LIVES.max}
              onChange={setLives}
              suffix={lives === 1 ? ' life' : ' lives'}
            />
          </div>
        </SettingRow>

        <p className="setting-row-note">
          Chaos Events don&apos;t apply to {GAME_NAME}: points are rounds survived, and its turn timers are already faster than
          a Speed Round.
        </p>
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
        <button className="btn btn-start" onClick={() => onStart({ difficulty, lives })} disabled={tooFew || tooMany}>
          {submitLabel ?? 'Start Game'}
        </button>
        <button className="btn btn-text" onClick={onCancel}>
          ← Back
        </button>
      </div>
    </div>
  )
}
