import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { socket, SERVER_URL, loadSession, clearSession } from '../socket'
import LobbyView from './LobbyView'
import HostControls from '../HostControls'
import GameMenu from '../games/GameMenu'
import GameCatalogue from '../games/GameCatalogue'
import HowToPlay from '../games/HowToPlay'
import { getGame } from '../games/registry'
import TournamentSetup from '../tournament/TournamentSetup'
import TournamentLineup from '../tournament/TournamentLineup'
import TournamentWheel from '../tournament/TournamentWheel'
import TournamentIntro from '../tournament/TournamentIntro'
import TournamentBetween from '../tournament/TournamentBetween'
import TournamentComplete from '../tournament/TournamentComplete'
import { useSoundDirector } from '../sound/useSoundDirector'
import ChaosOverlay from '../chaos/ChaosOverlay'
import ChaosStatusBar from '../chaos/ChaosStatusBar'
import ChaosVignette from '../chaos/ChaosVignette'

export default function Lobby() {
  const { code } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [room, setRoom] = useState(location.state?.room ?? null)
  const [myRole, setMyRole] = useState(null)
  const [error, setError] = useState('')
  const [kicked, setKicked] = useState(false)
  const [roomClosed, setRoomClosed] = useState(false)
  const [baseUrl, setBaseUrl] = useState(window.location.origin)
  const [connected, setConnected] = useState(socket.connected)

  // Our stable identity for this room, from the session the server handed
  // us when we created/joined. Survives refreshes via localStorage; this
  // is what the player list, host pointer, scores and roles are all keyed
  // to now — NOT socket.id, which changes on every reconnect.
  const [myPlayerId] = useState(() => {
    const s = loadSession()
    return s && s.code === code ? s.playerId : null
  })

  const redirectedRef = useRef(false)
  const lastRoundRef = useRef(null)

  // Host-only local UI state for picking + configuring a game. This never
  // touches the server until the host actually hits "Start Round" — until
  // then it's just navigation on the host's own screen, so everyone else
  // stays on their normal "waiting for host" lobby view.
  const [hostFlow, setHostFlow] = useState('idle') // 'idle' | 'menu' | 'configure'
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [startError, setStartError] = useState('')

  // Any player can open the browse-only Game Catalogue from the lobby.
  const [showCatalogue, setShowCatalogue] = useState(false)

  const isHost = room?.hostId === myPlayerId

  // Watches room / game / tournament state and fires the shared sound
  // effects on the moments that matter (start, reveals, wins, …).
  useSoundDirector(room, myRole, myPlayerId)

  useEffect(() => {
    // Deployed build: the server is on another domain and its LAN IP is
    // meaningless — keep baseUrl as window.location.origin (the real site).
    if (import.meta.env.VITE_SERVER_URL) return
    fetch(`${SERVER_URL}/lan-url`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setBaseUrl(data.url)
      })
      .catch(() => {}) // keep the fallback if the server can't be reached yet
  }, [])

  // Reconnect flow. Every time our socket connects — first load, a page
  // refresh (fresh socket), or an automatic reconnect after a WiFi blip
  // (same socket, new id) — we replay our stored {playerId, token} to the
  // server to reclaim our seat. On the server side that cancels the
  // "remove this player" countdown and catches us back up on room + role.
  useEffect(() => {
    function goToJoin() {
      if (redirectedRef.current) return
      redirectedRef.current = true
      navigate(`/join/${code}`, { replace: true })
    }

    function attemptResume() {
      const s = loadSession()
      if (!s || s.code !== code || !s.playerId || !s.token) {
        // We have no proof we belong here — send them through Join.
        goToJoin()
        return
      }
      socket.emit(
        'resume_session',
        { code, playerId: s.playerId, token: s.token },
        (res) => {
          if (res?.error) {
            // Seat expired or token rejected — start over cleanly.
            clearSession()
            setError(res.error)
            goToJoin()
            return
          }
          setError('')
          setRoom(res.room)
        }
      )
    }

    function handleRoomUpdate(nextRoom) {
      setRoom(nextRoom)
      if (nextRoom.status === 'in-game') {
        setHostFlow('idle')
        setSelectedGameId(null)
        setShowCatalogue(false)
      }
      // A fresh round's private "your_role" arrives as a separate message
      // right after this one — clear out last round's role now so there's
      // no chance of briefly rendering stale private data (a Fact or Fake
      // option id, a Black Magic curse) under the new round's screen
      // before the real one lands.
      const g = nextRoom.game
      const roundChanged = g && g.roundIndex !== lastRoundRef.current
      if (g) lastRoundRef.current = g.roundIndex
      if (roundChanged || g?.phase === 'reveal' || g?.phase === 'write' || g?.phase === 'pick') {
        setMyRole(null)
      }
    }

    function handleYourRole(role) {
      setMyRole(role)
    }

    function handleKicked() {
      // Host removed us. Drop our stored seat so we don't try to resume it,
      // and show the "removed" screen (with a way back to Home / to rejoin).
      clearSession()
      redirectedRef.current = true
      setKicked(true)
    }

    function handleRoomClosed() {
      // The server swept this room as abandoned (empty too long, or idle
      // for hours). The room and its state are gone — clear our seat and
      // show a dead-end screen rather than a frozen lobby.
      clearSession()
      redirectedRef.current = true
      setRoomClosed(true)
    }

    function handleConnect() {
      setConnected(true)
      attemptResume()
    }

    function handleDisconnect() {
      setConnected(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('room_update', handleRoomUpdate)
    socket.on('your_role', handleYourRole)
    socket.on('kicked', handleKicked)
    socket.on('room_closed', handleRoomClosed)

    // If the socket is already up (we just came from Host/Join), the
    // 'connect' event won't fire again — kick off the resume now.
    if (socket.connected) {
      setConnected(true)
      attemptResume()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room_update', handleRoomUpdate)
      socket.off('your_role', handleYourRole)
      socket.off('kicked', handleKicked)
      socket.off('room_closed', handleRoomClosed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function handleStartGame(options) {
    setStartError('')
    socket.emit('start_game', { code, gameId: selectedGameId, options }, (res) => {
      if (res?.error) setStartError(res.error)
    })
  }

  const gameActions = {
    startTurns: () => socket.emit('imposter_start_turns', { code }),
    nextTurn: () => socket.emit('imposter_next_turn', { code }),
    toggleVote: (votedForId) => socket.emit('imposter_toggle_vote', { code, votedForId }),
    // Shared by every game's "Custom Category / Theme / Topic" setup option.
    aiGenerateContent: (gameId, name, cb) =>
      socket.emit('ai_generate_content', { code, gameId, name }, cb),
    wyrAnswer: (choice) => socket.emit('wyr_answer', { code, choice }),
    wyrReveal: () => socket.emit('wyr_reveal', { code }),
    wyrNextRound: () => socket.emit('wyr_next_round', { code }),
    wyrSubmitPrompt: (slotId, text, cb) =>
      socket.emit('wyr_submit_prompt', { code, slotId, text }, cb),
    wyrForceGenerate: () => socket.emit('wyr_force_generate', { code }),
    emojiAnswer: (guess, cb) => socket.emit('emoji_answer', { code, guess }, cb),
    emojiReveal: () => socket.emit('emoji_reveal', { code }),
    emojiNextRound: () => socket.emit('emoji_next_round', { code }),
    fibbageTruthChoose: (slotIndex, choiceIndex, cb) =>
      socket.emit('fibbage_truth_choose', { code, slotIndex, choiceIndex }, cb),
    fibbageTruthSubmit: (text, cb) => socket.emit('fibbage_truth_submit', { code, text }, cb),
    fibbageTruthForce: () => socket.emit('fibbage_truth_force', { code }),
    fibbageSubmit: (text, cb) => socket.emit('fibbage_submit', { code, text }, cb),
    fibbageStartVote: () => socket.emit('fibbage_start_vote', { code }),
    fibbageVote: (optionId, cb) => socket.emit('fibbage_vote', { code, optionId }, cb),
    fibbageReveal: () => socket.emit('fibbage_reveal', { code }),
    fibbageNextRound: () => socket.emit('fibbage_next_round', { code }),
    bmPickWitch: (witchId) => socket.emit('black_magic_pick_witch', { code, witchId }),
    bmChooseCurse: (pick) => socket.emit('black_magic_choose_curse', { code, pick }),
    bmAward: (guesserId) => socket.emit('black_magic_award', { code, guesserId }),
    bmReveal: () => socket.emit('black_magic_reveal', { code }),
    bmNextRound: () => socket.emit('black_magic_next_round', { code }),
    wavelengthSubmitClue: (clue, cb) => socket.emit('wavelength_submit_clue', { code, clue }, cb),
    wavelengthGuess: (guess, cb) => socket.emit('wavelength_guess', { code, guess }, cb),
    wavelengthReveal: () => socket.emit('wavelength_reveal', { code }),
    wavelengthNextRound: () => socket.emit('wavelength_next_round', { code }),
    tabooStartRound: () => socket.emit('taboo_start_round', { code }),
    tabooGuess: (guess, cb) => socket.emit('taboo_guess', { code, guess }, cb),
    tabooReveal: () => socket.emit('taboo_reveal', { code }),
    tabooNextRound: () => socket.emit('taboo_next_round', { code }),
    fakeArtistStart: () => socket.emit('fake_artist_start', { code }),
    fakeArtistSubmit: (image, cb) => socket.emit('fake_artist_submit', { code, image }, cb),
    fakeArtistStartVote: () => socket.emit('fake_artist_start_vote', { code }),
    fakeArtistVote: (targetId, cb) => socket.emit('fake_artist_vote', { code, targetId }, cb),
    fakeArtistGuess: (text, cb) => socket.emit('fake_artist_guess', { code, text }, cb),
    fakeArtistSkipGuess: () => socket.emit('fake_artist_skip_guess', { code }),
    fakeArtistNextRound: () => socket.emit('fake_artist_next_round', { code }),
    backToLobby: () => socket.emit('back_to_lobby', { code }),
    setPlayerColor: (color) => socket.emit('set_player_color', { code, color }),
    kickPlayer: (playerId) => socket.emit('kick_player', { code, playerId }),
    hostForceAdvance: () => socket.emit('host_force_advance', { code }),
    tournamentStart: () => socket.emit('tournament_start', { code }),
    tournamentNext: () => socket.emit('tournament_next', { code }),
    tournamentWheelReady: () => socket.emit('tournament_wheel_ready', { code }),
    tournamentIntroStart: (options) => socket.emit('tournament_intro_start', { code, options }),
    tournamentEnd: () => socket.emit('tournament_end', { code }),
    setChaosFrequency: (frequency) => socket.emit('chaos_set_frequency', { code, frequency }),
    chaosWager: (cb) => socket.emit('chaos_wager', { code }, cb),
    chaosDisableTarget: (targetId, cb) =>
      socket.emit('chaos_disable_target', { code, targetId }, cb),
  }

  // Passed to every game's <Setup> (standalone and inside Tournament Mode)
  // so its "Custom Category / Theme / Topic" option can list this room's
  // already-generated batches and request new ones. The Setup keys into
  // `aiContent` by its own `gameId`.
  const aiProps = {
    aiContent: room?.aiContent ?? {},
    aiEnabled: room?.aiContentEnabled ?? false,
    onGenerateContent: gameActions.aiGenerateContent,
  }

  function handleTournamentConfigure(cfg) {
    setStartError('')
    socket.emit('tournament_configure', { code, ...cfg }, (res) => {
      if (res?.error) setStartError(res.error)
      else setHostFlow('idle')
    })
  }

  // The active screen. Wrapped in an IIFE so the persistent host panel
  // below can be rendered alongside whichever branch wins, without
  // repeating it in every return.
  const screen = (() => {
  if (kicked) {
    return (
      <div className="screen center">
        <p className="hint center-text">You've been removed from the room by the host.</p>
        <p className="hint center-text">You can rejoin any time with the room code.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    )
  }

  if (roomClosed) {
    return (
      <div className="screen center">
        <p className="hint center-text">This room was closed after a long time with no activity.</p>
        <p className="hint center-text">Start a fresh room to play again.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    )
  }

  if (error && redirectedRef.current) {
    return (
      <div className="screen center">
        <p className="error">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="screen center">
        {!connected && <p className="hint">Connecting…</p>}
      </div>
    )
  }

  const disconnectedPlayers = (room.players ?? []).filter((p) => !p.connected)

  // --- Tournament Mode takes over the whole screen while it's active.
  // The "playing" phase falls through to the normal game rendering below;
  // every other phase is a tournament-layer screen.
  const tour = room.tournament
  if (tour?.active && tour.phase !== 'playing') {
    const wrap = (node) => (
      <>
        <ConnectionBanners
          connected={connected}
          disconnectedPlayers={disconnectedPlayers}
        />
        {node}
      </>
    )
    if (tour.phase === 'lineup')
      return wrap(
        <TournamentLineup t={tour} isHost={isHost} onStart={gameActions.tournamentStart} />
      )
    if (tour.phase === 'wheel')
      return wrap(
        <TournamentWheel t={tour} isHost={isHost} onReady={gameActions.tournamentWheelReady} />
      )
    if (tour.phase === 'intro')
      return wrap(
        <TournamentIntro
          t={tour}
          isHost={isHost}
          playerCount={room.players.length}
          savedByGame={room.gameSettings ?? {}}
          onStart={gameActions.tournamentIntroStart}
          {...aiProps}
        />
      )
    if (tour.phase === 'between')
      return wrap(
        <TournamentBetween
          t={tour}
          players={room.players}
          myId={myPlayerId}
          isHost={isHost}
          onNext={gameActions.tournamentNext}
        />
      )
    if (tour.phase === 'complete')
      return wrap(
        <TournamentComplete
          t={tour}
          players={room.players}
          myId={myPlayerId}
          isHost={isHost}
          onDone={gameActions.tournamentEnd}
        />
      )
  }

  // A game is running — hand off to that game's own component. Every game
  // in the registry takes the same props: the public game state, the
  // player list, this client's own private role data, and a bundle of
  // action callbacks that emit that game's socket events.
  if (room.status === 'in-game' && room.game) {
    const activeGame = getGame(room.game.id)
    if (!activeGame) return null
    return (
      <>
        <ConnectionBanners
          connected={connected}
          disconnectedPlayers={disconnectedPlayers}
        />
        <activeGame.Game
          game={room.game}
          players={room.players}
          myRole={myRole}
          isHost={isHost}
          myId={myPlayerId}
          actions={gameActions}
        />
        <HowToPlay gameId={room.game.id} variant="fab" />
      </>
    )
  }

  // Any player opened the browse-only Game Catalogue from the lobby.
  if (showCatalogue) {
    return <GameCatalogue onClose={() => setShowCatalogue(false)} />
  }

  // Host chose "Tournament Mode" from the lobby — configure it.
  if (isHost && hostFlow === 'tournament') {
    return (
      <TournamentSetup
        playerCount={room.players.length}
        savedByGame={room.gameSettings ?? {}}
        onConfigure={handleTournamentConfigure}
        onCancel={() => setHostFlow('idle')}
        {...aiProps}
      />
    )
  }

  // Host clicked "Start Game" — show the picker.
  if (isHost && hostFlow === 'menu') {
    return (
      <GameMenu
        playerCount={room.players.length}
        onPick={(gameId) => {
          setSelectedGameId(gameId)
          setHostFlow('configure')
        }}
        onCancel={() => setHostFlow('idle')}
      />
    )
  }

  // Host picked a game — show that game's own setup form.
  if (isHost && hostFlow === 'configure') {
    const selectedGame = getGame(selectedGameId)
    return (
      <selectedGame.Setup
        gameId={selectedGameId}
        playerCount={room.players.length}
        saved={room.gameSettings?.[selectedGameId]}
        onStart={handleStartGame}
        onCancel={() => setHostFlow('menu')}
        error={startError}
        {...aiProps}
      />
    )
  }

  return (
    <>
      <ConnectionBanners
        connected={connected}
        disconnectedPlayers={disconnectedPlayers}
      />
      <LobbyView
        code={code}
        players={room.players}
        isHost={isHost}
        myPlayerId={myPlayerId}
        baseUrl={baseUrl}
        chaosFrequency={room.chaos?.frequency ?? 'off'}
        onSetChaosFrequency={gameActions.setChaosFrequency}
        onStartGame={() => setHostFlow('menu')}
        onTournament={() => setHostFlow('tournament')}
        onCatalogue={() => setShowCatalogue(true)}
        onPickColor={gameActions.setPlayerColor}
      />
    </>
  )
  })()

  return (
    <>
      {room?.status === 'in-game' && room?.chaos?.event && (
        <ChaosStatusBar
          event={room.chaos.event}
          players={room.players}
          myId={myPlayerId}
          actions={gameActions}
        />
      )}
      {screen}
      {room?.chaos?.event && (
        <ChaosOverlay
          key={room.chaos.event.roundKey}
          event={room.chaos.event}
          players={room.players ?? []}
          myScore={
            (room.game?.scores ?? []).find((s) => s.playerId === myPlayerId)?.score ?? 0
          }
          actions={gameActions}
        />
      )}
      {room?.status === 'in-game' &&
        room?.chaos?.event?.modifier?.id === 'countdown-chaos' &&
        room.chaos.event.roundKey ===
          `${room.game?.id}:${room.game?.roundIndex}` && (
          <ChaosVignette game={room.game} />
        )}
      {isHost && room && !kicked && !roomClosed && (
        <HostControls
          room={room}
          myPlayerId={myPlayerId}
          onKick={gameActions.kickPlayer}
          onForceAdvance={gameActions.hostForceAdvance}
          onEndGame={gameActions.backToLobby}
        />
      )}
    </>
  )
}

// Two thin status strips shown above whatever screen is active, so a
// disconnect is never silent — for this device OR for anyone else.
function ConnectionBanners({ connected, disconnectedPlayers }) {
  if (connected && disconnectedPlayers.length === 0) return null

  return (
    <div className="conn-banners">
      {!connected && (
        <p className="conn-banner conn-banner-self">
          Connection lost — reconnecting…
        </p>
      )}
      {disconnectedPlayers.length > 0 && (
        <p className="conn-banner conn-banner-others">
          {disconnectedPlayers.map((p) => p.name).join(', ')}{' '}
          {disconnectedPlayers.length === 1 ? 'has' : 'have'} disconnected —
          holding their spot for a moment…
        </p>
      )}
    </div>
  )
}
