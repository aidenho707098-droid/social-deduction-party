import { useEffect, useRef, useState } from 'react'
import { GameIcon } from '../games/gameStyle'
import { useSound } from '../sound/SoundContext'

const SEG_COLORS = ['#5b3e99', '#ff7a50', '#f0b429']
const R = 118
const C = 130
const SIZE = 260

function pointOn(deg, r) {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)]
}

// Shown to EVERYONE before every game in a random tournament. The server
// has already decided `wheel.landedOn`; this just animates the reveal so
// it lands there. The host's device (and a server timer) then kick off the
// actual game.
export default function TournamentWheel({ t, isHost, onReady }) {
  const wheel = t.wheel
  const pool = wheel?.pool ?? []
  const n = Math.max(pool.length, 1)
  const seg = 360 / n

  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState(false)
  const firedRef = useRef(false)
  const { play, stop } = useSound()

  useEffect(() => {
    if (!wheel) return
    firedRef.current = false
    setLanded(false)

    // Pace the spin SFX to the wheel. The wheel eases out over ~4.4s
    // (cubic-bezier below), so its angular speed starts high and tails off
    // to nearly nothing. Ride the spin sound's playbackRate down the same
    // curve so its ticking spaces out as the wheel slows, rather than
    // racing at one flat tempo for the whole spin.
    const spinEl = play('wheel-spin')
    const SPIN_MS = 4400
    const RATE_START = 0.85
    const RATE_END = 0.3
    let rateRaf = 0
    let rateT0 = 0
    const rampRate = (now) => {
      if (!rateT0) rateT0 = now
      const p = Math.min(1, (now - rateT0) / SPIN_MS)
      const speed = (1 - p) ** 2 // ease-out velocity: fast, then trailing off
      try {
        spinEl.playbackRate = RATE_END + (RATE_START - RATE_END) * speed
      } catch {
        // some browsers clamp playbackRate — leave it at the default
      }
      if (p < 1) rateRaf = requestAnimationFrame(rampRate)
    }
    if (spinEl) rateRaf = requestAnimationFrame(rampRate)

    const k = Math.max(0, pool.findIndex((p) => p.id === wheel.landedOn))
    const center = ((k + 0.5) * seg) % 360
    const within = (360 - center) % 360
    const jitter = (Math.random() - 0.5) * seg * 0.55
    const target = 360 * 7 + within + jitter

    setSpinning(false)
    setRot(0)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinning(true)
        setRot(target)
      })
    })
    const done = setTimeout(() => {
      stop('wheel-spin')
      play('wheel-land')
      setLanded(true)
      if (isHost && !firedRef.current) {
        firedRef.current = true
        onReady()
      }
    }, 4600)

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(rateRaf)
      clearTimeout(done)
      stop('wheel-spin')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel?.spinId])

  return (
    <div className="screen center tour-wheel-screen">
      <p className="wyr-round">
        Game {t.currentIndex + 1} of {t.totalGames}
      </p>
      <h1 className="title">{landed ? 'The wheel picked…' : 'Spinning…'}</h1>

      <div className="tour-wheel-wrap">
        <div className="tour-wheel-pointer" />
        <svg className="tour-wheel" viewBox={`0 0 ${SIZE} ${SIZE}`} width="280" height="280">
          <g
            style={{
              transform: `rotate(${rot}deg)`,
              transformOrigin: `${C}px ${C}px`,
              transition: spinning
                ? 'transform 4.4s cubic-bezier(0.16, 0.85, 0.25, 1)'
                : 'none',
            }}
          >
            {pool.map((g, i) => {
              const [x0, y0] = pointOn(i * seg, R)
              const [x1, y1] = pointOn((i + 1) * seg, R)
              const [lx, ly] = pointOn(i * seg + seg / 2, R * 0.64)
              return (
                <g key={`${g.id}-${i}`}>
                  <path
                    d={`M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1} Z`}
                    fill={SEG_COLORS[i % 3]}
                    stroke="#f7f4fb"
                    strokeWidth="2"
                  />
                  <foreignObject x={lx - 14} y={ly - 14} width="28" height="28">
                    <div className="tour-wheel-ico">
                      <GameIcon id={g.id} />
                    </div>
                  </foreignObject>
                </g>
              )
            })}
            <circle cx={C} cy={C} r="15" fill="#241f33" stroke="#f7f4fb" strokeWidth="3" />
          </g>
        </svg>
      </div>

      <div className={`tour-wheel-result ${landed ? 'tour-wheel-result-in' : ''}`}>
        {landed && wheel && (
          <>
            <span className="tour-wheel-result-label">Next game</span>
            <span className="tour-wheel-result-name">{wheel.landedOnName}</span>
          </>
        )}
      </div>

      {isHost && landed && (
        <button className="btn btn-primary" onClick={onReady}>
          Continue →
        </button>
      )}
      {!isHost && landed && (
        <p className="hint center-text">Get ready for {wheel?.landedOnName}…</p>
      )}
    </div>
  )
}
