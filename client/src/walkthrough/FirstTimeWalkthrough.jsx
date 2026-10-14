import { useEffect, useState } from 'react'
import WalkthroughOverlay from './WalkthroughOverlay'
import { WALKTHROUGHS } from './content'
import { hasSeenWalkthrough, markWalkthroughSeen } from './seen'

// Drop this anywhere with a `walkthroughKey` (one of the WALKTHROUGHS keys,
// or null/undefined for "nothing to show here"). It pops the overlay the
// FIRST time this key is seen in the current session, then never again —
// re-mounting with the same key (leaving and re-entering the mode) won't
// replay it, but a different key will get its own first showing.
//
// `deferred` (see keyFor.js walkthroughDeferred): not now — the overlay
// would eat time a player can't get back. It waits, and one that's already
// open steps aside (unread, so not marked seen) and comes back after.
export default function FirstTimeWalkthrough({ walkthroughKey, deferred = false }) {
  const [openKey, setOpenKey] = useState(null)

  useEffect(() => {
    if (walkthroughKey && !hasSeenWalkthrough(walkthroughKey)) {
      setOpenKey(walkthroughKey)
    }
  }, [walkthroughKey])

  if (!openKey || deferred) return null
  const content = WALKTHROUGHS[openKey]
  if (!content) return null

  function dismiss() {
    markWalkthroughSeen(openKey)
    setOpenKey(null)
  }

  return <WalkthroughOverlay title={content.title} steps={content.steps} onDone={dismiss} />
}
