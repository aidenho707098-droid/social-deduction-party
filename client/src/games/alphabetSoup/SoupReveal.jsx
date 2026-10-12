import { useEffect, useMemo, useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { CategoryChip, LetterTile } from './LetterTile'
import AlphabetStrip from './AlphabetStrip'

// The round-start letter reveal: the category chip slides in, then a bowl
// of alphabet soup seen from above — letter tiles stirred in a slow swirl
// that speeds up and settles, one tile drifting to the centre and growing
// into the round's big letter tile.
//
// The SERVER chose the letter before this mounted, and owns the clock: the
// answer / first-turn timer only starts once its intro timer runs out (see
// server/games/alphabet-soup.js INTRO_MS). Every client animates from the
// same room_update, so the tile lands everywhere at about the same moment.
//
// Reliability rules learned from the Chaos takeover (ChaosOverlay.jsx):
//   * The parent mounts this with key={roundIndex} — a FRESH instance every
//     round, so no stage, timer or "already played" flag can leak from one
//     round into the next (nothing module-level either).
//   * Timing is anchored to a LOCAL clock (performance.now at mount) plus
//     the server's relative `introMsLeft` — never wall-clock timestamps,
//     which drift by seconds on phones.
//   * Stages advance on a setInterval, not requestAnimationFrame (rAF is
//     frozen in background tabs / on a locked screen).
//   * Motion is CSS transforms + opacity only; no canvas, no layout thrash.
//   * The bowl is sized with min(vw, px) inside the normal page flow — no
//     fixed/100vh layers for mobile browser toolbars to clip.
// A device that first sees this round's intro well after it began (a
// reconnect) skips straight to the landed result, silently. With
// prefers-reduced-motion the swirl is replaced by a quick fade + pop.

const LAND_MS = 700 // the final drift-to-centre + grow, inside swirlMs
const SKIP_IF_LATE_MS = 600 // joined this much after the chip was due -> skip
const TILE_COLORS = ['violet', 'coral', 'gold']

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Two rings of tiles built only from letters eligible this round. The
// chosen letter sits at slot 0 of the outer ring — the one that lands.
function buildRings(eligible, letter) {
  const others = eligible.filter((l) => l !== letter)
  const pool = others.length ? others : [letter]
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const total = Math.min(16, Math.max(11, eligible.length))
  const picks = []
  for (let i = 0; picks.length < total - 1; i++) picks.push(shuffled[i % shuffled.length])
  const outerCount = Math.ceil(total * 0.6)
  const outer = [letter, ...picks.slice(0, outerCount - 1)]
  const inner = picks.slice(outerCount - 1)
  const place = (letters, radius, offset) =>
    letters.map((l, i) => ({
      letter: l,
      angle: offset + (360 / letters.length) * i,
      radius,
      color: TILE_COLORS[(i + (radius > 0.3 ? 0 : 1)) % TILE_COLORS.length],
    }))
  return { outer: place(outer, 0.34, -90), inner: place(inner, 0.18, -60) }
}

// Outer ring turns OUTER_TURN degrees over the stir; the chosen tile ends
// where its start angle + that turn puts it — the landing tile starts
// there. A whole turn, so the chosen tile finishes upright and hands off
// seamlessly to the (upright) landing tile. The inner ring is stirred a
// little faster and fades as the letter lands, so its end angle is free.
const OUTER_TURN = 360
const INNER_TURN = 540

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
  const rings = useMemo(
    () => buildRings(game.eligibleLetters?.length ? game.eligibleLetters : [letter], letter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [stage, setStage] = useState(timing.skip ? 'landed' : 'wait') // wait|chip|swirl|land|landed

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

  const showChip = stage !== 'wait'
  const landed = stage === 'landed'
  const chosen = rings.outer[0]
  const endAngle = ((chosen.angle + OUTER_TURN) * Math.PI) / 180
  const heroStyle = {
    // Bowl-relative start point (a fraction of --bowl), used in calc().
    '--fx': (Math.cos(endAngle) * chosen.radius).toFixed(4),
    '--fy': (Math.sin(endAngle) * chosen.radius).toFixed(4),
    '--land-ms': `${LAND_MS}ms`,
  }
  const ringStyle = (turn) => ({ '--stir-ms': `${stirMs}ms`, '--turn': `${turn}deg` })

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
        <div className={`as-bowl-stage as-stage-${stage}`}>
          <div className="as-bowl" aria-hidden="true">
            <div className="as-broth" />
            {['outer', 'inner'].map((ringName) => (
              <div
                key={ringName}
                className={`as-ring as-ring-${ringName}`}
                style={ringStyle(ringName === 'outer' ? OUTER_TURN : INNER_TURN)}
              >
                {rings[ringName].map((t, i) => (
                  <span
                    key={`${ringName}-${i}`}
                    className={`as-soup-slot ${ringName === 'outer' && i === 0 ? 'as-soup-chosen' : ''}`}
                    style={{
                      transform: `rotate(${t.angle}deg) translateX(var(--r-${ringName})) rotate(${-t.angle}deg)`,
                    }}
                  >
                    <span className={`as-soup-tile as-soup-${t.color}`}>{t.letter}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          {(stage === 'land' || landed) && (
            <div className="as-hero" style={heroStyle}>
              <LetterTile letter={letter} />
            </div>
          )}
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
