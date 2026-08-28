import { GAMES } from './registry'
import HowToPlay from './HowToPlay'
import { GameIcon } from './gameStyle'
import { accentName } from './gamePalette'

export default function GameMenu({ playerCount, onPick, onCancel }) {
  return (
    <div className="screen">
      <h1 className="title">Choose a Game</h1>

      <div className="game-menu-list">
        {GAMES.map((game, i) => {
          const disabled = playerCount < game.minPlayers
          const accent = accentName(game.id)
          return (
            <div key={game.id} className="game-menu-row">
              <button
                type="button"
                className={`game-card game-card-${accent} ${i % 2 ? 'game-card-alt' : ''}`}
                disabled={disabled}
                onClick={() => onPick(game.id)}
              >
                <span className={`game-card-badge game-card-badge-${accent}`}>
                  <GameIcon id={game.id} />
                </span>
                <span className="game-card-body">
                  <span className="game-card-name">{game.name}</span>
                  <span className="game-card-meta">
                    {disabled
                      ? `Needs ${game.minPlayers}+ players`
                      : `${game.minPlayers}+ players`}
                  </span>
                </span>
              </button>
              <HowToPlay gameId={game.id} variant="menu" />
            </div>
          )
        })}
      </div>

      <button type="button" className="btn btn-text" onClick={onCancel}>
        ← Back to Lobby
      </button>
    </div>
  )
}
