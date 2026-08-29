import { QRCodeSVG } from 'qrcode.react'

export default function LobbyView({ code, players, isHost, baseUrl, onStartGame, onTournament, onCatalogue }) {
  const joinUrl = `${baseUrl}/join/${code}`

  return (
    <div className="screen">
      <div className="lobby-header">
        <span className="label">Room Code</span>
        <div className="room-code">{code}</div>
      </div>

      <div className="qr-wrap">
        <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#241f33" />
        <p className="hint">Scan to join, or go to {joinUrl}</p>
      </div>

      <div className="player-section">
        <span className="label">Players ({players.length})</span>
        <ul className="player-list">
          {players.map((p) => (
            <li
              key={p.id}
              className={`player-item ${p.connected === false ? 'player-item-away' : ''}`}
            >
              <span className="player-dot" />
              {p.name}
              {p.connected === false && (
                <span className="player-away-tag">disconnected</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="stack">
          <button className="btn btn-start" onClick={onStartGame}>
            ▶ Start Game
          </button>
          <button className="btn btn-secondary" onClick={onTournament}>
            🏆 Tournament Mode
          </button>
        </div>
      ) : (
        <p className="hint center-text">Waiting for the host to start the game…</p>
      )}

      <button className="btn btn-text" onClick={onCatalogue}>
        📖 Game Catalogue
      </button>
    </div>
  )
}
