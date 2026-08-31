import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSound } from '../sound/SoundContext'
import { playChaosBuildup, playChaosSting } from './chaosSting'
import { CHAOS_ICONS } from './chaosCopy'

// The ONE loud moment in the app — a full-screen takeover on every device:
// a tense buildup (strobe + shake + rising rumble), a hard flash-slam that
// drops the modifier name + effect + WHO it hit, then (for Risk It only) an
// interactive beat before it clears: a 3-second WAGER / PASS pop-up that
// spells out the exact payout.
//
// Countdown Chaos used to get a 3-2-1-GO klaxon here. It no longer does —
// its whole effect is now mechanical (hide the round timer, replace it with
// an edge vignette that tightens as time runs out); see ChaosVignette.
//
// MOBILE NOTES — two things that were stopping this rendering on phones:
//   1. Timing runs off a LOCAL clock (performance.now) captured when this
//      device first sees the event, NOT the server `announcedAt`. Phone
//      clocks drift from the server by seconds, which made every stage
//      compute as "already over" so nothing ever showed.
//   2. The stage machine is driven by setInterval, NOT requestAnimationFrame
//      — rAF is frozen in a backgrounded/inactive tab and while the screen
//      is locked, which stalled the takeover mid-animation.
// The parent gives us a `key={event.roundKey}`, so every Chaos event gets a
// FRESH instance — no leftover interval, no stale stage, no cross-round
// leak. A per-instance `doneRef` (set only on completion) still guards
// against a re-render or a StrictMode double-invoke replaying the run.
// (There is deliberately NO module-level "seen" cache: it made a replayed
// game / a repeated tournament round silently skip the takeover forever.)

const T_BUILDUP = 1400
const T_REVEAL = 2500
const T_WAGER = 3200
const T_OUT = 550

