import { useId } from 'react'

// One setting on a game's setup screen: its label left-aligned above its
// control, both on the same left edge. Wrap a screen's settings in
// <SettingList> for an even 16px between them. `note` is a small line under
// the control (what the current choice means).
export function SettingList({ children }) {
  return <div className="setting-list">{children}</div>
}

export default function SettingRow({ label, note, children }) {
  const id = useId()
  return (
    <section className="setting-row" aria-labelledby={id}>
      <span className="label setting-row-label" id={id}>
        {label}
      </span>
      {children}
      {note && <p className="setting-row-note">{note}</p>}
    </section>
  )
}
