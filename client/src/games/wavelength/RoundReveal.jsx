import { useEffect } from 'react'
import Spectrum from './Spectrum'
import CountUp from '../CountUp'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'

const CLS_LABEL = { exact: 'Exact!', close: 'Close', miss: 'Off' }

function shortLabel(name) {
  return (name || '?').trim().slice(0, 3).toUpperCase()
}

export default function RoundReveal({ game, players = [], myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nameOf = (id) => nameById[id] ?? 'Someone'
  const r = game.result
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const { play } = useSound()

  useEffect(() => {
    if (r?.skipped) return
    play('reveal')
    if (r?.exactCount > 0) {
      const t = setTimeout(() => play('correct'), 650) // land the needle first
      return () => clearTimeout(t)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (r?.skipped) {
    return (
      <div className="screen">
        <p className="wyr-round">Round {game.roundIndex + 1} — skipped</p>
        <div className="outcome-banner outcome-lose">
          <div className="outcome-icon">⏭️</div>
          <div className="outcome-title">No clue this round</div>
          <div className="outcome-subtitle">Nobody scored — on to the next one.</div>
        </div>
        <Leaderboard game={game} nameOf={nameOf} colorById={colorById} myId={myId} />
        {isHost ? (
          <button className="btn btn-primary" onClick={onNext}>
            {isLastRound ? 'See Final Results' : 'Next Round'}
          </button>
        ) : (
          <p className="hint center-text waiting">Waiting for the host to continue…</p>
        )}
      </div>
    )
  }

  const guessMarkers = r.rows
    .filter((row) => row.guess != null)
    .map((row) => ({
      id: row.playerId,
      value: row.guess,
      color: colorById[row.playerId],
      label: shortLabel(nameOf(row.playerId)),
      cls: row.cls,
    }))

  return (
    <div className="screen">
      <p className="wyr-round">Round {game.roundIndex + 1} results</p>

      <div className="wv-reveal-head">
        <span className="wv-clue-cat">{r.category}</span>
        <p className="wv-clue-text">"{r.clue}"</p>
        <span className="wv-clue-by">
          <PlayerDot color={colorById[r.clueGiverId]} className="player-cdot-inline" />
          {nameOf(r.clueGiverId)} was aiming for <strong>{r.target}</strong>
        </span>
      </div>

      <Spectrum
        min={r.min}
        max={r.max}
        poleA={r.poleA}
        poleB={r.poleB}
        target={r.target}
        guesses={guessMarkers}
        animate
      />

      <div>
        <span className="label">Guesses</span>
        <div className="wyr-board">
          {r.rows.map((row) => (
            <div
              key={row.playerId}
              className={`wyr-board-row ${row.playerId === myId ? 'wyr-me' : ''}`}
            >
              <span>
                <PlayerDot color={colorById[row.playerId]} className="player-cdot-inline" />
                {nameOf(row.playerId)}
              </span>
              <span className={`wv-guess-chip wv-guess-${row.cls}`}>
                {row.guess == null ? '—' : row.guess}
              </span>
              <span className="wv-cls-tag">{CLS_LABEL[row.cls]}</span>
              <span className="wyr-board-score">{row.points > 0 ? `+${row.points}` : '+0'}</span>
            </div>
          ))}
          <div className={`wyr-board-row wv-giver-row ${r.clueGiverId === myId ? 'wyr-me' : ''}`}>
            <span>
              <PlayerDot color={colorById[r.clueGiverId]} className="player-cdot-inline" />
              {nameOf(r.clueGiverId)} <span className="hint">Clue-Giver</span>
            </span>
            <span className="wv-cls-tag">
              {r.exactCount} exact · {r.closeCount} close
            </span>
            <span className="wyr-board-score">
              {r.giverPoints > 0 ? `+${r.giverPoints}` : '+0'}
            </span>
          </div>
        </div>
      </div>

      <Leaderboard game={game} nameOf={nameOf} colorById={colorById} myId={myId} />

      {isHost ? (
        <button className="btn btn-primary" onClick={onNext}>
          {isLastRound ? 'See Final Results' : 'Next Round'}
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to continue…</p>
      )}
    </div>
  )
}

function Leaderboard({ game, nameOf, colorById, myId }) {
  return (
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
              {nameOf(s.playerId)}
            </span>
            <span className="wyr-board-score">
              <CountUp value={s.score} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
