import { useState } from 'react'
import { createPortal } from 'react-dom'
import { GAMES, getGame } from './registry'
import { RulesModal } from './HowToPlay'
import { GameIcon } from './gameStyle'
import { accentName } from './gamePalette'

// Browse-only reference view, opened from the lobby by ANY player. Lists
// every game with its name, player requirement and style tag; tapping one
// opens that game's full rules (the exact same RulesModal the per-game
// "How to Play" uses — no rules text is duplicated here). It never starts
// anything: choosing what to play stays with the host's Start Game flow.
export default function GameCatalogue({ onClose }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = getGame(selectedId)

  return (
    <div className="screen">
      <h1 className="title">Game Catalogue</h1>
      <p className="hint center-text hint-block">
        Browse every game and how it plays. The host picks what to start.
      </p>

      <div className="game-menu-list">
        {GAMES.map((game, i) => {
          const accent = accentName(game.id)
          return (
            <button
              key={game.id}
              type="button"
              className={`game-card game-card-${accent} ${i % 2 ? 'game-card-alt' : ''}`}
              onClick={() => setSelectedId(game.id)}
            >
              <span className={`game-card-badge game-card-badge-${accent}`}>
                <GameIcon id={game.id} />
              </span>
              <span className="game-card-body">
                <span className="game-card-name">{game.name}</span>
                <span className="game-card-meta">
                  {game.minPlayers}+ players · {game.genre}
                </span>
              </span>
              <span className="game-card-cta">View rules</span>
            </button>
          )
        })}
      </div>

      <button type="button" className="btn btn-text" onClick={onClose}>
        ← Back to Lobby
      </button>

      {selected &&
        createPortal(
          <RulesModal game={selected} onClose={() => setSelectedId(null)} />,
          document.body,
        )}
    </div>
  )
}
