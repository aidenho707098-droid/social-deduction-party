import { useState } from 'react'
import AskScreen from './AskScreen'
import AnswerScreen from './AnswerScreen'
import RevealFlash from './RevealFlash'
import RoundReveal from './RoundReveal'
import FinalStandings from './FinalStandings'

const FLASH_MS = 2600

// Same contract as every game component: public state, players, this
// client's private role, host flag, id, and the action bundle.
export default function WhoAmIGame({ game, players, myRole, isHost, myId, actions }) {
  const [flash, setFlash] = useState(null) // { name, placement } | null

  // Wraps the guess action so a correct guess triggers the reveal flash —
  // kept at this level (not inside AskScreen) so it survives the active
  // player's screen swapping out to AnswerScreen the instant room_update
  // reflects the turn having moved on.
  function handleGuess(text, cb) {
    actions.whoAmIGuess(text, (res) => {
      if (res?.correct) {
        setFlash({ name: res.identity?.name, placement: res.placement })
        setTimeout(() => setFlash(null), FLASH_MS)
      }
      cb?.(res)
    })
  }

  if (game.phase === 'reveal') {
    return (
      <RoundReveal
        game={game}
        players={players}
        myId={myId}
        isHost={isHost}
        onNext={actions.whoAmINextRound}
      />
    )
  }

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

  // phase === 'turns'
  const amActive = game.activePlayerId === myId
  return (
    <>
      {amActive ? (
        <AskScreen
          game={game}
          myRole={myRole}
          onAsk={actions.whoAmIAsk}
          onStartGuess={actions.whoAmIStartGuess}
          onGuess={handleGuess}
        />
      ) : (
        <AnswerScreen game={game} players={players} myId={myId} myRole={myRole} />
      )}
      {flash && <RevealFlash name={flash.name} placement={flash.placement} />}
    </>
  )
}
