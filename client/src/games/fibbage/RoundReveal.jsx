import FactPrompt from './FactPrompt'

export default function RoundReveal({ game, players, myId, isHost, onNext }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const nameOf = (id) => nameById[id] ?? 'Someone'
  const nameList = (ids) => ids.map(nameOf).join(', ')

  const { prompt, answer, options, roundScores } = game.result
  const isLastRound = game.roundIndex + 1 >= game.totalRounds

  // Players who wrote something identical to the real answer "knew it"
  // rather than "spotted it" (they were blocked from voting for it).
  const truthWriterIds = new Set(
    (options.find((o) => o.isTruth)?.ownerIds ?? [])
  )

  // Truth first, then fakes ordered by how many people they fooled.
  const ordered = [...options].sort((a, b) => {
    if (a.isTruth !== b.isTruth) return a.isTruth ? -1 : 1
    return b.voterIds.length - a.voterIds.length
  })

  return (
    <div className="screen">
      <p className="wyr-round">Round {game.roundIndex + 1} results</p>

      <div className="fof-answer-callout">
        <FactPrompt prompt={prompt} fill={answer} className="fof-answer-fact" />
        <div className="fof-answer-line">
          <span className="fof-answer-check">✓</span> The real answer was{' '}
          <strong>{answer}</strong>
        </div>
      </div>

      {/* --- Every answer, who wrote it, and who voted for it --- */}
      <div>
        <span className="label">The answers</span>
        <div className="fof-answers">
          {ordered.map((o) => {
            const fakeAuthors = o.isTruth ? [] : o.ownerIds
            const truthWriters = o.isTruth ? o.ownerIds : []
            return (
              <div
                key={o.id}
                className={`fof-answer ${o.isTruth ? 'fof-answer-true' : 'fof-answer-fake'}`}
              >
                <div className="fof-answer-row">
                  <span className="fof-answer-text">{o.text}</span>
                  <span
                    className={`fof-badge ${o.isTruth ? 'fof-badge-true' : 'fof-badge-fake'}`}
                  >
                    {o.isTruth ? '✓ TRUE' : 'FAKE'}
                  </span>
                </div>

                <div className="fof-answer-meta">
                  {o.isTruth ? (
                    <span>
                      The real fact
                      {truthWriters.length > 0 &&
                        ` — also written by ${nameList(truthWriters)}!`}
                    </span>
                  ) : (
                    <span>Faked by {nameList(fakeAuthors)}</span>
                  )}
                  <span className="fof-vote-count">
                    {o.voterIds.length} {o.voterIds.length === 1 ? 'vote' : 'votes'}
                  </span>
                </div>

                <div className="fof-voters">
                  {o.voterIds.length === 0 ? (
                    <span className="fof-voters-none">No one voted for this</span>
                  ) : (
                    o.voterIds.map((vid) => (
                      <span
                        key={vid}
                        className={`fof-voter ${
                          o.isTruth ? 'fof-voter-right' : 'fof-voter-fooled'
                        } ${vid === myId ? 'fof-voter-me' : ''}`}
                      >
                        {o.isTruth ? '✓' : '✗'} {nameOf(vid)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* --- Scoreboard: this round's points, by source, next to the total --- */}
      <div>
        <span className="label">Scores</span>
        <div className="fof-scoreboard">
          {game.scores.map((s, i) => {
            const rs = roundScores[s.playerId]
            const foundTruth = rs?.foundTruth
            const fooled = rs?.fooled ?? 0
            const gained = rs?.gained ?? 0
            return (
              <div
                key={s.playerId}
                className={`fof-score ${s.playerId === myId ? 'fof-score-me' : ''}`}
              >
                <div className="fof-score-head">
                  <span className="fof-score-rank">{i + 1}</span>
                  <span className="fof-score-name">{nameOf(s.playerId)}</span>
                  <span className="fof-score-total">
                    <span className="fof-score-total-num">{s.score}</span>
                    <span className="fof-score-total-label">total</span>
                  </span>
                </div>

                <div className="fof-score-lines">
                  {foundTruth && (
                    <div className="fof-score-line fof-score-line-truth">
                      <span className="fof-score-line-icon">🎯</span>
                      <span className="fof-score-line-label">
                        {truthWriterIds.has(s.playerId)
                          ? 'Wrote the real answer'
                          : 'Voted for the real answer'}
                      </span>
                      <span className="fof-score-line-pts">+{rs.truthPoints}</span>
                    </div>
                  )}
                  {fooled > 0 && (
                    <div className="fof-score-line fof-score-line-fool">
                      <span className="fof-score-line-icon">🎣</span>
                      <span className="fof-score-line-label">
                        Fooled {fooled} {fooled === 1 ? 'player' : 'players'} with a fake
                      </span>
                      <span className="fof-score-line-pts">+{rs.foolPoints}</span>
                    </div>
                  )}
                  {!foundTruth && fooled === 0 && (
                    <div className="fof-score-line fof-score-line-none">
                      <span className="fof-score-line-icon">·</span>
                      <span className="fof-score-line-label">No points this round</span>
                    </div>
                  )}
                </div>

                <div
                  className={`fof-score-delta ${gained > 0 ? 'fof-score-delta-up' : ''}`}
                >
                  <span>This round</span>
                  <strong>{gained > 0 ? `+${gained}` : '+0'}</strong>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isHost ? (
        <button className="btn btn-primary" onClick={onNext}>
          {isLastRound ? 'See Final Results' : 'Next Round'}
        </button>
      ) : (
        <p className="hint center-text">Waiting for the host to continue…</p>
      )}
    </div>
  )
}
