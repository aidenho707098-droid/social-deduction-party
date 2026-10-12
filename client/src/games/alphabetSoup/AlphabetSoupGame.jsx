import SoupReveal from './SoupReveal'
import TypedRound from './TypedRound'
import TypedResults from './TypedResults'
import SpokenRound from './SpokenRound'
import SpokenResults from './SpokenResults'
import FinalStandings from './FinalStandings'

// Same contract as every game component: public state, players, this
// client's private role, host flag, id, and the action bundle.
//
// Each round-scoped screen is keyed by roundIndex so its local state
// (the reveal animation's stage machine above all) starts fresh EVERY
// round — never carried over from the last one.
export default function AlphabetSoupGame({ game, players, myRole, isHost, myId, actions }) {
  const k = `${game.roundIndex}`

  if (game.phase === 'final') {
    return (
      <FinalStandings
        game={game}
        players={players}
        myId={myId}
        isHost={isHost}
        onBackToLobby={actions.backToLobby}
      />
    )
  }

  if (game.phase === 'intro') return <SoupReveal key={`intro-${k}`} game={game} />

  if (game.mode === 'spoken') {
    if (game.phase === 'reveal') {
      return <SpokenResults game={game} players={players} myId={myId} isHost={isHost} actions={actions} />
    }
    return (
      <SpokenRound key={`spoken-${k}`} game={game} players={players} myId={myId} myRole={myRole} actions={actions} />
    )
  }

  if (game.phase === 'review' || game.phase === 'reveal') {
    return (
      <TypedResults
        key={`results-${k}`}
        game={game}
        players={players}
        myId={myId}
        myRole={myRole}
        isHost={isHost}
        actions={actions}
      />
    )
  }

  // 'answer' | 'checking'
  return (
    <TypedRound key={`typed-${k}`} game={game} players={players} myId={myId} myRole={myRole} actions={actions} />
  )
}
