import { useEffect, useState } from 'react'
import { PlayerDot } from '../../PlayerDot'
import { playerColorMap } from '../../playerColors'
import FinalStandings from '../alphabetSoup/FinalStandings'
import { useCountdown } from '../alphabetSoup/useCountdown'
import { GameIcon } from '../gameStyle'
import Bomb, { FuseReadout } from './Bomb'
import { MODULE_NAMES, difficultyOf, fmtFuse, privateFor } from './config'
import Manual, { Parts } from './Manual'
import { ModuleIcon } from './ModuleIcon'
import { useBombSounds, useFuse } from './useFuse'

// Same contract as every game component. Two play styles:
//
// "turns" (one pair at a time)
//   ready   briefing card (the pair and roles) + 10s get-ready: the Expert
//           can already read; spectators bet
//   live    Defuser: the bomb. Expert(s): fuse, strikes and the manual.
//           Everyone else: a read-only mirror + "stay quiet"
//   result  defused / boom (and what went wrong), for everyone
// "together" (all pairs at once)
//   ready   your pair's briefing + one shared 10s get-ready
//   live    your bomb; once it ends, your result card and the other pairs'
//           status (still playing / defused / exploded — nothing more)
// then the round summary (ranked) and, at the end, the final standings.
export default function BombSquadGame({ game, players, myRole, isHost, myId, actions }) {
  const priv = privateFor(game, myRole)
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const ctx = { game, priv, myId, isHost, nameById, colorById, actions }

  if (game.phase === 'final') {
    return (
      <FinalStandings
        game={game}
        players={players}
        myId={myId}
        isHost={isHost}
        onBackToLobby={actions.backToLobby}
        plainRanks
        icon={
          <span className="mi-final-icon">
            <GameIcon id="bomb-squad" />
          </span>
        }
      />
    )
  }
  if (game.phase === 'summary') return <Summary key={`sum-${game.roundIndex}`} {...ctx} />
  const key = game.style === 'together' ? `round-${game.roundIndex}` : `turn-${game.turn?.serial}`
  return <Turn key={key} {...ctx} />
}

const Name = ({ id, nameById, colorById, myId }) => (
  <span className="bs-name">
    <PlayerDot color={colorById[id]} className="player-cdot-inline" />
    {id === myId ? 'You' : nameById[id] ?? 'Someone'}
  </span>
)

function TeamLine({ defuserId, expertIds, nm }) {
  return (
    <div className="bs-team-line">
      {nm(defuserId)} <span className="bs-role-tag">Defuser</span>
      {expertIds.map((e) => (
        <span key={e}>
          {nm(e)} <span className="bs-role-tag">Expert</span>
        </span>
      ))}
    </div>
  )
}

function roleOf(game, priv, myId, turn) {
  if (priv?.role) return priv.role
  if (!turn) return game.style === 'together' ? 'watcher' : null
  if (turn.defuserId === myId) return 'defuser'
  if (turn.expertIds.includes(myId)) return 'expert'
  return 'spectator'
}

