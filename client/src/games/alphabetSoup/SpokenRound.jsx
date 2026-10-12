import { useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { RoundPrompt } from './LetterTile'
import AlphabetStrip from './AlphabetStrip'
import { useCountdown } from './useCountdown'

// Spoken mode: turn-based elimination. The active player says an answer
// OUT LOUD and taps "Said it" before their ring runs out; then everyone
// else gets a 5s window to Challenge, and a challenge goes to a 5s room
// vote. Every action carries the server's `turnSeq`, so a tap that raced
// the buzzer can never land on the next player's turn.

const EVENT_COPY = {
  timeout: (n) => `${n} ran out of time — loses a life`,
  upheld: (n) => `Challenge upheld — ${n} loses a life`,
  overruled: (n) => `Challenge failed — ${n}'s answer stands`,
  accepted: () => null,
  skipped: (n) => `${n} didn't make it back — turn skipped`,
  left: (n) => `${n} left the game`,
}

export default function SpokenRound({ game, players, myId, myRole, actions }) {
  const { play } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nm = (id) => nameById[id] ?? 'Player'

  const active = game.activePlayerId
  const amActive = active === myId
  const sub = game.subPhase // turn | challenge | vote | waiting
  const msLeft = useCountdown(game.msLeft ?? 0, `${game.turnSeq}:${sub}`, 50)
  const myLives = game.lives?.[myId] ?? 0
  const amOut = (game.roundPlayerIds ?? []).includes(myId) && myLives <= 0
  const used = game.challengesUsed?.[myId] ?? 0
  const challengesLeft = Math.max(0, (game.challengeLimit ?? 2) - used)
  const myVote =
    myRole?.alphabetSoup?.turnSeq === game.turnSeq ? myRole.alphabetSoup.myVote : null

  const [pending, setPending] = useState(false)
  const [note, setNote] = useState('')
  const [seq, setSeq] = useState(game.turnSeq)
  if (seq !== game.turnSeq) {
    setSeq(game.turnSeq)
    setPending(false)
    setNote('')
  }

  // A short-lived banner for whatever just happened to the previous turn.
  const [toast, setToast] = useState(null)
  const lastEventKey = game.lastEvent ? `${game.lastEvent.seq}:${game.lastEvent.type}` : null
  const seenEvent = useRef(lastEventKey)
  useEffect(() => {
    if (!lastEventKey || seenEvent.current === lastEventKey) return
    seenEvent.current = lastEventKey
    const e = game.lastEvent
    const text = EVENT_COPY[e.type]?.(e.playerId === myId ? 'You' : nm(e.playerId))
    if (e.type === 'timeout' || e.type === 'upheld') play('wrong')
    if (!text) return undefined
    setToast(text)
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEventKey])

  function act(fn, ...args) {
    if (pending) return
    setPending(true)
    fn(...args, game.turnSeq, (res) => {
      setPending(false)
      if (!res?.ok && res?.message) setNote(res.message)
    })
  }

  const ringLabel =
    sub === 'turn'
      ? amActive
        ? 'Say it!'
        : `${nm(active)}'s turn`
      : sub === 'challenge'
        ? 'Challenge window'
        : sub === 'vote'
          ? 'Vote!'
          : 'Reconnecting…'

  return (
    <div className="screen as-round as-spoken">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds} · {Math.round((game.turnWindowMs ?? 10000) / 1000)}s turns
      </p>
      <RoundPrompt game={game} size={amActive ? 'lg' : 'md'} />

      {toast && <div className="as-toast">{toast}</div>}

      <CountdownRing
        msLeft={msLeft}
        totalMs={game.turnMs}
        label={ringLabel}
        tone={sub === 'turn' ? (amActive ? 'hot' : 'base') : sub === 'vote' ? 'coral' : 'calm'}
        big={amActive}
      />

      {/* --- the active player's own controls --- */}
      {amActive && sub === 'turn' && (
        <button
          type="button"
          className="btn btn-start as-said-it"
          onClick={() => act(actions.alphabetSoupSaidIt)}
          disabled={pending || msLeft <= 0}
        >
          🗣️ Said it
        </button>
      )}
      {amActive && sub === 'challenge' && (
        <p className="hint center-text">Nice — waiting to see if anyone challenges…</p>
      )}
      {amActive && sub === 'vote' && (
        <p className="as-callout as-callout-coral">
          {nm(game.challenge?.challengerId)} challenged you! The room is voting…
        </p>
      )}

      {/* --- everyone else --- */}
      {!amActive && sub === 'turn' && (
        <p className="hint center-text">
          <PlayerDot color={colorById[active]} className="player-cdot-inline" />
          <strong>{nm(active)}</strong> is answering out loud…
        </p>
      )}
      {!amActive && sub === 'challenge' && (
        <div className="as-challenge-box">
          <p className="hint center-text">
            Wrong letter, doesn't fit, or a repeat? Challenge it.
          </p>
          <button
            type="button"
            className="btn btn-secondary as-challenge-btn"
            onClick={() => act(actions.alphabetSoupChallenge)}
            disabled={pending || amOut || challengesLeft <= 0}
          >
            ✋ Challenge
          </button>
          <p className="hint center-text">
            {amOut
              ? "You're out — you can still vote on challenges."
              : `${challengesLeft} challenge${challengesLeft === 1 ? '' : 's'} left this round`}
          </p>
        </div>
      )}
      {!amActive && sub === 'vote' && (
        <div className="as-challenge-box">
          <p className="as-callout as-callout-coral">
            {game.challenge?.challengerId === myId ? 'You' : nm(game.challenge?.challengerId)} challenged{' '}
            {nm(active)}’s answer. Was it bad?
          </p>
          {game.challenge?.challengerId === myId ? (
            <p className="hint center-text">Your challenge counts as a vote to uphold.</p>
          ) : myVote == null ? (
            <div className="as-vote-btns">
              <button type="button" className="btn btn-primary" onClick={() => act(actions.alphabetSoupChallengeVote, true)} disabled={pending}>
                Uphold — it was bad
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => act(actions.alphabetSoupChallengeVote, false)} disabled={pending}>
                It's fine
              </button>
            </div>
          ) : (
            <p className="hint center-text">You voted {myVote ? 'to uphold' : "that it's fine"}.</p>
          )}
          <p className="hint center-text">
            {game.challenge?.votedIds?.length ?? 0} of {(game.challenge?.voterCount ?? 0)} voted · ties go to {nm(active)}
          </p>
        </div>
      )}
      {sub === 'waiting' && (
        <p className="as-callout">
          Waiting for {nm(active)} to reconnect — their turn is skipped if they're not back in{' '}
          {Math.ceil(msLeft / 1000)}s.
        </p>
      )}
      {note && <p className="error">{note}</p>}

      {game.burnedOn && (
        <AlphabetStrip pool={game.letterPool} burned={game.burnedLetters} current={game.letter} />
      )}

      <LivesBoard game={game} players={players} myId={myId} nm={nm} colorById={colorById} />
    </div>
  )
}

