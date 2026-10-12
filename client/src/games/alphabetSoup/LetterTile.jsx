// The round's visual anchor: one big letter tile, plus the category chip
// that names what you're answering. Shared by every Alphabet Soup screen
// (and the size the reveal animation's landing tile grows into).
export function LetterTile({ letter, size = 'lg', className = '' }) {
  return (
    <div className={`as-tile as-tile-${size} ${className}`} aria-label={`Letter ${letter}`}>
      <span className="as-tile-letter">{letter}</span>
    </div>
  )
}

export function CategoryChip({ name, className = '' }) {
  return (
    <div className={`as-chip ${className}`}>
      <span className="as-chip-kicker">Category</span>
      <span className="as-chip-name">{name}</span>
    </div>
  )
}

// Letter + category as one header block for the in-round screens.
export function RoundPrompt({ game, size = 'lg' }) {
  return (
    <div className="as-prompt">
      <CategoryChip name={game.category?.name} />
      <LetterTile letter={game.letter} size={size} />
    </div>
  )
}
