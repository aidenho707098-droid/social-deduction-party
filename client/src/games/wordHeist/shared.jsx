import { PlayerDot } from '../../PlayerDot'

// The timer ring in each player's header. Countdown Chaos hides its arc
// and number ([data-chaos-blind] .wh-ring-*).
export function TimerRing({ msLeft, totalMs }) {
  const R = 20
  const C = 2 * Math.PI * R
  const frac = totalMs ? Math.max(0, Math.min(1, msLeft / totalMs)) : 0
  const s = Math.ceil(msLeft / 1000)
  const label = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`
  return (
    <span className={`wh-ring ${frac < 0.2 ? 'wh-ring-low' : ''}`} role="timer" aria-label={`${s} seconds left`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={R} className="wh-ring-track" />
        <circle cx="24" cy="24" r={R} className="wh-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <span className={`wh-ring-num ${label.length > 2 ? 'wh-ring-num-sm' : ''}`}>{label}</span>
    </span>
  )
}

// One chip per other player: counts and statuses only, never words.
//   set:   "setting…" / "locked in"
//   solve: "solving (3)" / "solved in 4" / "failed" / "left"
export function PlayerStrip({ game, myId, nameById, colorById }) {
  const lockedIds = game.lockedIds ?? []
  const items = (game.participantIds ?? []).map((pid) => {
    let text
    let tone = ''
    if (game.phase === 'set') {
      const locked = lockedIds.includes(pid)
      text = locked ? 'locked in' : 'setting…'
      tone = locked ? 'done' : ''
    } else {
      const p = (game.pairs ?? []).find((x) => x.solverId === pid)
      if (!p) return null
      if (p.status === 'solved') [text, tone] = [`solved in ${p.guessCount}`, 'done']
      else if (p.status === 'failed') [text, tone] = ['failed', 'bad']
      else if (p.status === 'void') [text, tone] = ['left', 'bad']
      else text = `solving (${p.guessCount})`
    }
    return { pid, text, tone }
  })
  return (
    <ul className="wh-strip" aria-label="Players">
      {items.filter(Boolean).map(({ pid, text, tone }) => (
        <li key={pid} className={`wh-strip-item ${pid === myId ? 'wh-strip-me' : ''} ${tone ? `wh-strip-${tone}` : ''}`}>
          <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
          <span className="wh-strip-name">{pid === myId ? 'You' : nameById[pid] ?? '?'}</span>
          <span className="wh-strip-status">{text}</span>
        </li>
      ))}
    </ul>
  )
}
