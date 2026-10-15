import { useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { useCountdown } from '../alphabetSoup/useCountdown'
import { WORD, shapeOf } from './config'
import { roundLabel } from './labels'
import { PlayerStrip, TimerRing } from './shared'

// The set phase: everyone at once. Pick a prompt (Prompted mode), type one
// word, "Check word". The server's AI check answers with a lock, a
// rejection (and its reason), or "Did you mean …?". Once locked, a waiting
// screen with everyone's status (counts only).
export default function SetWord({ game, priv, myId, nameById, colorById, actions }) {
  const { play } = useSound()
  const [text, setText] = useState('')
  const [localMsg, setLocalMsg] = useState(null)
  const msLeft = useCountdown(game.msLeft ?? 0, `${game.serial}:set`, 250)

  const shape = shapeOf(text)
  const solverName = priv?.solverId ? nameById[priv.solverId] ?? 'Someone' : null
  const prompted = game.mode === 'prompted'
  const chosen = priv?.prompts?.find((p) => p.id === priv.promptId) ?? null
  const lockedCount = game.lockedIds?.length ?? 0
  const total = game.participantIds?.length ?? 0

  function check() {
    if (!shape.ok || priv?.checking) {
      if (shape.problem && shape.problem !== 'empty') setLocalMsg(shape.problem)
      return
    }
    setLocalMsg(null)
    actions.wordHeistCheck(text, (res) => {
      if (res?.locked) play('confirm')
      else if (res && !res.ok && !res.rejected && res.message) setLocalMsg(res.message)
    })
  }

  function answer(yes) {
    actions.wordHeistConfirm(yes, (res) => {
      if (res?.locked) play('confirm')
    })
  }

  const header = (
    <div className="wh-head">
      <div className="wh-head-text">
        <h2 className="wh-title">{priv?.locked ? 'Word locked in' : 'Set your word'}</h2>
        <p className="wh-round">
          {roundLabel(game)}
          {game.speed && <span className="wh-speed"> · Speed Round</span>}
        </p>
      </div>
      <TimerRing msLeft={msLeft} totalMs={game.windowMs} />
    </div>
  )

  if (!priv) {
    return (
      <div className="screen wh-set">
        {header}
        <p className="hint center-text">You&apos;re watching this round.</p>
        <PlayerStrip game={game} myId={myId} nameById={nameById} colorById={colorById} />
      </div>
    )
  }

  // ---- locked: the waiting screen ----
  if (priv.locked) {
    return (
      <div className="screen wh-set">
        {header}
        <div className="wh-mine-card">
          <span className="wh-mine-label">Your word</span>
          <span className="wh-mine-word">{priv.locked.display}</span>
          {chosen && <span className="wh-mine-prompt">{chosen.text}</span>}
          {priv.message && <p className="wh-note">{priv.message}</p>}
          {priv.locked.verified === false && (
            <p className="wh-note">The word check is down, so it went in as typed.</p>
          )}
          {solverName && <p className="wh-mine-solver">{solverName} will try to crack it. Keep it secret!</p>}
        </div>
        <p className="wh-wait-count" aria-live="polite">
          {lockedCount} of {total} locked in
        </p>
        <PlayerStrip game={game} myId={myId} nameById={nameById} colorById={colorById} />
      </div>
    )
  }

  // ---- choosing / typing ----
  const counterTone = !text ? '' : shape.ok ? 'ok' : 'bad'
  const msg = localMsg ?? priv.message
  return (
    <div className="screen wh-set">
      {header}

      {prompted ? (
        <div className="wh-prompts" role="radiogroup" aria-label="Pick a prompt">
          {(priv.prompts ?? []).map((p) => {
            const on = p.id === priv.promptId
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`wh-prompt ${on ? 'wh-prompt-on' : ''}`}
                disabled={!!priv.pending || priv.checking}
                onClick={() => actions.wordHeistPrompt(p.id)}
              >
                <span className="wh-prompt-text">{p.text}</span>
                <span className="wh-prompt-meta">
                  {WORD.min} to {WORD.max} letters
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="wh-free-line">
          Any word you like · {WORD.min} to {WORD.max} letters
        </p>
      )}

      {priv.pending ? (
        <div className="wh-confirm" role="alertdialog" aria-label="Spelling check">
          <p className="wh-confirm-q">
            Did you mean <strong>{priv.pending.grid}</strong>?
          </p>
          <div className="wh-confirm-actions">
            <button type="button" className="btn btn-primary" onClick={() => answer(true)}>
              Yes, lock it in
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => answer(false)}>
              No
            </button>
          </div>
        </div>
      ) : (
        <form
          className="wh-entry"
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
        >
          <label className="label" htmlFor="wh-word">
            {prompted ? (priv.promptId ? 'Your answer' : 'Pick a prompt first') : 'Your secret word'}
          </label>
          <input
            id="wh-word"
            className="input wh-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setLocalMsg(null)
            }}
            maxLength={24}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            disabled={priv.checking || (prompted && !priv.promptId)}
            placeholder={prompted ? 'One word' : 'One word, kept secret'}
          />
          <div className="wh-entry-row">
            <span className={`wh-counter ${counterTone ? `wh-counter-${counterTone}` : ''}`} aria-live="polite">
              {shape.letters} letter{shape.letters === 1 ? '' : 's'} · {WORD.min}–{WORD.max}
            </span>
            <span className="wh-checks">
              {priv.checksLeft} check{priv.checksLeft === 1 ? '' : 's'} left
            </span>
          </div>
          <button
            type="submit"
            className="btn btn-primary wh-check-btn"
            disabled={priv.checking || !shape.ok || (prompted && !priv.promptId)}
          >
            {priv.checking ? 'Checking…' : 'Check word'}
          </button>
        </form>
      )}

      {msg && !priv.pending && (
        <p className="wh-reject" role="status">
          {msg}
        </p>
      )}
      {!shape.ok && shape.problem !== 'empty' && !msg && <p className="wh-shape-hint">{shape.problem}</p>}

      {solverName && <p className="wh-solver-line">{solverName} will try to crack your word.</p>}
      <PlayerStrip game={game} myId={myId} nameById={nameById} colorById={colorById} />
    </div>
  )
}
