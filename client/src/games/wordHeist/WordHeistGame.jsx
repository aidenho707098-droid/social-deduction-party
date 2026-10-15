import { playerColorMap } from '../../playerColors'
import FinalStandings from '../alphabetSoup/FinalStandings'
import { GameIcon } from '../gameStyle'
import { privateFor } from './config'
import RoundReveal from './RoundReveal'
import SetWord from './SetWord'
import Solve from './Solve'

// Same contract as every game component. Screens are keyed by the round's
// serial, so each round starts every screen fresh. A private payload is only
// used for the phase it was sent for (the set-phase one can linger for a
// moment after solving starts).
export default function WordHeistGame({ game, players, myRole, isHost, myId, actions }) {
  const priv = privateFor(game, myRole)
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const props = { game, myId, isHost, nameById, colorById, actions }
  const k = game.serial

  switch (game.phase) {
    case 'set':
      return <SetWord key={`set-${k}`} {...props} priv={priv?.phase === 'set' ? priv : null} />
    case 'solve':
      return <Solve key={`solve-${k}`} {...props} priv={priv?.phase === 'solve' ? priv : null} />
    case 'reveal':
      return <RoundReveal key={`rev-${k}`} {...props} />
    case 'final':
      return (
        <FinalStandings
          game={game}
          players={players}
          myId={myId}
          isHost={isHost}
          onBackToLobby={actions.backToLobby}
          plainRanks
          icon={
            <span className="mi-final-icon">
              <GameIcon id="word-heist" />
            </span>
          }
        />
      )
    default:
      return null
  }
}
