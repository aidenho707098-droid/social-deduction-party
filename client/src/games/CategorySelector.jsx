import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sameAnswer } from './alphabetSoup/answerChecks'
import { allOptions, sample, searchCategories, summarizeSelection } from './categorySearch'
import LoadingDots from './LoadingDots'

// The shared category selector (Alphabet Soup + Hot Potato): ONE summary row
// on the settings screen that opens a bottom sheet with search, quick
// actions, the current selection and "Create category". Parameterised by:
//   bank             [{ key, label, tags }] — the shared bank (categories.js)
//   customCategories this room's custom ones ({ key, name, tags, broad, … })
//   withLetters      the game uses per-category letter data (Alphabet Soup):
//                    a category created here gets its letters checked too
//   isUnavailable    (custom) -> reason string | null — e.g. Hot Potato's
//                    "Too narrow for Hot Potato"; shown greyed, not selectable
//   onCreate         (name, { force }, cb) — the create handler (server call)
//   multi            multi-select (the only mode these games use today)
//   readOnly         the summary only, no sheet (non-hosts)
// The selection is a plain list of keys. "All" is only a label for when it
// equals everything selectable.

const SUGGESTIONS = 8
const DEBOUNCE_MS = 150
const MAX_NAME = 40

// ---- component ---------------------------------------------------------------

