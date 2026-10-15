import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'

// The fuse, ticking locally between server pushes. The server owns it and
// sends { leftMs, rate, running } (rate = 1.25 per strike); this counts
// down at that rate and snaps back to the server whenever the two drift
// apart by more than ~0.6s.
export function useFuse(fuse, key) {
  const [msLeft, setMsLeft] = useState(fuse?.leftMs ?? 0)
  const [k, setK] = useState(key)
  if (k !== key) {
    setK(key)
    setMsLeft(fuse?.leftMs ?? 0)
  }
  const running = !!fuse?.running
  const rate = fuse?.rate ?? 1
  useEffect(() => {
    if (!running) return undefined
    const step = 100
    const t = setInterval(() => setMsLeft((m) => Math.max(0, m - step * rate)), step)
    return () => clearInterval(t)
  }, [running, rate, key])
  const server = fuse?.leftMs
  useEffect(() => {
    if (typeof server !== 'number') return
    setMsLeft((m) => (Math.abs(m - server) > 600 || !running ? server : m))
  }, [server, running])
  return msLeft
}

// The bomb's sounds, from the shared bell/beep/arcade set (mute-aware via
// the sound engine): a gentle tick that speeds up with each strike, a soft
// buzz on a strike, a chime per solved module, a fanfare on a defuse, a
// soft pop on an explosion.
export function useBombSounds({ turn, solvedCount = null, phase }) {
  const { play } = useSound()
  const running = !!turn?.fuse?.running
  const rate = turn?.fuse?.rate ?? 1
  useEffect(() => {
    if (!running) return undefined
    const t = setInterval(() => play('potato-tick', { gain: 0.18 }), Math.round(1000 / rate))
    return () => clearInterval(t)
  }, [running, rate, play])

  const strikes = turn?.strikes ?? 0
  const lastStrikes = useRef(strikes)
  useEffect(() => {
    if (strikes > lastStrikes.current) play('wrong', { gain: 0.28 })
    lastStrikes.current = strikes
  }, [strikes, play])

  const lastSolved = useRef(solvedCount)
  useEffect(() => {
    if (solvedCount != null && lastSolved.current != null && solvedCount > lastSolved.current) play('correct', { gain: 0.5 })
    lastSolved.current = solvedCount
  }, [solvedCount, play])

  const outcome = phase === 'result' ? turn?.outcome : null
  useEffect(() => {
    if (outcome === 'defused') play('game-win', { gain: 0.7 })
    else if (outcome === 'exploded') play('potato-pop', { gain: 0.45 })
  }, [outcome, play])
}
