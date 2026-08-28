import { Link } from 'react-router-dom'
import { loadSession } from '../socket'

export default function Home() {
  const session = loadSession()

  return (
    <div className="screen center">
      <h1 className="title">🎉 Party Game</h1>
      <p className="subtitle">Play together, no shared screen needed.</p>

      <div className="stack">
        {session?.code && (
          <Link to={`/lobby/${session.code}`} className="btn btn-primary">
            Rejoin room {session.code}
          </Link>
        )}
        <Link
          to="/host"
          className={session?.code ? 'btn btn-secondary' : 'btn btn-primary'}
        >
          Host a Game
        </Link>
        <Link to="/join" className="btn btn-secondary">
          Join a Game
        </Link>
      </div>
    </div>
  )
}
