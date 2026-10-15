import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { useCountdown } from '../alphabetSoup/useCountdown'
import { ROWS, STATE_LABEL, keyStates } from './keyboard'
import { roundLabel, stepLabel } from './labels'
import { PlayerStrip, TimerRing } from './shared'

// Tile gap: a pixel tighter on the longest words, so 8 letters x 9 rows
// still get ~32px tiles on a 320x568 screen.
const gapFor = (length) => (length >= 7 ? 3 : 4)
const MAX_TILE = 58
const REVEAL_STEP_MS = 120 // the flip moves across a new row tile by tile

// The solve phase: everyone at once, each on a DIFFERENT word. The whole
// thing (header, board, keyboard) fits a 320x568 screen with no scrolling.
// The board's tiles size themselves to the space left over, and the
// on-screen keyboard replaces the phone's own, so nothing ever shifts.
//
// The target word never reaches this device: each guess goes to the server
// and comes back as a feedback pattern ("g" right spot, "y" wrong spot,
// "x" not in the word).
export default function Solve({ game, priv, myId, nameById, colorById, actions }) {
  const { play } = useSound()
  const msLeft = useCountdown(game.msLeft ?? 0, `${game.serial}:solve`, 250)
  const board = priv?.board ?? null
  const mine = priv?.myWord ?? null
  const L = board?.length ?? 5
  const rows = board?.maxGuesses ?? L + 1
  const GAP = gapFor(L)
  const guesses = board?.guesses ?? []
  const playing = board?.status === 'solving'

  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState(null) // { count, guess } while a guess is in flight
  const [msg, setMsg] = useState(null)
  const [shake, setShake] = useState(0)
  const [revealRow, setRevealRow] = useState(-1)

  // A guess landed: the server's row replaces the in-flight one.
  const count = guesses.length
  const [lastCount, setLastCount] = useState(count)
  if (count !== lastCount) {
    setLastCount(count)
    if (count > lastCount) {
      setRevealRow(count - 1)
      setSent(null)
    }
  }

  const submit = useCallback(() => {
    if (!playing || sent) return
    if (typed.length < L) {
      setMsg(`Not enough letters: ${L} needed`)
      setShake((n) => n + 1)
      return
    }
    const guess = typed
    setSent({ count, guess })
    setTyped('')
    setMsg(null)
    actions.wordHeistGuess(guess, (res) => {
      if (!res?.ok) {
        setSent(null)
        setTyped(guess)
        setMsg(res?.message ?? 'That guess didn’t go through.')
        setShake((n) => n + 1)
        return
      }
      if (res.status === 'solved') play('correct')
      else if (res.status === 'failed') play('wrong')
      else play('confirm', { gain: 0.25 })
    })
  }, [playing, sent, typed, L, count, actions, play])

  const press = useCallback(
    (key) => {
      if (!playing || sent) return
      if (key === 'ENTER') return submit()
      setMsg(null)
      if (key === 'BACK') return setTyped((t) => t.slice(0, -1))
      if (/^[A-Z]$/.test(key)) setTyped((t) => (t.length < L ? t + key : t))
    },
    [playing, sent, submit, L],
  )

  // A physical keyboard works too (laptops, tablets with keyboards).
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target?.closest?.('input, textarea')) return
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase())
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  // ---- tile size from the space the board actually has ----
  const boardRef = useRef(null)
  const [tile, setTile] = useState(40)
  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return undefined
    const fit = () => {
      const { width, height } = el.getBoundingClientRect()
      const w = (width - GAP * (L - 1)) / L
      const h = (height - GAP * (rows - 1)) / rows
      setTile(Math.max(18, Math.floor(Math.min(w, h, MAX_TILE))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [L, rows, GAP])

  const states = keyStates(guesses)

  // ---- header copy ----
  const step = stepLabel('solve')
  const guessNo = Math.min(rows, guesses.length + (playing ? 1 : 0))
  let status
  if (!board) status = 'You’re watching this round'
  else if (board.status === 'solved') status = `Cracked in ${guesses.length}!`
  else if (board.status === 'failed') status = 'Out of guesses'
  else if (board.status === 'void') status = 'Your board was closed'
  else status = `Guess ${guessNo} of ${rows}`

  const myPill = mine
    ? mine.status === 'solved'
      ? `Your word: cracked in ${mine.guessCount}`
      : mine.status === 'failed'
        ? 'Your word: not cracked!'
        : mine.status === 'void'
          ? 'Your word: solver left'
          : `Your word: ${mine.guessCount} guess${mine.guessCount === 1 ? '' : 'es'} so far`
    : null

  let chip = null
  if (board?.prompt) chip = { kind: 'prompt', text: board.prompt }
  else if (board?.hint) chip = { kind: 'hint', text: `Hint: ${board.hint}` }
  else if (board?.firstLetter) chip = { kind: 'hint', text: `Starts with ${board.firstLetter}` }
  else if (board && game.mode === 'free') {
    const left = Math.max(0, (game.config?.hintAfterGuess ?? 3) - guesses.length)
    if (left > 0) chip = { kind: 'wait', text: `Hint after ${left} more guess${left === 1 ? '' : 'es'}` }
  }

  return (
    <div className="screen wh-solve">
      <div className="wh-top">
        <div className="wh-top-text">
          <p className="wh-top-meta">
            {roundLabel(game)}
            {step && ` · ${step}`}
            {game.speed && <span className="wh-speed"> · Speed</span>}
          </p>
          <p className={`wh-top-count wh-top-${board?.status ?? 'none'}`} aria-live="polite">
            {status}
          </p>
        </div>
        <TimerRing msLeft={msLeft} totalMs={game.windowMs} />
      </div>

      <div className="wh-chips">
        {chip && <span className={`wh-chip wh-chip-${chip.kind}`}>{chip.text}</span>}
        {myPill && <span className="wh-pill">{myPill}</span>}
      </div>

      <PlayerStrip game={game} myId={myId} nameById={nameById} colorById={colorById} />

      <div className="wh-board-wrap" ref={boardRef}>
        {board && (
          <div
            key={shake}
            className={`wh-board ${shake ? 'wh-board-shake' : ''}`}
            style={{ '--wh-tile': `${tile}px`, '--wh-cols': L, gap: GAP }}
            role="grid"
            aria-label={`${L}-letter board, ${rows} guesses`}
          >
            {Array.from({ length: rows }, (_, r) => {
              const done = guesses[r]
              const inflight = !done && sent && r === sent.count ? sent.guess : null
              const current = !done && !inflight && playing && r === guesses.length ? typed : null
              const letters = done?.guess ?? inflight ?? current ?? ''
              return (
                <div key={r} className="wh-row" role="row">
                  {Array.from({ length: L }, (_, c) => {
                    const st = done?.pattern[c]
                    const ch = letters[c] ?? ''
                    const flip = st && r === revealRow
                    return (
                      <span
                        key={c}
                        role="gridcell"
                        className={`wh-tile ${st ? `wh-t-${st}` : ch ? 'wh-t-filled' : ''} ${flip ? 'wh-tile-flip' : ''}`}
                        style={flip ? { animationDelay: `${c * REVEAL_STEP_MS}ms` } : undefined}
                        aria-label={ch ? `${ch}${st ? `, ${STATE_LABEL[st]}` : ''}` : 'empty'}
                      >
                        {ch}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="wh-msg" role="status">
        {(msg || (board && !playing)) && <span>{msg ?? 'Waiting for everyone else to finish…'}</span>}
      </p>

      <div className={`wh-kb ${playing ? '' : 'wh-kb-off'}`} aria-label="Keyboard">
        {ROWS.map((row, i) => (
          <div key={row} className="wh-kb-row">
            {i === 2 && (
              <button type="button" className="wh-key wh-key-wide" onClick={() => press('ENTER')} disabled={!playing}>
                Enter
              </button>
            )}
            {[...row].map((k) => (
              <button
                key={k}
                type="button"
                className={`wh-key ${states[k] ? `wh-t-${states[k]}` : ''}`}
                onClick={() => press(k)}
                disabled={!playing}
                aria-label={states[k] ? `${k}, ${STATE_LABEL[states[k]]}` : k}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button type="button" className="wh-key wh-key-wide" onClick={() => press('BACK')} disabled={!playing} aria-label="Backspace">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
