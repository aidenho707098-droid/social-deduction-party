import { useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import HowToPlay from '../HowToPlay'
import { catalogEntry } from '../catalog'
import NumberStepper from '../NumberStepper'
import SettingRow, { SettingList } from '../SettingRow'
import { DIFFICULTIES, DIFFICULTY_KEYS, PLAY_STYLES, PLAY_STYLE_KEYS, ROUNDS, fmtFuse, playStyleOf } from './config'

const { name: GAME_NAME, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS } = catalogEntry('bomb-squad')

const clampTo = (v, min, max, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

// Pairs the host has rolled still match the room exactly?
const fits = (pairing, players) => {
  const ids = (players ?? []).map((p) => p.id)
  const flat = (pairing ?? []).flat()
  return flat.length === ids.length && ids.every((id) => flat.includes(id))
}

// Difficulty + rounds (remembered per room via `saved`), and — in the
// standalone lobby flow only — a preview of the pairs with a re-roll.
// Tournament Mode pairs at random when the game starts.
export default function BombSquadSetup({ gameId, playerCount, saved, onStart, onCancel, error, submitLabel, players, bombSquadPairing, onRerollPairs }) {
  const [difficulty, setDifficulty] = useState(() => (DIFFICULTY_KEYS.includes(saved?.difficulty) ? saved.difficulty : 'easy'))
  const [rounds, setRounds] = useState(() => clampTo(saved?.rounds, ROUNDS.min, ROUNDS.max, ROUNDS.dflt))
  const [playStyle, setPlayStyle] = useState(() => (PLAY_STYLE_KEYS.includes(saved?.playStyle) ? saved.playStyle : 'turns'))
  const tooFew = playerCount < MIN_PLAYERS
  const tooMany = playerCount > MAX_PLAYERS
  const canPair = !!onRerollPairs && !!players
  const pairsOk = canPair && fits(bombSquadPairing, players)

  // Roll pairs as soon as the screen opens (or the room changes) — once per
  // set of players, not on every render while the broadcast is on its way.
  const roomKey = (players ?? []).map((p) => p.id).join()
  const asked = useRef(null)
  useEffect(() => {
    if (!canPair || pairsOk || tooFew || tooMany || asked.current === roomKey) return
    asked.current = roomKey
    onRerollPairs()
  }, [canPair, pairsOk, tooFew, tooMany, onRerollPairs, roomKey])

  const nameById = Object.fromEntries((players ?? []).map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players ?? [])

  return (
    <div className="screen setup-screen bs-setup">
      <h1 className="title">{GAME_NAME}</h1>
      <HowToPlay gameId={gameId} />
      <p className="hint">One of you sees the bomb, the other reads the manual. Talk it down before the fuse runs out.</p>

      <SettingList>
        <SettingRow label="Difficulty">
          <div className="ec-tiers bs-diffs" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => {
              const on = difficulty === d.key
              return (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`ec-tier ${on ? 'ec-tier-on' : ''}`}
                  onClick={() => setDifficulty(d.key)}
                >
                  <span className="ec-tier-name">{d.name}</span>
                  <span className="ec-tier-meta">
                    {d.modules} modules · {fmtFuse(d.fuseMs)}
                  </span>
                </button>
              )
            })}
          </div>
        </SettingRow>

        <SettingRow label="Play style" note={playStyleOf(playStyle).description}>
          <div className="ec-tiers bs-styles" role="radiogroup" aria-label="Play style">
            {PLAY_STYLES.map((p) => {
              const on = playStyle === p.key
              return (
                <button key={p.key} type="button" role="radio" aria-checked={on} className={`ec-tier ${on ? 'ec-tier-on' : ''}`} onClick={() => setPlayStyle(p.key)}>
                  <span className="ec-tier-name">{p.name}</span>
                  <span className="ec-tier-meta">{p.meta}</span>
                </button>
              )
            })}
          </div>
        </SettingRow>

        <SettingRow label="Rounds" note="Every pair plays once per round, and roles swap each round.">
          <div className="ec-lives">
            <NumberStepper ariaLabel="Rounds" value={rounds} min={ROUNDS.min} max={ROUNDS.max} onChange={setRounds} suffix={rounds === 1 ? ' round' : ' rounds'} />
          </div>
        </SettingRow>

        {canPair && !tooFew && !tooMany && (
          <SettingRow label="Teams">
            <ul className="bs-pairs">
              {(pairsOk ? bombSquadPairing : []).map((g, i) => (
                <li key={i} className="bs-pair-row">
                  <span className="bs-pair-n">{g.length === 3 ? 'Trio' : `Pair ${i + 1}`}</span>
                  {g.map((id) => (
                    <span key={id} className="bs-name">
                      <PlayerDot color={colorById[id]} className="player-cdot-inline" />
                      {nameById[id]}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-secondary bs-reroll" onClick={() => onRerollPairs()}>
              Re-roll teams
            </button>
          </SettingRow>
        )}

        <p className="setting-row-note">Chaos Events don&apos;t apply to {GAME_NAME}: the score modifiers don&apos;t fit a shared team score.</p>
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
        <button className="btn btn-start" onClick={() => onStart({ difficulty, rounds, playStyle })} disabled={tooFew || tooMany}>
          {submitLabel ?? 'Start Game'}
        </button>
        <button className="btn btn-text" onClick={onCancel}>
          ← Back
        </button>
      </div>
    </div>
  )
}
