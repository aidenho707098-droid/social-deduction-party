import { useEffect, useRef } from 'react'
import { useSound } from './SoundContext'

// Central "sound director". Mounted once (in Lobby) with the live room /
// role state; it watches for the transitions that deserve a sound and
// fires the shared SFX: lobby joins, game start, round start, per-round
// reveals, end-of-game win/lose, and the tournament between-games screen.
// Individual games stay sound-agnostic — they just change phase and this
// reacts.
//
// A few cues are NOT here because only the component knows their exact
// moment: the tournament wheel spin/land (TournamentWheel), the grand
// finale sting (TournamentComplete), the instant correct/wrong on an Emoji
// guess (GuessMovie), and the "confirm" blip on locking in a vote/answer
// (each submit component).
//
// Covering a NEW game usually needs nothing: game-start, round-start,
// final win/lose and the tournament flow are all generic. Add an entry to
// PHASE_CUES only for a mid-game reveal-type moment specific to that game.

const REVEAL = 'reveal'

// gameId -> (phase -> soundKey | (ctx) -> soundKey|null)
// Only list phases that are NOT a game's first phase (that's covered by
// the generic game-start) and are worth a sound.
const PHASE_CUES = {
  imposter: {
    // single round; 'reveal' is the opening role reveal → game-start covers it
    results: (c) =>
      c.personalWin == null ? REVEAL : c.personalWin ? 'game-win' : 'game-over',
  },
  'would-you-rather': { result: REVEAL },
  'emoji-movie': { reveal: REVEAL },
  fibbage: { reveal: REVEAL },
  'black-magic': {
    active: 'round-start', // the round truly begins when the Witch locks a Curse
    reveal: (c) => (c.bmGuesserIsMe ? 'correct' : REVEAL),
  },
  wavelength: {
    guess: 'round-start', // a valid clue is in — guessing opens
    // 'reveal' has its own needle-landing sound inside RoundReveal
  },
  taboo: {
    guess: 'round-start', // the Describer hit "start" — the clock is live
    reveal: REVEAL,
    // the '-30s' timer-drop alert fires inside GuessRound (play('time-drop'))
  },
  'fake-artist': {
    draw: 'round-start', // the pens are down — the round is live
    vote: 'round-start',
    reveal: REVEAL,
  },
}

function buildCtx(game, myRole, myId) {
  const ctx = { personalWin: null, bmGuesserIsMe: false }

  if (game.id === 'imposter' && game.phase === 'results') {
    if (typeof game.detectivesWin === 'boolean' && myRole?.role) {
      ctx.personalWin =
        myRole.role === 'imposter' ? !game.detectivesWin : game.detectivesWin
    }
  }
  if (game.id === 'black-magic' && game.phase === 'reveal') {
    ctx.bmGuesserIsMe =
      game.result?.outcome === 'lifted' && game.result?.guesserId === myId
  }
  return ctx
}

export function useSoundDirector(room, myRole, myPlayerId) {
  const { play } = useSound()
  const seeded = useRef(false)
  const prev = useRef({
    status: null,
    gameId: null,
    phase: null,
    roundIndex: null,
    tourPhase: null,
  })
  const roundStarted = useRef(new Set()) // "gameId:roundIndex" already announced
  const finalPlayed = useRef(new Set()) // gameId whose final cue already fired
  const knownPlayerIds = useRef(new Set()) // for the lobby "someone joined" blip

  useEffect(() => {
    const status = room?.status ?? null
    const game = room?.game ?? null
    const gameId = game?.id ?? null
    const phase = game?.phase ?? null
    const roundIndex = game?.roundIndex ?? null
    const tour = room?.tournament
    const tourPhase = tour?.active ? tour.phase : null
    const snap = { status, gameId, phase, roundIndex, tourPhase }
    const playerIds = (room?.players ?? []).map((pl) => pl.id)

    // First observed state — don't sound anything for "we just loaded into
    // a room that's already mid-game" (a refresh / reconnect), and take the
    // current roster as the baseline so it doesn't blip for who's already here.
    if (!seeded.current) {
      seeded.current = true
      prev.current = snap
      knownPlayerIds.current = new Set(playerIds)
      return
    }
    const p = prev.current

    // --- Lobby: a new player joined the room ------------------------
    // Subtle welcome blip, lobby only (not for mid-game reconnects).
    let someoneJoined = false
    for (const id of playerIds) {
      if (!knownPlayerIds.current.has(id) && id !== myPlayerId) someoneJoined = true
    }
    knownPlayerIds.current = new Set(playerIds)
    if (someoneJoined && status === 'lobby' && !tourPhase) {
      play('player-join')
    }

    const announceRoundStart = () => {
      const key = `${gameId}:${roundIndex}`
      if (roundStarted.current.has(key)) return
      roundStarted.current.add(key)
      play('round-start')
    }

    // --- Game start: room entered "in-game" ---------------------------
    if (status === 'in-game' && p.status !== 'in-game') {
      play('game-start')
      roundStarted.current = new Set()
      finalPlayed.current = new Set()
      if (gameId != null) roundStarted.current.add(`${gameId}:${roundIndex}`)
    }

    // --- Round advance (rounds 2+ of the same game) ------------------
    if (
      gameId &&
      gameId === p.gameId &&
      roundIndex != null &&
      p.roundIndex != null &&
      roundIndex > p.roundIndex
    ) {
      announceRoundStart()
    }

    // --- Per-game phase-enter cues ----------------------------------
    const phaseChanged =
      !!game &&
      (gameId !== p.gameId || phase !== p.phase || roundIndex !== p.roundIndex)

    if (phaseChanged) {
      const cue = PHASE_CUES[gameId]?.[phase]
      if (cue) {
        const ctx = buildCtx(game, myRole, myPlayerId)
        const key = typeof cue === 'function' ? cue(ctx) : cue
        if (key === 'round-start') announceRoundStart()
        else if (key) play(key)
      }

      // Generic end-of-game standings (standalone games end on 'final';
      // in a tournament the layer intercepts before clients see it).
      if (phase === 'final' && !finalPlayed.current.has(gameId)) {
        finalPlayed.current.add(gameId)
        const iWon = (game.winnerIds ?? []).includes(myPlayerId)
        play(iWon ? 'game-win' : 'game-over')
      }
    }

    // --- Tournament flow ------------------------------------------
    if (tourPhase !== p.tourPhase && tourPhase === 'between') {
      play('reveal') // between-games results screen
    }

    prev.current = snap
  })
}
