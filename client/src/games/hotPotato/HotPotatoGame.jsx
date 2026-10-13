import FinalStandings from '../alphabetSoup/FinalStandings'
import ExplosionScreen from './ExplosionScreen'
import LiveRound from './LiveRound'
import PotatoIntro from './PotatoIntro'

// Same contract as every game component. Each potato-scoped screen is
// keyed by roundIndex (one potato = one index) so its local state — the
// intro's countdown beeps, the explosion's one-shot pop — starts fresh for
// every potato.
export default function HotPotatoGame({ game, players, myRole, isHost, myId, actions }) {
  const k = `${game.roundIndex}`

  if (game.phase === 'final') {
    return (
      <FinalStandings
        game={game}
        players={players}
        myId={myId}
        isHost={isHost}
        onBackToLobby={actions.backToLobby}
        icon="🥔"
      />
    )
  }
  if (game.phase === 'intro') return <PotatoIntro key={`intro-${k}`} game={game} players={players} myId={myId} />
  if (game.phase === 'explode') {
    return <ExplosionScreen key={`boom-${k}`} game={game} players={players} myId={myId} isHost={isHost} actions={actions} />
  }
  return <LiveRound key={`live-${k}`} game={game} players={players} myId={myId} myRole={myRole} actions={actions} />
}
