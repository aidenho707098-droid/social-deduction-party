import RoleReveal from './RoleReveal'
import DrawTurn from './DrawTurn'
import Gallery from './Gallery'
import VoteScreen from './VoteScreen'
import RevealScreen from './RevealScreen'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public state, players, this
// client's private role (only the Fake Artist's differs), host flag, id,
// and the action bundle.
export default function FakeArtistGame({ game, players, myRole, isHost, myId, actions }) {
  switch (game.phase) {
    case 'brief':
      return (
        <RoleReveal game={game} myRole={myRole} isHost={isHost} onStart={actions.fakeArtistStart} />
      )

    case 'draw':
      return (
        <DrawTurn
          game={game}
          players={players}
          myId={myId}
          myRole={myRole}
          isHost={isHost}
          onSubmit={actions.fakeArtistSubmit}
          onForceAdvance={actions.hostForceAdvance}
        />
      )

    case 'gallery':
      return (
        <Gallery game={game} isHost={isHost} onStartVote={actions.fakeArtistStartVote} />
      )

    case 'vote':
      return (
        <VoteScreen
          game={game}
          players={players}
          myId={myId}
          myRole={myRole}
          onVote={actions.fakeArtistVote}
        />
      )

    case 'reveal':
      return (
        <RevealScreen
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onGuess={actions.fakeArtistGuess}
          onSkipGuess={actions.fakeArtistSkipGuess}
          onNext={actions.fakeArtistNextRound}
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
