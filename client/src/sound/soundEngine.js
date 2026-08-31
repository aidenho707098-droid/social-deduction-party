// Shared sound-effect engine — one instance for the whole app.
//
// Everything routes through `soundEngine.play(key)`. Keys live in
// SOUND_MANIFEST; each maps to a file in /public/sounds plus a per-sound
// `gain` (0..1) so a booming crowd cheer and a tiny UI tick can sit at
// sensible relative levels under one master volume.
//
// To add a sound for a FUTURE game: drop the file in public/sounds, add
// one line to SOUND_MANIFEST, then call play('your-key'). Nothing else to
// wire — the sound director (useSoundDirector.js) already covers generic
// moments (game start, round start, reveals, final win/lose); a game only
// needs a bespoke call for something animation-timed.
//
// Master state (muted + volume) persists to localStorage, so a room set to
// "quiet" in a cafe or classroom stays that way across refreshes. Playback
// is best-effort: browsers block audio until the first user gesture, so
// `unlock()` is invoked from the first pointer/key event (see SoundProvider).

const STORAGE_KEY = 'party-game:sound'
const DEFAULT_VOLUME = 0.7

// key -> { src, gain }
export const SOUND_MANIFEST = {
  'game-start': { src: 'game-start.mp3', gain: 0.7 },
  // Between rounds — a short, clean arcade blip in the same bell/beep
  // family as `reveal` / `confirm` / `correct`. Kept quiet (fires every
  // round) so it reads as a gentle transition, not an alert.
  'round-start': { src: 'round-start.mp3', gain: 0.4 },
  // Per-round results fire constantly all session, so this is a plain,
  // neutral notification ding — crisp but not musical, not an alert.
  reveal: { src: 'reveal.mp3', gain: 0.5 },
  correct: { src: 'correct.mp3', gain: 0.8 },
  wrong: { src: 'wrong.mp3', gain: 0.6 },
  confirm: { src: 'confirm.mp3', gain: 0.45 },
  // Someone new in the lobby — a soft, welcoming blip, nothing more.
  'player-join': { src: 'player-join.mp3', gain: 0.35 },
  // A mechanical spin bed; cut short when the wheel lands. TournamentWheel
  // ramps its playbackRate down over the spin so the ticking decelerates
  // with the wheel instead of racing at a flat tempo.
  'wheel-spin': { src: 'wheel-spin.mp3', gain: 0.4 },
  'wheel-land': { src: 'wheel-land.mp3', gain: 0.75 },
  'game-win': { src: 'game-win.mp3', gain: 0.85 },
  'game-over': { src: 'game-over.mp3', gain: 0.6 },
  // Taboo: the round timer just lost 30s because a guesser buzzed in. A
  // short, sharp alert — reuses the buzzer bed until a bespoke asset lands.
  'time-drop': { src: 'wrong.mp3', gain: 0.8 },
  // Tournament grand finale — a short, crisp rising achievement chime.
  // Triumphant and clean, not a long sting or a crowd.
  'grand-finale': { src: 'grand-finale.mp3', gain: 0.7 },
}

// Vite serves /public at BASE_URL (normally "/").
const BASE_PATH = `${import.meta.env.BASE_URL}sounds/`

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        muted: !!p.muted,
        volume:
          typeof p.volume === 'number'
            ? Math.min(1, Math.max(0, p.volume))
            : DEFAULT_VOLUME,
      }
    }
  } catch {
    // storage disabled / private mode — fall through to defaults
  }
  return { muted: false, volume: DEFAULT_VOLUME } // sound ON by default
}

class SoundEngine {
  constructor() {
    const s = loadState()
    this.muted = s.muted
    this.volume = s.volume
    this.unlocked = false
    this.masters = new Map() // key -> HTMLAudioElement (template, cloned per play)
    this.active = new Map() // key -> Set<HTMLAudioElement> currently sounding
    this.listeners = new Set()
  }

  getState() {
    return { muted: this.muted, volume: this.volume }
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _emit() {
    const s = this.getState()
    for (const fn of this.listeners) fn(s)
  }

  _persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ muted: this.muted, volume: this.volume })
      )
    } catch {
      // ignore
    }
  }

  _effectiveVolume(gain) {
    return Math.min(1, Math.max(0, this.volume * (gain ?? 1)))
  }

  setMuted(next) {
    this.muted = typeof next === 'boolean' ? next : !this.muted
    if (this.muted) this.stopAll()
    this._persist()
    this._emit()
  }

  toggleMuted() {
    this.setMuted(!this.muted)
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0))
    if (this.volume === 0) this.stopAll()
    // live-adjust anything still ringing
    for (const set of this.active.values()) {
      for (const el of set) el.volume = this._effectiveVolume(el._gain)
    }
    this._persist()
    this._emit()
  }

  _master(key) {
    if (this.masters.has(key)) return this.masters.get(key)
    const entry = SOUND_MANIFEST[key]
    if (!entry) return null
    const el = new Audio(BASE_PATH + entry.src)
    el.preload = 'auto'
    this.masters.set(key, el)
    return el
  }

  // Warm the HTTP cache so the first real play doesn't wait on a download.
  preloadAll() {
    for (const key of Object.keys(SOUND_MANIFEST)) this._master(key)
  }

  // Called once from the first user gesture — satisfies autoplay policies
  // so later, event-driven plays (a reveal, a win) are allowed to sound.
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    for (const el of this.masters.values()) {
      try {
        const p = el.play()
        if (p && typeof p.then === 'function') {
          p.then(() => {
            el.pause()
            el.currentTime = 0
          }).catch(() => {})
        } else {
          el.pause()
          el.currentTime = 0
        }
      } catch {
        // ignore — we'll just try again on the next real play
      }
    }
  }

  // Fire a sound. `opts.gain` overrides the manifest gain for this one play.
  play(key, opts = {}) {
    if (this.muted || this.volume === 0) return null
    const entry = SOUND_MANIFEST[key]
    if (!entry) {
      if (import.meta.env.DEV) console.warn('[sound] unknown key:', key)
      return null
    }
    const master = this._master(key)
    if (!master) return null

    const el = master.cloneNode() // independent element -> overlapping plays are fine
    el._gain = opts.gain ?? entry.gain ?? 1
    el.volume = this._effectiveVolume(el._gain)

    const set = this.active.get(key) ?? new Set()
    set.add(el)
    this.active.set(key, set)
    const forget = () => set.delete(el)
    el.addEventListener('ended', forget, { once: true })
    el.addEventListener('error', forget, { once: true })

    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => forget()) // blocked / decode fail -> stay silent
    return el
  }

  // Cut a specific sound short (e.g. stop the wheel-spin bed when it lands).
  stop(key) {
    const set = this.active.get(key)
    if (!set) return
    for (const el of set) {
      try {
        el.pause()
        el.currentTime = 0
      } catch {
        // ignore
      }
    }
    set.clear()
  }

  stopAll() {
    for (const key of this.active.keys()) this.stop(key)
  }
}

export const soundEngine = new SoundEngine()
