import { useEffect, useRef } from 'react'
import { useSound } from '../../sound/SoundContext'

// Buzz the phone, where the browser allows it (Android Chrome; iOS Safari
// has no Vibration API). Skipped when the room's sound is muted.
export function buzz(pattern, muted) {
  if (muted) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported — fine
  }
}

// Live-round sound: a short pop on every pass (all phones), a buzz for the
// player who just caught it, and — on the HOLDER's phone only — arcade
// ticks that speed up as their turn window runs down. `msLeftRef` /
// `totalMs` are whatever turn clock this device can see: the public
// Sprint window, or the holder's private 5s cap in a Hidden Fuse potato.
// Nothing here ever reads the hidden fuse (no client has it).
export function usePotatoSounds({ turnId, holderId, myId, running, msLeftRef, totalMs }) {
  const { play, muted } = useSound()
  const lastTurn = useRef(turnId)
  const isHolder = holderId === myId

  useEffect(() => {
    if (turnId === lastTurn.current) return
    const first = lastTurn.current == null
    lastTurn.current = turnId
    if (first) return
    play('potato-pass')
    if (isHolder) buzz(40, muted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnId])

  useEffect(() => {
    if (!isHolder || !running || !totalMs) return undefined
    let timer = null
    const loop = () => {
      const left = msLeftRef.current ?? 0
      if (left <= 0) return
      const frac = Math.max(0, Math.min(1, left / totalMs))
      play('potato-tick', { gain: 0.25 + 0.25 * (1 - frac) })
      // ~2.3 ticks/s when the window is fresh, ~8/s at the very end.
      timer = setTimeout(loop, 120 + 320 * frac)
    }
    timer = setTimeout(loop, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHolder, running, totalMs, turnId])
}
