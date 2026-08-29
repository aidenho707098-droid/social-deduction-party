import { useState } from 'react'

// Crew-only: a private click-to-reveal of the secret word that a player can
// check any time during the round, then hide again so it isn't left sitting
// on screen for a passer-by to read. The imposter has no `word`, so passing
// `word={null}` renders nothing and their screen is unchanged.
export default function WordPeek({ word }) {
  const [shown, setShown] = useState(false)

  if (!word) return null

  return (
    <div className="word-peek">
      <button
        type="button"
        className="btn btn-text word-peek-toggle"
        aria-expanded={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? '🙈 Hide the word' : '👀 Peek at your word'}
      </button>
      {shown && <div className="word-peek-word">{word}</div>}
    </div>
  )
}
