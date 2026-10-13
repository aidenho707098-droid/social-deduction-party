import { useEffect, useMemo, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { CategoryChip, LetterTile } from './LetterTile'
import AlphabetStrip from './AlphabetStrip'
import { TRAVEL_AT, buildSoup, heroFrame, tileCount, tileFrame } from './soupMotion'

// The round-start letter reveal: the category chip slides in, then a bowl
// of alphabet soup seen from above — 14–20 letter tiles scattered across
// the whole bowl, stirred in loose, vortex-like orbits (each tile at its
// own speed, wobbling, bobbing and tilting), easing in, racing, then
// slowing. The chosen tile lifts while the rest dim, then spirals in to
// the centre and grows into the round's big letter tile. The motion model
// lives in soupMotion.js.
//
// The SERVER chose the letter before this mounted, and owns the clock: the
// answer / first-turn timer only starts once its intro timer runs out (see
// server/games/alphabet-soup.js INTRO_MS). Every client animates from the
// same room_update, so the tile lands everywhere at about the same moment.
//
// Reliability rules learned from the Chaos takeover (ChaosOverlay.jsx):
//   * The parent mounts this with key={roundIndex} — a FRESH instance every
//     round, so no stage, timer or "already played" flag can leak from one
//     round into the next (nothing module-level either). A fresh instance
//     also means a fresh random layout every round.
//   * Timing is anchored to a LOCAL clock (performance.now at mount) plus
//     the server's relative `introMsLeft` — never wall-clock timestamps,
//     which drift by seconds on phones. A Chaos takeover that plays first
//     just pushes the chip / swirl back by `introLeadMs`.
//   * Stages (and sounds) advance on a setInterval, not requestAnimationFrame
//     (rAF is frozen in background tabs / on a locked screen). Only the
//     tile motion itself rides rAF, and it's computed from the same clock,
//     so a frozen frame just catches up; the landed tile is placed by CSS
//     class, not by the last frame written.
//   * Motion is CSS transforms + opacity only, written straight to each
//     tile's style (no React re-render per frame); no canvas, no layout
//     thrash. Fewer tiles on small bowls / low-power phones.
//   * The bowl is sized with min(vw, px) inside the normal page flow — no
//     fixed/100vh layers for mobile browser toolbars to clip.
// A device that first sees this round's intro well after it began (a
// reconnect) skips straight to the landed result, silently. With
// prefers-reduced-motion the swirl is replaced by a quick fade + pop.

const LAND_MS = 700 // stir sound stops / "land" stage begins this long before the end
const SKIP_IF_LATE_MS = 600 // joined this much after the chip was due -> skip
const SOUP_TILE_PX = 30 // .as-soup-tile size
const HERO_TILE_PX = 112 // .as-tile (lg) size — what the chosen tile grows into
const MOTION_TAIL_MS = 400 // keep animating briefly after landing, then stop

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Matches .as-bowl-stage's --bowl: min(74vw, 290px).
function expectedBowlPx() {
  return Math.min(0.74 * (window.innerWidth || 390), 290)
}

export default function SoupReveal({ game }) {
  const { play, stop } = useSound()
  const reduced = useMemo(prefersReducedMotion, [])
  const letter = game.letter
  const lead = game.introLeadMs ?? 0
  const chipAt = lead
  const swirlAt = lead + (game.categoryMs ?? 1000)
  const swirlMs = game.swirlMs ?? 2700
  const landAt = swirlAt + swirlMs - LAND_MS
  const doneAt = swirlAt + swirlMs
  const stirMs = swirlMs - LAND_MS

  // Captured ONCE at mount: how far into the intro this device already is.
  const [timing] = useState(() => {
    const elapsed = Math.max(0, (game.introMs ?? 0) - (game.introMsLeft ?? 0))
    return { mountedAt: performance.now(), elapsed, skip: elapsed > chipAt + SKIP_IF_LATE_MS }
  })
  // This round's soup — a new random layout every mount.
  const [soup] = useState(() =>
    buildSoup(
      letter,
      tileCount({
        bowlPx: expectedBowlPx(),
        cores: navigator.hardwareConcurrency ?? 8,
        memoryGb: navigator.deviceMemory ?? 8,
      }),
    ),
  )
  const chosen = soup.find((t) => t.chosen)
  const stageRef = useRef(null)
  const tileRefs = useRef([])
  const heroRef = useRef(null)

  const [stage, setStage] = useState(timing.skip ? 'landed' : 'wait') // wait|chip|swirl|land|landed

  // Stages + sounds, on a setInterval (see the reliability notes above).
  useEffect(() => {
    if (timing.skip) return undefined
    const fired = { stir: false, stopStir: false, land: false }
    let stirEl = null
    let timer = 0

    const now = () => timing.elapsed + (performance.now() - timing.mountedAt)
    const step = () => {
      const t = now()
      let st = 'wait'
      if (t >= doneAt) st = 'landed'
      else if (t >= landAt) st = 'land'
      else if (t >= swirlAt) st = 'swirl'
      else if (t >= chipAt) st = 'chip'
      setStage((prev) => (prev === st ? prev : st))

      // Soft ticking under the stir: ride the spin bed's playback rate up
      // and back down with the swirl's speed (ease-in-out ~ a sine hump).
      if (!reduced && t >= swirlAt && t < landAt) {
        if (!fired.stir) {
          fired.stir = true
          stirEl = play('soup-stir')
        }
        if (stirEl) {
          const p = Math.min(1, (t - swirlAt) / stirMs)
          try {
            stirEl.playbackRate = 0.45 + 0.6 * Math.sin(Math.PI * p)
          } catch {
            // some browsers clamp playbackRate — keep the default
          }
        }
      }
      if (t >= landAt && !fired.stopStir) {
        fired.stopStir = true
        stop('soup-stir')
      }
      if (t >= doneAt && !fired.land) {
        fired.land = true
        play('soup-land')
        clearInterval(timer)
      }
    }
    step()
    timer = setInterval(step, 50)
    return () => {
      clearInterval(timer)
      stop('soup-stir')
    }
    // Runs once per mounted instance (= once per round).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tile motion, on requestAnimationFrame: every frame is computed from the
  // shared clock and written straight into transform / opacity.
  useEffect(() => {
    if (timing.skip || reduced) return undefined
    const bowlPx = stageRef.current?.offsetWidth || expectedBowlPx()
    const heroBase = SOUP_TILE_PX / HERO_TILE_PX
    let raf = 0
    const frame = () => {
      const t = timing.elapsed + (performance.now() - timing.mountedAt)
      const u = Math.max(0, t - swirlAt)
      soup.forEach((tile, i) => {
        const el = tileRefs.current[i]
        if (!el) return
        const f = tileFrame(tile, u)
        // The chosen tile hands over to the big tile as it sets off.
        const handoff = tile.chosen ? Math.min(1, Math.max(0, (u - TRAVEL_AT) / 120)) : 0
        el.style.transform =
          `translate3d(${(f.x * bowlPx).toFixed(2)}px, ${(f.y * bowlPx + f.bobPx).toFixed(2)}px, 0) ` +
          `rotate(${f.tilt.toFixed(1)}deg) scale(${f.scale.toFixed(3)})`
        el.style.opacity = (f.opacity * (1 - handoff)).toFixed(3)
        if (tile.chosen) el.classList.toggle('as-soup-lift', f.lift > 0.05)
      })
      const hero = heroRef.current
      const h = heroFrame(chosen, u, swirlMs)
      if (hero && h) {
        const scale = heroBase * h.startScale + (1 - heroBase * h.startScale) * h.t
        hero.style.transform =
          `translate(-50%, -50%) translate3d(${(h.x * bowlPx).toFixed(2)}px, ${(h.y * bowlPx).toFixed(2)}px, 0) ` +
          `rotate(${h.tilt.toFixed(1)}deg) scale(${scale.toFixed(3)})`
        hero.style.opacity = Math.min(1, (u - TRAVEL_AT) / 120).toFixed(3)
      }
      if (t < doneAt + MOTION_TAIL_MS) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // Runs once per mounted instance (= once per round).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showChip = stage !== 'wait'
  const landed = stage === 'landed'

  return (
    <div className="screen as-intro">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>

      <div className={`as-intro-chip ${showChip ? 'as-intro-chip-in' : ''}`}>
        <CategoryChip name={game.category?.name} />
      </div>

      {reduced || timing.skip ? (
        <div className="as-bowl-stage">
          {(stage === 'swirl' || stage === 'land' || landed) && (
            <LetterTile letter={letter} className={timing.skip ? '' : 'as-tile-pop'} />
          )}
        </div>
      ) : (
        <div ref={stageRef} className={`as-bowl-stage as-stage-${stage}`}>
          <div className="as-bowl" aria-hidden="true">
            <div className="as-broth" />
            {soup.map((tile, i) => (
              <span
                key={i}
                ref={(el) => {
                  tileRefs.current[i] = el
                }}
                className={`as-soup-tile as-soup-${tile.color} ${tile.chosen ? 'as-soup-chosen' : ''}`}
              >
                {tile.letter}
              </span>
            ))}
          </div>
          <div ref={heroRef} className={`as-hero ${landed ? 'as-hero-landed' : ''}`}>
            <LetterTile letter={letter} />
          </div>
        </div>
      )}

      {game.burnedOn && (
        <AlphabetStrip
          pool={game.letterPool}
          burned={game.burnedLetters}
          current={landed ? letter : null}
          currentBurned={landed}
        />
      )}

      <p className={`hint center-text as-intro-hint ${landed ? 'as-intro-hint-in' : ''}`}>
        {game.mode === 'spoken' ? 'Get ready — turns start now.' : 'Get ready — answers open now.'}
      </p>
    </div>
  )
}
