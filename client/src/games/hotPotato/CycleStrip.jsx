import { useLayoutEffect, useRef } from 'react'
import { PotatoToken } from './Potato'

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')

// The fixed cycle as a strip of avatars in player colours. The holder is
// ringed in coral and carries the potato; the next player is labelled
// "next"; the viewer's own avatar is dashed and labelled "You". In
// Elimination each avatar shows its lives.
//
// THE HOP: the potato token is rendered inside the holder's slot, so at
// rest it's always in the right place (resizes, rotations, reconnects).
// When the holder changes, the new token starts offset at the OLD
// holder's position and the Web Animations API hops it home along an arc
// — the X move and the Y arc on two nested elements. Each pass mounts a
// fresh token (keyed on turnId), so a burst of rapid passes can never
// leave a half-finished animation behind: the old token is simply gone.
// Under prefers-reduced-motion the hop is replaced by a fade.
//
// Echo Chain reuses the strip for its turn order (`showToken={false}`: the
// active player is ringed in coral, no potato) and `ariaLabel`.
export default function CycleStrip({
  cycle = [],
  activeIds = [],
  removedIds = [],
  holderId = null,
  nextId = null,
  myId,
  turnId = 0,
  lives = null,
  startLives = 1,
  colorById,
  nameById,
  popId = null,
  showToken = true,
  ariaLabel = 'Passing order',
  activeLabel = 'holding the potato',
}) {
  const slotRefs = useRef(new Map())
  const tokenRef = useRef(null)
  const arcRef = useRef(null)
  const prevHolder = useRef(holderId)

  useLayoutEffect(() => {
    const from = prevHolder.current
    prevHolder.current = holderId
    const token = tokenRef.current
    const arc = arcRef.current
    if (!token || !arc || !from || from === holderId) return
    const a = slotRefs.current.get(from)?.getBoundingClientRect()
    const b = slotRefs.current.get(holderId)?.getBoundingClientRect()
    if (!a || !b) return
    if (REDUCED?.matches) {
      token.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' })
      return
    }
    const dx = a.left + a.width / 2 - (b.left + b.width / 2)
    const lift = Math.min(40, 16 + Math.abs(dx) * 0.12)
    token.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], {
      duration: 360,
      easing: 'cubic-bezier(.35,.0,.25,1)',
    })
    arc.animate(
      [
        { transform: 'translateY(0) rotate(0deg)', easing: 'cubic-bezier(.2,.6,.4,1)' },
        { transform: `translateY(${-lift}px) rotate(${dx > 0 ? -160 : 160}deg)`, offset: 0.5, easing: 'cubic-bezier(.6,0,.8,.4)' },
        { transform: 'translateY(0) rotate(-360deg)' },
      ],
      { duration: 360 },
    )
  }, [holderId, turnId])

  const visible = cycle.filter((pid) => !removedIds.includes(pid))

  return (
    <div className="hp-strip" role="list" aria-label={ariaLabel}>
      {visible.map((pid) => {
        const out = !activeIds.includes(pid)
        const isHolder = pid === holderId
        const isMe = pid === myId
        const tag = isMe ? (pid === nextId ? 'You · next' : 'You') : pid === nextId ? 'next' : null
        return (
          <div
            key={pid}
            role="listitem"
            ref={(el) => {
              if (el) slotRefs.current.set(pid, el)
              else slotRefs.current.delete(pid)
            }}
            className={`hp-slot ${isHolder ? 'hp-slot-holder' : ''} ${isMe ? 'hp-slot-me' : ''} ${
              out ? 'hp-slot-out' : ''
            } ${pid === nextId ? 'hp-slot-next' : ''} ${pid === popId ? 'hp-slot-pop' : ''}`}
            aria-label={`${nameById[pid] ?? 'Player'}${isHolder ? `, ${activeLabel}` : ''}${out ? ', out' : ''}`}
          >
            <span className="hp-token-dock">
              {isHolder && showToken && (
                <span key={turnId} ref={tokenRef} className="hp-token">
                  <span ref={arcRef} className="hp-token-arc">
                    <PotatoToken />
                  </span>
                </span>
              )}
            </span>
            <span className="hp-avatar" style={{ '--hp-color': colorById[pid] ?? 'var(--muted)' }}>
              {(nameById[pid] ?? '?').trim().charAt(0).toUpperCase()}
            </span>
            <span className="hp-slot-name">{nameById[pid] ?? 'Player'}</span>
            {tag ? <span className={`hp-slot-tag ${tag === 'next' ? 'hp-slot-tag-next' : ''}`}>{tag}</span> : <span className="hp-slot-tag" />}
            {lives && (
              <span className="hp-slot-lives" aria-label={`${lives[pid] ?? 0} lives`}>
                {out
                  ? 'out'
                  : Array.from({ length: startLives }, (_, i) => (
                      <span key={i} className={i < (lives[pid] ?? 0) ? '' : 'hp-life-lost'}>
                        ♥
                      </span>
                    ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