// One bomb: get-ready, live, result.
function Turn({ game, priv, myId, isHost, nameById, colorById, actions }) {
  const together = game.style === 'together'
  // "together": your OWN bomb's fuse/strikes come privately.
  const turn = together ? (priv?.turn ?? null) : game.turn
  const role = roleOf(game, priv, myId, turn)
  const ended = !!turn?.outcome
  const phase = ended ? 'result' : game.phase
  const msLeft = useFuse(turn?.fuse, `${turn?.serial}:${phase}`)
  const phaseLeft = useCountdown(game.msLeft ?? 0, `${game.roundIndex}:${turn?.serial}:${game.phase}`, 250)
  const bomb = priv?.bomb ?? null
  useBombSounds({ turn, phase, solvedCount: bomb ? bomb.modules.filter((m) => m.solved).length : null })
  const [note, setNote] = useState(null)
  useEffect(() => {
    if (!note) return undefined
    const t = setTimeout(() => setNote(null), 1800)
    return () => clearTimeout(t)
  }, [note])

  const nm = (id) => <Name id={id} nameById={nameById} colorById={colorById} myId={myId} />
  const head = (
    <p className="wyr-round bs-round">
      Round {game.roundIndex + 1} of {game.totalRounds} ·{' '}
      {together ? 'All pairs at once' : `Bomb ${game.pos + 1} of ${game.order.length}`} · {difficultyOf(game.difficulty).name}
    </p>
  )

  function onAct(index, a) {
    actions.bombAct({ turn: turn.serial, module: index, ...a }, (res) => {
      if (res && !res.ok && res.message) setNote(res.message)
    })
  }

  // ---- watching a simultaneous round (not on any bomb) ----
  if (together && !turn) {
    return (
      <div className="screen bs-screen">
        {head}
        <p className="hint">Every pair is playing its own bomb.</p>
        <PairStatus game={game} nm={nm} isHost={isHost} onSkip={actions.bombSkip} />
      </div>
    )
  }
  if (!turn) return null

  // ---- result card (+ in "together", the other pairs' status) ----
  if (ended) {
    return (
      <div className="screen bs-screen">
        {head}
        <ResultCard r={turn.result} nm={nm} myId={myId} nameById={nameById} />
        {together ? (
          <>
            <p className="bs-wait-title">{game.phase === 'live' ? 'Waiting for the other pairs…' : 'Round over'}</p>
            <PairStatus game={game} nm={nm} isHost={isHost} onSkip={actions.bombSkip} />
          </>
        ) : (
          <p className="hint center-text">Next up in {Math.ceil(phaseLeft / 1000)}s</p>
        )}
      </div>
    )
  }

  // ---- get-ready + live ----
  const live = game.phase === 'live'
  const lineup = game.lineup.map((t) => MODULE_NAMES[t]).join(', ')
  return (
    <div className={`screen bs-screen ${live && role === 'defuser' ? 'bs-screen-defuser' : ''}`}>
      {head}
      {!live && (
        <div className="bs-brief">
          <p className="bs-brief-kicker">{together ? 'Your pair' : 'Up now'}</p>
          <TeamLine defuserId={turn.defuserId} expertIds={turn.expertIds} nm={nm} />
          <p className="bs-brief-mods">
            {game.lineup.length} modules: {lineup}
          </p>
          <p className="bs-brief-you">
            {role === 'defuser' && "You'll see the bomb. Your Expert has the manual. Sit so you can't see each other's screens, and talk."}
            {role === 'expert' && 'Read your manual now. The Defuser will describe the bomb; you tell them what to do.'}
            {role === 'spectator' && 'Watch along, and no helping! Will they make it?'}
          </p>
          {together && <p className="bs-brief-note">Every pair is playing at once: spread out so you can hear each other.</p>}
          <p className="bs-brief-count" role="timer">
            {together ? 'All fuses light in' : 'Fuse lights in'} {Math.ceil(phaseLeft / 1000)}
          </p>
          {role === 'spectator' && <Bets priv={priv} count={turn.betCount} onBet={actions.bombBet} />}
        </div>
      )}

      {live && turn.fuse.paused && (
        <p className="bs-paused" role="status">
          Paused: waiting for a teammate to reconnect…
        </p>
      )}

      {live && role === 'spectator' && <p className="bs-quiet">Stay quiet while the bomb is live</p>}

      {role === 'expert' && (
        <>
          {live && (
            <div className="bs-expert-head">
              <FuseReadout msLeft={msLeft} fuse={turn.fuse} strikes={turn.strikes} />
            </div>
          )}
          {priv?.manual ? <Manual manual={priv.manual} /> : <p className="hint">Opening the manual…</p>}
        </>
      )}

      {live && role !== 'expert' && bomb && (
        <Bomb bomb={bomb} turn={turn} msLeft={msLeft} interactive={role === 'defuser' && !turn.fuse.paused} onAct={onAct} />
      )}

      {note && (
        <p className="bs-toast" role="status">
          {note}
        </p>
      )}
      {isHost && !together && <SkipPair onSkip={() => actions.bombSkip()} />}
      {isHost && together && live && <PairStatus game={game} nm={nm} isHost onSkip={actions.bombSkip} compact />}
    </div>
  )
}

