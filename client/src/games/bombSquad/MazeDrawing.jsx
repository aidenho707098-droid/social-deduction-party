import { useState } from 'react'
import { createPortal } from 'react-dom'

const COLS = 'ABCDEF'
const CELL = 40
const PAD = 22

// One maze from the manual, drawn as SVG from the rules data: the walls
// (wherever a cell isn't open), the two marker cells highlighted, column and
// row labels. Tap to see it full screen.
function MazeSvg({ size, open, markers, n }) {
  const W = PAD + size * CELL + 4
  const lines = []
  for (let cell = 0; cell < size * size; cell++) {
    const r = Math.floor(cell / size)
    const c = cell % size
    const x = PAD + c * CELL
    const y = PAD + r * CELL
    if (!(open[cell] & 1)) lines.push(`M${x} ${y}h${CELL}`)
    if (!(open[cell] & 8)) lines.push(`M${x} ${y}v${CELL}`)
    if (r === size - 1 && !(open[cell] & 4)) lines.push(`M${x} ${y + CELL}h${CELL}`)
    if (c === size - 1 && !(open[cell] & 2)) lines.push(`M${x + CELL} ${y}v${CELL}`)
  }
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="bs-maze-svg" role="img" aria-label={`Layout ${n}`}>
      {markers.map((m) => (
        <g key={m}>
          <rect x={PAD + (m % size) * CELL + 2} y={PAD + Math.floor(m / size) * CELL + 2} width={CELL - 4} height={CELL - 4} rx="6" className="bs-maze-svg-mark" />
          <circle cx={PAD + (m % size) * CELL + CELL / 2} cy={PAD + Math.floor(m / size) * CELL + CELL / 2} r="9" className="bs-maze-svg-ring" />
        </g>
      ))}
      {Array.from({ length: size }, (_, i) => (
        <g key={i} className="bs-maze-svg-label">
          <text x={PAD + i * CELL + CELL / 2} y={15} textAnchor="middle">
            {COLS[i]}
          </text>
          <text x={10} y={PAD + i * CELL + CELL / 2 + 5} textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      <path d={lines.join('')} className="bs-maze-svg-walls" />
    </svg>
  )
}

export default function MazeDrawing({ block }) {
  const [big, setBig] = useState(false)
  return (
    <>
      <button type="button" className="bs-maze-card" onClick={() => setBig(true)} aria-label={`Layout ${block.n}, tap to enlarge`}>
        <span className="bs-maze-card-n">Layout {block.n}</span>
        <MazeSvg {...block} />
      </button>
      {/* A portal: the screen's entry animation (a transform) would
          otherwise trap a fixed overlay inside the long page. */}
      {big &&
        createPortal(
        <div className="modal-overlay bs-maze-zoom" role="dialog" aria-label={`Layout ${block.n}`} onClick={() => setBig(false)}>
          <div className="bs-maze-zoom-card">
            <p className="bs-maze-card-n">Layout {block.n} · tap to close</p>
            <MazeSvg {...block} />
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
