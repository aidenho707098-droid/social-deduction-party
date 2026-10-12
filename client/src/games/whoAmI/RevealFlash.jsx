function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// A brief, self-dismissing overlay the moment a correct guess lands — the
// "satisfying reveal" moment. Lives at the WhoAmIGame level (not inside
// AskScreen) so it keeps showing even once the turn has already moved on
// and the active-player screen has unmounted underneath it.
export default function RevealFlash({ name, placement }) {
  return (
    <div className="wai-flash-overlay" role="status" aria-live="polite">
      <div className="wai-flash-card">
        <div className="wai-flash-icon">🎉</div>
        <div className="wai-flash-you">You were</div>
        <div className="wai-flash-name">{name}</div>
        {placement && <div className="wai-flash-placement">{ordinal(placement)} place!</div>}
      </div>
    </div>
  )
}
