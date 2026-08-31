import { useCallback, useEffect, useState } from 'react'
import { soundEngine } from './soundEngine'
import { SoundContext } from './SoundContext'
import { unlockChaosAudio } from '../chaos/chaosSting'

// Thin React binding over the singleton sound engine. Provides the current
// { muted, volume } (re-rendering subscribers when they change) plus stable
// action callbacks. Also owns two bits of lifecycle: preloading the sound
// files, and unlocking audio on the first user gesture so later
// event-driven plays are allowed to sound.
//
// The context + `useSound` hook live in ./SoundContext so this file only
// exports the component.

export function SoundProvider({ children }) {
  const [state, setState] = useState(() => soundEngine.getState())

  useEffect(() => {
    soundEngine.preloadAll()
    const unsub = soundEngine.subscribe(setState)

    const unlock = () => {
      soundEngine.unlock()
      unlockChaosAudio() // warm the Web Audio context for the Chaos sting (iOS)
    }
    const opts = { once: true, passive: true }
    window.addEventListener('pointerdown', unlock, opts)
    window.addEventListener('keydown', unlock, opts)
    window.addEventListener('touchstart', unlock, opts)

    return () => {
      unsub()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [])

  const play = useCallback((key, o) => soundEngine.play(key, o), [])
  const stop = useCallback((key) => soundEngine.stop(key), [])
  const setMuted = useCallback((v) => soundEngine.setMuted(v), [])
  const toggleMuted = useCallback(() => soundEngine.toggleMuted(), [])
  const setVolume = useCallback((v) => soundEngine.setVolume(v), [])

  const value = {
    muted: state.muted,
    volume: state.volume,
    play,
    stop,
    setMuted,
    toggleMuted,
    setVolume,
  }

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