export default function CategorySelector({
  bank,
  customCategories = [],
  value,
  onChange,
  withLetters = false,
  isUnavailable = null,
  onCreate = null,
  multi = true,
  readOnly = false,
  label = 'Categories',
}) {
  const [open, setOpen] = useState(false)
  const options = useMemo(() => allOptions(bank, customCategories, isUnavailable), [bank, customCategories, isUnavailable])
  const summary = summarizeSelection(value, options)

  if (readOnly) {
    return (
      <div className="cat-row cat-row-readonly">
        <span className="cat-row-label">{label}</span>
        <span className="cat-row-summary">{summary}</span>
      </div>
    )
  }

  return (
    <>
      <button type="button" className="cat-row" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="cat-row-label">{label}</span>
        <span className="cat-row-summary">{summary}</span>
        <svg className="cat-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
      {open && (
        <CategorySheet
          options={options}
          value={value}
          onDone={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
          withLetters={withLetters}
          onCreate={onCreate}
          multi={multi}
          isUnavailable={isUnavailable}
        />
      )}
    </>
  )
}

// Track the visual viewport so the sheet shrinks above an on-screen
// keyboard (iOS Safari doesn't resize the layout viewport for it).
function useVisualViewport() {
  const read = () => {
    const vv = window.visualViewport
    return vv ? { height: vv.height, top: vv.offsetTop } : { height: window.innerHeight, top: 0 }
  }
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    const update = () => setVp(read())
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return vp
}

function CategorySheet({ options, value, onDone, onCancel, withLetters, onCreate, multi, isUnavailable }) {
  const [selected, setSelected] = useState(() => value.filter((k) => options.some((o) => o.key === k && !o.unavailable)))
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [creating, setCreating] = useState(null) // null | { name, busy, error, kind }
  // Reshuffled every time the sheet opens (this component mounts per open).
  const [shuffleSeed] = useState(() => Math.random())
  // Bumped by Clear / Select all, so "Try these" re-samples from what's now
  // unselected (a plain tap leaves the list put, ticked).
  const [suggestRound, setSuggestRound] = useState(0)
  const vp = useVisualViewport()
  const searchRef = useRef(null)
  const createRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  const selectable = options.filter((o) => !o.unavailable)
  // Only selectable keys ever count (a category can turn out unavailable —
  // e.g. too narrow for Hot Potato — after it was created here).
  const isSel = (k) => selected.includes(k) && selectable.some((o) => o.key === k)
  const toggle = (o) => {
    if (o.unavailable) return
    setSelected((prev) => (prev.includes(o.key) ? prev.filter((k) => k !== o.key) : multi ? [...prev, o.key] : [o.key]))
  }
  const remove = (k) => setSelected((prev) => prev.filter((x) => x !== k))

  const results = debounced.trim() ? searchCategories(options, debounced) : null
  const suggestions = useMemo(
    () => sample(selectable.filter((o) => !selected.includes(o.key)), SUGGESTIONS),
    // Re-sampled per open (seed) and after Clear / Select all, not per toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shuffleSeed, suggestRound],
  )
  // Suggestions stay put (checked) when tapped, until the sheet reopens.
  const listed = results ?? suggestions
  const count = selectable.filter((o) => isSel(o.key)).length
  const countLabel = summarizeSelection(selected.filter(isSel), options).startsWith('All') ? `All categories (${count})` : `${count} selected`
  const chosen = selectable.filter((o) => isSel(o.key))

  function openCreate(prefill = '') {
    setCreating({ name: prefill.slice(0, MAX_NAME), busy: false, error: '', kind: null })
    setTimeout(() => createRef.current?.focus(), 0)
  }

  function submitCreate(force = false) {
    const name = creating?.name.trim() ?? ''
    if (!name) {
      setCreating((c) => ({ ...c, error: 'Type a category name first.', kind: 'invalid' }))
      return
    }
    // A duplicate of something already here: select it instead of copying.
    const existing = options.find((o) => sameAnswer(o.label, name))
    if (existing && !existing.unavailable) {
      setSelected((prev) => (prev.includes(existing.key) ? prev : [...prev, existing.key]))
      setCreating({ name: '', busy: false, error: `“${existing.label}” already exists — selected it.`, kind: 'info' })
      return
    }
    setCreating((c) => ({ ...c, busy: true, error: '', kind: null }))
    onCreate(name, { force }, (res) => {
      if (res?.ok) {
        const blocked = res.broad === false ? isUnavailable?.({ broad: false }) : null
        if (blocked) {
          setCreating({ name: '', busy: false, error: `Added — but it's ${blocked.charAt(0).toLowerCase()}${blocked.slice(1)}. It's still there for other games.`, kind: 'info' })
          setQuery('')
          return
        }
        setSelected((prev) => (prev.includes(res.key) ? prev : [...prev, res.key]))
        setCreating(
          res.existing
            ? { name: '', busy: false, error: 'That one already exists — selected it.', kind: 'info' }
            : null,
        )
        setQuery('')
        return
      }
      setCreating((c) => ({ ...c, busy: false, error: res?.error ?? 'Something went wrong.', kind: res?.kind ?? 'failed' }))
    })
  }

  const sheetStyle = { maxHeight: `${Math.round(vp.height * 0.85)}px`, height: `${Math.round(vp.height * 0.85)}px` }
  const backdropStyle = { top: `${vp.top}px`, height: `${vp.height}px` }

  return createPortal(
    <div className="cat-backdrop" style={backdropStyle} onClick={onCancel}>
      <div
        className="cat-sheet"
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose categories"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cat-sheet-head">
          <div className="cat-sheet-grab" aria-hidden="true" />
          <input
            ref={searchRef}
            className="input cat-search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            maxLength={MAX_NAME}
            placeholder={`Search ${options.length} categories`}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search categories"
          />
        </div>

        {/* Everything between the pinned search and the pinned footer
            scrolls, so a short viewport (keyboard open) never pushes Done
            off-screen. */}
        <div className={`cat-scroll ${results !== null ? 'cat-scroll-searching' : ''}`}>
          <div className="cat-actions">
            <button
              type="button"
              className="cat-action"
              onClick={() => {
                setSelected(selectable.map((o) => o.key))
                setSuggestRound((n) => n + 1)
              }}
            >
              Select all
            </button>
            <button
              type="button"
              className="cat-action"
              onClick={() => {
                setSelected([])
                setSuggestRound((n) => n + 1)
              }}
            >
              Clear
            </button>
            {onCreate && (
              <button type="button" className="cat-action cat-action-create" onClick={() => openCreate(query.trim())}>
                ＋ Create category
              </button>
            )}
          </div>

          {creating && (
            <div className="cat-create">
              <div className="cat-create-row">
                <input
                  ref={createRef}
                  className="input"
                  type="text"
                  value={creating.name}
                  maxLength={MAX_NAME}
                  placeholder="e.g. Things in a kitchen drawer"
                  disabled={creating.busy}
                  onChange={(e) => setCreating((c) => ({ ...c, name: e.target.value, error: c.kind === 'info' ? '' : c.error }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreate(false)
                  }}
                  aria-label="New category name"
                />
                <button type="button" className="btn btn-primary cat-create-add" onClick={() => submitCreate(false)} disabled={creating.busy || !creating.name.trim()}>
                  {creating.busy ? <LoadingDots /> : 'Add'}
                </button>
              </div>
              {creating.busy && (
                <p className="hint cat-create-msg">
                  Checking “{creating.name.trim()}”{withLetters ? ' and which letters work' : ''}…
                </p>
              )}
              {creating.error && (
                <div className={`cat-create-msg ${creating.kind === 'info' ? 'hint' : 'error'}`}>
                  {creating.error}
                  {creating.kind === 'failed' && (
                    <div className="cat-create-fallback">
                      <button type="button" className="btn btn-text" onClick={() => submitCreate(false)}>
                        Retry
                      </button>
                      <button type="button" className="btn btn-text" onClick={() => submitCreate(true)}>
                        Add anyway
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!creating.busy && (
                <button type="button" className="btn btn-text cat-create-close" onClick={() => setCreating(null)}>
                  Close
                </button>
              )}
            </div>
          )}

          {/* Selection strip */}
          <div className="cat-strip">
            {count === 0 ? (
              <span className="hint">Nothing selected yet.</span>
            ) : count <= 5 ? (
              chosen.map((o) => (
                <span key={o.key} className="cat-chip">
                  {o.label}
                  <button type="button" className="cat-chip-x" onClick={() => remove(o.key)} aria-label={`Remove ${o.label}`}>
                    ×
                  </button>
                </span>
              ))
            ) : (
              <button type="button" className="cat-chip cat-chip-summary" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {countLabel}
                <span className="cat-chip-caret" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
              </button>
            )}
          </div>
          {expanded && count > 5 && (
            <ul className="cat-expanded">
              {chosen.map((o) => (
                <li key={o.key}>
                  <span>{o.label}</span>
                  <button type="button" className="cat-chip-x" onClick={() => remove(o.key)} aria-label={`Remove ${o.label}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

        <div className="cat-results">
          {results === null && (
            <p className="cat-results-label">
              {listed.length ? 'Try these' : 'Everything is selected. Search to find one, or Clear to start fresh.'}
            </p>
          )}
          {results !== null && results.length === 0 && (
            <div className="cat-nomatch">
              <p>
                No match for “{debounced.trim()}”. Create it?
              </p>
              {onCreate && (
                <button type="button" className="btn btn-secondary" onClick={() => openCreate(debounced.trim())}>
                  Create “{debounced.trim().slice(0, MAX_NAME)}”
                </button>
              )}
            </div>
          )}
          <ul className="cat-list">
            {listed.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  className={`cat-item ${isSel(o.key) ? 'cat-item-on' : ''} ${o.unavailable ? 'cat-item-off' : ''}`}
                  onClick={() => toggle(o)}
                  aria-pressed={isSel(o.key)}
                  disabled={Boolean(o.unavailable)}
                >
                  <span className="cat-item-text">
                    <span className="cat-item-name">
                      {o.label}
                      {o.custom && <span className="custom-badge">Custom</span>}
                    </span>
                    <span className="cat-item-tags">
                      {o.unavailable ?? (o.tags.join(' · ') || (o.unverified ? 'letters unverified' : ''))}
                    </span>
                  </span>
                  <span className="cat-check" aria-hidden="true">{isSel(o.key) ? '✓' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        </div>

        <div className="cat-footer">
          <span className={`cat-count ${count === 0 ? 'cat-count-warn' : ''}`}>
            {count === 0 ? 'Pick at least one category' : countLabel}
          </span>
          <button type="button" className="btn btn-start cat-done" onClick={() => onDone(selected.filter(isSel))} disabled={count === 0}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
