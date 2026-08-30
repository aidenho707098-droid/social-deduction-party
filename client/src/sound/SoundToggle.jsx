import { useEffect, useRef, useState } from 'react'
import { useSound } from './SoundContext'

// Small, unobtrusive corner control. At rest it's just a faded speaker
// icon in the top-right — no bar, no slider taking up space. A tap mutes
// or unmutes instantly; hovering (desktop) or long-pressing (touch)
// reveals a compact volume slider that closes itself again.
export default function SoundToggle() {
  const { muted, volume, toggleMuted, setMuted, setVolume, play } = useSound()
  const off = muted || volume === 0

  const [showVol, setShowVol] = useState(false)
  const wrapRef = useRef(null)
  const longPressed = useRef(false)
  const pressTimer = useRef(null)
  const hideTimer = useRef(null)

  const openVol = () => {
    clearTimeout(hideTimer.current)
    setShowVol(true)
  }
  const scheduleHide = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowVol(false), 260)
  }

  // Dismiss the slider on an outside tap or Escape.
  useEffect(() => {
    if (!showVol) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowVol(false)
    }
    const onKey = (e) => e.key === 'Escape' && setShowVol(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showVol])

  useEffect(() => () => {
    clearTimeout(pressTimer.current)
    clearTimeout(hideTimer.current)
  }, [])

  const startPress = () => {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      openVol()
    }, 450)
  }
  const endPress = () => clearTimeout(pressTimer.current)

  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false
      return // long-press opened the slider; don't also toggle
    }
    const wasOff = off
    toggleMuted()
    if (wasOff) play('confirm') // tiny blip so you know sound is back
  }

  return (
    <div
      ref={wrapRef}
      className={`snd ${off ? 'snd-off' : ''}`}
      onMouseEnter={openVol}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        className="snd-icon"
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => {
          e.preventDefault()
          openVol()
        }}
        aria-pressed={off}
        aria-label={off ? 'Sound effects off — tap to turn on' : 'Sound effects on — tap to mute'}
        title={off ? 'Sound off' : 'Sound on'}
      >
        <span aria-hidden="true">{off ? '🔇' : '🔊'}</span>
      </button>

      {showVol && (
        <div className="snd-pop" onMouseEnter={openVol} onMouseLeave={scheduleHide}>
          <input
            type="range"
            className="snd-range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (muted && v > 0) setMuted(false)
              setVolume(v)
            }}
            aria-label="Sound effects volume"
          />
        </div>
      )}
    </div>
  )
}
