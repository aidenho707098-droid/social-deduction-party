export default function ChooseCurse({ game, players, myId, myRole, onChoose }) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const iAmWitch = myId === game.witchId
  const witchName = nameById[game.witchId] ?? 'someone'
  const options = myRole?.options // { physical: {category,text}, verbal: {category,text} }

  if (!iAmWitch) {
    return (
      <div className="screen">
        <p className="wyr-round">
          Round {game.roundIndex + 1} of {game.totalRounds}
        </p>
        <h1 className="title">The Witch is choosing…</h1>
        <p className="hint center-text">
          <strong>{witchName}</strong> is picking which Curse to perform. The
          round starts in a moment.
        </p>
      </div>
    )
  }

  return (
    <div className="screen">
      <p className="wyr-round">
        Round {game.roundIndex + 1} of {game.totalRounds}
      </p>
      <div className="bm-witch-banner">🔮 You are The Witch</div>
      <h1 className="title">Pick your Curse</h1>
      <p className="hint hint-block">
        Choose whichever one you'd rather act out — only you will see it. The
        stopwatch starts the moment you pick.
      </p>

      {options ? (
        <div className="bm-choose-list">
          <button
            type="button"
            className="bm-choose-card"
            onClick={() => onChoose('physical')}
          >
            <span className="bm-choose-tag bm-choose-tag-physical">Physical</span>
            <span className="bm-choose-text">{options.physical.text}</span>
          </button>
          <button
            type="button"
            className="bm-choose-card"
            onClick={() => onChoose('verbal')}
          >
            <span className="bm-choose-tag bm-choose-tag-verbal">Verbal</span>
            <span className="bm-choose-text">{options.verbal.text}</span>
          </button>
        </div>
      ) : (
        <p className="hint center-text">Loading your Curse options…</p>
      )}
    </div>
  )
}
