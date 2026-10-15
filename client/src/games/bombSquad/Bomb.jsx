import { useEffect, useRef, useState } from 'react'
import { MODULE_NAMES, fmtFuse } from './config'
import { ModuleIcon } from './ModuleIcon'
import { MODULE_UI } from './modules'

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
export default function Bomb({ bomb, turn, msLeft, interactive, onAct }) {
  const strikes = turn?.strikes ?? 0
  const [shake, setShake] = useState(0)
  const last = useRef(strikes)
  useEffect(() => {
    if (strikes > last.current) setShake((n) => n + 1)
    last.current = strikes
  }, [strikes])

  return (
    <div key={shake} className={`bs-bomb ${shake ? 'bs-bomb-shake' : ''}`}>
      <div className="bs-bomb-head">
        <FuseReadout msLeft={msLeft} fuse={turn?.fuse} strikes={strikes} />
        <div className="bs-serial">
          <span className="bs-serial-label">Serial</span>
          <span className="bs-serial-no">{bomb.serialNo}</span>
        </div>
      </div>
      <div className="bs-modules">
        {bomb.modules.map((m) => {
          const UI = MODULE_UI[m.type]
          return (
            <section key={m.index} className={`bs-module ${m.solved ? 'bs-module-solved' : ''}`} aria-label={MODULE_NAMES[m.type]}>
              <header className="bs-module-head">
                <ModuleIcon id={m.type} />
                <span>{MODULE_NAMES[m.type]}</span>
                <span className={`bs-light ${m.solved ? 'bs-light-on' : ''}`} aria-label={m.solved ? 'solved' : 'not solved'} />
              </header>
              {UI ? (
                <UI view={m.view} interactive={interactive && !m.solved} onAct={(a) => onAct?.(m.index, a)} />
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
