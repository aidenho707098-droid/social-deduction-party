import { PlayerDot } from '../PlayerDot'
import { playerColorMap } from '../playerColors'
import { CHAOS_ICONS } from './chaosCopy'
import ChaosGuide from './ChaosGuide'

// The persistent, RESTRAINED half of Chaos (the loud half is ChaosOverlay).
// While a Chaos round is live / just resolved this shows:
//   * a chip naming the active modifier, tappable for the full reference,
//   * a scoreboard strip that spells out what the modifier did to this
//     round's points (×2 / ×3 / ×4 badges, "DISABLED" markers, per-player
//     deltas) so the leaderboard change is never silent,
//   * the Player Disable target picker for the round winner,
//   * a plain-language, name-aware summary once it's resolved.
export default function ChaosStatusBar({ event, players = [], myId, actions }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)

  if (!event?.modifier) return null
  const m = event.modifier
  const settled = event.settled
  const result = event.result
  const nm = (id) => nameById[id] ?? 'Player'

  const dp = event.disablePending
  const iChoose = dp && dp.chooserId === myId && !dp.targetId
  const disableWaiting = dp && !dp.targetId && dp.chooserId !== myId

  const scoreRows = buildScoreRows(result)

  return (
    <div className="chaos-bar">
      <div className="chaos-bar-chip">
        <span className="chaos-bar-glyph">{CHAOS_ICONS[m.id] ?? '🎲'}</span>
        <span className="chaos-bar-name">{m.name}</span>
        {result?.multiplier && (
          <span className="chaos-mult-tag">{result.multiplier}x</span>
        )}
        <span className="chaos-bar-tag">{settled ? 'resolved' : 'active'}</span>
        <ChaosGuide trigger="ⓘ" highlightId={m.id} />
      </div>

      {iChoose && (
        <div className="chaos-bar-action">
          <span>🚫 Pick a player to zero out NEXT round:</span>
          <div className="chaos-bar-btns chaos-bar-btns-wrap">
            {dp.candidates.map((id) => (
              <button
                key={id}
                className="btn btn-secondary btn-sm"
                onClick={() => actions.chaosDisableTarget?.(id)}
              >
                <PlayerDot color={colorById[id]} className="player-cdot-inline" />
                {nm(id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {disableWaiting && (
        <p className="chaos-bar-line">
          🚫 Waiting for <strong>{nm(dp.chooserId)}</strong> to choose who gets disabled next
          round…
        </p>
      )}
      {dp?.targetId && (
        <p className="chaos-bar-line">
          🚫 <strong>{nm(dp.targetId)}</strong> earns nothing next round.
        </p>
      )}

      {settled && scoreRows.length > 0 && (
        <div className="chaos-scoreboard">
          <span className="chaos-scoreboard-label">This round, after Chaos</span>
          {scoreRows.map((r) => (
            <div
              key={r.playerId}
              className={`chaos-scoreboard-row ${r.disabled ? 'chaos-sb-disabled' : ''}`}
            >
              <PlayerDot color={colorById[r.playerId]} className="player-cdot-inline" />
              <span className="chaos-sb-name">{nm(r.playerId)}</span>
              {r.disabled && (
                <span className="chaos-sb-badge chaos-sb-badge-disabled">🚫 DISABLED</span>
              )}
              <span className="chaos-sb-delta">
                {r.roundRaw !== r.roundFinal && (
                  <span className="chaos-sb-was">{fmt(r.roundRaw)} →</span>
                )}{' '}
                <strong>{fmt(r.roundFinal)}</strong>
                {result?.multiplier && r.roundFinal !== 0 && (
                  <span className="chaos-mult-tag">{result.multiplier}x</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {settled && result?.summary && (
        <p className="chaos-bar-line chaos-bar-result">⚡ {describeResult(result, nm)}</p>
      )}
    </div>
  )
}

function fmt(n) {
  return n > 0 ? `+${n}` : `${n}`
}

// Rows to show on the scoreboard strip — only when Chaos actually moved a
// number this round (a multiplier, a disable, or any row where the raw and
// final round points differ).
function buildScoreRows(result) {
  if (!result) return []
  const disabled = new Set(result.disabledIds ?? [])
  const rows = (result.rows ?? []).map((r) => ({
    ...r,
    disabled: disabled.has(r.playerId),
  }))
  const interesting =
    result.multiplier != null ||
    disabled.size > 0 ||
    rows.some((r) => r.roundRaw !== r.roundFinal)
  return interesting ? rows : []
}

// A name-aware one-liner for the resolved event, built from result.targets.
function describeResult(result, nm) {
  const t = result.targets ?? []
  const of = (tag) => t.filter((x) => x.tag === tag).map((x) => nm(x.playerId))
  const amtOf = (tag) => t.find((x) => x.tag === tag)?.amount ?? 0
  switch (result.modifierId) {
    case 'score-swap': {
      const [a, b] = t.map((x) => nm(x.playerId))
      return a && b ? `Score Swap — ${a} ↔ ${b}` : result.summary
    }
    case 'steal': {
      const [thief] = of('thief')
      const [mark] = of('mark')
      const a = amtOf('thief')
      return thief && mark
        ? a
          ? `${thief} skimmed ${a} off ${mark}'s round`
          : `${mark} earned nothing for ${thief} to skim`
        : result.summary
    }
    case 'the-tyrant': {
      const [tyrant] = of('tyrant')
      const victims = of('victim')
      const a = amtOf('tyrant')
      return tyrant
        ? `The Tyrant — ${tyrant} seized ${a} from ${victims.join(', ') || 'the room'}`
        : result.summary
    }
    case 'rival': {
      const [w] = of('rival-win')
      const [l] = of('rival-lose')
      if (w && l) return `Rival — ${w} ripped ${amtOf('rival-win')} off ${l}'s round`
      const pair = of('rival')
      return pair.length === 2
        ? `Rivals ${pair[0]} & ${pair[1]} — nothing to take`
        : result.summary
    }
    case 'kingbreaker': {
      const [leader] = of('leader')
      return leader ? `Kingbreaker — ${leader} lost this round's points` : result.summary
    }
    case 'tax-collector': {
      const [c] = of('collector')
      const payers = of('payer')
      const a = amtOf('collector')
      return c
        ? `${c} taxed ${a} in round points from ${payers.join(', ') || 'nobody'}`
        : result.summary
    }
    case 'half-reset': {
      const who = of('halved')
      return who.length ? `Half Reset — ${who.join(', ')} halved` : result.summary
    }
    case 'underdog-boost': {
      const who = of('boost')
      return who.length ? `Underdog Boost — ${who.join(', ')} scored ×3` : result.summary
    }
    case 'all-or-nothing': {
      const who = of('winner')
      return who.length ? `All or Nothing — only ${who.join(', ')} scored` : result.summary
    }
    case 'risk-it': {
      const cashed = of('cashed')
      const busted = of('busted')
      const parts = []
      if (cashed.length) parts.push(`${cashed.join(', ')} doubled their wager`)
      if (busted.length) parts.push(`${busted.join(', ')} lost it`)
      return parts.length ? `Risk It — ${parts.join('; ')}` : result.summary
    }
    default:
      return result.summary
  }
}
