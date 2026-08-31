import { useEffect, useRef, useState } from 'react'
import Spectrum from './Spectrum'
import NumberInput from './NumberInput'
import { useSound } from '../../sound/SoundContext'
import { HOST_GRACE_SECONDS } from '../timing'

export default function GuessPhase({ game, players = [], myRole, myId, isHost, onGuess, onReveal }) {
  const scale = game.scale
  const iAmGiver = game.clueGiverId === myId
  const giverName =
    players.find((p) => p.id === game.clueGiverId)?.name ?? 'The Clue-Giver'

  const [pick, setPick] = useState(null)
  const [locked, setLocked] = useState(false)
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(() => Math.ceil(game.msLeft / 1000))
  const firedForce = useRef(false)
  const firedBuzz = useRef(false)
  const { play } = useSound()

  useEffect(() => {
    setPick(null)
    setLocked(false)
    setPending(false)
    firedForce.current = false
    firedBuzz.current = false
    setSeconds(Math.ceil(game.msLeft / 1000))
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundIndex])

  // Host advances the round after a short grace past zero, so any
  // auto-locked guesses land first.
  useEffect(() => {
    if (seconds <= -HOST_GRACE_SECONDS && isHost && !firedForce.current) {
      firedForce.current = true
      onReveal()
    }
  }, [seconds, isHost, onReveal])

  // Time's up without locking in — auto-lock whatever's on the slider (or
  // just buzz if nothing was picked).
  useEffect(() => {
    if (seconds <= 0 && !locked && !iAmGiver && !firedBuzz.current) {
      firedBuzz.current = true
      if (pick != null && !pending) {
        setPending(true)
        onGuess(pick, (res) => {
          setPending(false)
          if (res?.ok) {
            setLocked(true)
            play('confirm')
          } else {
            play('wrong')
          }
        })
      } else {
        play('wrong')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, locked, iAmGiver, play])

  const timeUp = seconds <= 0
  const totalSeconds = Math.max(1, Math.round(game.guessMs / 1000))
  const pctTime = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))
  const guessed = game.guessedPlayerIds?.length ?? 0
  const totalGuessers = game.totalGuessers ?? 0

  function lockIn() {
    if (pick == null || pending || timeUp) return
    setPending(true)
    onGuess(pick, (res) => {
      setPending(false)
      if (res?.ok) {
        setLocked(true)
        play('confirm')
      }
    })
  }

  const timerBlock = (
    <>
      <div className="wyr-timer">
        <div className={`wyr-timer-fill ${seconds <= 5 ? 'low' : ''}`} style={{ width: `${pctTime}%` }} />
      </div>
      <p className="hint">
        {timeUp ? "Time's up" : `${seconds}s left`} · {guessed}/{totalGuessers} guessed
      </p>
    </>
  )

  const clueCard = (
    <div className="wv-clue-card">
      <span className="wv-clue-cat">{scale.category}</span>
      <p className="wv-clue-text">"{game.clue}"</p>
      <span className="wv-clue-by">— {giverName}</span>
    </div>
  )

  // --- The Clue-Giver watches (they already know the answer) ---
  if (iAmGiver) {
    return (
      <div className="screen">
        <p className="wyr-round">
          Round {game.roundIndex + 1} of {game.totalRounds} · your clue is out
        </p>
        {timerBlock}
        {clueCard}
        <Spectrum
          min={scale.min}
          max={scale.max}
          poleA={scale.poleA}
          poleB={scale.poleB}
          target={myRole?.wavelength?.target ?? null}
        />
        <p className="hint center-text">
          Everyone else is placing their guess. Sit tight for the reveal.
        </p>
        {isHost && (
          <button className="btn btn-text" onClick={onReveal}>
            Reveal now →
          </button>
        )}
      </div>
    )
  }

  // --- A guesser ---
  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>
      {timerBlock}
      {clueCard}

      <Spectrum
        min={scale.min}
        max={scale.max}
        poleA={scale.poleA}
        poleB={scale.poleB}
        pick={pick}
      />
      <NumberInput
        min={scale.min}
        max={scale.max}
        value={pick}
        onChange={(n) => setPick(n)}
      />

      {locked ? (
        <p className="banner">✓ Guess locked — slide to change it</p>
      ) : (
        <p className="hint center-text">Where on the scale does the clue point?</p>
      )}

      <button
        className="btn btn-primary"
        onClick={lockIn}
        disabled={pick == null || pending || timeUp}
      >
        {locked ? 'Update guess' : 'Lock in guess'}
      </button>

      {isHost && (
        <button className="btn btn-text" onClick={onReveal}>
          Reveal now →
        </button>
      )}
    </div>
  )
}
