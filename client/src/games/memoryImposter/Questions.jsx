import { useState } from 'react'
import { useSound } from '../../sound/SoundContext'
import { ItemToken, Prompt } from './items'
import { itemLabel, usePhaseClock } from './memoryData'
import { MySequence, RoundLine, TimerBar } from './shared'

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

// PROOF QUESTIONS: everyone answers privately. A tap is sent straight away
// as a draft (it counts if the clock runs out); Lock in finishes early.
// No feedback at all until the evidence table.
export default function Questions({ game, priv, actions }) {
  const { play } = useSound()
  const q = game.question
  const msLeft = usePhaseClock(game, q.index)

  // Local pick for THIS question; a refresh restores it from the server.
  const restored = priv?.myAnswer?.qIndex === q.index ? priv.myAnswer : null
  const [state, setState] = useState({ q: q.index, value: restored?.value ?? null, locked: restored?.final ?? false })
  if (state.q !== q.index) setState({ q: q.index, value: restored?.value ?? null, locked: restored?.final ?? false })
  else if (restored && state.value == null) setState({ q: q.index, value: restored.value, locked: restored.final })
  const { value, locked } = state

  function choose(v) {
    if (locked || msLeft <= 0) return
    setState({ q: q.index, value: v, locked: false })
    actions.memoryAnswer(q.index, v, false)
  }

  function lockIn() {
    if (locked || value == null) return
    play('confirm')
    setState({ q: q.index, value, locked: true })
    actions.memoryAnswer(q.index, value, true, (res) => {
      if (!res?.ok && !res?.locked) setState((s) => (s.q === q.index ? { ...s, locked: false } : s))
    })
  }

  let input
  if (q.input === 'count') {
    input = (
      <div className="mi-picker mi-picker-count" role="group" aria-label="How many">
        {Array.from({ length: (game.countMax ?? 5) + 1 }, (_, n) => (
          <button
            key={n}
            type="button"
            className={`mi-key ${value === n ? 'mi-key-on' : ''}`}
            onClick={() => choose(n)}
            disabled={locked}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    )
  } else if (game.sequenceType === 'digits') {
    input = (
      <div className="mi-picker mi-keypad" role="group" aria-label="Keypad">
        {KEYPAD.map((d) => (
          <button
            key={d}
            type="button"
            className={`mi-key ${value === d ? 'mi-key-on' : ''} ${d === '0' ? 'mi-key-zero' : ''}`}
            onClick={() => choose(d)}
            disabled={locked}
            aria-pressed={value === d}
          >
            {d}
          </button>
        ))}
      </div>
    )
  } else {
    input = (
      <div className="mi-picker mi-options" role="group" aria-label="Options">
        {(game.choices ?? []).map((item) => (
          <button
            key={item}
            type="button"
            className={`mi-key mi-key-item ${value === item ? 'mi-key-on' : ''}`}
            onClick={() => choose(item)}
            disabled={locked}
            aria-pressed={value === item}
            aria-label={itemLabel(game.sequenceType, item)}
          >
            <ItemToken type={game.sequenceType} item={item} size={30} />
          </button>
        ))}
      </div>
    )
  }

  const answered = game.answeredIds?.length ?? 0
  return (
    <div className="screen mi-questions">
      <RoundLine game={game} />
      <MySequence game={game} priv={priv} />

      <div className="mi-question" key={q.index}>
        <p className="mi-question-kicker">
          Question {q.index + 1} of {game.questionCount}
        </p>
        <Prompt question={q} type={game.sequenceType} />
      </div>

      <TimerBar key={q.index} msLeft={msLeft} total={game.windowMs} />

      {input}

      {locked ? (
        <p className="banner">
          ✓ Locked in · {answered}/{game.waitingOn ?? answered} done
        </p>
      ) : msLeft <= 0 ? (
        <p className="hint center-text">Time's up{value != null ? '. Your pick counts.' : '.'}</p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={lockIn} disabled={value == null}>
          Lock in
        </button>
      )}
    </div>
  )
}
