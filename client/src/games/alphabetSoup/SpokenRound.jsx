import { useEffect, useRef, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { RoundPrompt } from './LetterTile'
import AlphabetStrip from './AlphabetStrip'
import { useCountdown } from './useCountdown'

// Spoken mode: turn-based elimination. The active player says an answer
// OUT LOUD and taps "Said it" before their ring runs out — the turn passes
// straight to the next player. Until that player answers (or runs out of
// time), anyone else still in can Challenge the answer: the clock freezes
// for a 5s room vote, then picks up where it stopped. Every action carries
// the server's `turnSeq` (or, for a challenge, the answer's own seq), so a
// tap that raced the buzzer can never land on the wrong turn or answer.

const EVENT_COPY = {
  timeout: (n) => `${n} ran out of time — loses a life`,
  upheld: (n, e) => `Challenge upheld — ${n} ${e.eliminated ? 'is out' : 'loses a life'}`,
  overruled: (n) => `Challenge failed — ${n}'s answer stands`,
  said: () => null,
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
  const sub = game.subPhase // turn | vote | waiting
  const msLeft = useCountdown(game.msLeft ?? 0, `${game.turnSeq}:${sub}`, 50)
  const myLives = game.lives?.[myId] ?? 0
  const amOut = (game.roundPlayerIds ?? []).includes(myId) && myLives <= 0
  const used = game.challengesUsed?.[myId] ?? 0
  const challengesLeft = Math.max(0, (game.challengeLimit ?? 2) - used)
  const myVote =
    myRole?.alphabetSoup?.turnSeq === game.turnSeq ? myRole.alphabetSoup.myVote : null
  const target = game.lastAnswer // the answer a Challenge would hit now, or null
  const aliveCount = (game.turnOrder ?? []).filter((pid) => (game.lives?.[pid] ?? 0) > 0).length
  // The active player may only challenge in a two-player endgame (otherwise
  // nobody could). Same rules the server enforces.
  // null = no Challenge button at all (the active player, unless only two
  // are left); '' = enabled; any other string = disabled, with the reason.
  const challengeBlock = amActive && aliveCount > 2
    ? null
    : !target
      ? (game.turnSeq ?? 0) <= 1
        ? 'Nothing to challenge yet — this is the first turn.'
        : 'No answer to challenge right now.'
      : target.playerId === myId
        ? 'That was your answer.'
        : amOut
          ? "You're out — you can still vote on challenges."
          : challengesLeft <= 0
            ? "You're out of challenges this round."
            : sub === 'vote'
              ? 'A vote is already running.'
              : ''
  const ch = game.challenge
  const iCanVote = sub === 'vote' && ch && ch.answererId !== myId && (game.roundPlayerIds ?? []).includes(myId)

  const [pending, setPending] = useState(false)
  const canChallenge = challengeBlock === '' && !pending
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
    const text = EVENT_COPY[e.type]?.(e.playerId === myId ? 'You' : nm(e.playerId), e)
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

  function raiseChallenge() {
    if (!canChallenge) return
    setPending(true)
    actions.alphabetSoupChallenge(target.seq, (res) => {
      setPending(false)
      if (!res?.ok && res?.message) setNote(res.message)
    })
  }

  const ringLabel =
    sub === 'turn'
      ? amActive
        ? 'Say it!'
        : `${nm(active)}'s turn`
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

      {sub === 'vote' && ch && (
        <p className="hint center-text">
          ⏸ {ch.frozenSubPhase === 'turn' ? `${amActive ? 'Your' : `${nm(active)}'s`} turn` : 'The turn'} is paused at{' '}
          {Math.ceil((ch.frozenMsLeft ?? 0) / 1000)}s while the room votes.
        </p>
      )}

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

      {!amActive && sub === 'turn' && (
        <p className="hint center-text">
          <PlayerDot color={colorById[active]} className="player-cdot-inline" />
          <strong>{nm(active)}</strong> is answering out loud…
        </p>
      )}

      {/* --- the vote (everyone but the challenged answerer) --- */}
      {sub === 'vote' && ch && (
        <div className="as-challenge-box">
          <p className="as-callout as-callout-coral">
            {ch.challengerId === myId ? 'You' : nm(ch.challengerId)} challenged{' '}
            {ch.answererId === myId ? 'your' : `${nm(ch.answererId)}’s`} answer.
            {ch.answererId === myId ? ' The room is voting…' : ' Was it bad?'}
          </p>
          {iCanVote &&
            (ch.challengerId === myId ? (
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
            ))}
          <p className="hint center-text">
            {ch.votedIds?.length ?? 0} of {ch.voterCount ?? 0} voted · ties go to {nm(ch.answererId)}
          </p>
        </div>
      )}

      {/* --- Challenge: always on screen for everyone but the active player
          (who only gets it in a two-player endgame); disabled when there's
          nothing they may challenge. --- */}
      {challengeBlock !== null && sub !== 'vote' && (
        <div className="as-challenge-box">
          <button
            type="button"
            className="btn btn-secondary as-challenge-btn"
            onClick={raiseChallenge}
            disabled={!canChallenge}
          >
            ✋ Challenge{target && target.playerId !== myId ? ` ${nm(target.playerId)}'s answer` : ''}
          </button>
          <p className="hint center-text">
            {challengeBlock ||
              `Wrong letter, doesn't fit, or a repeat? ${challengesLeft} challenge${challengesLeft === 1 ? '' : 's'} left this round.`}
          </p>
          {challengeBlock === '' && game.category?.blockNumberedSequels && (
            <p className="hint center-text">A numbered sequel of a title you already used counts as a repeat.</p>
          )}
          {challengeBlock === '' && game.category?.blockRepeatedLeadWord && (
            <p className="hint center-text">Don't reuse the first word of an earlier answer.</p>
          )}
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
