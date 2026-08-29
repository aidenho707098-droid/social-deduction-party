import { useEffect, useRef, useState } from 'react'

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

const PROMPT = {
  movies: 'Name the movie',
  tv: 'Name the TV show',
  countries: 'Name the country',
  'video-games': 'Name the video game',
  mashup: 'Two emojis, one word',
}

export default function GuessMovie({ game, isHost, onGuess, onReveal }) {
  const [guess, setGuess] = useState('')
  const [lockedIn, setLockedIn] = useState(false)
  const [lockedPoints, setLockedPoints] = useState(0)
  const [lockedAt, setLockedAt] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [shake, setShake] = useState(false)
  const [pending, setPending] = useState(false)
  // Local elapsed-time driver (ms since the round started). The server
  // pushes a fresh room_update roughly once a second, but we tick locally
  // in between so the countdown and "next emoji" timer stay smooth.
  const [elapsed, setElapsed] = useState(() => game.answerMs - game.msLeft)
  const firedReveal = useRef(false)
  const inputRef = useRef(null)

  const totalEmojis = game.totalEmojis ?? game.emojis.length
  const revealInterval = game.revealIntervalMs ?? 6000
  // We only ever hold the emoji glyphs the server has actually revealed.
  const revealedEmojis = game.emojis
  const allRevealed = revealedEmojis.length >= totalEmojis

  // New round: reset everything and restart the local clock from the
  // server's remaining time. Keyed on roundIndex so it doesn't reset every
  // time someone else guesses (that also pushes a room_update).
  useEffect(() => {
    setGuess('')
    setLockedIn(false)
    setLockedPoints(0)
    setLockedAt(0)
    setAttempted(false)
    setShake(false)
    setPending(false)
    firedReveal.current = false
    setElapsed(game.answerMs - game.msLeft)
    inputRef.current?.focus()
    const timer = setInterval(() => setElapsed((e) => e + 250), 250)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // Snap the local clock back to the server's whenever a push arrives and
  // we've drifted by more than ~1s (network jitter, a slow tab, etc.).
  useEffect(() => {
    const serverElapsed = game.answerMs - game.msLeft
    setElapsed((e) => (Math.abs(e - serverElapsed) > 900 ? serverElapsed : e))
  }, [game.msLeft, game.answerMs])

  const msLeft = Math.max(0, game.answerMs - elapsed)
  const secondsLeft = Math.ceil(msLeft / 1000)
  const timeUp = msLeft <= 0

  // When time runs out, the host's device tells the server to reveal.
  useEffect(() => {
    if (timeUp && isHost && !firedReveal.current) {
      firedReveal.current = true
      onReveal()
    }
  }, [timeUp, isHost, onReveal])

  // Seconds until the next emoji pops (based on the local clock). The Nth
  // extra emoji is due at elapsed === revealInterval * N.
  const nextEmojiInSec = allRevealed
    ? null
    : Math.max(0, Math.ceil((revealInterval * revealedEmojis.length - elapsed) / 1000))

  function submit(e) {
    e?.preventDefault()
    const value = guess.trim()
    if (!value || lockedIn || pending || timeUp) return
    setPending(true)
    onGuess(value, (res) => {
      setPending(false)
      if (res?.correct) {
        setLockedIn(true)
        setLockedPoints(res.points ?? 0)
        setLockedAt(res.revealedAtGuess ?? revealedEmojis.length)
      } else {
        setAttempted(true)
        setShake(true)
        setTimeout(() => setShake(false), 450)
      }
    })
  }

  const totalSeconds = Math.max(1, Math.round(game.answerMs / 1000))
  const pct = Math.max(0, Math.min(100, (msLeft / (totalSeconds * 1000)) * 100))

  const shownCount = revealedEmojis.length
  const stageHint = timeUp
    ? ''
    : shownCount <= 1
    ? 'Guess now for FULL points'
    : shownCount >= totalEmojis
    ? 'All emojis shown — base points'
    : 'Still worth partial points'

  const difficulty = game.currentDifficulty
  const diffLabel = DIFFICULTY_LABEL[difficulty]
  const prompt = PROMPT[game.category] ?? 'Crack the code'

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
        {game.categoryName && <span className="emoji-cat">{game.categoryName}</span>}
        {diffLabel && (
          <span className={`emoji-diff emoji-diff-${difficulty}`}>{diffLabel}</span>
        )}
      </p>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${secondsLeft <= 5 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint">
        {timeUp ? "Time's up" : `${secondsLeft}s left`} · {game.solvedCount}/
        {game.totalPlayers} locked in
      </p>

      <p className="wyr-prompt">{prompt}</p>

      <div className="emoji-clue">
        {Array.from({ length: totalEmojis }).map((_, i) => (
          <span
            key={i}
            className={`emoji-slot ${i < shownCount ? '' : 'emoji-slot-hidden'}`}
          >
            {i < shownCount ? revealedEmojis[i] : '•'}
          </span>
        ))}
      </div>
      <p className="hint center-text emoji-reveal-status">
        {allRevealed
          ? 'All emojis revealed'
          : nextEmojiInSec > 0
          ? `Next emoji in ${nextEmojiInSec}s`
          : 'Revealing…'}
      </p>

      {lockedIn ? (
        <div className="emoji-solved">
          <div className="emoji-solved-title">🔒 Locked in!</div>
          <div className="emoji-solved-points">
            +{lockedPoints} points · guessed at {lockedAt} emoji
            {lockedAt === 1 ? '' : 's'}
          </div>
        </div>
      ) : (
        <form className="emoji-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className={`input ${shake ? 'input-shake' : ''}`}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="go"
            placeholder="Your guess…"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={timeUp || pending}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!guess.trim() || timeUp || pending}
          >
            {timeUp ? "Time's up" : 'Submit guess'}
          </button>
          {!timeUp && <p className="hint center-text">{stageHint}</p>}
        </form>
      )}

      {!lockedIn && attempted && !timeUp && (
        <p className="hint center-text">
          Not quite — keep guessing as more emojis appear.
        </p>
      )}

      {isHost && (
        <button className="btn btn-text" onClick={onReveal}>
          Reveal answer now →
        </button>
      )}
    </div>
  )
}
