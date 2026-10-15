// Each Simon colour has its own shape, so nobody relies on colour alone:
// red circle, blue square, green triangle, yellow diamond.
const SHAPES = {
  red: <circle cx="12" cy="12" r="6.5" />,
  blue: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  green: <path d="M12 5.5 19 18.5H5Z" />,
  yellow: <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" />,
}

export function SimonShape({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
      {SHAPES[color]}
    </svg>
  )
}
