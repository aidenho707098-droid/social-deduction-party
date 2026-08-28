import { useEffect, useState } from 'react'

const COLORS = ['#5b3e99', '#ff7a50', '#f0b429']
const COUNT = 46

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

function makeBits() {
  return Array.from({ length: COUNT }, (_, i) => {
    const round = Math.random() > 0.6
    const size = 6 + Math.random() * 7
    return {
      key: i,
      left: `${Math.random() * 100}%`,
      width: `${size}px`,
      height: `${round ? size : size * 1.6}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: round ? '50%' : '2px',
      animationDelay: `${Math.random() * 0.5}s`,
      animationDuration: `${2.1 + Math.random() * 1.2}s`,
      drift: `${(Math.random() - 0.5) * 170}px`,
      rot: `${Math.random() * 800 - 400}deg`,
    }
  })
}

// A short, tasteful confetti burst. Self-contained (no library), respects
// prefers-reduced-motion, and stops rendering after ~3.4s.
export default function Confetti({ run }) {
  const [bits, setBits] = useState(null)

  useEffect(() => {
    if (!run || REDUCED_MOTION) return undefined
    const raf = requestAnimationFrame(() => setBits(makeBits()))
    const timer = setTimeout(() => setBits(null), 3400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [run])

  if (!bits) return null

  return (
    <div className="confetti-layer" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.key}
          className="confetti-bit"
          style={{
            left: b.left,
            width: b.width,
            height: b.height,
            background: b.background,
            borderRadius: b.borderRadius,
            animationDelay: b.animationDelay,
            animationDuration: b.animationDuration,
            '--drift': b.drift,
            '--rot': b.rot,
          }}
        />
      ))}
    </div>
  )
}
