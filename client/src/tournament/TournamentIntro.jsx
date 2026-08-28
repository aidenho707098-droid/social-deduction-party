import { getGame } from '../games/registry'
import { GameIcon } from '../games/gameStyle'
import { accentName } from '../games/gamePalette'

// "Up next" — shown to everyone before EVERY tournament game (the first
// included). Names the game, shows progress, and reuses that game's How to
// Play content as a quick refresher. Host proceeds when the room's ready.
export default function TournamentIntro({ t, isHost, onStart }) {
  const game = getGame(t.pendingGame?.id)
  const accent = accentName(t.pendingGame?.id ?? '')
  const rules = game?.rules

  return (
    <div className="screen">
      <p className="wyr-round">
        Game {t.currentIndex + 1} of {t.totalGames}
      </p>
      <p className="tour-intro-kicker">Up next</p>

      <div className={`tour-intro-hero tour-intro-hero-${accent}`}>
        <span className={`tour-intro-badge tour-intro-badge-${accent}`}>
          <GameIcon id={t.pendingGame?.id} />
        </span>
        <span className="tour-intro-name">{t.pendingGame?.name ?? 'Next game'}</span>
      </div>

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
        <button className="btn btn-start" onClick={onStart}>
          Start {t.pendingGame?.name ?? 'Game'} →
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to start…</p>
      )}
    </div>
  )
}
