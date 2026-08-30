import CluePhase from './CluePhase'
import GuessPhase from './GuessPhase'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, this client's private
// data (`myRole` — carries the scale + secret target when this client is
// the round's Clue-Giver), and the action bundle.
export default function WavelengthGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'clue':
      return (
        <CluePhase
          game={game}
          myRole={myRole}
          myId={myId}
          isHost={isHost}
          onSubmitClue={actions.wavelengthSubmitClue}
          onReveal={actions.wavelengthReveal}
        />
      )

    case 'guess':
      return (
        <GuessPhase
          game={game}
          players={players}
          myRole={myRole}
          myId={myId}
          isHost={isHost}
          onGuess={actions.wavelengthGuess}
          onReveal={actions.wavelengthReveal}
        />
      )

    case 'reveal':
      return (
        <RoundReveal
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.wavelengthNextRound}
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
