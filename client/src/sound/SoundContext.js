import { createContext, useContext } from 'react'

// The context + hook live here (not in SoundProvider.jsx) so that file can
// export only its component — keeps react-refresh happy and the import
// surface small: components just `import { useSound } from '.../SoundContext'`.

export const SoundContext = createContext(null)

// Inert fallback so components can call useSound() even with no provider
// mounted (e.g. an isolated component test).
export const NOOP_SOUND = {
  muted: false,
  volume: 0,
  play: () => {},
  stop: () => {},
  setMuted: () => {},
  toggleMuted: () => {},
  setVolume: () => {},
}

export function useSound() {
  return useContext(SoundContext) ?? NOOP_SOUND
}
