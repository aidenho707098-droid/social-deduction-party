import { useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap, resolvePlayerColor } from '../../playerColors'
import { LetterTile } from './LetterTile'
import Leaderboard from './Leaderboard'
import { useCountdown } from './useCountdown'

// Typed mode's end-of-round screen, in two beats on one layout:
//   review — one card per distinct answer (who gave it, Unique / Shared /
//            Invalid), PROVISIONAL points, and the dispute window: each
//            player may dispute ONE of their own rejected answers; everyone
//            else gets 10s to vote. Majority of votes cast overturns, a tie
//            keeps it rejected.
//   reveal — disputes settled, points final, running leaderboard, host
//            moves on.
// Cards animate in fast with a capped stagger, so a 10-player round with
// ~50 cards still lands in well under a second.

const BADGE = {
  unique: (p) => `Unique +${p}`,
  shared: (p) => `Shared +${p}`,
  invalid: () => 'Invalid',
}
const STAGGER_MS = 28
const STAGGER_CAP_MS = 560

export default function TypedResults({ game, players, myId, myRole, isHost, actions }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const result = game.result ?? { cards: [], rows: [], bonusIds: [] }
  const reviewing = game.phase === 'review'
  const isLastRound = game.roundIndex + 1 >= game.totalRounds
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState('')

  const windowLeft = useCountdown(game.disputeMsLeft ?? 0, `dw:${game.roundIndex}`)
  const disputes = game.disputes ?? []
  const myVotes = myRole?.alphabetSoup?.myVotes ?? {}
  const iDisputed = (game.disputedIds ?? []).includes(myId)
  const iSettled = (game.settledIds ?? []).includes(myId)
  const windowOpen = reviewing && windowLeft > 0 && !iDisputed
  const disputedAnswerIds = new Set(disputes.map((d) => d.answerId))
  const myRejected = result.cards
    .filter((c) => c.status === 'invalid')
    .flatMap((c) => c.answers.filter((a) => a.playerId === myId))

  function dispute(answerId) {
    setBusy(answerId)
    actions.alphabetSoupDispute(answerId, (res) => {
      setBusy(null)
      setNote(res?.ok ? '' : res?.message ?? "Couldn't open that dispute.")
    })
  }

  return (
    <div className="screen as-results">
      <p className="wyr-round">
        Round {game.roundIndex + 1} {reviewing ? 'answers' : 'results'}
      </p>
      <div className="as-results-head">
        <LetterTile letter={game.letter} size="sm" />
        <span className="as-results-cat">{game.category?.name}</span>
      </div>

      {reviewing && (
        <div className="as-dispute-bar">
          {windowLeft > 0 ? (
            <span>
              Disputes open · <strong>{Math.ceil(windowLeft / 1000)}s</strong>
            </span>
          ) : (
            <span>Finishing the votes…</span>
          )}
          {myRejected.length > 0 && !iDisputed && !iSettled && windowLeft > 0 && (
            <button type="button" className="btn btn-text as-settle" onClick={() => actions.alphabetSoupSettle()}>
              Looks good
            </button>
          )}
        </div>
      )}

      {disputes.length > 0 && (
        <div className="as-disputes">
          {disputes.map((d) => (
            <DisputeRow
              key={d.id}
              d={d}
              myId={myId}
              myVote={myVotes[d.id]}
              name={nameById[d.playerId] ?? 'Player'}
              onVote={(overturn) => actions.alphabetSoupDisputeVote(d.id, overturn)}
            />
          ))}
        </div>
      )}

      <div className="as-cards">
        {result.cards.length === 0 && <p className="hint center-text">Nobody got an answer in this round.</p>}
        {result.cards.map((c, i) => {
          const mineInvalid = c.status === 'invalid' && c.answers.find((a) => a.playerId === myId)
          return (
            <div
              key={c.key}
              className={`as-card as-card-${c.status}`}
              style={{ animationDelay: `${Math.min(i * STAGGER_MS, STAGGER_CAP_MS)}ms` }}
            >
              <div className="as-card-main">
                <span className="as-card-text">{c.text}</span>
                <span className={`as-badge as-badge-${c.status}`}>
                  {BADGE[c.status](c.points)}
                  {c.overturned && ' · disputed'}
                </span>
              </div>
              <div className="as-card-who">
                {c.playerIds.map((pid) => (
                  <span
                    key={pid}
                    className="as-who"
                    style={{ '--who': resolvePlayerColor(colorById[pid]) }}
                  >
                    <PlayerDot color={colorById[pid]} />
                    {nameById[pid] ?? 'Player'}
                  </span>
                ))}
              </div>
              {mineInvalid && windowOpen && !disputedAnswerIds.has(mineInvalid.answerId) && (
                <button
                  type="button"
                  className="btn btn-secondary as-dispute-btn"
                  onClick={() => dispute(mineInvalid.answerId)}
                  disabled={busy != null}
                >
                  Dispute this
                </button>
              )}
            </div>
          )
        })}
      </div>
      {note && <p className="error">{note}</p>}

      <div>
        <span className="label">{reviewing ? 'This round (pending disputes)' : 'This round'}</span>
        <div className="wyr-board">
          {result.rows.map((r) => (
            <div key={r.playerId} className={`wyr-board-row ${r.playerId === myId ? 'wyr-me' : ''}`}>
              <span className="as-row-who">
                <span>
                  <PlayerDot color={colorById[r.playerId]} className="player-cdot-inline" />
                  {nameById[r.playerId] ?? 'Player'}
                </span>
                <span className="as-row-stats">
                  {r.unique} unique · {r.shared} shared
                  {r.bonus ? ` · most unique +${r.bonus}` : ''}
                </span>
              </span>
              <span className="wyr-plus">+{r.points}</span>
            </div>
          ))}
        </div>
      </div>

      {!reviewing && (
        <>
          <Leaderboard scores={game.scores} players={players} myId={myId} />
          {isHost ? (
            <button className="btn btn-primary" onClick={actions.alphabetSoupNextRound}>
              {isLastRound ? 'See Final Results' : 'Next Round'}
            </button>
          ) : (
            <p className="hint center-text waiting">Waiting for the host to continue…</p>
          )}
        </>
      )}
    </div>
  )
}

function DisputeRow({ d, myId, myVote, name, onVote }) {
  const msLeft = useCountdown(d.msLeft ?? 0, d.id)
  const mine = d.playerId === myId
  if (d.resolved) {
    return (
      <div className={`as-dispute as-dispute-done ${d.overturned ? 'as-dispute-won' : ''}`}>
        <span>
          {mine ? 'Your' : `${name}'s`} “{d.text}”
        </span>
        <strong>{d.overturned ? `counts! (${d.up}–${d.down})` : `stays out (${d.up}–${d.down})`}</strong>
      </div>
    )
  }
  return (
    <div className="as-dispute">
      <div className="as-dispute-q">
        {mine ? (
          <>
            You disputed “{d.text}” — waiting on votes ({d.votedIds.length}/{d.voterCount})
          </>
        ) : (
          <>
            {name} says “{d.text}” should count. Does it?
          </>
        )}
        <span className="as-dispute-time">{Math.ceil(msLeft / 1000)}s</span>
      </div>
      {!mine &&
        (myVote === undefined ? (
          <div className="as-vote-btns">
            <button type="button" className="btn btn-primary" onClick={() => onVote(true)}>
              Let it count
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onVote(false)}>
              Keep it out
            </button>
          </div>
        ) : (
          <p className="hint">You voted {myVote ? 'to let it count' : 'to keep it out'}.</p>
        ))}
    </div>
  )
}
