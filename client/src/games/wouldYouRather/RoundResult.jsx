import { useEffect, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'

const OPTION_CLASSES = ['wyr-a', 'wyr-b', 'wyr-c', 'wyr-d']

// Counts from 0 up to `target` over ~750ms once `run` flips true, after an
// optional stagger. Drives the "% building up" feel alongside the CSS bar
// growth so the numbers and the bars land together.
function useCountUp(target, run, delayMs = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return undefined
    let raf
    let startedAt
    const duration = 750
    const timer = setTimeout(() => {
      const step = (ts) => {
        if (startedAt === undefined) startedAt = ts
        const p = Math.min(1, (ts - startedAt) / duration)
        const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
        setValue(Math.round(target * eased))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delayMs)
    return () => {
      clearTimeout(timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target, run, delayMs])
  return value
}

// Remounted every round (its key includes the round index), so the reveal
// animation replays fresh each time results come in.
function ResultOption({ option, index, majorityTag, authors, nameById, colorById }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const shownPct = useCountUp(option.pct, revealed, index * 110)

  return (
    <div
      className={`wyr-result-option ${option.cls} ${option.isMajority ? 'wyr-majority' : ''}`}
    >
      <div className="wyr-result-head">
        <span className="wyr-badge-letter">{option.key}</span>
        <span>{option.text}</span>
        <span className="wyr-result-pct">{shownPct}%</span>
      </div>
      <div className="wyr-bar">
        <div
          className={`wyr-bar-fill ${option.cls}`}
          style={{
            width: revealed ? `${option.pct}%` : '0%',
            transitionDelay: `${index * 0.11}s`,
          }}
        />
      </div>
      <span className="wyr-majority-tag">
        {option.count} {option.count === 1 ? 'vote' : 'votes'}
        {option.isMajority && majorityTag ? ` · ${majorityTag}` : ''}
      </span>
      {authors && authors.length > 0 && (
        <span className="wyr-author-line">
          written by{' '}
          {authors.map((pid, i) => (
            <span key={pid} className="wyr-author">
              <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
              {nameById[pid] ?? 'Unknown'}
              {i < authors.length - 1 ? ' & ' : ''}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

export default function RoundResult({ game, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const {
    counts,
    totalAnswered,
    majorityKey,
    majorityPct,
    tie,
    tierPoints,
    answers,
    roundScores,
    custom,
    authorsByKey,
    crowdPleaserIds,
  } = game.result
  const isLastRound = game.roundIndex + 1 >= game.totalRounds

  const options = game.question.options.map((text, i) => {
    const key = String.fromCharCode(65 + i)
    const count = counts[key] ?? 0
    return {
      key,
      text,
      count,
      pct: totalAnswered ? Math.round((count / totalAnswered) * 100) : 0,
      cls: OPTION_CLASSES[i],
      isMajority: key === majorityKey,
    }
  })

  const majorityPctRounded = Math.round(majorityPct * 100)
  let majorityTag = ''
  if (majorityKey) {
    majorityTag =
      tierPoints > 0
        ? `${majorityPctRounded}% majority → +${tierPoints}`
        : `${majorityPctRounded}% — top pick`
  }

  const crowdPleaserNames = (crowdPleaserIds ?? []).map((pid) => nameById[pid] ?? 'Unknown')

  return (
    <div className="screen">
      <p className="wyr-round">Round {game.roundIndex + 1} results</p>

      <p className="wyr-prompt">{game.question.prompt}</p>

      <div className="wyr-choices">
        {options.map((o, i) => (
          <ResultOption
            key={`${game.roundIndex}-${o.key}`}
            option={o}
            index={i}
            majorityTag={majorityTag}
            authors={custom ? authorsByKey?.[o.key] : null}
            nameById={nameById}
            colorById={colorById}
          />
        ))}
      </div>

      {custom && crowdPleaserNames.length > 0 && (
        <p className="wyr-crowd-pleaser">
          👑 Crowd Pleaser: <strong>{crowdPleaserNames.join(' & ')}</strong> +1
        </p>
      )}

      {totalAnswered === 0 ? (
        <p className="hint center-text">No one answered this round.</p>
      ) : tie ? (
        <p className="hint center-text">It's a tie — no majority points this round.</p>
      ) : tierPoints === 0 ? (
        <p className="hint center-text">
          Top pick only got {majorityPctRounded}% — need 51%+ to score majority points.
        </p>
      ) : null}

      <div>
        <span className="label">Who picked what</span>
        <div className="wyr-board">
          {players.map((p) => {
            const pick = answers[p.id]
            const rs = roundScores[p.id]
            return (
              <div
                key={p.id}
                className={`wyr-board-row ${p.id === myId ? 'wyr-me' : ''}`}
              >
                <span>
                  <PlayerDot color={colorById[p.id]} className="player-cdot-inline" />
                  {p.name}
                </span>
                <span
                  className={`wyr-pick-chip ${pick ? `wyr-${pick.toLowerCase()}` : 'wyr-none'}`}
                >
                  {pick ?? '—'}
                </span>
                {rs && rs.total > 0 && (
                  <span
                    className="wyr-plus"
                    title={[
                      rs.base > 0 ? `+${rs.base} majority` : null,
                      rs.bonus > 0 ? `+${rs.bonus} streak` : null,
                      rs.crowdPleaser > 0 ? `+${rs.crowdPleaser} crowd pleaser` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  >
                    +{rs.total}
                    {rs.bonus > 0 && ' 🔥'}
                    {rs.crowdPleaser > 0 && ' 👑'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <span className="label">Leaderboard</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div
              key={s.playerId}
              className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span className="wyr-board-rank">{i + 1}</span>
              <span>
                <PlayerDot color={colorById[s.playerId]} className="player-cdot-inline" />
                {nameById[s.playerId] ?? 'Unknown'}
              </span>
              {s.streak >= 2 && <span className="wyr-streak">🔥{s.streak}</span>}
              <span className="wyr-board-score">{s.score}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onNext}>
          {isLastRound ? 'See Final Results' : 'Next Round'}
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
