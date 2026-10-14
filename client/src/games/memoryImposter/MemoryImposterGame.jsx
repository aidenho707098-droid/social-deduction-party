import { GameIcon } from '../gameStyle'
import FinalStandings from '../alphabetSoup/FinalStandings'
import Discussion from './Discussion'
import Memorize from './Memorize'
import { privateFor } from './memoryData'
import RoleReveal from './RoleReveal'
import RoundReveal from './RoundReveal'
import Vote from './Vote'

// Same contract as every game component. Screens are keyed by the deal's
// serial, so a cancelled-and-redone round starts every screen fresh.
export default function MemoryImposterGame({ game, players, myRole, isHost, myId, actions }) {
  const priv = privateFor(game, myRole)
  const k = game.roundSerial
  const props = { game, priv, players, myId, isHost, actions }

  switch (game.phase) {
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
              <GameIcon id="memory-imposter" />
            </span>
          }
        />
      )
    case 'memorize':
      return <Memorize key={`mem-${k}`} {...props} />
    case 'roles':
      return <RoleReveal key={`roles-${k}`} {...props} />
    case 'discussion':
      return <Discussion key={`talk-${k}`} {...props} />
    case 'vote':
      return <Vote key={`vote-${k}`} {...props} />
    case 'reveal':
      return <RoundReveal key={`r-${k}`} {...props} />
    default:
      return null
  }
}
