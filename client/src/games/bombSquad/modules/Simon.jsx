import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../../sound/SoundContext'
import { SimonShape } from './simonShapes'
import { tapProps } from './tap'

const COLORS = ['red', 'blue', 'green', 'yellow']
const NOTE = { red: 0, blue: 2, green: 4, yellow: 6 } // soft bells (Echo Chain's notes)

// SIMON LIGHTS: four lights flash the sequence; the Defuser presses the
// TRANSLATED colours on the buttons below.
//
// The SERVER runs the playback (server/games/bombSquad/modules/simon.js):
// the view's `playback` says which run is on and how far in it is, and this
// only draws it. The buttons stay disabled while the server says a playback
// is running, and re-enable only when a view without one arrives. Each
// press says which stage + index it is for (the server's progress plus the
// presses still in flight), so one that crosses a strike or replay is
// refused rather than judged. An inactivity replay keeps the stage's
// progress; a strike resets it.
export default function Simon({ view, pending = 0, interactive, onAct }) {
  const { play } = useSound()
  const [lit, setLit] = useState(null)
  const pb = view.playback
  const playing = !!pb

  // Draw a playback run once per run id, offset by how far in it already
  // was when the server sent it (a reload mid-run picks up where it is).
  const shown = useRef(null)
  const timers = useRef([])
  useEffect(() => {
    if (!pb || shown.current === pb.id) return
    shown.current = pb.id
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLit(null)
    const { leadMs, onMs, gapMs } = view.timing
    view.flashes.forEach((c, i) => {
      const t0 = leadMs + i * (onMs + gapMs) - pb.elapsedMs
      if (t0 + onMs <= 0) return // already over
      timers.current.push(
        setTimeout(() => {
          setLit(c)
          if (t0 >= 0) play(`echo-note-${NOTE[c]}`, { gain: 0.32 })
        }, Math.max(0, t0)),
      )
      timers.current.push(setTimeout(() => setLit(null), t0 + onMs))
    })
  }, [pb, view.flashes, view.timing, play])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const disabled = !interactive || playing
  function press(color) {
    if (disabled) return
    onAct({ kind: 'press', color, stage: view.stage, index: view.progress + pending })
  }

  const pressed = view.progress + pending
  let status = `pressed ${pressed}`
  if (playing && pb.reason === 'idle' && view.progress > 0) status = view.progress === 1 ? 'replaying · your 1 press still counts' : `replaying · your ${view.progress} presses still count`
  else if (playing && pb.reason === 'strike') status = 'strike · the stage starts over'
  else if (playing) status = 'watch the lights'

  return (
    <div className="bs-simon">
      <div className="bs-simon-lights" aria-live="polite" aria-label={lit ? `${lit} flash` : 'lights'}>
        {COLORS.map((c) => (
          <span key={c} className={`bs-simon-light bs-simon-${c} ${lit === c ? 'bs-simon-on' : ''}`}>
            <SimonShape color={c} />
          </span>
        ))}
      </div>
      <p className="bs-simon-stage" role="status">
        Stage {Math.min(view.stage + 1, view.stages)} of {view.stages} · {view.flashes.length} flashes · {status}
      </p>
      <div className={`bs-simon-buttons ${playing ? 'bs-simon-buttons-wait' : ''}`}>
        {COLORS.map((c) => (
          <button key={c} type="button" className={`bs-simon-btn bs-simon-${c}`} disabled={disabled} aria-label={`Press ${c}`} {...tapProps(() => press(c))}>
            <SimonShape color={c} />
            <span>{c}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
