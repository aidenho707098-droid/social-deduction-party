import { useEffect, useState } from 'react'

// A local countdown that follows the server's `msLeft` — like
// alphabetSoup/useCountdown, but it can be PAUSED: while `running` is
// false (a challenge vote or a dropped holder froze the potato) it holds
// the server's frozen number instead of ticking down. A new `windowKey`
// (a new turn) takes the server number fresh.
export function useClock(serverMs, windowKey, running = true, tickMs = 50) {
  const [msLeft, setMsLeft] = useState(serverMs ?? 0)
  const [key, setKey] = useState(windowKey)

  if (key !== windowKey) {
    setKey(windowKey)
    setMsLeft(serverMs ?? 0)
  }

  useEffect(() => {
    if (!running) return undefined
    let last = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      setMsLeft((m) => Math.max(0, m - dt))
    }, tickMs)
    return () => clearInterval(t)
  }, [windowKey, running, tickMs])

  useEffect(() => {
    if (typeof serverMs !== 'number') return
    // Paused: show exactly the frozen value. Running: snap only on drift.
    setMsLeft((m) => (!running || Math.abs(m - serverMs) > 400 ? serverMs : m))
  }, [serverMs, running])

  return msLeft
}
