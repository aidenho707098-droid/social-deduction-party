import { useEffect, useMemo, useState } from 'react'
import { accentName } from '../games/gamePalette'
import { PlayerDot } from '../PlayerDot'
import { playerColorMap } from '../playerColors'
import Confetti from './Confetti'
import { useSound } from '../sound/SoundContext'

const REVEAL_GAP = 850
const FINALE_PAUSE = 1500

function shortName(name) {
  const words = name.split(/\s+/)
  if (words.length >= 2) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4)
  return name.slice(0, 8)
}

function computeBonusStats(history, nameOf) {
  const games = history.filter((h) => !h.skipped)
  if (games.length === 0) return []

  const firsts = {}
  for (const g of games) {
    for (const r of g.ranks) {
      if (r.rank === 1) firsts[r.playerId] = (firsts[r.playerId] ?? 0) + 1
    }
  }
  let mostId = null
  let most = 0
  for (const [pid, c] of Object.entries(firsts)) {
    if (c > most) {
      most = c
      mostId = pid
    }
  }

  let bestId = null
  let bestScore = -Infinity
  let bestGame = ''
  for (const g of games) {
    for (const r of g.ranks) {
      if (r.gameScore > bestScore) {
        bestScore = r.gameScore
        bestId = r.playerId
        bestGame = g.gameName
      }
    }
  }

  const out = []
  if (mostId && most >= 1) {
    out.push({
      icon: '🥇',
      label: 'Most first-place finishes',
      value: `${nameOf(mostId)} · ${most}`,
    })
  }
  if (bestId && bestScore > 0) {
    out.push({
      icon: '🔥',
      label: 'Best single game',
      value: `${nameOf(bestId)} · ${bestScore} in ${bestGame}`,
    })
  }
  return out
}

// The grand finale — final standings revealed lowest-first, building up to
// the champion, with a celebratory moment and a couple of fun bonus stats.
export default function TournamentComplete({ t, players, myId, isHost, onDone }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nameOf = (id) => nameById[id] ?? 'Unknown'
  const accentOf = (id) => {
    const i = players.findIndex((p) => p.id === id)
    return ['violet', 'coral', 'gold'][(i < 0 ? 0 : i) % 3]
  }

  const board = t.leaderboard
  const n = board.length
  const topPoints = n ? board[0].points : 0
  const winnerCount = topPoints > 0 ? board.filter((p) => p.points === topPoints).length : 0
  const nonWinners = n - winnerCount

  const [revealed, setRevealed] = useState(0)
  const [finale, setFinale] = useState(false)
  const { play } = useSound()

  // The big moment — the champion is on screen. Bigger + more celebratory
  // than any per-game win sound.
  useEffect(() => {
    if (!finale) return
    play(winnerCount > 0 ? 'grand-finale' : 'game-over')
  }, [finale, winnerCount, play])

  useEffect(() => {
    const timers = []
    for (let i = 1; i <= nonWinners; i++) {
      timers.push(setTimeout(() => setRevealed(i), 400 + i * REVEAL_GAP))
    }
    timers.push(
      setTimeout(() => setFinale(true), 400 + nonWinners * REVEAL_GAP + FINALE_PAUSE)
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(
    () => computeBonusStats(t.history ?? [], nameOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t.history]
  )

  const winnerNames = board.slice(0, Math.max(winnerCount, 1)).map((r) => nameOf(r.playerId))
  const games = t.history ?? []

  return (
    <div className="screen tour-finale">
      <Confetti run={finale && winnerCount > 0} />

      <p className="tour-intro-kicker">🏆 Tournament complete</p>

      <div className="tour-finale-list">
        {board.map((row, idx) => {
          const isWinner = idx < winnerCount
          const visible = isWinner ? finale : revealed >= n - idx
          if (!visible) return null
          const acc = accentOf(row.playerId)

          if (isWinner) {
            return (
              <div
                key={row.playerId}
                className={`tour-hero tour-hero-${acc} tour-anim-in`}
              >
                <div className="tour-hero-crown">👑</div>
                <div className="tour-hero-name">
                  <PlayerDot
                    color={colorById[row.playerId]}
                    className="player-cdot-inline"
                    onColor
                  />
                  {nameOf(row.playerId)}
                </div>
                <div className="tour-hero-pts">
                  <span className="tour-hero-pts-num">{row.points}</span> pts
                </div>
                <div className="tour-hero-label">
                  {winnerCount > 1 ? 'Shared champions' : 'Champion'}
                </div>
              </div>
            )
          }

          return (
            <div
              key={row.playerId}
              className={`tour-podium-row tour-anim-in ${
                row.playerId === myId ? 'tour-podium-me' : ''
              }`}
            >
              <span className={`tour-podium-rank tour-podium-rank-${acc}`}>{idx + 1}</span>
              <span className="tour-podium-name">
                <PlayerDot color={colorById[row.playerId]} className="player-cdot-inline" />
                {nameOf(row.playerId)}
              </span>
              <span className="tour-podium-pts">{row.points} pts</span>
            </div>
          )
        })}
      </div>

      {finale && winnerCount > 1 && (
        <p className="hint center-text">It's a shared win: {winnerNames.join(' & ')}!</p>
      )}
      {finale && winnerCount === 0 && (
        <p className="hint center-text">Nobody managed to score a point!</p>
      )}

      {finale && stats.length > 0 && (
        <div className="tour-anim-in-slow">
          <span className="label">Bonus stats</span>
          <div className="tour-stats">
            {stats.map((s, i) => (
              <div key={i} className="tour-stat">
                <span className="tour-stat-icon">{s.icon}</span>
                <span className="tour-stat-body">
                  <span className="tour-stat-label">{s.label}</span>
                  <span className="tour-stat-value">{s.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {finale && games.length > 0 && (
        <div className="tour-anim-in-slow">
          <span className="label">How it was built up</span>
          <div className="tour-breakdown">
            {board.map((p) => (
              <div
                key={p.playerId}
                className={`tour-break-card ${p.playerId === myId ? 'tour-break-me' : ''}`}
              >
                <div className="tour-break-head">
                  <span className="tour-break-name">
                    <PlayerDot color={colorById[p.playerId]} className="player-cdot-inline" />
                    {nameOf(p.playerId)}
                  </span>
                  <span className="tour-break-total">
                    <span className="tour-break-total-num">{p.points}</span>
                    <span className="tour-break-total-label">pts</span>
                  </span>
                </div>
                <div className="tour-break-pills">
                  {games.map((g, gi) => {
                    const r = g.ranks.find((x) => x.playerId === p.playerId)
                    const pts = g.skipped ? null : r?.points ?? 0
                    return (
                      <span
                        key={`${g.gameId}-${gi}`}
                        className={`tour-break-pill tour-break-pill-${accentName(g.gameId)} ${
                          pts ? '' : 'tour-break-pill-zero'
                        }`}
                        title={g.gameName}
                      >
                        <span className="tour-break-pill-game">{shortName(g.gameName)}</span>
                        <span className="tour-break-pill-pts">
                          {g.skipped ? '–' : `+${pts}`}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHost ? (
        <button className="btn btn-primary" onClick={onDone}>
          Back to Lobby
        </button>
      ) : (
        <p className="hint center-text waiting">Waiting for the host to return to the lobby…</p>
      )}
    </div>
  )
}
