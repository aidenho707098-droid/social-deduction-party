import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Host from './pages/Host'
import Join from './pages/Join'
import Lobby from './pages/Lobby'
import Twemojify from './Twemojify'
import SoundToggle from './sound/SoundToggle'

export default function App() {
  return (
    <>
      <Twemojify />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/join/:code?" element={<Join />} />
        <Route path="/lobby/:code" element={<Lobby />} />
      </Routes>
      <SoundToggle />
    </>
  )
}
