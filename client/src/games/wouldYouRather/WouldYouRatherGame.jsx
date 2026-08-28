import AnswerQuestion from './AnswerQuestion'
import RoundResult from './RoundResult'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, and the action bundle.
// This game has no private per-player data, so `myRole` is ignored.
export default function WouldYouRatherGame({ game, players, isHost, myId, actions }) {
  switch (game.phase) {
    case 'answer':
      return (
        <AnswerQuestion
          game={game}
          isHost={isHost}
          onAnswer={actions.wyrAnswer}
          onReveal={actions.wyrReveal}
        />
      )

    case 'result':
      return (
        <RoundResult
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.wyrNextRound}
        />
      )

    case 'final':
      return (
        <FinalStandings
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onBackToLobby={actions.backToLobby}
        />
      )

    default:
      return null
  }
}