// Every player's lives, in turn order, with whose turn it is marked.
function LivesBoard({ game, myId, nm, colorById }) {
  const start = game.startLives ?? 3
  return (
    <div>
      <span className="label">Lives</span>
      <div className="as-lives">
        {(game.turnOrder ?? []).map((pid) => {
          const lives = game.lives?.[pid] ?? 0
          const out = lives <= 0
          return (
            <div
              key={pid}
              className={`as-lives-row ${pid === game.activePlayerId ? 'as-lives-active' : ''} ${
                out ? 'as-lives-out' : ''
              } ${pid === myId ? 'wyr-me' : ''}`}
            >
              <span className="as-lives-name">
                <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
                {nm(pid)}
                {pid === myId && ' (you)'}
              </span>
              <span className="as-hearts" aria-label={`${lives} lives`}>
                {out
                  ? 'OUT'
                  : Array.from({ length: start }, (_, i) => (
                      <span key={i} className={`as-heart ${i < lives ? '' : 'as-heart-lost'}`}>
                        ♥
                      </span>
                    ))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// A big circular countdown. The arc is an SVG stroke whose dash offset
// follows the time left; the number sits in the middle. Hidden (with the
// other timers) under Countdown Chaos.
function CountdownRing({ msLeft, totalMs, label, tone = 'base', big = false }) {
  const R = 52
  const C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(1, msLeft / Math.max(1, totalMs ?? 1)))
  const secs = Math.ceil(msLeft / 1000)
  return (
    <div className={`as-ring-wrap ${big ? 'as-ring-big' : ''} as-ring-${tone} ${secs <= 3 ? 'as-ring-low' : ''}`}>
      <svg viewBox="0 0 120 120" className="as-ring-svg" aria-hidden="true">
        <circle cx="60" cy="60" r={R} className="as-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className="as-ring-progress"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
        />
      </svg>
      <div className="as-ring-center">
        <span className="as-ring-count">{secs}</span>
        <span className="as-ring-label">{label}</span>
      </div>
    </div>
  )
}
