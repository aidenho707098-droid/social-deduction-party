import { useRef, useState } from 'react'
import { MODULE_NAMES } from './config'
import { Glyph } from './glyphs'
import MazeDrawing from './MazeDrawing'
import { ModuleIcon } from './ModuleIcon'

// The Expert's manual. It draws ONLY what the server rendered from this
// pair's rules (chapters of blocks of parts — see server/games/bombSquad/
// vocab.js), so it can never say something the checker doesn't do.
// Chapter chips stay pinned at the top; a text-size toggle is remembered
// on this device.

const SIZE_KEY = 'bs-manual-size'
const readSize = () => {
  try {
    return localStorage.getItem(SIZE_KEY) === 'lg' ? 'lg' : 'md'
  } catch {
    return 'md'
  }
}

export function ColorChip({ color }) {
  return (
    <span className={`bs-chip bs-chip-color`}>
      <span className={`bs-sw bs-sw-${color}`} aria-hidden="true" />
      {color}
    </span>
  )
}

// One rich-text part.
function Part({ p }) {
  if ('t' in p) return p.t
  if ('b' in p) return <strong>{p.b}</strong>
  if ('c' in p) return <ColorChip color={p.c} />
  if ('d' in p) return <span className="bs-chip bs-chip-digit">{p.d}</span>
  if ('k' in p) return <span className={`bs-chip bs-chip-act bs-chip-${p.k}`}>{p.k.toUpperCase()}</span>
  if ('g' in p) return <Glyph id={p.g} size={20} className="bs-glyph-inline" />
  return null
}
export const Parts = ({ parts }) => parts.map((p, i) => <Part key={i} p={p} />)

// A table cell made of " · "-separated groups (Simon's "red → blue · …")
// shows one group per line, so it reads cleanly on a narrow phone.
function Cell({ parts }) {
  const groups = [[]]
  for (const p of parts) {
    if (p.t === ' · ') groups.push([])
    else groups[groups.length - 1].push(p)
  }
  if (groups.length === 1) return <Parts parts={parts} />
  return groups.map((g, i) => (
    <span key={i} className="bs-cell-line">
      <Parts parts={g} />
    </span>
  ))
}

function Block({ block }) {
  if (block.type === 'note') {
    return (
      <p className="bs-note">
        <Parts parts={block.parts} />
      </p>
    )
  }
  if (block.type === 'rules') {
    return (
      <div className="bs-rules">
        {block.heading && <h4 className="bs-rules-head">{block.heading}</h4>}
        <ol className="bs-rule-list">
          {block.items.map((parts, i) => (
            <li key={i}>
              <Parts parts={parts} />
            </li>
          ))}
        </ol>
      </div>
    )
  }
  if (block.type === 'table') {
    return (
      <div className="bs-table-wrap">
        {block.heading && <h4 className="bs-rules-head">{block.heading}</h4>}
        <table className="bs-table">
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    <Cell parts={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.type === 'maze') return <MazeDrawing block={block} />
  if (block.type === 'glyphColumns') {
    return (
      <div className="bs-glyph-cols" role="table" aria-label="Symbol columns">
        {block.columns.map((col, i) => (
          <div key={i} className="bs-glyph-col" role="row">
            <span className="bs-glyph-col-n">{i + 1}</span>
            {col.map((g) => (
              <span key={g} role="cell" className="bs-glyph-cell">
                <Glyph id={g} size={26} />
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }
  return null
}

// A warning-style line icon for the "Read this first" alert.
function WarnIcon() {
  return (
    <svg className="bs-alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 21.5 20h-19Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </svg>
  )
}

export default function Manual({ manual }) {
  const [size, setSize] = useState(readSize)
  const refs = useRef({})
  const pages = [manual.general, ...manual.chapters]

  function toggleSize() {
    const next = size === 'lg' ? 'md' : 'lg'
    setSize(next)
    try {
      localStorage.setItem(SIZE_KEY, next)
    } catch {
      // per-device convenience only
    }
  }

  return (
    <div className={`bs-manual bs-manual-${size}`}>
      <div className="bs-manual-chips" role="navigation" aria-label="Manual chapters">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            className="bs-manual-chip"
            onClick={() => refs.current[p.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <ModuleIcon id={p.icon} />
            {p.id === 'general' ? 'Basics' : MODULE_NAMES[p.id] ?? p.title}
          </button>
        ))}
        <button type="button" className="bs-manual-size" onClick={toggleSize} aria-label={size === 'lg' ? 'Smaller text' : 'Larger text'}>
          {size === 'lg' ? 'A−' : 'A+'}
        </button>
      </div>
      {manual.split && <p className="bs-manual-split">You have half the chapters; your fellow Expert has the rest.</p>}
      {pages.map((p, i) =>
        p.static ? (
          <section
            key={p.id}
            ref={(el) => {
              refs.current[p.id] = el
            }}
            className="bs-alert"
            role="note"
          >
            <div className="bs-alert-head">
              <WarnIcon />
              <h3 className="bs-alert-title">{p.title}</h3>
              <span className="bs-alert-badge">Same every round</span>
            </div>
            {p.blocks.map((bl, j) => (
              <Block key={j} block={bl} />
            ))}
          </section>
        ) : (
        <section
          key={p.id}
          ref={(el) => {
            refs.current[p.id] = el
          }}
          className={`bs-chapter ${i % 2 ? 'bs-chapter-alt' : ''}`}
        >
          <h3 className="bs-chapter-title">
            <ModuleIcon id={p.icon} />
            {p.title}
          </h3>
          {p.blocks.map((bl, j) => (
            <Block key={j} block={bl} />
          ))}
        </section>
        ),
      )}
    </div>
  )
}
