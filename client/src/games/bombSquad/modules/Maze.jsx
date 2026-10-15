import { useEffect, useRef } from 'react'
import { useSound } from '../../../sound/SoundContext'

const COLS = 'ABCDEF'

// MAZE: the Defuser's grid — two marker circles, the white dot and the
// target triangle. No walls here (they're only in the Expert's manual).
// Arrow buttons move the dot; a light click on every step.
export default function Maze({ view, interactive, onAct }) {
  const { play } = useSound()
  const last = useRef(view.pos)
  useEffect(() => {
    if (view.pos !== last.current) play('potato-pass', { gain: 0.18 })
    last.current = view.pos
  }, [view.pos, play])
  const n = view.size ?? 6
  const name = (cell) => `${COLS[cell % n]}${Math.floor(cell / n) + 1}`
  return (
    <div className="bs-maze">
      <div className="bs-maze-grid" style={{ '--n': n }} role="grid" aria-label={`Dot at ${name(view.pos)}, target at ${name(view.target)}, circles at ${view.markers.map(name).join(' and ')}`}>
        <span className="bs-maze-corner" />
        {Array.from({ length: n }, (_, c) => (
          <span key={`c${c}`} className="bs-maze-label">
            {COLS[c]}
          </span>
        ))}
        {Array.from({ length: n }, (_, r) => [
          <span key={`r${r}`} className="bs-maze-label">
            {r + 1}
          </span>,
          ...Array.from({ length: n }, (_, c) => {
            const cell = r * n + c
            return (
              <span key={cell} className="bs-maze-cell" role="gridcell">
                {view.markers.includes(cell) && <span className="bs-maze-marker" />}
                {view.target === cell && <span className="bs-maze-target" aria-label="target" />}
                {view.pos === cell && <span className="bs-maze-dot" aria-label="dot" />}
              </span>
            )
          }),
        ])}
      </div>
      <div className="bs-maze-pad">
        {[
          ['up', '↑'],
          ['left', '←'],
          ['right', '→'],
          ['down', '↓'],
        ].map(([dir, glyph]) => (
          <button key={dir} type="button" className={`bs-maze-btn bs-maze-${dir}`} disabled={!interactive} onClick={() => onAct({ kind: 'move', dir })} aria-label={`Move ${dir}`}>
            {glyph}
          </button>
        ))}
      </div>
    </div>
  )
}
