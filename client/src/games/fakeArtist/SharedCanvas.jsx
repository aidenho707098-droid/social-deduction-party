import { DRAW_W, DRAW_H } from './inkModel'

// Read-only view of the shared drawing (a PNG/WebP data URL from the
// server, or nothing yet). Keeps the logical aspect ratio so a stroke
// drawn at one size lands in the same place for everyone.
export default function SharedCanvas({ src, className = '', label }) {
  return (
    <div
      className={`fa-canvas-frame ${className}`}
      style={{ aspectRatio: `${DRAW_W} / ${DRAW_H}` }}
    >
      {src ? (
        <img src={src} alt={label ?? 'The shared drawing so far'} className="fa-canvas-img" />
      ) : (
        <div className="fa-canvas-blank">Blank canvas — nobody's drawn yet</div>
      )}
    </div>
  )
}
