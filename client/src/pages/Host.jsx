import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { socket, saveSession } from '../socket'

export default function Host() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Enter your name first.')

    setLoading(true)
    setError('')

    socket.emit('create_room', { name: trimmed }, (res) => {
      setLoading(false)
      if (res.error) return setError(res.error)

      saveSession({
        code: res.room.code,
        playerId: res.playerId,
        token: res.token,
        name: trimmed,
      })
      navigate(`/lobby/${res.room.code}`, { state: { room: res.room } })
    })
  }

  return (
    <div className="screen center">
      <h1 className="title">Host a Game</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <input
          className="input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create Room'}
        </button>
        <Link to="/" className="btn btn-text">
          ← Back
        </Link>
      </form>
    </div>
  )
}
