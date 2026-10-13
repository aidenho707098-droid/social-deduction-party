import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GAMES } from './registry'
import { FILTERS, accentOf, fitReason, matchesFilter, minPlayersFor, playerRangeLabel, tileRangeLabel } from './catalog'
import { GameIcon } from './gameStyle'
import { RulesBody } from './HowToPlay'

// The building blocks every game list shares: the host's game menu, the
// lobby's read-only catalogue and Tournament Mode's lineup builder. Fit is
// always judged against the LIVE lobby size (`playerCount`), so rows move
// in and out of "Doesn't fit your group" as people join and leave.

// Horizontal-scrolling, single-select filter chips.
export function FilterChips({ filter, onFilter }) {
  return (
    <div className="gb-chips" role="group" aria-label="Filter games">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`gb-chip ${filter === f.key ? 'gb-chip-on' : ''}`}
          aria-pressed={filter === f.key}
          onClick={() => onFilter(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

export function FitsToggle({ on, onChange, playerCount }) {
  return (
    <label className="gb-fits">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="gb-switch" aria-hidden="true" />
      Fits {playerCount} {playerCount === 1 ? 'player' : 'players'}
    </label>
  )
}

function Chevron() {
  return (
    <svg className="gb-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

// One compact tile. The name always reserves two lines, so the meta line
// starts at the same height in every tile of a row.
function GameTile({ game, alt, reason, played, picked, extra, onSelect }) {
  const accent = accentOf(game.id)
  return (
    <button
      id={`gb-tile-${game.id}`}
      type="button"
      className={`gb-tile ${alt ? 'gb-tile-alt' : ''} ${reason ? 'gb-tile-unfit' : ''} ${picked ? 'gb-tile-picked' : ''}`}
      onClick={() => onSelect(game)}
      aria-label={`${game.name}${reason ? `, ${reason}` : ''}${played ? ', played' : ''}`}
    >
      <span className="gb-tile-top">
        <span className="gb-badge-wrap">
          <span className={`gb-badge gb-badge-${accent}`}>
            <GameIcon id={game.id} />
          </span>
          {played && (
            <span className="gb-played" title="Played in this room">
              ✓
            </span>
          )}
        </span>
        <span className="gb-flags">
          {extra && <span className="gb-extra">{extra}</span>}
          {game.isNew && <span className="gb-new">New</span>}
        </span>
      </span>
      <span className="gb-name">{game.name}</span>
      <span className="gb-meta">
        {reason ? `${reason[0].toUpperCase()}${reason.slice(1)}` : tileRangeLabel(game)} · {game.genre}
      </span>
    </button>
  )
}

// The list itself. With `fitsOnly`, games the current lobby can't play drop
// into a collapsed "Doesn't fit your group" section at the bottom; without
// it every game stays in catalogue order, still greyed where it doesn't fit.
// Unfit rows can still be opened to read about the game; the sheet just
// won't launch them.
export function GameList({
  playerCount,
  filter,
  fitsOnly,
  playedGameIds = [],
  pickedId = null,
  rowExtra = () => null,
  onSelect,
}) {
  const [showUnfit, setShowUnfit] = useState(false)
  const shown = GAMES.filter((g) => matchesFilter(g, filter))
  const reasonOf = (g) => fitReason(g, playerCount)
  const unfit = shown.filter(reasonOf)
  const main = fitsOnly ? shown.filter((g) => !reasonOf(g)) : shown
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label

  const tile = (g, i) => (
    <GameTile
      key={g.id}
      game={g}
      alt={i % 2 === 1}
      reason={reasonOf(g)}
      played={playedGameIds.includes(g.id)}
      picked={pickedId === g.id}
      extra={rowExtra(g)}
      onSelect={onSelect}
    />
  )

  return (
    <div className="gb-lists">
      {main.length > 0 ? (
        <div className="gb-grid">{main.map(tile)}</div>
      ) : (
        <p className="hint center-text gb-empty">
          {filter === 'all'
            ? `No games fit ${playerCount} ${playerCount === 1 ? 'player' : 'players'} yet.`
            : `No ${filterLabel} games fit ${playerCount} ${playerCount === 1 ? 'player' : 'players'}.`}
        </p>
      )}

      {fitsOnly && unfit.length > 0 && (
        <section className="gb-unfit">
          <button
            type="button"
            className="gb-unfit-toggle"
            aria-expanded={showUnfit}
            onClick={() => setShowUnfit((v) => !v)}
          >
            Doesn't fit your group ({unfit.length})
            <Chevron />
          </button>
          {showUnfit && <div className="gb-grid">{unfit.map(tile)}</div>}
        </section>
      )}
    </div>
  )
}

// Bottom sheet for one game: description, player range, the game's own How
// to Play (collapsible), and, when `action` is given, the button that moves
// on (the host's "Continue" to the settings screen, or "Add to lineup").
// Without `action` it's read-only, for non-hosts.
export function GameSheet({ game, playerCount, played, action = null, onClose }) {
  const sheetRef = useRef(null)
  const closeRef = useRef(onClose)
  const reason = fitReason(game, playerCount)

  useEffect(() => {
    closeRef.current = onClose
  })

  // Once per open: Escape closes, the page behind stops scrolling, focus
  // moves into the sheet. (Room updates re-render it live without
  // re-running this, so they never steal focus.)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const accent = accentOf(game.id)
  // Modes this lobby is too small for, even though the game itself fits
  // (Alphabet Soup's Spoken mode with 2 players).
  const lockedModes = reason
    ? []
    : Object.entries(game.modes ?? {}).filter(([key]) => playerCount < minPlayersFor(game, key))

  return createPortal(
    <div className="gb-sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="gb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gb-sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gb-sheet-grab" aria-hidden="true" />
        <div className="gb-sheet-head">
          <span className={`gb-badge gb-badge-${accent}`}>
            <GameIcon id={game.id} />
          </span>
          <div className="gb-sheet-titles">
            <h2 id="gb-sheet-title" className="gb-sheet-title">
              {game.name}
              {game.isNew && <span className="gb-new">New</span>}
            </h2>
            <p className="gb-sheet-meta">
              {playerRangeLabel(game)} · {game.genre}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="gb-sheet-desc">{game.description}</p>

        {reason && (
          <p className="gb-sheet-warn">
            Doesn't fit your group of {playerCount}: {reason}.
          </p>
        )}
        {lockedModes.map(([key, m]) => (
          <p key={key} className="gb-sheet-note">
            {m.label} mode needs {m.minPlayers}+ players, so it's locked with {playerCount}.
          </p>
        ))}
        {played && <p className="gb-sheet-note">✓ Already played in this room</p>}

        {game.rules && (
          <details className="gb-htp">
            <summary>How to Play</summary>
            <div className="gb-htp-body">
              <RulesBody rules={game.rules} />
            </div>
          </details>
        )}

        {action ? (
          <button type="button" className="btn btn-start" disabled={Boolean(reason)} onClick={action.onClick}>
            {action.label}
          </button>
        ) : (
          <p className="hint center-text">The host picks what to play.</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
