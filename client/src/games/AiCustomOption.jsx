import { useState } from 'react'
import LoadingDots from './LoadingDots'

// The "✨ Custom X" generator widget shared by every game's setup screen
// (Imposter, Crack the Code, Fact or Fake, Taboo, Fake Artist).
//
// Collapsed: a prominent violet feature button. Expanded: a name box +
// Generate, with a brief loading state, and an error line with Retry on
// failure. On success it calls onGenerated(name) — the parent adds that
// name to its own option list (the name also arrives back via room state,
// so it renders as a normal built-in-looking pill). Nothing here knows
// which game it's for; the parent wires `onGenerate` to the right gameId.
export default function AiCustomOption({
  label, // e.g. "Custom Theme"
  placeholder, // e.g. "90s Movies"
  hint, // one-liner shown above the box when expanded
  noun = 'set', // "theme" / "topic" / "category" — used in the loading line
  onGenerate, // (name, cb) => void ; cb gets { ok, name } | { error }
  onGenerated, // (name) => void
  startOpen = false,
}) {
  const [open, setOpen] = useState(startOpen)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const trimmed = name.trim()
  const canGo = !busy && trimmed.length >= 2 && trimmed.length <= 40

  function generate() {
    if (!canGo) return
    setBusy(true)
    setErr('')
    onGenerate(trimmed, (res) => {
      setBusy(false)
      if (res?.error) {
        setErr(res.error)
        return
      }
      onGenerated?.(res.name)
      setName('') // keep the box open so the host can add another
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        className="pill pill-custom-feature"
        onClick={() => setOpen(true)}
      >
        ✨ {label}
      </button>
    )
  }

  return (
    <div className="ai-custom">
      {hint && <p className="hint hint-block">{hint}</p>}
      <div className="row">
        <input
          className="input"
          type="text"
          value={name}
          maxLength={40}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') generate()
          }}
        />
        <button
          type="button"
          className="btn btn-primary ai-custom-go"
          onClick={generate}
          disabled={!canGo}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {busy && (
        <p className="hint center-text">
          Building the {noun} <LoadingDots />
        </p>
      )}
      {err && (
        <p className="error">
          {err}{' '}
          <button
            type="button"
            className="btn btn-text ai-custom-retry"
            onClick={generate}
            disabled={!canGo}
          >
            Retry
          </button>
        </p>
      )}
      <button
        type="button"
        className="btn btn-text"
        onClick={() => {
          setOpen(false)
          setErr('')
        }}
      >
        Done
      </button>
    </div>
  )
}
