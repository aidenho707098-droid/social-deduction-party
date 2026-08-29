import { useState } from 'react'

// Persistent host-only panel, rendered by Lobby across every screen (lobby,
// tournament, and any running game). Non-hosts never get this component
// mounted at all. Destructive actions (remove a player, end the game) use a
// two-tap confirm; "Force proceed" just advances so it fires on one tap.
export default function HostControls({ room, myPlayerId, onKick, onForceAdvance, onEndGame }) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(null) // 'end' | `kick:${playerId}` | null

  const players = room.players ?? []
  const inGame = room.status === 'in-game'

  function tap(key, run) {
    if (armed === key) {
      run()
      setArmed(null)
    } else {
      setArmed(key)
    }
  }

  function close() {
    setOpen(false)
    setArmed(null)
  }

  if (!open) {
    return (
      <div className="host-panel">
        <button className="host-panel-toggle" onClick={() => setOpen(true)}>
          🛠️ Host
        </button>
      </div>
    )
  }

  return (
    <div className="host-panel host-panel-open">
      <div className="host-panel-head">
        <span>🛠️ Host controls</span>
        <button className="host-panel-x" onClick={close} aria-label="Close host controls">
          ✕
        </button>
      </div>

      <div className="host-panel-players">
        {players.map((p) => {
          const key = `kick:${p.id}`
          return (
            <div key={p.id} className="host-panel-player">
              <span className={`host-panel-dot ${p.connected ? '' : 'host-panel-dot-off'}`} />
              <span className="host-panel-name">
                {p.name}
                {p.id === myPlayerId && ' (you)'}
              </span>
              {p.id !== myPlayerId && (
                <button
                  className={`host-panel-btn ${armed === key ? 'host-panel-btn-armed' : ''}`}
                  onClick={() => tap(key, () => onKick(p.id))}
                >
                  {armed === key ? 'Confirm' : 'Remove'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {inGame && (
        <div className="host-panel-game">
          <button
            className="host-panel-wide"
            onClick={() => {
              onForceAdvance()
              setArmed(null)
            }}
          >
            ⏭️ Force proceed
          </button>
          <button
            className={`host-panel-wide host-panel-danger ${
              armed === 'end' ? 'host-panel-btn-armed' : ''
            }`}
            onClick={() => tap('end', onEndGame)}
          >
            {armed === 'end' ? 'Confirm — end game' : '⛔ End game & return to lobby'}
          </button>
        </div>
      )}

      <p className="host-panel-note">
        Removing a player is temporary — they can rejoin later with the room code.
      </p>
    </div>
  )
}
