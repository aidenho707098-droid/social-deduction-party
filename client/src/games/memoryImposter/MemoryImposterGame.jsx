import FinalStandings from '../alphabetSoup/FinalStandings'
import Deliberation from './Deliberation'
import Questions from './Questions'
import { MemorizeScreen, RoleScreen } from './RoundStart'
import RoundReveal from './RoundReveal'
import Statements from './Statements'
import { privateFor } from './memoryData'

// Same contract as every game component. Screens are keyed by the deal's
// serial, so a cancelled-and-redealt round starts every screen fresh.
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
          icon="🧠"
        />
      )
    case 'roles':
      return <RoleScreen key={`roles-${k}`} {...props} />
    case 'memorize':
      return <MemorizeScreen key={`mem-${k}`} {...props} />
    case 'statements':
      return <Statements key={`st-${k}`} {...props} />
    case 'questions':
      return <Questions key={`q-${k}`} {...props} />
    case 'evidence':
    case 'discussion':
    case 'vote':
      return <Deliberation key={`d-${k}`} {...props} />
    case 'reveal':
      return <RoundReveal key={`r-${k}`} {...props} />
    default:
      return null
  }
}
