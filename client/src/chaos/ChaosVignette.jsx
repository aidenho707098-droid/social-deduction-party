import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// COUNTDOWN CHAOS — the mechanical half. While this modifier owns the
// current round:
//   * `[data-chaos-blind]` on <html> hides every `.wyr-timer` bar and the
//     readout `<p>` right after it (one CSS rule, all games) — players can
//     no longer see how much time is left,
//   * a pulsing vignette rings the screen edge and tightens in stages as
//     the (still-real, still-running) clock winds down.
// The round's actual deadline is untouched; only the DISPLAY changes.
//
// The local-countdown + re-sync effect shape mirrors every game's own
// timer component (see fakeArtist/DrawTurn, taboo/GuessRound): tick down
// between the ~1s server room pushes, snap back if the server diverges.

const TICK_MS = 250

// A phase's full time budget — games name this window differently.
function fullBudget(game) {
  return (
    game?.answerMs ??
    game?.guessMs ??
    game?.startMs ??
    game?.turnMs ??
    game?.writeMs ??
    game?.voteMs ??
    null
  )
}

function tierFor(frac) {
  if (frac == null) return 'calm' // no live clock this phase — gentle idle pulse
  if (frac > 0.5) return 'calm'
  if (frac > 0.28) return 'warm'
  if (frac > 0.12) return 'hot'
  return 'critical'
}

export default function ChaosVignette({ game }) {
  // Blind the timers for as long as this component is mounted.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-chaos-blind', '')
    return () => el.removeAttribute('data-chaos-blind')
  }, [])

  const full = fullBudget(game)
  const serverMs = typeof game?.msLeft === 'number' ? game.msLeft : null
  const phaseKey = `${game?.phase}:${game?.roundIndex}:${game?.currentDrawerId ?? ''}`

  const [msLeft, setMsLeft] = useState(serverMs ?? full ?? null)

  // New phase / turn — take the server's number fresh.
  useEffect(() => {
    setMsLeft(serverMs ?? full ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey])

  // Server push diverged from our local guess by >0.9s — snap to it.
  useEffect(() => {
    if (serverMs == null) return
    setMsLeft((m) => (m == null || Math.abs(m - serverMs) > 900 ? serverMs : m))
  }, [serverMs])

  // Tick down between pushes.
  useEffect(() => {
    const t = setInterval(
      () => setMsLeft((m) => (m == null ? m : Math.max(0, m - TICK_MS))),
      TICK_MS,
    )
    return () => clearInterval(t)
  }, [])

  // A live clock only exists while there's time on it AND the phase has a
  // budget. Between the timed phase and the next round (reveal / results),
  // msLeft rests at 0 — the vignette should ease off, not scream red.
  const frac =
    msLeft != null && msLeft > 0 && full
      ? Math.max(0, Math.min(1, msLeft / full))
      : null

  return createPortal(
    <div className="chaos-vignette" data-tier={tierFor(frac)} aria-hidden="true" />,
    document.body,
  )
}
