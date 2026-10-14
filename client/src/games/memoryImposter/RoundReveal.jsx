import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import Leaderboard from '../alphabetSoup/Leaderboard'
import { SequenceStrip } from './items'
import { TYPE_LABELS, usePhaseClock } from './memoryData'
import { RoundLine } from './shared'

// REVEAL: the Imposter, the full sequence, the round's type and
// difficulty, the vote tally and this round's points. The next round deals
// automatically; the host can go early.
export default function RoundReveal({ game, players, myId, isHost, actions }) {
  const r = game.result
  const msLeft = usePhaseClock(game)
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const nm = (id) => (id === myId ? 'You' : nameById[id] ?? 'Player')
  const iAmImposter = r.imposterId === myId
  const won = iAmImposter ? !r.caught : r.caught
  const last = game.roundIndex + 1 >= game.totalRounds

  const tally = Object.entries(r.tally)
    .filter(([pid]) => game.participantIds.includes(pid))
    .sort((a, b) => b[1] - a[1])

  let because
  if (r.caught) because = `${iAmImposter ? 'You were' : `${nm(r.imposterId)} was`} voted out.`
  else if (r.eliminatedId) because = `${nm(r.eliminatedId)} ${r.eliminatedId === myId ? 'were' : 'was'} voted out instead.`
  else if (r.tie) because = 'The vote was a tie, so nobody was voted out.'
  else because = 'Nobody voted.'

  return (
    <div className="screen mi-reveal">
      <RoundLine game={game} detail={false} />

      <div className={`outcome-banner ${won ? 'outcome-win' : 'outcome-lose'} mi-outcome`}>
        <div className="outcome-title">{r.caught ? 'Imposter caught!' : 'The Imposter got away!'}</div>
        <div className="outcome-subtitle">
          <PlayerDot color={colorById[r.imposterId]} className="player-cdot-inline" onColor />
          {iAmImposter ? 'You were' : `${nameById[r.imposterId] ?? 'Someone'} was`} the Imposter. {because}
        </div>
      </div>

      <div>
        <span className="label">
          The sequence · {TYPE_LABELS[r.type]} · {r.length} items, {r.viewSec}s
        </span>
        <SequenceStrip items={r.sequence} />
        <p className="hint center-text mi-difficulty">
          Difficulty {r.difficultyScore}
          {r.caught ? ` · getting away was worth +${r.evadeWorth}` : ` · +${r.evadeWorth} to the Imposter`}
        </p>
      </div>

      <div>
        <span className="label">Votes</span>
        <div className="wyr-board">
          {tally.map(([pid, n]) => (
            <div
              key={pid}
              className={`wyr-board-row ${pid === myId ? 'wyr-me' : ''} ${pid === r.imposterId ? 'mi-row-imposter' : ''}`}
            >
              <span className="wyr-board-rank">{n}</span>
              <span>
                <PlayerDot color={colorById[pid]} className="player-cdot-inline" />
                {nameById[pid] ?? 'Player'}
                {pid === r.imposterId && <span className="mi-tag">Imposter</span>}
              </span>
              <span className="wyr-board-score">{r.points[pid] ? `+${r.points[pid]}` : '0'}</span>
            </div>
          ))}
        </div>
      </div>

      <Leaderboard scores={game.scores} players={players} myId={myId} label="Scores" />

      {isHost && (
        <button type="button" className="btn btn-primary" onClick={() => actions.memoryHost('next')}>
          {last ? 'Final scores →' : 'Next round →'}
        </button>
      )}
      <p className="hint center-text">
        {last ? 'Final scores' : 'Next round'} in {Math.ceil(msLeft / 1000)}s…
      </p>
    </div>
  )
}

