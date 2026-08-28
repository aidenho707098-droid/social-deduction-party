import RoleReveal from './RoleReveal'
import TurnOrder from './TurnOrder'
import Voting from './Voting'
import Results from './Results'

export default function ImposterGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'reveal':
      return <RoleReveal myRole={myRole} isHost={isHost} onStartTurns={actions.startTurns} />

    case 'turns':
      return (
        <TurnOrder
          players={players}
          turnOrder={game.turnOrder}
          currentTurnPlayerId={game.currentTurnPlayerId}
          imposterCount={game.imposterCount}
          myId={myId}
          onNextTurn={actions.nextTurn}
        />
      )

    case 'voting':
      return (
        <Voting
          players={players}
          myId={myId}
          votedPlayerIds={game.votedPlayerIds}
          totalVoters={game.totalVoters}
          voteLimit={game.imposterCount}
          onToggleVote={actions.toggleVote}
        />
      )

    case 'results':
      return (
        <Results
          players={players}
          myRole={myRole}
          category={game.category}
          word={game.word}
          imposterIds={game.imposterIds}
          tally={game.tally}
          detectivesWin={game.detectivesWin}
          isHost={isHost}
          onBackToLobby={actions.backToLobby}
        />
      )

    default:
      return null
  }
}