function reduced() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function ChaosOverlay({ event, players = [], myScore = 0, actions }) {
  const { muted, volume } = useSound()
  const snd = useRef({ muted, volume })
  snd.current = { muted, volume }

  const [stage, setStage] = useState(null) // null|buildup|reveal|wager|out
  const [decision, setDecision] = useState(null) // null|in|out  (Risk It)
  const decisionRef = useRef(null)
  const doneRef = useRef(false)

  const m = event?.modifier
  const roundKey = event?.roundKey
  const revealEnd = T_BUILDUP + T_REVEAL

  // Risk It ALWAYS gets the wager pop-up shown — even to a player on 0
  // points (the button is just disabled for them); the spec is that every
  // player sees the accept/decline prompt.
  const isWager = m?.id === 'risk-it'

  useEffect(() => {
    if (!m || !roundKey) return
    // Guard only on completion — NOT on "started". React StrictMode
    // mounts→cleans up→remounts the effect; a "started" flag set by the
    // throwaway first mount (whose loop the cleanup cancels) would block
    // the real second mount from ever animating. doneRef flips only once an
    // animation fully finishes, so a cancelled run just re-runs.
    if (doneRef.current) return
    decisionRef.current = null
    setDecision(null)

    const rm = reduced()
    const start = performance.now()
    const fired = { buildup: false, sting: false }
    // Driven by setInterval, NOT requestAnimationFrame: rAF is paused in
    // background/hidden tabs, and on a phone the player's other apps or a
    // locked screen would freeze the takeover mid-animation. A 100ms timer
    // keeps it progressing (throttled to ~1s when truly backgrounded, which
    // still walks it through its stages instead of stalling).
    let timer = 0

    const loop = () => {
      const el = performance.now() - start
      const { muted: mu, volume: vo } = snd.current
      const audible = !mu && vo > 0
      const interactEnd = revealEnd + (isWager ? T_WAGER : 0)
      const total = interactEnd + T_OUT

      let st
      if (el < T_BUILDUP) st = 'buildup'
      else if (el < revealEnd) st = 'reveal'
      else if (isWager) st = decisionRef.current || el >= interactEnd ? 'out' : 'wager'
      else st = 'out'
      if (el >= total) st = null
      setStage(st)

      if (audible && !rm && !fired.buildup && el < 260) {
        fired.buildup = true
        playChaosBuildup(vo)
      }
      if (audible && !fired.sting && el >= T_BUILDUP) {
        fired.sting = true
        playChaosSting(vo)
      }

      if (st === null) {
        doneRef.current = true
        setStage(null)
        clearInterval(timer)
      }
    }
    loop()
    timer = setInterval(loop, 100)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey])

  if (!stage || !m) return null

  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const nm = (id) => nameById[id] ?? 'Player'
  const targets = event.result?.targets ?? []
  const rm = reduced()
  const stake = Math.max(1, Math.floor(myScore / 2))

  function decide(choice) {
    if (decisionRef.current) return
    decisionRef.current = choice
    setDecision(choice)
    if (choice === 'in') actions?.chaosWager?.()
  }

  return createPortal(
    <div
      className={`chaos-takeover chaos-stage-${stage} ${rm ? 'chaos-reduced' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="chaos-bg" />
      <div className="chaos-strobe" />
      <div className="chaos-shakebox">
        {stage === 'buildup' && (
          <div className="chaos-warn">
            <div className="chaos-warn-bang">⚠</div>
            <div className="chaos-warn-text">CHAOS INCOMING</div>
          </div>
        )}

        {(stage === 'reveal' || stage === 'out') && (
          <div className="chaos-card">
            <div className="chaos-kicker">⚡ CHAOS EVENT ⚡</div>
            <div className="chaos-glyph">{CHAOS_ICONS[m.id] ?? '🎲'}</div>
            <div className="chaos-name">{m.name}</div>
            <div className="chaos-blurb">{m.blurb}</div>
            {targets.length > 0 && (
              <div className="chaos-affected">{renderTargets(m.id, targets, nm)}</div>
            )}
          </div>
        )}

        {stage === 'wager' && (
          <div className="chaos-card chaos-wager">
            <div className="chaos-kicker">🎲 RISK IT</div>
            {myScore > 0 ? (
              <>
                <div className="chaos-wager-q">
                  Wager <strong>{stake}</strong> points?
                </div>
                {/* Show the actual payout so nobody commits blind. */}
                <div className="chaos-wager-payout">
                  <span className="chaos-wager-win">
                    Good round → <strong>+{stake}</strong> bonus, round score ×2
                  </span>
                  <span className="chaos-wager-lose">
                    Bad round → <strong>−{stake}</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="chaos-wager-q">No points to wager… yet.</div>
                <div className="chaos-wager-sub">
                  You need points on the board before you can risk them.
                </div>
              </>
            )}
            {decision ? (
              <div className="chaos-wager-locked">
                {decision === 'in' ? "🎲 You're in!" : 'Sitting this one out.'}
              </div>
            ) : (
              <div className="chaos-wager-btns">
                <button
                  className="chaos-wager-yes"
                  disabled={myScore <= 0}
                  onClick={() => decide('in')}
                >
                  WAGER IT
                </button>
                <button className="chaos-wager-no" onClick={() => decide('out')}>
                  PASS
                </button>
              </div>
            )}
            <div className="chaos-wager-timer">
              <div className="chaos-wager-timer-fill" />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Who a modifier hit, shown on the takeover for the ones decided up front.
function renderTargets(id, targets, nm) {
  const by = (tag) => targets.filter((t) => t.tag === tag).map((t) => nm(t.playerId))
  const amt = (tag) => targets.find((t) => t.tag === tag)?.amount
  if (id === 'score-swap') {
    const [a, b] = targets.map((t) => nm(t.playerId))
    return (
      <span className="chaos-aff-line">
        {a} <span className="chaos-aff-swap">⇄</span> {b}
      </span>
    )
  }
  if (id === 'rival') {
    const [a, b] = targets.map((t) => nm(t.playerId))
    return (
      <span className="chaos-aff-line">
        {a} <span className="chaos-aff-vs">VS</span> {b}
      </span>
    )
  }
  if (id === 'steal') {
    const thief = by('thief')[0]
    const mark = by('mark')[0]
    if (!thief || !mark) return null
    const a = amt('thief')
    return (
      <span className="chaos-aff-line">
        {thief} skims {a ? `${a} ` : ''}off {mark}'s round
      </span>
    )
  }
  if (id === 'the-tyrant') {
    const tyrant = by('tyrant')[0]
    if (!tyrant) return null
    const victims = by('victim')
    const a = amt('tyrant')
    return (
      <span className="chaos-aff-line">
        {tyrant} taxes {victims.length ? victims.join(', ') : 'the room'}
        {a ? ` for ${a}` : ''}
      </span>
    )
  }
  return null
}
