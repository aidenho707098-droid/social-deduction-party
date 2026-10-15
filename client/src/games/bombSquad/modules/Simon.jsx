import { useCallback, useEffect, useRef, useState } from 'react'
import { useSound } from '../../../sound/SoundContext'
import { SimonShape } from './simonShapes'

const COLORS = ['red', 'blue', 'green', 'yellow']
const NOTE = { red: 0, blue: 2, green: 4, yellow: 6 } // soft bells (Echo Chain's notes)
const ON_MS = 520
const GAP_MS = 260
const IDLE_MS = 8_000

// SIMON LIGHTS: four lights flash the sequence; the Defuser presses the
// TRANSLATED colours on the buttons below. The flashes replay whenever the
// server says so (a new stage, or a strike) and after 8s with no press.
export default function Simon({ view, interactive, onAct }) {
  const { play } = useSound()
  const [lit, setLit] = useState(null)
  const [nudge, setNudge] = useState(0) // bumps on a press: restarts the idle timer
  const flashes = view.flashes.join()

  // Schedules one run through the flashes; returns how long it takes.
  const timers = useRef([])
  const seqMs = view.flashes.length * (ON_MS + GAP_MS)
  const playSeq = useCallback(
    (delay) => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      view.flashes.forEach((c, i) => {
        const t0 = delay + i * (ON_MS + GAP_MS)
        timers.current.push(
          setTimeout(() => {
            setLit(c)
            play(`echo-note-${NOTE[c]}`, { gain: 0.32 })
          }, t0),
        )
        timers.current.push(setTimeout(() => setLit(null), t0 + ON_MS))
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flashes, play],
  )
  // A new sequence (next stage) or a strike: play it now.
  useEffect(() => {
    playSeq(400)
    const list = timers
    return () => list.current.forEach(clearTimeout)
  }, [view.replay, playSeq])
  // Idle for 8s (no press): play it again. A press restarts the wait.
  useEffect(() => {
    const id = setInterval(() => playSeq(0), IDLE_MS + seqMs)
    return () => clearInterval(id)
  }, [view.replay, nudge, playSeq, seqMs])

  return (
    <div className="bs-simon">
      <div className="bs-simon-lights" aria-live="polite" aria-label={lit ? `${lit} flash` : 'lights'}>
        {COLORS.map((c) => (
          <span key={c} className={`bs-simon-light bs-simon-${c} ${lit === c ? 'bs-simon-on' : ''}`}>
            <SimonShape color={c} />
          </span>
        ))}
      </div>
      <p className="bs-simon-stage">
        Stage {Math.min(view.stage + 1, view.stages)} of {view.stages} · {view.flashes.length} flashes · pressed {view.progress}
      </p>
      <div className="bs-simon-buttons">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`bs-simon-btn bs-simon-${c}`}
            disabled={!interactive}
            onClick={() => {
              setNudge((n) => n + 1)
              onAct({ kind: 'press', color: c })
            }}
            aria-label={`Press ${c}`}
          >
            <SimonShape color={c} />
            <span>{c}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
