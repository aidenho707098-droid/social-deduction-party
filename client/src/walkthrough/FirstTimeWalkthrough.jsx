import { useEffect, useState } from 'react'
import WalkthroughOverlay from './WalkthroughOverlay'
import { WALKTHROUGHS } from './content'
import { hasSeenWalkthrough, markWalkthroughSeen } from './seen'

// Drop this anywhere with:
//   walkthroughKey  which content to show (a WALKTHROUGHS key, e.g. the
//                   mode-specific "alphabet-soup-spoken"), or null
//   seenKey         what "seen" is tracked under: the GAME ("game:<id>")
//                   or "tournament" (see seen.js)
//   room, myId      whose seen-list to read (the server's, in the room)
//
// It pops the overlay automatically ONLY the first time this player meets
// seenKey in this room, and marks it seen the moment it appears — so a
// reload, reconnect, new round, restart or trip through the menu can never
// bring it back. (How to Play reopens it by hand.)
//
// `deferred` (see keyFor.js walkthroughDeferred): not now — the overlay
// would eat time a player can't get back. It waits until it's allowed; if
// it was already open when the deferral starts, it closes, and (already
// seen) it does not come back on its own.
export default function FirstTimeWalkthrough({ walkthroughKey, seenKey, room, myId, deferred = false }) {
  const [openKey, setOpenKey] = useState(null)
  const seen = hasSeenWalkthrough(room, myId, seenKey)
  const code = room?.code

  useEffect(() => {
    if (openKey || deferred || seen || !walkthroughKey || !WALKTHROUGHS[walkthroughKey]) return
    markWalkthroughSeen(code, myId, seenKey) // the moment it's first shown
    setOpenKey(walkthroughKey)
  }, [walkthroughKey, seenKey, seen, deferred, openKey, code, myId])

  // A deferral closes an open walkthrough for good (it's already seen).
  if (deferred && openKey) setOpenKey(null)

  if (!openKey || deferred) return null
  const content = WALKTHROUGHS[openKey]
  if (!content) return null
  return <WalkthroughOverlay title={content.title} steps={content.steps} onDone={() => setOpenKey(null)} />
}
