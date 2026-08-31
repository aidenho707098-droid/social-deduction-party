import DescribeIntro from './DescribeIntro'
import GuessRound from './GuessRound'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's private role data (only the round's Describer gets
// one), whether it's the host, and the action bundle.
export default function TabooGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'describe':
      return (
        <DescribeIntro
          game={game}
          players={players}
          myRole={myRole}
          isHost={isHost}
          onStart={actions.tabooStartRound}
        />
      )

    case 'guess':
      return (
        <GuessRound
          game={game}
          players={players}
          myId={myId}
          myRole={myRole}
          isHost={isHost}
          onGuess={actions.tabooGuess}
          onReveal={actions.tabooReveal}
        />
      )

    case 'reveal':
      return (
        <RoundReveal
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.tabooNextRound}
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
