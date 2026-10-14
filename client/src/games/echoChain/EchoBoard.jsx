import { colorFor, tileLabel } from './board'

// The grid. Every tile is a real button (so it's tappable and labelled by
// its position), but only the active player's board takes taps; everyone
// else's shows the same taps live and ignores touches.
//
// `flashes`: tile -> { id, kind, ms }. Each flash mounts a fresh face
// (keyed on its id), so the same tile lit twice in a row animates twice.
// The flash brightens the tile with a slight scale-up; under
// prefers-reduced-motion it's a plain colour change (index.css).
export default function EchoBoard({ size, interactive, flashes, onTap }) {
  const tiles = size * size
  return (
    <div
      className={`ec-board ec-board-s${size} ${interactive ? 'ec-board-live' : ''}`}
      style={{ '--ec-size': size }}
      role="group"
      aria-label={interactive ? 'Tiles: tap the chain in order' : 'Tiles'}
    >
      {Array.from({ length: tiles }, (_, t) => {
        const f = flashes[t]
        return (
          <button
            key={t}
            type="button"
            className="ec-tile"
            style={{ '--ec-color': colorFor(size, t) }}
            aria-label={tileLabel(size, t)}
            aria-disabled={!interactive}
            tabIndex={interactive ? 0 : -1}
            onPointerDown={(e) => {
              if (!interactive) return
              // Pointer down, not click: a tap registers the instant the
              // finger lands, and a quick double tap is two taps.
              e.preventDefault()
              onTap(t)
            }}
            onKeyDown={(e) => {
              if (!interactive || (e.key !== 'Enter' && e.key !== ' ')) return
              e.preventDefault()
              onTap(t)
            }}
          >
            <span
              key={f ? f.id : 'idle'}
              className={`ec-face ${f ? `ec-lit ec-lit-${f.kind}` : ''}`}
              style={f ? { '--ec-flash-ms': `${f.ms}ms` } : undefined}
            />
          </button>
        )
      })}
    </div>
  )
}
