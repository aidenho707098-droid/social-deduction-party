import { useState } from 'react'
import { getGame } from '../games/registry'
import { GameIcon } from '../games/gameStyle'
import { accentName } from '../games/gamePalette'
import { describeGameOptions } from '../games/gameSettingsSummary'

// "Up next" — shown to everyone before EVERY tournament game (the first
// included). Names the game, shows progress, and reuses that game's How to
// Play content as a quick refresher.
//
// Random mode: the game was only just revealed by the wheel, so the host
// configures its settings here before starting (pre-filled from the room's
// last-used settings). Manual mode settings were fixed at lineup time.
export default function TournamentIntro({
  t,
  isHost,
  playerCount,
  savedByGame = {},
  onStart,
  // Forwarded to the revealed game's own Setup UI so its AI "Custom
  // Category / Theme / Topic" option is available on this screen too.
  aiContent = {},
  aiEnabled = false,
  onGenerateContent,
}) {
  const gameId = t.pendingGame?.id
  const game = getGame(gameId)
  const accent = accentName(gameId ?? '')
  const rules = game?.rules
  const canConfigure = t.mode === 'random' && !!game?.Setup

  const [configuring, setConfiguring] = useState(false)
  const [pendingOptions, setPendingOptions] = useState(null)

  const effectiveOptions = pendingOptions ?? savedByGame[gameId] ?? null
  const summary = describeGameOptions(effectiveOptions)

  function startGame() {
    onStart(t.mode === 'random' ? effectiveOptions ?? {} : undefined)
  }

  // --- Sub-screen: configure the just-revealed game (random mode) ---
  if (configuring && canConfigure) {
    const GameSetup = game.Setup
    return (
      <GameSetup
        gameId={gameId}
        playerCount={playerCount}
        saved={effectiveOptions}
        submitLabel="Save settings"
        onStart={(opts) => {
          setPendingOptions(opts)
          setConfiguring(false)
        }}
        onCancel={() => setConfiguring(false)}
        aiContent={aiContent}
        aiEnabled={aiEnabled}
        onGenerateContent={onGenerateContent}
      />
    )
  }

  return (
    <div className="screen">
      <p className="wyr-round">
        Game {t.currentIndex + 1} of {t.totalGames}
      </p>
      <p className="tour-intro-kicker">Up next</p>

      <div className={`tour-intro-hero tour-intro-hero-${accent}`}>
        <span className={`tour-intro-badge tour-intro-badge-${accent}`}>
          <GameIcon id={gameId} />
        </span>
        <span className="tour-intro-name">{t.pendingGame?.name ?? 'Next game'}</span>
      </div>

      {canConfigure && isHost && (
        <div>
          <span className="label">Settings</span>
          <button
            type="button"
            className="tour-lineup-config tour-intro-config"
            onClick={() => setConfiguring(true)}
          >
            ⚙ {summary || 'Configure this game'}
          </button>
        </div>
      )}

      {rules && (
        <div>
          <span className="label">Quick refresher</span>
          <p className="modal-summary">{rules.summary}</p>
          {rules.bullets?.length > 0 && (
            <ul className="modal-bullets">
              {rules.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isHost ? (
        <button className="btn btn-start" onClick={startGame}>
          Start {t.pendingGame?.name ?? 'Game'} →
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start…</p>
      )}
    </div>
  )
}
