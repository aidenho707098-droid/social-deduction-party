import { useEffect, useRef, useState } from 'react'
import { MODULE_NAMES, fmtFuse } from './config'
import { ModuleIcon } from './ModuleIcon'
import { MODULE_UI } from './modules'
import { useSocketConnected } from '../../socket'

// The fuse: mm:ss, a burning bar with a spark at its end, and the rate
// when strikes have sped it up. Shared by every role.
export function FuseReadout({ msLeft, fuse, strikes, max = 3 }) {
  const frac = fuse?.totalMs ? Math.max(0, Math.min(1, msLeft / fuse.totalMs)) : 0
  return (
    <div className={`bs-fuse ${fuse?.paused ? 'bs-fuse-paused' : ''}`}>
      <div className="bs-fuse-row">
        <span className={`bs-fuse-time ${msLeft < 30_000 ? 'bs-fuse-low' : ''}`} role="timer" aria-label={`${fmtFuse(msLeft)} left`}>
          {fmtFuse(msLeft)}
        </span>
        {fuse?.rate > 1 && <span className="bs-fuse-rate">×{fuse.rate.toFixed(2)} speed</span>}
        <span className="bs-strikes" aria-label={`${strikes} of ${max} strikes`}>
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={`bs-strike ${i < strikes ? 'bs-strike-on' : ''}`}>
              ✕
            </span>
          ))}
        </span>
      </div>
      <div className="bs-fuse-bar" aria-hidden="true">
        <div className="bs-fuse-fill" style={{ width: `${frac * 100}%` }}>
          {fuse?.running && <span className="bs-spark" />}
        </div>
      </div>
    </div>
  )
}

// The bomb, for the Defuser (interactive) or spectators (a read-only mirror).
//
// Sync with the server: every action goes out numbered (`seq`, carried on
// from the bomb's lastSeq so a reload keeps counting) and the server acks
// each one with that module's fresh view + rev. Each module shows whichever
// view is newest — the ack or the latest push — so the bomb never drifts
// from the server, however acks and pushes interleave. `onAct` resolves
// with the ack, so modules can count their in-flight actions.
export default function Bomb({ bomb, turn, msLeft, interactive, onAct }) {
  const strikes = turn?.strikes ?? 0
  const connected = useSocketConnected()

  // A strike shakes the bomb by restarting a CSS animation — never by
  // remounting it, which would swallow a tap that's halfway through.
  const shakeRef = useRef(null)
  const last = useRef(strikes)
  useEffect(() => {
    const el = shakeRef.current
    if (strikes > last.current && el) {
      el.classList.remove('bs-bomb-shake')
      void el.offsetWidth
      el.classList.add('bs-bomb-shake')
    }
    last.current = strikes
  }, [strikes])

  const seq = useRef(0)
  const [acked, setAcked] = useState({}) // module index -> { rev, solved, view } from acks
  const [pending, setPending] = useState({}) // module index -> actions not acked yet
  const bump = (index, d) => setPending((p) => ({ ...p, [index]: Math.max(0, (p[index] ?? 0) + d) }))
  const send = (index, a) =>
    new Promise((resolve) => {
      seq.current = Math.max(seq.current, bomb.lastSeq ?? 0) + 1
      bump(index, 1)
      onAct(index, { ...a, seq: seq.current }, (res) => {
        // The fresh view and the in-flight count change in the SAME render,
        // so "server progress + in flight" never double-counts a press.
        const m = res?.module
        if (m) setAcked((prev) => (prev[m.index] && prev[m.index].rev > m.rev ? prev : { ...prev, [m.index]: m }))
        bump(index, -1)
        if (Number.isInteger(res?.lastSeq)) seq.current = Math.max(seq.current, res.lastSeq)
        resolve(res ?? null)
      })
    })
  const newest = (m) => {
    const a = acked[m.index]
    return a && a.rev > (m.rev ?? -1) ? { ...m, ...a } : m
  }

  return (
    <div ref={shakeRef} className="bs-bomb" onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove('bs-bomb-shake')}>
      <div className="bs-bomb-head">
        <FuseReadout msLeft={msLeft} fuse={turn?.fuse} strikes={strikes} />
        <div className="bs-serial">
          <span className="bs-serial-label">Serial</span>
          <span className="bs-serial-no">{bomb.serialNo}</span>
        </div>
      </div>
      {interactive && !connected && (
        <p className="bs-paused" role="status">
          Reconnecting… presses are paused.
        </p>
      )}
      <div className="bs-modules">
        {bomb.modules.map(newest).map((m) => {
          const UI = MODULE_UI[m.type]
          return (
            <section key={m.index} className={`bs-module ${m.solved ? 'bs-module-solved' : ''}`} aria-label={MODULE_NAMES[m.type]}>
              <header className="bs-module-head">
                <ModuleIcon id={m.type} />
                <span>{MODULE_NAMES[m.type]}</span>
                <span className={`bs-light ${m.solved ? 'bs-light-on' : ''}`} aria-label={m.solved ? 'solved' : 'not solved'} />
              </header>
              {UI ? (
                <UI view={m.view} pending={pending[m.index] ?? 0} interactive={interactive && connected && !m.solved} onAct={(a) => send(m.index, a)} />
              ) : (
                <p className="hint">Unknown module.</p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
