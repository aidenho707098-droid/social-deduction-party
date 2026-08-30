import { resolvePlayerColor } from './playerColors'

// The consistent visual identifier shown beside a player's name everywhere
// they appear — lobby, host controls, every game's lists / voting /
// leaderboards, and the tournament standings.
//
// `color` accepts a colour id, a hex, a CSS var, or a value straight from
// playerColorMap(). `className="player-cdot-inline"` places it before a
// name inside a text run; `onColor` swaps the dark hairline ring for a
// light one, for dots sitting on a coloured / dark background.
export function PlayerDot({ color, className = '', onColor = false, title }) {
  return (
    <span
      className={`player-cdot ${onColor ? 'player-cdot-on' : ''} ${className}`}
      style={{ background: resolvePlayerColor(color) }}
      title={title}
      aria-hidden="true"
    />
  )
}
