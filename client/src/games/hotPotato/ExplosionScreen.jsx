import { useEffect } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import Leaderboard from '../alphabetSoup/Leaderboard'
import CycleStrip from './CycleStrip'
import { Potato } from './Potato'
import { buzz } from './usePotatoSounds'
import { useClock } from './useClock'

const CAUSE = {
  timeout: 'Too slow to pass.',
  fuse: 'The fuse ran out.',
  challenge: 'Challenge upheld: that answer didn\'t count.',
  left: 'Not enough players left to keep passing.',
}

const PLACE = ['1st', '2nd', '3rd', '4th']

// The pop: the potato bursts, "[Name] exploded!", what it cost them, then
// the standings, and either the next potato (automatic) or, after the
// last explosion of an Elimination match, the host starts the next match.
export default function ExplosionScreen({ game, players, myId, isHost, actions }) {
  const { play, muted } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const r = game.explosion ?? {}
  const msLeft = useClock(game.explodeMsLeft ?? 0, `explode:${game.roundIndex}`)
  const mine = r.playerId === myId
  const who = r.playerId ? (mine ? 'You' : nameById[r.playerId] ?? 'Someone') : null

  useEffect(() => {
    if (!r.playerId) return
    play('potato-pop')
    if (mine) buzz([90, 60, 160], muted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let outcome = null
  if (r.playerId && game.mode === 'rounds') {
    outcome = `${mine ? 'You score' : `${who} scores`} 0 this round. Everyone else gets +2.`
  } else if (r.playerId) {
    outcome = r.eliminated
      ? `${mine ? "You're" : `${who} is`} eliminated!`
      : `${mine ? 'You lose' : `${who} loses`} a life: ${r.livesLeft} left.`
  }

  const nextLine = r.gameOver
    ? 'Final scores coming up…'
    : r.matchOver
      ? null
      : `Next potato in ${Math.ceil(msLeft / 1000)}s…`

  return (
    <div className="screen hp-explode">
      <div className="hp-boom" aria-hidden="true">
        <Potato size={120} pulse={false} className="hp-boom-potato" />
        <span className="hp-boom-burst" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="hp-boom-bit" style={{ '--i': i }} />
        ))}
      </div>

      <div className="hp-explode-text">
        <h1 className="hp-explode-title">
          {who ? `${who} exploded!` : 'Match over'}
        </h1>
        {r.cause && <p className="hint center-text">{CAUSE[r.cause]}</p>}
        {outcome && <p className={`hp-explode-result ${r.eliminated ? 'hp-explode-out' : ''}`}>{outcome}</p>}
      </div>

      {r.matchOver && game.placements && (
        <div>
          <span className="label">Match {game.matchIndex + 1} results</span>
          <div className="wyr-board">
            {game.placements.map((p) => (
              <div key={p.playerId} className={`wyr-board-row ${p.playerId === myId ? 'wyr-me' : ''}`}>
                <span className="wyr-board-rank">{PLACE[p.place - 1] ?? `${p.place}th`}</span>
                <span>
                  <PlayerDot color={colorById[p.playerId]} className="player-cdot-inline" />
                  {nameById[p.playerId] ?? 'Unknown'}
                </span>
                <span className="wyr-board-score">+{p.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {game.mode === 'elimination' && !r.matchOver && (
        <CycleStrip
          cycle={game.cycle}
          activeIds={game.activeIds}
          removedIds={game.removedIds}
          myId={myId}
          lives={game.lives}
          startLives={game.startLives}
          colorById={colorById}
          nameById={nameById}
          popId={r.playerId}
        />
      )}

      {(game.mode === 'rounds' || r.matchOver) && (
        <Leaderboard scores={game.scores} players={players} myId={myId} label={r.gameOver ? 'Final scores' : 'Scores'} />
      )}

      {nextLine && <p className="hint center-text">{nextLine}</p>}
      {r.matchOver && !r.gameOver && (
        isHost ? (
          <button type="button" className="btn btn-primary" onClick={actions.hotPotatoNextMatch}>
            Start match {game.matchIndex + 2} →
          </button>
        ) : (
          <p className="hint center-text waiting">Waiting for the host to start the next match…</p>
        )
      )}
    </div>
  )
}
