// THE one way to play a sound. Every play() in the app — the sound
// director, game screens, the tournament wheel — goes through here (via
// useSound().play, see SoundProvider), and the manager decides whether it
// actually sounds:
//
//   * hidden tab        nothing plays while document.hidden
//   * catching up       nothing plays while the app is syncing state it
//                       didn't witness: the first load / a reload, and a
//                       reconnect until the server has caught us up (+ a
//                       short grace). State hydration is never an event.
//   * cooldown          the same sound at most once per COOLDOWN_MS (a
//                       StrictMode double effect, a remount, a re-render)
//   * coalescing        a sound with `coalesceMs` plays once per window:
//                       five players joining together = one blip
//   * global cap        at most MAX_PER_SEC event sounds in any rolling
//                       second. Rhythm sounds (manifest `rhythm: true`:
//                       game notes and ticks that ARE the gameplay) skip
//                       the cap but keep every other rule.
//
// DEV LOG: in dev builds, add ?soundlog to the URL, or run
// localStorage.setItem('party-game:sound-log', '1') and reload. Every
// request is logged to the console as
//   [sound] <key> <played | suppressed: reason> ← <trigger>
// and kept in window.__soundLog (the last 500). The trigger is what the
// caller passed (`{ trigger }`), else the calling file:line.

import { SOUND_MANIFEST, soundEngine } from './soundEngine.js'

// Sounds that aren't files (the Chaos sting is synthesised with Web
// Audio): same rules, played by the caller's own function via run().
const SYNTH = { 'chaos-buildup': {}, 'chaos-sting': {} }

export const COOLDOWN_MS = 150
export const RHYTHM_COOLDOWN_MS = 40
export const MAX_PER_SEC = 3
export const CATCH_UP_GRACE_MS = 800

const LOG_KEY = 'party-game:sound-log'

function logEnabled() {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return false
  try {
    return /[?&]soundlog\b/.test(window.location.search) || localStorage.getItem(LOG_KEY) === '1'
  } catch {
    return false
  }
}

// The first frame of the stack outside the sound layer, e.g.
// "games/taboo/GuessRound.jsx:115".
function callerOf() {
  const lines = (new Error().stack ?? '').split('\n')
  for (const l of lines) {
    const m = l.match(/\/src\/([^?:)]+)(?:\?[^:)]*)?:(\d+)/)
    if (m && !m[1].startsWith('sound/')) return `${m[1]}:${m[2]}`
  }
  return 'unknown'
}

class SoundManager {
  constructor(engine, { now = () => performance.now(), hidden = () => typeof document !== 'undefined' && document.hidden } = {}) {
    this.engine = engine
    this.now = now
    this.hidden = hidden
    this.lastAt = new Map() // key -> last time it actually played
    this.recent = [] // times of the last event (non-rhythm) plays
    this.syncing = new Set() // reasons the app is catching up
    this.quietUntil = 0 // grace after the last catch-up ends
    this.log = logEnabled()
    this.history = []
    if (this.log && typeof window !== 'undefined') window.__soundLog = this.history
  }

  // ---- catch-up (state sync) ------------------------------------------
  // beginCatchUp('reconnect') ... endCatchUp('reconnect'): nothing sounds
  // in between, nor for CATCH_UP_GRACE_MS after the last one ends.
  beginCatchUp(reason) {
    this.syncing.add(reason)
    this._note('—', `catch-up start: ${reason}`)
  }

  endCatchUp(reason) {
    if (!this.syncing.delete(reason)) return
    this.quietUntil = Math.max(this.quietUntil, this.now() + CATCH_UP_GRACE_MS)
    this._note('—', `catch-up end: ${reason}`)
  }

  catchingUp() {
    return this.syncing.size > 0 || this.now() < this.quietUntil
  }

  // ---- play -----------------------------------------------------------
  play(key, opts = {}) {
    const { trigger, run, ...engineOpts } = opts
    const entry = SOUND_MANIFEST[key] ?? SYNTH[key]
    const why = this._blocked(key, entry)
    const by = trigger ?? (this.log ? callerOf() : '')
    if (why) {
      this._note(key, `suppressed: ${why}`, by)
      return null
    }
    const t = this.now()
    this.lastAt.set(key, t)
    if (!entry.rhythm) this.recent.push(t)
    this._note(key, 'played', by)
    return SYNTH[key] ? (run?.() ?? null) : this.engine.play(key, engineOpts)
  }

  // A synthesised sound (SYNTH above): fn() makes the noise if allowed.
  run(key, fn, opts = {}) {
    return this.play(key, { ...opts, run: fn })
  }

  _blocked(key, entry) {
    if (!entry) return 'unknown key'
    if (this.hidden()) return 'tab hidden'
    if (this.syncing.size) return `catching up (${[...this.syncing].join(', ')})`
    const t = this.now()
    if (t < this.quietUntil) return 'catching up (grace)'
    const gap = entry.rhythm ? RHYTHM_COOLDOWN_MS : Math.max(COOLDOWN_MS, entry.coalesceMs ?? 0)
    const last = this.lastAt.get(key)
    if (last != null && t - last < gap) return entry.coalesceMs ? 'coalesced' : 'cooldown'
    if (!entry.rhythm) {
      this.recent = this.recent.filter((x) => t - x < 1000)
      if (this.recent.length >= MAX_PER_SEC) return 'over 3/sec'
    }
    return null
  }

  _note(key, status, trigger = '') {
    if (!this.log) return
    const row = { t: Math.round(this.now()), key, status, trigger }
    this.history.push(row)
    if (this.history.length > 500) this.history.shift()
    console.info(`[sound] ${key} ${status}${trigger ? ` ← ${trigger}` : ''}`)
  }

  stop(key) {
    this.engine.stop(key)
  }
}

export { SoundManager }
export const soundManager = new SoundManager(soundEngine)

// Coming back to a hidden tab: whatever changed while it was hidden is
// already on screen — a short grace so it doesn't all sound at once.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) soundManager.beginCatchUp('tab hidden')
    else soundManager.endCatchUp('tab hidden')
  })
}