const OUTCOME = { defused: 'Defused', exploded: 'Exploded', forfeit: 'Forfeit', live: 'Still playing', ready: 'Getting ready' }

// "together": every pair's status, and nothing else about their bombs.
function PairStatus({ game, nm, isHost, onSkip, compact = false }) {
  return (
    <div className={`bs-pair-status ${compact ? 'bs-pair-status-compact' : ''}`}>
      {compact && <span className="label">Host: pairs</span>}
      <ul>
        {(game.bombs ?? []).map((b) => (
          <li key={b.groupId} className={`bs-status bs-status-${b.status}`}>
            <span className="bs-status-team">
              {nm(b.defuserId)}
              {b.expertIds.map((e) => (
                <span key={e}>{nm(e)}</span>
              ))}
            </span>
            <span className="bs-status-label">{OUTCOME[b.status] ?? b.status}</span>
            {isHost && (b.status === 'live' || b.status === 'ready') && <SkipPair compact onSkip={() => onSkip(b.groupId)} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The result card, with "What went wrong" when the bomb blew up.
function ResultCard({ r, nm, myId, nameById }) {
  if (!r) return null
  const title = r.outcome === 'defused' ? 'Defused!' : r.outcome === 'exploded' ? 'Boom.' : 'Forfeit'
  const why =
    r.outcome === 'forfeit'
      ? { left: 'A teammate left the game.', skipped: 'The host skipped this bomb.', short: 'Not enough players left in this group.', check: 'This bomb failed its safety check.' }[r.reason]
      : r.outcome === 'exploded'
        ? r.reason === 'time'
          ? 'The fuse ran out.'
          : 'Three strikes.'
        : null
  return (
    <>
      <div className={`bs-result bs-result-${r.outcome}`}>
        <p className="bs-result-title">{title}</p>
        {why && <p className="bs-result-why">{why}</p>}
        <TeamLine defuserId={r.defuserId} expertIds={r.expertIds} nm={nm} />
        <dl className="bs-stats">
          <div>
            <dt>Time left</dt>
            <dd>{fmtFuse(r.msLeft ?? 0)}</dd>
          </div>
          <div>
            <dt>Strikes</dt>
            <dd>{r.strikes ?? 0}</dd>
          </div>
          <div>
            <dt>Modules</dt>
            <dd>
              {r.modulesSolved}/{r.modules}
            </dd>
          </div>
          <div>
            <dt>Points each</dt>
            <dd>+{r.points ?? 0}</dd>
          </div>
        </dl>
        {r.betWinners?.length > 0 && (
          <p className="bs-bet-line">Called it (+1): {r.betWinners.map((id) => (id === myId ? 'You' : nameById[id])).join(', ')}</p>
        )}
      </div>
      {r.outcome === 'exploded' && (r.strikeLog?.length > 0 || r.unsolved?.length > 0) && <WhatWentWrong r={r} />}
    </>
  )
}

// Every strike in order (what was done vs. what the manual said), then
// "Time ran out" and what was left, if that's how it ended. Only ever shown
// after the bomb has ended.
function WhatWentWrong({ r }) {
  return (
    <section className="bs-wrong" aria-label="What went wrong">
      <h3 className="bs-wrong-title">What went wrong</h3>
      <ol className="bs-wrong-list">
        {(r.strikeLog ?? []).map((e, i) => (
          <li key={i} className="bs-wrong-item">
            <span className="bs-wrong-icon" title={MODULE_NAMES[e.module]}>
              <ModuleIcon id={e.module} />
            </span>
            <span className="bs-wrong-text">
              <span className="bs-wrong-did">
                <Parts parts={e.did} />
              </span>
              <span className="bs-wrong-exp">
                Should have: <Parts parts={e.expected} />
              </span>
            </span>
            <span className="bs-wrong-time">{fmtFuse(e.msLeft)}</span>
          </li>
        ))}
        {r.unsolved?.length > 0 && (
          <li className="bs-wrong-item bs-wrong-time-out">
            <span className="bs-wrong-icon">⏱</span>
            <span className="bs-wrong-text">
              <span className="bs-wrong-did">Time ran out</span>
              <span className="bs-wrong-exp">Still unsolved: {r.unsolved.map((t) => MODULE_NAMES[t]).join(', ')}</span>
            </span>
          </li>
        )}
      </ol>
    </section>
  )
}

// Spectators call it before the fuse lights: right bets score 1.
function Bets({ priv, count, onBet }) {
  const mine = priv?.myBet ?? null
  return (
    <div className="bs-bets">
      <span className="label">Your call (+1 if right)</span>
      <div className="bs-bet-row" role="radiogroup" aria-label="Bet">
        {[
          ['defused', 'Defused'],
          ['boom', 'Boom'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mine === k}
            className={`bs-bet bs-bet-${k} ${mine === k ? 'bs-bet-on' : ''}`}
            onClick={() => onBet(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="bs-bet-count">
        {count} bet{count === 1 ? '' : 's'} in
      </p>
    </div>
  )
}

// Host: a pair forfeits its bomb. Two taps, like the host panel's
// destructive actions.
function SkipPair({ onSkip, compact = false }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const t = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`btn btn-text bs-skip ${compact ? 'bs-skip-compact' : ''} ${armed ? 'bs-skip-armed' : ''}`}
      onClick={() => (armed ? onSkip() : setArmed(true))}
    >
      {armed ? 'Tap again to skip' : compact ? 'Skip' : 'Skip this pair'}
    </button>
  )
}

// After every pair has played: the round's bombs ranked + the leaderboard.
function Summary({ game, myId, isHost, nameById, colorById, actions }) {
  const left = useCountdown(game.msLeft ?? 0, `sum-${game.roundIndex}`, 250)
  const last = game.roundIndex + 1 >= game.totalRounds
  const nm = (id) => <Name id={id} nameById={nameById} colorById={colorById} myId={myId} />
  return (
    <div className="screen bs-screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds} · Summary
      </p>
      <ul className="bs-sum-list stagger-in">
        {game.results.map((r, i) => (
          <li key={r.serial} className={`bs-sum bs-sum-${r.outcome}`}>
            <span className="bs-sum-outcome">
              {game.style === 'together' && <span className="bs-sum-rank">{i + 1}</span>}
              {r.outcome === 'defused' ? 'Defused' : r.outcome === 'exploded' ? 'Boom' : 'Forfeit'}
            </span>
            <span className="bs-team-line">
              {nm(r.defuserId)}
              {r.expertIds.map((e) => (
                <span key={e}>{nm(e)}</span>
              ))}
            </span>
            <span className="bs-sum-stats">
              {fmtFuse(r.msLeft)} left · {r.strikes} strike{r.strikes === 1 ? '' : 's'} · +{r.points}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <span className="label">Leaderboard</span>
        <div className="wyr-board">
          {game.scores.map((s, i) => (
            <div key={s.playerId} className={`wyr-board-row ${s.playerId === myId ? 'wyr-me' : ''}`}>
              <span className="wyr-board-rank">{i + 1}</span>
              <span>
                <PlayerDot color={colorById[s.playerId]} className="player-cdot-inline" />
                {nameById[s.playerId] ?? 'Unknown'}
              </span>
              <span className="wyr-board-score">{s.score}</span>
            </div>
          ))}
        </div>
      </div>
      {!last && <p className="hint center-text">Roles swap for the next round. Starts in {Math.ceil(left / 1000)}s</p>}
      {last && <p className="hint center-text">Final results in {Math.ceil(left / 1000)}s</p>}
      {isHost && (
        <button type="button" className="btn btn-primary" onClick={actions.hostForceAdvance}>
          {last ? 'See final results' : 'Next round'}
        </button>
      )}
    </div>
  )
}
