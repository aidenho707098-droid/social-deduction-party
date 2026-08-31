import { useEffect, useRef, useState } from 'react'

// Renders a number that briefly counts up to `value` — from 0 on mount,
// from its previous value on later changes — so scores and leaderboard
// totals feel like they land rather than blink into place. Quick
// (~450ms, easeOutCubic) and snaps instantly under reduced-motion.
const DURATION = 450

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function CountUp({ value }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = target
    if (from === target || prefersReducedMotion()) {
      setShown(target)
      return undefined
    }
    let raf
    let startedAt
    const tick = (ts) => {
      if (startedAt === undefined) startedAt = ts
      const p = Math.min(1, (ts - startedAt) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => raf && cancelAnimationFrame(raf)
  }, [target])

  return <>{shown}</>
}
