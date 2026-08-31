// The audio for Chaos Events — synthesised with the Web Audio API so it is
// its OWN sound, never reused from any file-based SFX in the app. Players
// should learn this exact stab as "something huge is happening".
//
//   playChaosBuildup(v) — a rising rumble under the pre-reveal tension beat
//   playChaosSting(v)    — the slam: sub drop + dissonant brass cluster + noise hit
//   playChaosKlaxon(v)   — the 3-2-1 klaxon bed for the Countdown Chaos modifier
//   playChaosBeep(v, n)  — a single countdown blip (n = 3 | 2 | 1 | 0 for "go")
//
// iOS/Safari will not let a fresh AudioContext leave the "suspended" state
// outside a user gesture, so we install a one-time unlock on the first
// pointer/key/touch (mirrors what SoundProvider does for HTMLAudio). All
// calls are best-effort: no AudioContext, or still locked -> silent no-op.

let ctx = null
let unlockBound = false

function bindUnlock() {
  if (unlockBound || typeof window === 'undefined') return
  unlockBound = true
  const go = () => {
    const c = rawCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }
  const opts = { passive: true }
  window.addEventListener('pointerdown', go, opts)
  window.addEventListener('keydown', go, opts)
  window.addEventListener('touchstart', go, opts)
}

function rawCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  return ctx
}

function ac() {
  bindUnlock()
  const c = rawCtx()
  if (!c) return null
  if (c.state === 'suspended') c.resume().catch(() => {})
  return c
}

// Call from the app's first-gesture handler too, so the context is warm
// before the first Chaos Event ever fires.
export function unlockChaosAudio() {
  bindUnlock()
  const c = rawCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

function master(c, v, extra = 1) {
  const g = c.createGain()
  g.gain.value = Math.min(1, Math.max(0, v)) * 0.9 * extra
  g.connect(c.destination)
  return g
}

function noiseBuffer(c, seconds, shape = (i, n) => 1 - i / n) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * shape(i, len)
  return buf
}

export function playChaosBuildup(v = 0.7) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime
  const out = master(c, v, 0.6)

  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 1.5, (i, n) => (i / n) ** 1.5)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(90, t0)
  lp.frequency.linearRampToValueAtTime(320, t0 + 1.35)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(0.9, t0 + 1.3)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5)
  src.connect(lp).connect(g).connect(out)
  src.start(t0)
  src.stop(t0 + 1.5)

  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(60, t0)
  o.frequency.exponentialRampToValueAtTime(520, t0 + 1.35)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t0)
  og.gain.linearRampToValueAtTime(0.06, t0 + 1.2)
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 1.45)
  o.connect(og).connect(out)
  o.start(t0)
  o.stop(t0 + 1.5)
}

export function playChaosSting(v = 0.7) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime
  const out = master(c, v)

  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(150, t0)
  sub.frequency.exponentialRampToValueAtTime(30, t0 + 0.55)
  const subG = c.createGain()
  subG.gain.setValueAtTime(0.0001, t0)
  subG.gain.linearRampToValueAtTime(1.0, t0 + 0.02)
  subG.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0)
  sub.connect(subG).connect(out)
  sub.start(t0)
  sub.stop(t0 + 1.05)

  const freqs = [110, 116.5, 155.6, 220, 233.1]
  freqs.forEach((f, i) => {
    const o = c.createOscillator()
    o.type = i % 2 ? 'sawtooth' : 'square'
    o.frequency.setValueAtTime(f * (i % 2 ? 1.008 : 0.992), t0)
    o.frequency.exponentialRampToValueAtTime(f * 0.93, t0 + 0.7)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85)
    o.connect(g).connect(out)
    o.start(t0)
    o.stop(t0 + 0.9)
  })

  const noise = c.createBufferSource()
  noise.buffer = noiseBuffer(c, 0.28)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 0.6
  const ng = c.createGain()
  ng.gain.setValueAtTime(1.0, t0)
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28)
  noise.connect(bp).connect(ng).connect(out)
  noise.start(t0)
  noise.stop(t0 + 0.3)
}

// One countdown blip. `n` 3/2/1 = rising urgent beeps; n = 0 = the "GO" blast.
export function playChaosBeep(v = 0.7, n = 3) {
  const c = ac()
  if (!c) return
  const t = c.currentTime
  const out = master(c, v, 0.9)
  if (n <= 0) {
    for (const f of [180, 240]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.5)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.22, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.6)
    }
    return
  }
  const base = 440 + (3 - n) * 90
  for (const f of [base, base * 1.5]) {
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime(f, t)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.16, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.24)
  }
}

export function playChaosKlaxon(v = 0.7) {
  const c = ac()
  if (!c) return
  const out = master(c, v, 0.8)
  const base = c.currentTime
  for (let k = 0; k < 3; k++) {
    const t = base + k * 0.42
    for (const f of [440 - k * 40, 590 - k * 50]) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.14, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.32)
    }
  }
  const tf = base + 1.35
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(180, tf)
  o.frequency.exponentialRampToValueAtTime(70, tf + 0.7)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, tf)
  g.gain.linearRampToValueAtTime(0.2, tf + 0.04)
  g.gain.exponentialRampToValueAtTime(0.001, tf + 0.8)
  o.connect(g).connect(out)
  o.start(tf)
  o.stop(tf + 0.85)
}
