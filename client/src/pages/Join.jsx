import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { socket, saveSession } from '../socket'

export default function Join() {
  const { code: codeFromUrl } = useParams()
  const [name, setName] = useState('')
  const [code, setCode] = useState(codeFromUrl?.toUpperCase() ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedName) return setError('Enter your name first.')
    if (!trimmedCode) return setError('Enter the room code.')

    setLoading(true)
    setError('')

    socket.emit('join_room', { code: trimmedCode, name: trimmedName }, (res) => {
      setLoading(false)
      if (res.error) return setError(res.error)

      saveSession({
        code: res.room.code,
        playerId: res.playerId,
        token: res.token,
        name: trimmedName,
      })
      navigate(`/lobby/${res.room.code}`, { state: { room: res.room } })
    })
  }

  return (
    <div className="screen center">
      <h1 className="title">Join a Game</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <input
          className="input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus={!codeFromUrl}
        />
        <input
          className="input input-code"
          type="text"
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          autoFocus={Boolean(codeFromUrl)}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Joining…' : 'Join Room'}
        </button>
        <Link to="/" className="btn btn-text">
          ← Back
        </Link>
      </form>
    </div>
  )
}
