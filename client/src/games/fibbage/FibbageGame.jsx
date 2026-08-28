import WriteAnswer from './WriteAnswer'
import VoteAnswer from './VoteAnswer'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, this client's private
// data (`myRole` — here it carries { myOptionId } during voting), and the
// action bundle.
export default function FibbageGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'write':
      return (
        <WriteAnswer
          game={game}
          isHost={isHost}
          onSubmit={actions.fibbageSubmit}
          onForceVote={actions.fibbageStartVote}
        />
      )

    case 'vote':
      return (
        <VoteAnswer
          game={game}
          myRole={myRole}
          isHost={isHost}
          onVote={actions.fibbageVote}
          onForceReveal={actions.fibbageReveal}
        />
      )

    case 'reveal':
      return (
        <RoundReveal
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.fibbageNextRound}
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
