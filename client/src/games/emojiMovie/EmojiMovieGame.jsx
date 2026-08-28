import GuessMovie from './GuessMovie'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public game state, the player
// list, this client's id, whether it's the host, and the action bundle.
// This game has no private per-player data, so `myRole` is ignored.
export default function EmojiMovieGame({ game, players, isHost, myId, actions }) {
  switch (game.phase) {
    case 'guess':
      return (
        <GuessMovie
          game={game}
          isHost={isHost}
          onGuess={actions.emojiAnswer}
          onReveal={actions.emojiReveal}
        />
      )

    case 'reveal':
      return (
        <RoundReveal
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onNext={actions.emojiNextRound}
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
