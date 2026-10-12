import { useEffect, useState } from 'react'

// Local countdown that follows the server's `msLeft` — the same shape as
// every other game's timer (taboo/GuessRound, whoAmI/AskScreen): tick down
// between the server's ~1s pushes, reset on a new `windowKey`, and snap to
// the server whenever the two drift apart by more than ~0.9s.
export function useCountdown(serverMs, windowKey, tickMs = 100) {
  const [msLeft, setMsLeft] = useState(serverMs ?? 0)
  const [key, setKey] = useState(windowKey)

  // New window: take the server number fresh (adjusting state during
  // render, so the first frame of a new window is never stale).
  if (key !== windowKey) {
    setKey(windowKey)
    setMsLeft(serverMs ?? 0)
  }

  useEffect(() => {
    const t = setInterval(() => setMsLeft((m) => Math.max(0, m - tickMs)), tickMs)
    return () => clearInterval(t)
  }, [windowKey, tickMs])

  useEffect(() => {
    if (typeof serverMs !== 'number') return
    setMsLeft((m) => (Math.abs(m - serverMs) > 900 ? serverMs : m))
  }, [serverMs])

  return msLeft
}
