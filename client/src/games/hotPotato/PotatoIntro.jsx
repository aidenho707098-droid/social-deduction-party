import { useEffect, useRef } from 'react'
import { playerColorMap } from '../../playerColors'
import { useSound } from '../../sound/SoundContext'
import { CategoryChip } from '../alphabetSoup/LetterTile'
import Leaderboard from '../alphabetSoup/Leaderboard'
import CycleStrip from './CycleStrip'
import { Potato } from './Potato'
import { useClock } from './useClock'

const KIND = {
  sprint: { name: 'Sprint', desc: '8s turns, shorter after every pass' },
  hidden: { name: 'Hidden Fuse', desc: 'a secret fuse, and 5s to pass' },
}

// The beat before every potato: the category (and, in Mixed, which timer
// this potato uses) lands, then 3-2-1. The server owns the timing — the
// first turn only starts when ITS intro clock runs out; this screen just
// animates toward that from `introMsLeft`. A Chaos takeover in front of it
// (`introLeadMs`) is waited out first.
export default function PotatoIntro({ game, players, myId }) {
  const { play } = useSound()
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const colorById = playerColorMap(players)
  const msLeft = useClock(game.introMsLeft ?? 0, `intro:${game.roundIndex}`)
  const elapsed = (game.introMs ?? 0) - msLeft
  const lead = game.introLeadMs ?? 0
  const stage = elapsed < lead ? 'wait' : elapsed < lead + (game.categoryMs ?? 2400) ? 'category' : 'count'
  const count = Math.max(1, Math.ceil(msLeft / 1000))

  const lastBeep = useRef(null)
  useEffect(() => {
    if (stage !== 'count' || lastBeep.current === count) return
    lastBeep.current = count
    play('potato-tick', { gain: 0.55 })
  }, [stage, count, play])

  const kind = KIND[game.potatoKind] ?? KIND.sprint
  const starter = game.starterId === myId ? 'You start' : `${nameById[game.starterId] ?? 'Someone'} starts`
  const head =
    game.mode === 'rounds'
      ? `Round ${game.roundIndex + 1} of ${game.totalRounds}`
      : `Match ${game.matchIndex + 1}${game.totalMatches > 1 ? ` of ${game.totalMatches}` : ''}`

  return (
    <div className="screen hp-intro">
      <p className="wyr-round">{head}</p>

      <div className={`hp-intro-stage hp-intro-${stage}`}>
        {stage === 'wait' ? (
          <Potato size={110} pulse={false} />
        ) : (
          <>
            <CategoryChip name={game.category?.name} className="hp-intro-chip" />
            <p className="hp-intro-kind">
              {game.speed ? '⚡ Speed Round · 2s turns' : `${kind.name}: ${kind.desc}`}
            </p>
            {stage === 'count' ? (
              <span key={count} className="hp-count" aria-live="assertive">
                {count}
              </span>
            ) : (
              <p className="hp-intro-starter">{starter}</p>
            )}
          </>
        )}
      </div>

      <CycleStrip
        cycle={game.cycle}
        activeIds={game.activeIds}
        removedIds={game.removedIds}
        holderId={game.starterId}
        myId={myId}
        lives={game.mode === 'elimination' ? game.lives : null}
        startLives={game.startLives}
        colorById={colorById}
        nameById={nameById}
      />

      {game.mode === 'rounds' && game.roundIndex > 0 && (
        <Leaderboard scores={game.scores} players={players} myId={myId} label="Scores" />
      )}
    </div>
  )
}
