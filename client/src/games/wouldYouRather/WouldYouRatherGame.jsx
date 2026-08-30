import CollectPrompts from './CollectPrompts'
import AnswerQuestion from './AnswerQuestion'
import RoundResult from './RoundResult'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, this client's private
// data (`myRole` — only used in Custom Mode's "collect" phase, where it
// carries the prompt this player is currently answering), and the actions.
export default function WouldYouRatherGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'collect':
      return (
        <CollectPrompts
          game={game}
          myRole={myRole}
          isHost={isHost}
          onSubmitPrompt={actions.wyrSubmitPrompt}
          onForceGenerate={actions.wyrForceGenerate}
        />
      )

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
