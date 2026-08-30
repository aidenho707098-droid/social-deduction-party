import { useState } from 'react'
import { GAMES, getGame } from '../games/registry'
import { GameIcon } from '../games/gameStyle'
import { accentName } from '../games/gamePalette'
import { describeGameOptions } from '../games/gameSettingsSummary'

const RANDOM_COUNTS = [3, 4, 5, 6]

// Host-only screen for turning a session into a tournament. Local UI until
// the host locks it in with `onConfigure({ mode, lineup?, lineupSettings?,
// totalGames? })`. In Manual mode each lineup slot can be configured with
// that game's own setup UI (pre-filled from the room's last-used settings).
export default function TournamentSetup({ playerCount, savedByGame = {}, onConfigure, onCancel }) {
  const [mode, setMode] = useState(null) // null | 'manual' | 'random'
  const [lineup, setLineup] = useState([]) // ordered gameIds
  const [lineupSettings, setLineupSettings] = useState([]) // parallel: createGame options per slot
  const [totalGames, setTotalGames] = useState(4)
  const [configIndex, setConfigIndex] = useState(null) // lineup slot being configured
  const [error, setError] = useState('')

  const eligible = GAMES.filter((g) => playerCount >= g.minPlayers)

  function addGame(id) {
    setLineup((l) => [...l, id])
    // Seed each slot with the room's last-used settings for that game (or
    // empty, letting the server fall back to defaults) — the host can tweak.
    setLineupSettings((s) => [...s, savedByGame[id] ? { ...savedByGame[id] } : {}])
  }
  function removeAt(i) {
    setLineup((l) => l.filter((_, idx) => idx !== i))
    setLineupSettings((s) => s.filter((_, idx) => idx !== i))
  }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= lineup.length) return
    const swap = (arr) => {
      const copy = [...arr]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    }
    setLineup(swap)
    setLineupSettings(swap)
  }
  function saveSlotSettings(i, opts) {
    setLineupSettings((s) => s.map((v, idx) => (idx === i ? opts : v)))
    setConfigIndex(null)
  }

  function submit() {
    setError('')
    if (mode === 'manual') {
      if (lineup.length < 2) return setError('Add at least 2 games to the lineup.')
      onConfigure({ mode: 'manual', lineup, lineupSettings })
    } else {
      onConfigure({ mode: 'random', totalGames })
    }
  }

  // --- Sub-screen: configure one lineup game with its own setup UI ---
  if (configIndex != null && lineup[configIndex]) {
    const gid = lineup[configIndex]
    const GameSetup = getGame(gid)?.Setup
    if (GameSetup) {
      return (
        <GameSetup
          gameId={gid}
          playerCount={playerCount}
          saved={lineupSettings[configIndex] ?? savedByGame[gid]}
          submitLabel="Save settings"
          onStart={(opts) => saveSlotSettings(configIndex, opts)}
          onCancel={() => setConfigIndex(null)}
        />
      )
    }
  }

  return (
    <div className="screen">
      <h1 className="title">🏆 Tournament Mode</h1>
      <p className="hint hint-block">
        Run the session as one tournament — games flow one after another and
        rank-based points stack up on an overall leaderboard.
      </p>

      <div>
        <span className="label">How is the lineup chosen?</span>
        <div className="tour-mode-choices">
          <button
            type="button"
            className={`tour-mode-card ${mode === 'manual' ? 'tour-mode-active' : ''}`}
            onClick={() => setMode('manual')}
          >
            <span className="tour-mode-name">Manual</span>
            <span className="tour-mode-desc">
              You pick the games, their order, and each one's settings.
              Everyone sees the full lineup before it starts.
            </span>
          </button>
          <button
            type="button"
            className={`tour-mode-card ${mode === 'random' ? 'tour-mode-active' : ''}`}
            onClick={() => setMode('random')}
          >
            <span className="tour-mode-name">Random</span>
            <span className="tour-mode-desc">
              Pick a number of games. A spinning wheel reveals each one, then
              you set it up, just before it's played.
            </span>
          </button>
        </div>
      </div>

      {mode === 'manual' && (
        <>
          <div>
            <span className="label">Add games</span>
            <div className="tour-pick-list">
              {eligible.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`tour-pick-btn tour-pick-${accentName(g.id)}`}
                  onClick={() => addGame(g.id)}
                >
                  <span className={`tour-pick-badge tour-pick-badge-${accentName(g.id)}`}>
                    <GameIcon id={g.id} />
                  </span>
                  {g.name}
                  <span className="tour-pick-add">+</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Tonight's lineup ({lineup.length})</span>
            {lineup.length === 0 ? (
              <p className="hint">Tap games above to build the running order.</p>
            ) : (
              <ol className="tour-lineup-edit">
                {lineup.map((id, i) => {
                  const g = GAMES.find((x) => x.id === id)
                  const summary = describeGameOptions(lineupSettings[i])
                  return (
                    <li key={`${id}-${i}`} className="tour-lineup-edit-item">
                      <span className="tour-lineup-num">{i + 1}</span>
                      <span
                        className={`tour-pick-badge tour-pick-badge-${accentName(id)}`}
                      >
                        <GameIcon id={id} />
                      </span>
                      <span className="tour-lineup-edit-main">
                        <span className="tour-lineup-edit-name">{g?.name ?? id}</span>
                        <button
                          type="button"
                          className="tour-lineup-config"
                          onClick={() => setConfigIndex(i)}
                        >
                          ⚙ {summary || 'Settings'}
                        </button>
                      </span>
                      <button
                        type="button"
                        className="tour-lineup-ctl"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="tour-lineup-ctl"
                        onClick={() => move(i, 1)}
                        disabled={i === lineup.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="tour-lineup-ctl tour-lineup-remove"
                        onClick={() => removeAt(i)}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </>
      )}

      {mode === 'random' && (
        <div>
          <span className="label">How many games?</span>
          <div className="pill-group">
            {RANDOM_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`pill ${totalGames === n ? 'pill-active' : ''}`}
                onClick={() => setTotalGames(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="hint hint-block">
            The games and their order stay a mystery — the wheel picks each
            one live, then you configure it on the "up next" screen.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {mode && (
        <button className="btn btn-start" onClick={submit}>
          {mode === 'manual' ? 'Lock in lineup' : 'Set up tournament'}
        </button>
      )}
      <button className="btn btn-text" onClick={onCancel}>
        ← Back to lobby
      </button>
    </div>
  )
}
