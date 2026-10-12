import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../sound/SoundContext'

// The active player's own screen — they can't see the "?" card's answer
// (nobody can, it's not even sent to them), only ask yes/no questions out
// loud and tap what the group said, or commit to typing a guess.
export default function AskScreen({ game, myRole, onAsk, onStartGuess, onGuess }) {
  const subPhase = game.subPhase // 'asking' | 'guessing'
  const windowMs = subPhase === 'guessing' ? game.guessMs : game.questionMs
  const category = myRole?.whoAmI?.myCategory

  const [msLeft, setMsLeft] = useState(game.msLeft ?? windowMs)
  const [guessText, setGuessText] = useState('')
  const [pending, setPending] = useState(false)

  const { play } = useSound()
  const firedTimeoutGuess = useRef(false)

  // A fresh "turn instance" for THIS player is either a new round, or a
  // flip between asking <-> guessing — reset transient UI synchronously
  // during render (same technique as Taboo's GuessRound), so the very
  // first render after the flip never shows stale state.
  const turnToken = `${game.roundIndex}:${subPhase}`
  const turnTokenRef = useRef(turnToken)
  if (turnTokenRef.current !== turnToken) {
    turnTokenRef.current = turnToken
    setGuessText('')
    setPending(false)
    firedTimeoutGuess.current = false
    setMsLeft(game.msLeft ?? windowMs)
  }

  useEffect(() => {
    const t = setInterval(() => setMsLeft((m) => Math.max(0, m - 250)), 250)
    return () => clearInterval(t)
  }, [turnToken])

  // Snap to the server's clock whenever it jumps by more than ~1s — covers
  // both a "Yes" reset (asking) and the asking -> guessing hand-off.
  useEffect(() => {
    setMsLeft((m) => (Math.abs(m - game.msLeft) > 900 ? game.msLeft : m))
  }, [game.msLeft])

  const secondsLeft = Math.ceil(msLeft / 1000)
  const timeUp = msLeft <= 0
  const pct = Math.max(0, Math.min(100, (msLeft / Math.max(1, windowMs)) * 100))
  const questionNumber = Math.min((game.activeQuestionsAsked ?? 0) + 1, game.questionCap)

  function tapAnswer(answer) {
    if (pending || timeUp || subPhase !== 'asking') return
    setPending(true)
    onAsk(answer, () => setPending(false))
  }

  function tapGuessButton() {
    if (pending || subPhase !== 'asking') return
    onStartGuess()
  }

  function submitGuess(e) {
    e?.preventDefault()
    const value = guessText.trim()
    if (!value || pending || firedTimeoutGuess.current) return
    setPending(true)
    onGuess(value, (res) => {
      setPending(false)
      play(res?.correct ? 'correct' : 'wrong')
    })
  }

  // Time's up while guessing and nothing was ever sent — auto-submit
  // whatever's typed (even if that's nothing).
  useEffect(() => {
    if (subPhase !== 'guessing' || !timeUp || firedTimeoutGuess.current) return
    firedTimeoutGuess.current = true
    const value = guessText.trim()
    setPending(true)
    onGuess(value, (res) => {
      setPending(false)
      play(res?.correct ? 'correct' : 'wrong')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPhase, timeUp])

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
        {category && <span className="emoji-cat">{category}</span>}
      </p>
      <h1 className="title center-text">Who are you?</h1>

      <div className="wyr-timer">
        <div
          className={`wyr-timer-fill ${secondsLeft <= 8 ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="hint center-text">
        {subPhase === 'guessing'
          ? timeUp
            ? 'Submitting…'
            : `${secondsLeft}s to type your guess`
          : timeUp
            ? "Time's up — passing the turn…"
            : `${secondsLeft}s left · Question ${questionNumber} of ${game.questionCap}`}
      </p>

      <div className="wai-mystery-card">
        <span className="wai-mystery-mark">?</span>
      </div>

      {subPhase === 'asking' ? (
        <>
          <p className="hint center-text">
            Ask a yes/no question out loud, then tap what the group said.
          </p>
          <div className="wai-yesno">
            <button
              type="button"
              className="btn btn-primary wai-yes"
              onClick={() => tapAnswer('yes')}
              disabled={pending || timeUp}
            >
              ✅ Yes — keep your turn
            </button>
            <button
              type="button"
              className="btn btn-secondary wai-no"
              onClick={() => tapAnswer('no')}
              disabled={pending || timeUp}
            >
              ❌ No — pass the turn
            </button>
          </div>
          <button
            type="button"
            className="btn btn-start"
            onClick={tapGuessButton}
            disabled={pending}
          >
            🎯 Guess
          </button>
        </>
      ) : (
        <form className="emoji-form" onSubmit={submitGuess}>
          <input
            className="input"
            type="text"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="go"
            placeholder="Who am I?"
            value={guessText}
            onChange={(e) => setGuessText(e.target.value)}
            disabled={pending || timeUp}
          />
          <button type="submit" className="btn btn-primary" disabled={!guessText.trim() || pending}>
            {timeUp ? "Time's up" : 'Lock in guess'}
          </button>
          <p className="hint center-text">
            Spelling doesn't have to be perfect. Wrong guesses pass the turn
            — same as a "No".
          </p>
        </form>
      )}
    </div>
  )
}
