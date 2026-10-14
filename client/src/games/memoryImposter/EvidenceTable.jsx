import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import { ItemToken, Prompt } from './items'

// Players × questions. The header row holds the correct answers; each
// cell is that player's answer, violet when it matches and coral when it
// doesn't (a dash = no answer). Cells fade in row by row when `animate`
// is on (the evidence beat); afterwards it's a static reference. Nothing
// here says who the Imposter is.
export default function EvidenceTable({ evidence, type, players, myId, animate = false }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const qs = evidence?.questions ?? []
  const rows = evidence?.rows ?? []

  return (
    <div className={`mi-evidence ${animate ? 'mi-evidence-animate' : ''}`}>
      <div className="mi-evidence-scroll">
        <table className="mi-table">
          <thead>
            <tr>
              <th scope="col" className="mi-th-name">
                <span className="mi-sr-only">Player</span>
              </th>
              {qs.map((q) => (
                <th key={q.index} scope="col" className="mi-th-q">
                  Q{q.index + 1}
                </th>
              ))}
            </tr>
            <tr className="mi-tr-answer">
              <th scope="row" className="mi-th-name">
                Answer
              </th>
              {qs.map((q) => (
                <td key={q.index} className="mi-td mi-td-answer">
                  <ItemToken type={type} item={q.answer} size={20} />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.playerId} className={row.playerId === myId ? 'mi-tr-me' : ''}>
                <th scope="row" className="mi-th-name">
                  <PlayerDot color={colorById[row.playerId]} className="player-cdot-inline" />
                  <span className="mi-name">{row.playerId === myId ? 'You' : nameById[row.playerId] ?? 'Player'}</span>
                </th>
                {row.answers.map((a, i) => (
                  <td
                    key={i}
                    className={`mi-td ${a.correct ? 'mi-td-ok' : 'mi-td-miss'}`}
                    style={{ '--d': `${r * 140 + i * 60}ms` }}
                    aria-label={a.correct ? 'matches' : a.value == null ? 'no answer' : 'does not match'}
                  >
                    <ItemToken type={type} item={a.value} size={20} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="mi-legend">
        {qs.map((q) => (
          <li key={q.index}>
            <span className="mi-legend-n">Q{q.index + 1}</span>
            <Prompt question={q} type={type} />
          </li>
        ))}
      </ol>
    </div>
  )
}
