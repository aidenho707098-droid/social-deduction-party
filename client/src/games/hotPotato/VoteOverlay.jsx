import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useClock } from './useClock'

// The challenge vote, over every screen at once. Everyone but the player
// who said the answer votes (eliminated players included); the challenger
// already counts as a No. A tie keeps the answer.
export default function VoteOverlay({ game, myId, priv, nameById, actions }) {
  const v = game.vote
  const msLeft = useClock(v.msLeft, `vote:${game.lastPass?.seq}`)
  const [pending, setPending] = useState(false)
  const nm = (id) => (id === myId ? 'you' : nameById[id] ?? 'someone')
  const isPasser = v.passerId === myId
  const isChallenger = v.challengerId === myId
  const myVote = priv?.myVote // true = "valid"

  function cast(valid) {
    if (pending) return
    setPending(true)
    actions.hotPotatoVote(valid, () => setPending(false))
  }

  return createPortal(
    <div className="hp-vote-backdrop" role="dialog" aria-modal="true" aria-labelledby="hp-vote-q">
      <div className="hp-vote-card">
        <p className="hp-vote-kicker">
          ✋ {isChallenger ? 'You' : nameById[v.challengerId] ?? 'Someone'} challenged {nm(v.passerId)}
          {isPasser ? '' : "'s answer"}
        </p>
        <h2 id="hp-vote-q" className="hp-vote-q">
          {isPasser ? 'The room is voting on your answer…' : 'Was that a valid answer?'}
        </h2>
        <div className="hp-vote-time" aria-hidden="true">
          <div className="hp-vote-time-fill" style={{ width: `${Math.max(0, Math.min(1, msLeft / (v.voteMs ?? 5000))) * 100}%` }} />
        </div>
        <p className="hp-vote-secs">{Math.ceil(msLeft / 1000)}s</p>

        {isPasser ? (
          <p className="hint center-text">If most say No, the potato explodes on you.</p>
        ) : isChallenger ? (
          <p className="hint center-text">Your challenge counts as a No.</p>
        ) : myVote == null ? (
          <div className="hp-vote-btns">
            <button type="button" className="btn btn-primary" onClick={() => cast(true)} disabled={pending}>
              Yes
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => cast(false)} disabled={pending}>
              No
            </button>
          </div>
        ) : (
          <p className="hint center-text">You voted {myVote ? 'Yes' : 'No'}.</p>
        )}
        <p className="hint center-text">
          {v.votedIds.length} of {v.voterCount} voted · a tie keeps the answer
        </p>
      </div>
    </div>,
    document.body,
  )
}
