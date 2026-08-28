// Renders a fact prompt that contains the "___" marker, either with the
// blank shown (fill = null) or filled in with an answer (fill = string).
// Shared by the write / vote / reveal screens so the blank always looks
// the same.
export default function FactPrompt({ prompt, fill = null, className = '' }) {
  const marker = '___'
  const idx = prompt.indexOf(marker)
  const before = idx === -1 ? prompt : prompt.slice(0, idx)
  const after = idx === -1 ? '' : prompt.slice(idx + marker.length)

  return (
    <p className={`fibbage-fact ${className}`}>
      {before}
      {fill == null ? (
        <span className="fibbage-blank" aria-label="blank" />
      ) : (
        <span className="fibbage-fill">{fill}</span>
      )}
      {after}
    </p>
  )
}
