import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

// Everyone else's screen while someone's active turn is running. Shows the
// active player's identity front and centre (so the room can answer), then
// every OTHER player's identity in a scrollable list — the viewer's own row
// always comes back from the server as hidden, never their real identity.
export default function AnswerScreen({ game, players, myId, myRole }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const activeId = game.activePlayerId
  const activeName = nameById[activeId] ?? 'Someone'

  const identities = myRole?.whoAmI?.identities ?? []
  const activeRow = identities.find((r) => r.playerId === activeId)
  const otherRows = identities.filter((r) => r.playerId !== activeId)

  const iAmDone = game.doneIds?.includes(myId)
  const iAmCapped = game.cappedIds?.includes(myId)
  const myOwnRow = identities.find((r) => r.playerId === myId)

  return (
    <div className="screen">
      <p className="wyr-round">Round {game.roundIndex + 1} of {game.totalRounds}</p>
      <h1 className="title center-text">{activeName} is asking</h1>

      {iAmDone && (
        <div className={`wai-status-banner ${iAmCapped ? 'wai-status-capped' : 'wai-status-solved'}`}>
          {iAmCapped
            ? "🏳️ You're out of questions this round — keep answering truthfully."
            : `✅ You guessed it${myOwnRow?.identity ? ` — you're ${myOwnRow.identity.name}!` : ''} Keep answering truthfully.`}
        </div>
      )}

      <p className="hint center-text">
        {game.subPhase === 'guessing'
          ? `${activeName} is typing a guess…`
          : 'Answer out loud: yes or no. No hints!'}
      </p>

      {activeRow?.identity && (
        <div className="wai-active-card">
          <span className="wai-active-label">{activeName} is</span>
          <span className="wai-active-name">{activeRow.identity.name}</span>
        </div>
      )}

      <div className="wai-identity-list">
        {otherRows.map((row) => (
          <div
            key={row.playerId}
            className={`wai-identity-row ${row.playerId === myId ? 'wai-identity-row-me' : ''} ${
              row.hidden ? 'wai-identity-row-hidden' : ''
            }`}
          >
            <PlayerDot color={colorById[row.playerId]} className="player-cdot-inline" />
            <span className="wai-identity-player">{nameById[row.playerId] ?? 'Unknown'}</span>
            <span className="wai-identity-value">{row.hidden ? '???' : row.identity?.name}</span>
          </div>
        ))}
      </div>

      <p className="hint center-text wai-footer-counter">
        {activeName} has asked {game.activeQuestionsAsked ?? 0} of {game.questionCap} questions
      </p>
    </div>
  )
}
