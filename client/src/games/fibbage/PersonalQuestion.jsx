// Renders a Personal Mode question ("What is {name}'s favorite movie?"),
// substituting the subject's name and styling it in that player's assigned
// colour + bold so it stands out from the rest of the question text.
export default function PersonalQuestion({ template, name, color, className = '' }) {
  const marker = '{name}'
  const text = String(template ?? '')
  const idx = text.indexOf(marker)

  if (idx === -1) return <p className={className}>{text}</p>

  return (
    <p className={className}>
      {text.slice(0, idx)}
      <span className="fof-subject-name" style={color ? { color } : undefined}>
        {name || 'them'}
      </span>
      {text.slice(idx + marker.length)}
    </p>
  )
}
