import { GameIcon } from '../games/gameStyle'
import { accentName } from '../games/gamePalette'

// Shown to EVERYONE after the host locks in the config, before the first
// game. Manual: the full ordered lineup. Random: "N mystery games".
export default function TournamentLineup({ t, isHost, onStart }) {
  return (
    <div className="screen">
      <h1 className="title">🏆 Tournament</h1>

      {t.mode === 'manual' ? (
        <>
          <p className="hint hint-block">
            Tonight's lineup — {t.totalGames} games, in this order:
          </p>
          <ol className="tour-lineup">
            {t.lineup.map((g, i) => (
              <li key={`${g.id}-${i}`} className="tour-lineup-item">
                <span className="tour-lineup-num">{i + 1}</span>
                <span className={`tour-pick-badge tour-pick-badge-${accentName(g.id)}`}>
                  <GameIcon id={g.id} />
                </span>
                <span className="tour-lineup-name">{g.name}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="tour-mystery">
          <div className="tour-mystery-big">{t.totalGames}</div>
          <p className="tour-mystery-text">
            mystery games — a spinning wheel reveals each one just before it's
            played.
          </p>
        </div>
      )}

      <div>
        <span className="label">Scoring each game</span>
        <p className="hint hint-block">
          1st place = 5 pts · 2nd = 3 · 3rd = 2 · 4th = 1 · 5th and below = 0.
          Points stack across every game for one overall winner.
        </p>
      </div>

      {isHost ? (
        <button className="btn btn-start" onClick={onStart}>
          Start Tournament
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start…</p>
      )}
    </div>
  )
}
