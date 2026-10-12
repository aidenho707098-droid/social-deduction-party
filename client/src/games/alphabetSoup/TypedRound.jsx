import { useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { RoundPrompt } from './LetterTile'
import AlphabetStrip from './AlphabetStrip'
import { useCountdown } from './useCountdown'
import { cleanAnswer, sameAnswer, startsWithLetter } from './answerChecks'

// Typed mode: answers go in ONE AT A TIME. Each one is locked the moment
// it's sent (no editing, no removing), lands in your own list with an
// "n / 5" counter, and the input clears for the next. The category check
// runs in the background — a pending dot on that answer flips to ✓ / ✗
// when the server's verdict arrives — and never blocks typing.
//
// Other players are shown as COUNTS only ("Sam 3/5"); their answers are
// never sent to this device until the round is over.

const CLIENT_REJECT = {
  letter: (L) => `Doesn't start with ${L}.`,
  duplicate: () => 'You already said that one.',
  short: () => "That's too short to be an answer.",
}

// The instant checks, mirrored from the server so a bounce is immediate.
function localCheck(text, letter, mine) {
  const clean = cleanAnswer(text)
  if (!clean) return { ok: false }
  if (clean.replace(/[^a-z0-9]/gi, '').length < 2) return { ok: false, message: CLIENT_REJECT.short() }
  if (!startsWithLetter(clean, letter)) return { ok: false, message: CLIENT_REJECT.letter(letter) }
  if (mine.some((a) => sameAnswer(a.text, clean))) return { ok: false, message: CLIENT_REJECT.duplicate() }
  return { ok: true, text: clean }
}

export default function TypedRound({ game, players, myId, myRole, actions }) {
  const { play } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const answering = game.phase === 'answer'
  const cap = game.answerCap ?? 5

  const msLeft = useCountdown(game.msLeft ?? 0, `${game.roundIndex}:${game.phase}`)
  const secondsLeft = Math.ceil(msLeft / 1000)
  const pct = Math.max(0, Math.min(100, (msLeft / Math.max(1, game.answerMs ?? 40000)) * 100))
  const timeUp = answering && msLeft <= 0

  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  // Acked answers not yet reflected in the private state (it follows the
  // ack by a few ms) — merged in so the list never flickers.
  const [optimistic, setOptimistic] = useState([])
  // Sent but not yet acked. Never blocks the next answer: the box clears
  // the instant Enter is pressed, however slow the network is, and the
  // repeat / cap checks count these too. (A ref as well as state, so two
  // Enters inside one render still see each other.)
  const [inFlight, setInFlight] = useState([])
  const inFlightRef = useRef([])
  const sendSeq = useRef(0)
  const autoFiredRef = useRef(false)
  const inputRef = useRef(null)

  const priv = myRole?.alphabetSoup?.roundIndex === game.roundIndex ? myRole.alphabetSoup : null
  const serverList = priv?.answers ?? []
  const acked = [
    ...serverList,
    ...optimistic.filter((o) => !serverList.some((a) => a.id === o.id)),
  ]
  const mine = [...acked, ...inFlight.map((f) => ({ id: f.tempId, text: f.text, status: 'pending' }))]
  const iAmDone = Boolean(priv?.done) || mine.length >= cap
  const canType = answering && !timeUp && !iAmDone

  function send(raw, { auto = false } = {}) {
    const pending = inFlightRef.current
    if (acked.length + pending.length >= cap) return
    const check = localCheck(raw, game.letter, [...acked, ...pending])
    if (!check.ok) {
      if (!auto && check.message) setMessage(check.message)
      return
    }
    sendSeq.current += 1
    const entry = { tempId: `tmp${sendSeq.current}`, text: check.text }
    inFlightRef.current = [...pending, entry]
    setInFlight(inFlightRef.current)
    setText('')
    setMessage('')
    actions.alphabetSoupSubmit(check.text, (res) => {
      inFlightRef.current = inFlightRef.current.filter((f) => f !== entry)
      setInFlight(inFlightRef.current)
      if (res?.ok) {
        setOptimistic((o) => [...o, res.answer])
        play('confirm')
      } else if (!auto && res?.message) {
        setMessage(`“${check.text}”: ${res.message}`)
      }
    })
    inputRef.current?.focus()
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!canType) return
    send(text)
  }

  // Time's up: whatever's sitting in the box goes in, if it passes the checks.
  useEffect(() => {
    if (!timeUp || autoFiredRef.current) return
    autoFiredRef.current = true
    if (text.trim() && !iAmDone) send(text, { auto: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  const others = (game.progress ?? []).filter((p) => p.playerId !== myId)

  return (
    <div className="screen as-round">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>
      <RoundPrompt game={game} />

      {answering ? (
        <>
          <div className="wyr-timer">
            <div className={`wyr-timer-fill ${secondsLeft <= 8 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="hint center-text">{timeUp ? "Time's up!" : `${secondsLeft}s left`}</p>
        </>
      ) : (
        <p className="hint center-text as-checking">Checking everyone's answers…</p>
      )}

      {game.burnedOn && (
        <AlphabetStrip pool={game.letterPool} burned={game.burnedLetters} current={game.letter} />
      )}

      <form className="as-answer-form" onSubmit={onSubmit}>
        <div className="as-answer-row">
          <input
            ref={inputRef}
            className="input"
            type="text"
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="send"
            maxLength={40}
            placeholder={canType ? `Something starting with ${game.letter}…` : iAmDone ? "You're done!" : ''}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (message) setMessage('')
            }}
            disabled={!canType}
          />
          <button type="submit" className="btn btn-primary as-submit" disabled={!canType || !text.trim()}>
            Submit
          </button>
        </div>
        <p className={`as-reject ${message ? 'as-reject-in' : ''}`} role="status" aria-live="polite">
          {message || ' '}
        </p>
      </form>

      <div className="as-mine">
        <div className="as-mine-head">
          <span className="label">Your answers</span>
          <span className="as-counter">
            {mine.length} / {cap}
          </span>
        </div>
        {mine.length === 0 ? (
          <p className="hint">Each answer locks in as soon as you send it.</p>
        ) : (
          <ol className="as-mine-list">
            {mine.map((a) => (
              <li key={a.id} className={`as-mine-item as-mine-${a.status}`}>
                <span className="as-mine-text">{a.text}</span>
                <StatusMark status={a.status} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {answering && !iAmDone && (
        <button type="button" className="btn btn-secondary" onClick={() => actions.alphabetSoupDone()}>
          I'm done
        </button>
      )}

      {others.length > 0 && (
        <div>
          <span className="label">Everyone else</span>
          <div className="as-progress">
            {others.map((p) => (
              <span key={p.playerId} className={`as-progress-chip ${p.done ? 'as-progress-done' : ''}`}>
                <PlayerDot color={colorById[p.playerId]} />
                <span className="as-progress-name">{nameById[p.playerId] ?? 'Player'}</span>
                <span className="as-progress-count">
                  {p.done && answering ? 'Done' : `${p.count}/${cap}`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusMark({ status }) {
  if (status === 'valid') {
    return (
      <span className="as-mark as-mark-ok" aria-label="accepted">
        ✓
      </span>
    )
  }
  if (status === 'invalid') {
    return (
      <span className="as-mark as-mark-no" aria-label="doesn't fit the category">
        ✕
      </span>
    )
  }
  return <span className="as-mark as-mark-pending" aria-label="checking" />
}
