import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { HOST_GRACE_SECONDS } from '../timing'
import SharedCanvas from './SharedCanvas'
import { DRAW_W, DRAW_H, INK_LIMIT, inkFraction, inkExhausted, clampMove } from './inkModel'

const PALETTE = ['#241f33', '#e5484d', '#2f6fed', '#2e9e5b', '#f2820b']
const WIDTHS = [
  { key: 'S', px: 3 },
  { key: 'M', px: 5 },
  { key: 'L', px: 8 },
]

function RoleReminder({ myRole }) {
  const fa = myRole?.fakeArtist
  if (!fa) return null
  if (fa.role === 'imposter') {
    return (
      <p className="fa-role-strip fa-role-imposter">
        🎭 You're the <strong>Fake Artist</strong> — category:{' '}
        <strong>{fa.category}</strong>. Blend in.
      </p>
    )
  }
  return (
    <p className="fa-role-strip fa-role-artist">
      Secret word: <strong>{fa.word}</strong>
    </p>
  )
}

export default function DrawTurn({ game, players, myId, myRole, isHost, onSubmit, onForceAdvance }) {
  const colorById = playerColorMap(players)
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const amDrawing = game.currentDrawerId === myId
  const { play } = useSound()

  // --- turn clock (mirrors the server, ticked locally between pushes) ---
  const [msLeft, setMsLeft] = useState(game.msLeft ?? game.turnMs)
  const firedTimeout = useRef(false)
  const firedReveal = useRef(false)

  useEffect(() => {
    setMsLeft(game.msLeft ?? game.turnMs)
    firedTimeout.current = false
    firedReveal.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentDrawerId, game.roundIndex])

  useEffect(() => {
    const t = setInterval(() => setMsLeft((m) => Math.max(0, m - 250)), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    setMsLeft((m) => (Math.abs(m - (game.msLeft ?? 0)) > 900 ? game.msLeft ?? 0 : m))
  }, [game.msLeft])

  const secondsLeft = Math.ceil(msLeft / 1000)
  const timeUp = msLeft <= 0

  // --- drawing state (only meaningful when it's my turn) ---
  const canvasRef = useRef(null)
  const strokesRef = useRef([])
  const drawingRef = useRef(false)
  const lastPtRef = useRef(null)
  const bgRef = useRef(null)
  const [rev, setRev] = useState(0)
  const [tool, setTool] = useState({ color: PALETTE[0], px: WIDTHS[1].px })
  const [submitted, setSubmitted] = useState(false)

  const strokes = strokesRef.current
  const frac = inkFraction(strokes, INK_LIMIT)
  const noInk = inkExhausted(strokes, INK_LIMIT)
  const locked = submitted || timeUp || noInk

  // reset per turn
  useEffect(() => {
    strokesRef.current = []
    drawingRef.current = false
    lastPtRef.current = null
    setSubmitted(false)
    setRev((r) => r + 1)
  }, [game.currentDrawerId, game.roundIndex])

  // Load the shared image that goes UNDER this turn's strokes (null on the
  // first turn). `bgReadyRef` resolves once it's decoded — submit() waits on
  // it so a very fast "Done" can't export before the previous turns' art
  // has painted in.
  const bgReadyRef = useRef(Promise.resolve())
  useEffect(() => {
    if (!amDrawing) return
    if (!game.canvas) {
      bgRef.current = null
      bgReadyRef.current = Promise.resolve()
      setRev((r) => r + 1)
      return
    }
    let done
    bgReadyRef.current = new Promise((res) => {
      done = res
    })
    const img = new Image()
    img.onload = () => {
      bgRef.current = img
      setRev((r) => r + 1)
      done()
    }
    img.onerror = () => done()
    img.src = game.canvas
  }, [amDrawing, game.canvas])

  const redraw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, DRAW_W, DRAW_H)
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, DRAW_W, DRAW_H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokesRef.current) {
      if (!s.points.length) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.01, s.points[0].y + 0.01)
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    if (amDrawing) redraw()
  }, [amDrawing, rev, redraw])

  function toLogical(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * DRAW_W,
      y: ((e.clientY - r.top) / r.height) * DRAW_H,
    }
  }

  function onPointerDown(e) {
    if (locked) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = toLogical(e)
    drawingRef.current = true
    lastPtRef.current = p
    strokesRef.current.push({ color: tool.color, width: tool.px, points: [p] })
    setRev((r) => r + 1)
  }
  function onPointerMove(e) {
    if (!drawingRef.current) return
    const to = toLogical(e)
    const from = lastPtRef.current
    const { point, exhausted } = clampMove(strokesRef.current, from, to, INK_LIMIT)
    const cur = strokesRef.current[strokesRef.current.length - 1]
    cur.points.push(point)
    lastPtRef.current = point
    if (exhausted) {
      drawingRef.current = false
      play('wrong')
    }
    setRev((r) => r + 1)
  }
  function endStroke() {
    drawingRef.current = false
    setRev((r) => r + 1)
  }
  function undo() {
    if (locked || !strokesRef.current.length) return
    strokesRef.current.pop()
    setRev((r) => r + 1)
  }

  const compose = useCallback(async () => {
    await bgReadyRef.current // don't export before the prior art has painted
    redraw()
    const cv = canvasRef.current
    if (!cv) return null
    let url
    try {
      url = cv.toDataURL('image/webp', 0.9)
      if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/png')
    } catch {
      url = cv.toDataURL('image/png')
    }
    return url
  }, [redraw])

  const sendTurn = useCallback(async () => {
    setSubmitted(true)
    const url = await compose()
    onSubmit(url ?? game.canvas ?? '', () => {})
  }, [compose, onSubmit, game.canvas])

  function submit() {
    if (submitted) return
    play('confirm')
    sendTurn()
  }

  // auto-submit my work the moment the clock hits zero
  useEffect(() => {
    if (!amDrawing || submitted || !timeUp || firedTimeout.current) return
    firedTimeout.current = true
    sendTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amDrawing, timeUp, submitted])

  // the host's device nudges the server on if a turn overruns its grace
  useEffect(() => {
    if (!isHost || amDrawing || !timeUp || firedReveal.current) return
    firedReveal.current = true
    const t = setTimeout(onForceAdvance, HOST_GRACE_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [isHost, amDrawing, timeUp, onForceAdvance])

  const pct = Math.max(0, Math.min(100, (msLeft / Math.max(1, game.turnMs)) * 100))

  const header = (
    <>
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
        <span className="emoji-cat">{game.category}</span>
      </p>
      <div className="wyr-timer">
        <div className={`wyr-timer-fill ${secondsLeft <= 5 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="hint center-text">
        {timeUp ? "Time's up" : `${secondsLeft}s`} · turn {game.turnNumber} of {game.turnCount}
      </p>
    </>
  )

  // ---- the drawer's view ----
  if (amDrawing) {
    return (
      <div className="screen">
        {header}
        <RoleReminder myRole={myRole} />

        <div className="fa-ink">
          <span className="fa-ink-label">Ink</span>
          <div className="fa-ink-bar">
            <div
              className={`fa-ink-fill ${frac <= 0.25 ? 'low' : ''}`}
              style={{ width: `${frac * 100}%` }}
            />
          </div>
        </div>

        <div className="fa-canvas-frame fa-canvas-live" style={{ aspectRatio: `${DRAW_W} / ${DRAW_H}` }}>
          <canvas
            ref={canvasRef}
            width={DRAW_W}
            height={DRAW_H}
            className={`fa-canvas-el ${locked ? 'fa-canvas-locked' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
          {noInk && !submitted && <div className="fa-canvas-note">Out of ink — that's your turn</div>}
        </div>

        <div className="fa-toolbar">
          <div className="fa-swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`fa-swatch ${tool.color === c ? 'fa-swatch-on' : ''}`}
                style={{ background: c }}
                aria-label={`colour ${c}`}
                disabled={locked}
                onClick={() => setTool((t) => ({ ...t, color: c }))}
              />
            ))}
          </div>
          <div className="fa-widths">
            {WIDTHS.map((w) => (
              <button
                key={w.key}
                type="button"
                className={`fa-width ${tool.px === w.px ? 'fa-width-on' : ''}`}
                disabled={locked}
                onClick={() => setTool((t) => ({ ...t, px: w.px }))}
              >
                {w.key}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={locked || !strokes.length} onClick={undo}>
            Undo
          </button>
        </div>

        {submitted ? (
          <p className="hint center-text waiting">Added — passing the pen…</p>
        ) : (
          <button className="btn btn-primary" onClick={submit}>
            Done — pass the pen
          </button>
        )}
      </div>
    )
  }

  // ---- everyone else: watch it evolve ----
  return (
    <div className="screen">
      {header}
      <RoleReminder myRole={myRole} />
      <SharedCanvas src={game.canvas} />
      <p className="wyr-prompt">
        {nameById[game.currentDrawerId] ?? 'Someone'} is drawing…
      </p>

      <div className="wyr-board">
        {game.turnOrder.map((pid, i) => {
          const done = i < game.turnNumber - 1
          const active = pid === game.currentDrawerId
          return (
            <div key={pid} className={`wyr-board-row ${active ? 'wyr-me' : ''}`}>
              <span className="wyr-board-rank">{i + 1}</span>
              <span>
                <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
                {nameById[pid] ?? 'Unknown'}
                {pid === myId && ' (you)'}
              </span>
              <span className="fa-turn-tag">{active ? '✏️ drawing' : done ? '✓ done' : 'waiting'}</span>
            </div>
          )
        })}
      </div>

      {isHost && (
        <button className="btn btn-text" onClick={onForceAdvance}>
          Skip this turn →
        </button>
      )}
    </div>
  )
}
