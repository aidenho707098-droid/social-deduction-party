import EchoPlay from './EchoPlay'
import EchoResults from './EchoResults'

// Same contract as every game component. Everything before the results is
// one screen (EchoPlay), so the board — and any flash on it — survives
// every turn change.
export default function EchoChainGame({ game, players, isHost, myId, actions }) {
  if (game.phase === 'final') {
    return <EchoResults game={game} players={players} myId={myId} isHost={isHost} onBackToLobby={actions.backToLobby} />
  }
  return <EchoPlay game={game} players={players} myId={myId} isHost={isHost} actions={actions} />
}
