import PickWitch from './PickWitch'
import ChooseCurse from './ChooseCurse'
import ActiveRound from './ActiveRound'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, this client's private
// data (`myRole` — here { role: 'witch', curse } for The Witch during an
// active round, otherwise { role: 'player' } or null), and the actions.
export default function BlackMagicGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'pick':
      return (
        <PickWitch
          game={game}
          players={players}
          isHost={isHost}
          onPick={actions.bmPickWitch}
        />
      )

    case 'choose':
      return (
        <ChooseCurse
          game={game}
          players={players}
          myId={myId}
          myRole={myRole}
          onChoose={actions.bmChooseCurse}
        />
      )

    case 'active':
      return (
        <ActiveRound
          game={game}
          players={players}
          myId={myId}
          myRole={myRole}
          isHost={isHost}
          onAward={actions.bmAward}
          onReveal={actions.bmReveal}
        />
      )

    case 'reveal':
      return (
        <RoundReveal
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.bmNextRound}
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
