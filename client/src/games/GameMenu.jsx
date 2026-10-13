import { useEffect, useRef, useState } from 'react'
import { GAMES, getGame } from './registry'
import { fitReason, matchesFilter } from './catalog'
import { FilterChips, FitsToggle, GameList, GameSheet } from './GameList'

const PICK_HIGHLIGHT_MS = 650

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The game picker: one compact row per game under a sticky header (title,
// room code, filter chips, the "fits N players" toggle and, for the host,
// Surprise me). Tapping a row opens that game's sheet.
//
//   host      — the sheet's "Continue" goes to the game's own setup screen
//   non-host  — the lobby's read-only Game Catalogue (same list, no launch)
export default function GameMenu({ isHost, roomCode, playerCount, playedGameIds = [], onContinue, onBack }) {
  const [filter, setFilter] = useState('all')
  const [fitsOnly, setFitsOnly] = useState(true)
  const [sheetId, setSheetId] = useState(null)
  const [pickedId, setPickedId] = useState(null)
  const lastSurpriseRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const sheetGame = getGame(sheetId)
  const surprisePool = GAMES.filter((g) => matchesFilter(g, filter) && !fitReason(g, playerCount))

  // A random game that fits the room and the active chip, preferring ones
  // this room hasn't played yet (and not the one Surprise me just showed).
  function surprise() {
    if (surprisePool.length === 0) return
    const fresh = surprisePool.filter((g) => !playedGameIds.includes(g.id))
    let from = fresh.length ? fresh : surprisePool
    if (from.length > 1) from = from.filter((g) => g.id !== lastSurpriseRef.current)
    const pick = from[Math.floor(Math.random() * from.length)]
    lastSurpriseRef.current = pick.id

    clearTimeout(timerRef.current)
    if (prefersReducedMotion()) {
      setSheetId(pick.id)
      return
    }
    setPickedId(pick.id)
    document.getElementById(`gb-tile-${pick.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    timerRef.current = setTimeout(() => {
      setPickedId(null)
      setSheetId(pick.id)
    }, PICK_HIGHLIGHT_MS)
  }

  return (
    <div className="screen gb-screen">
      <header className="gb-header">
        <div className="gb-header-top">
          <button type="button" className="gb-back" onClick={onBack} aria-label="Back to lobby">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <h1 className="gb-title">{isHost ? 'Choose a Game' : 'Game Catalogue'}</h1>
        </div>
        <div className="gb-header-row">
          <span className="gb-room">
            Room <strong>{roomCode}</strong>
          </span>
          <FitsToggle on={fitsOnly} onChange={setFitsOnly} playerCount={playerCount} />
          {isHost && (
            <button
              type="button"
              className="gb-surprise"
              onClick={surprise}
              disabled={surprisePool.length === 0}
            >
              Surprise me
            </button>
          )}
        </div>
        <FilterChips filter={filter} onFilter={setFilter} />
      </header>

      {!isHost && (
        <p className="hint center-text gb-browse-hint">Browse every game. The host picks what to start.</p>
      )}

      <GameList
        playerCount={playerCount}
        filter={filter}
        fitsOnly={fitsOnly}
        playedGameIds={playedGameIds}
        pickedId={pickedId}
        onSelect={(g) => setSheetId(g.id)}
      />

      {sheetGame && (
        <GameSheet
          game={sheetGame}
          playerCount={playerCount}
          played={playedGameIds.includes(sheetGame.id)}
          action={isHost ? { label: 'Continue', onClick: () => onContinue(sheetGame.id) } : null}
          onClose={() => setSheetId(null)}
        />
      )}
    </div>
  )
}
