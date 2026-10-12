// Burned Letters: the whole letter pool as a strip of small tiles, with
// every letter already used this game charred. `current` is this round's
// letter — highlighted, and charred too once `currentBurned` (the reveal
// animation flips that the moment the tile lands).
export default function AlphabetStrip({ pool, burned = [], current = null, currentBurned = true }) {
  if (!pool?.length) return null
  const burnt = new Set(burned)
  if (current && currentBurned) burnt.add(current)
  return (
    <div className="as-strip" aria-label="Burned letters">
      {pool.map((l) => (
        <span
          key={l}
          className={`as-strip-tile ${burnt.has(l) ? 'as-strip-burnt' : ''} ${
            l === current ? 'as-strip-current' : ''
          }`}
          aria-label={burnt.has(l) ? `${l} burned` : l}
        >
          {l}
        </span>
      ))}
    </div>
  )
}
