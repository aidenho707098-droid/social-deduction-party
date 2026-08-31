import { QRCodeSVG } from 'qrcode.react'
import { PlayerDot } from '../PlayerDot'
import { PLAYER_COLORS } from '../playerColors'
import { FREQUENCY_LABELS, FREQUENCY_HINT } from '../chaos/chaosCopy'

export default function LobbyView({
  code,
  players,
  isHost,
  myPlayerId,
  baseUrl,
  chaosFrequency = 'off',
  onSetChaosFrequency,
  onStartGame,
  onTournament,
  onCatalogue,
  onPickColor,
}) {
  const joinUrl = `${baseUrl}/join/${code}`
  const me = players.find((p) => p.id === myPlayerId)
  const takenByOthers = new Set(
    players.filter((p) => p.id !== myPlayerId).map((p) => p.color)
  )

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
              <PlayerDot color={p.colorHex ?? p.color} />
              {p.name}
              {p.id === myPlayerId && ' (you)'}
              {p.connected === false && (
                <span className="player-away-tag">disconnected</span>
              )}
            </li>
          ))}
        </ul>

        {me && onPickColor && (
          <div className="colour-picker">
            <span className="colour-picker-label">
              <PlayerDot color={me.colorHex ?? me.color} /> Your colour
            </span>
            <div className="colour-swatches">
              {PLAYER_COLORS.map((c) => {
                const mine = c.id === me.color
                const taken = takenByOthers.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`colour-swatch ${mine ? 'colour-swatch-mine' : ''} ${
                      taken ? 'colour-swatch-taken' : ''
                    }`}
                    style={{ background: c.hex }}
                    disabled={taken || mine}
                    title={taken ? `${c.name} — taken` : c.name}
                    aria-label={`${c.name}${mine ? ' (yours)' : taken ? ' (taken)' : ''}`}
                    onClick={() => onPickColor(c.id)}
                  />
                )
              })}
            </div>
            <p className="colour-picker-hint">
              Pick any free colour — it locks in once a game starts.
            </p>
          </div>
        )}
      </div>

      {isHost ? (
        <>
          <div className="chaos-setting">
            <span className="label">
              ⚡ Chaos Events —{' '}
              <span className="chaos-slider-value">
                {FREQUENCY_LABELS.find((f) => f.key === chaosFrequency)?.label ?? 'Off'}
              </span>
            </span>
            <div className={`chaos-slider chaos-slider-${chaosFrequency}`}>
              <input
                type="range"
                min="0"
                max={FREQUENCY_LABELS.length - 1}
                step="1"
                value={Math.max(
                  0,
                  FREQUENCY_LABELS.findIndex((f) => f.key === chaosFrequency),
                )}
                onChange={(e) => {
                  const next = FREQUENCY_LABELS[Number(e.target.value)]
                  if (next) onSetChaosFrequency?.(next.key)
                }}
                aria-label="Chaos Event frequency"
              />
              <div className="chaos-slider-ticks" aria-hidden="true">
                {FREQUENCY_LABELS.map((f) => (
                  <span
                    key={f.key}
                    className={`chaos-slider-tick ${
                      f.key === chaosFrequency ? 'chaos-slider-tick-on' : ''
                    }`}
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="hint hint-block">
              {FREQUENCY_HINT[chaosFrequency] ?? FREQUENCY_HINT.off} A random modifier can warp
              any round of any game.
            </p>
          </div>

          <div className="stack">
            <button className="btn btn-start" onClick={onStartGame}>
              ▶ Start Game
            </button>
            <button className="btn btn-secondary" onClick={onTournament}>
              🏆 Tournament Mode
            </button>
          </div>
        </>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to start the game…</p>
      )}

      <button className="btn btn-text" onClick={onCatalogue}>
        📖 Game Catalogue
      </button>
    </div>
  )
}
