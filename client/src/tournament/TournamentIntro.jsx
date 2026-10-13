import { useState } from 'react'
import { getGame } from '../games/registry'
import { fitReason } from '../games/catalog'
import { GameList, GameSheet } from '../games/GameList'
import CategorySelector from '../games/CategorySelector'
import { CATEGORY_OPTIONS } from '../games/alphabetSoup/categories'
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
//
// If the game no longer fits the room (players left since the lineup was
// built or the wheel spun), everyone sees why and the host can skip it or
// swap in a game that fits; a replacement is configured here too.
export default function TournamentIntro({
  t,
  isHost,
  playerCount,
  playedGameIds = [],
  savedByGame = {},
  onStart,
  onSkip,
  onReplace,
  // Forwarded to the revealed game's own Setup UI so its AI "Custom
  // Category / Theme / Topic" option is available on this screen too.
  aiContent = {},
  aiEnabled = false,
  onGenerateContent,
  // Forwarded to Alphabet Soup / Hot Potato's category selector.
  customCategories = [],
  onCreateCategory,
}) {
  const gameId = t.pendingGame?.id
  const game = getGame(gameId)
  const accent = accentName(gameId ?? '')
  const rules = game?.rules
  const canConfigure = (t.mode === 'random' || t.pendingGame?.replaced) && !!game?.Setup

  const [configuring, setConfiguring] = useState(false)
  const [pendingOptions, setPendingOptions] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [error, setError] = useState('')

  const effectiveOptions = pendingOptions ?? savedByGame[gameId] ?? null
  const summary = describeGameOptions(effectiveOptions)
  // The server judges fit with the settings it knows; once the host has
  // re-configured locally, judge it with those instead.
  const notFit = pendingOptions
    ? fitReason(game, playerCount, pendingOptions.mode)
    : t.pendingGame?.fitError ?? null
  const sheetGame = getGame(sheetId)

  function startGame() {
    setError('')
    onStart(canConfigure ? effectiveOptions ?? {} : undefined, (res) => {
      if (res?.error) setError(res.error)
    })
  }

  function replaceWith(id) {
    setError('')
    onReplace(id, (res) => {
      if (res?.error) return setError(res.error)
      setSheetId(null)
      setReplacing(false)
      setPendingOptions(null)
    })
  }

  // --- Sub-screen: pick a replacement that fits the room ---
  if (replacing && isHost) {
    return (
      <div className="screen">
        <h1 className="title">Replace {t.pendingGame?.name ?? 'this game'}</h1>
        <p className="hint hint-block">Pick a game that fits {playerCount} players.</p>
        <GameList
          playerCount={playerCount}
          filter="all"
          fitsOnly
          playedGameIds={playedGameIds}
          onSelect={(g) => setSheetId(g.id)}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-text" onClick={() => setReplacing(false)}>
          ← Back
        </button>
        {sheetGame && (
          <GameSheet
            game={sheetGame}
            playerCount={playerCount}
            played={playedGameIds.includes(sheetGame.id)}
            action={{ label: `Play ${sheetGame.name} instead`, onClick: () => replaceWith(sheetGame.id) }}
            onClose={() => setSheetId(null)}
          />
        )}
      </div>
    )
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
        customCategories={customCategories}
        onCreateCategory={onCreateCategory}
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

      {t.pendingGame?.categories && !(canConfigure && isHost) && (
        <CategorySelector
          readOnly
          bank={CATEGORY_OPTIONS}
          customCategories={customCategories}
          value={t.pendingGame.categories.keys}
          onChange={() => {}}
          isUnavailable={gameId === 'hot-potato' ? (c) => (c.broad === false ? 'Too narrow for Hot Potato' : null) : null}
        />
      )}

      {notFit && (
        <div className="tour-intro-unfit" role="status">
          <strong>Doesn't fit right now.</strong>{' '}
          {notFit.endsWith('.') ? notFit : `${t.pendingGame?.name ?? 'This game'} ${notFit}.`}{' '}
          {`There ${playerCount === 1 ? 'is' : 'are'} ${playerCount} here.`}
          {isHost
            ? canConfigure
              ? ' Change its settings, skip it, or play something else.'
              : ' Skip it or play something else.'
            : ' Waiting for the host to skip or replace it.'}
        </div>
      )}

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

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <>
          <button className="btn btn-start" onClick={startGame} disabled={Boolean(notFit)}>
            Start {t.pendingGame?.name ?? 'Game'} →
          </button>
          {notFit && (
            <>
              <button className="btn btn-secondary" onClick={() => setReplacing(true)}>
                Replace with a game that fits
              </button>
              <button className="btn btn-text" onClick={() => onSkip()}>
                Skip this game
              </button>
            </>
          )}
        </>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start…</p>
      )}
    </div>
  )
}
