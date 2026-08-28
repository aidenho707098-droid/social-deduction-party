// "Fact or Fake" — a bluffing trivia game. Each round everyone sees an
// obscure true fact with a blank. Players privately type a FAKE answer to fill the
// blank; then all the fakes are shuffled together with the REAL answer and
// shown anonymized. Everyone votes for which one they think is true.
//
//   * +2 for voting for (or having written) the true answer
//   * +1 for every OTHER player fooled into voting for your fake
//
// Attribution (who wrote which fake) lives ONLY in this module until the
// reveal phase. getPublicState() during "vote" deliberately strips every
// ownership / truth marker — see the whitelist there.

// Each entry: a prompt containing the marker "___" and the real answer
// that fills it. Every answer is a WORD or SHORT PHRASE (never a bare
// number) — open-ended answers make for funnier, more creative fake
// submissions than guessing a plausible figure. Facts are picked at
// random per game with no repeats within a game.
const FACTS = [
  // --- Animals ---
  { prompt: "A group of flamingos is called a ___.", answer: "flamboyance" },
  { prompt: "A group of pugs is called a ___.", answer: "grumble" },
  { prompt: "A group of crows is called a ___.", answer: "murder" },
  { prompt: "A group of jellyfish is called a ___.", answer: "smack" },
  { prompt: "A group of ferrets is called a ___.", answer: "business" },
  { prompt: "A shrimp's heart is located in its ___.", answer: "head" },
  { prompt: "Sea otters hold ___ while they sleep so they don't drift apart.", answer: "hands" },
  { prompt: "Wombats produce ___-shaped droppings.", answer: "cube" },
  { prompt: "Crocodiles are physically unable to stick out their ___.", answer: "tongue" },
  { prompt: "An ostrich's eye is bigger than its ___.", answer: "brain" },
  { prompt: "Bees can be trained to recognize human ___.", answer: "faces" },
  { prompt: "Sharks are older than ___ — they existed before those first appeared on land.", answer: "trees" },
  { prompt: "Reindeer eyes change color from gold in summer to ___ in winter.", answer: "blue" },
  { prompt: "The heart of a blue whale is roughly the size of a ___.", answer: "small car" },
  { prompt: "A swirling, shape-shifting flock of starlings is called a ___.", answer: "murmuration" },
  { prompt: "Tigers have striped ___, not just striped fur.", answer: "skin" },
  { prompt: "Kangaroos physically cannot ___ backwards.", answer: "hop" },
  { prompt: "Slugs and snails have thousands of tiny teeth on a tongue-like organ called a ___.", answer: "radula" },
  { prompt: "Cows form close friendships and get stressed when separated from their ___.", answer: "best friend" },
  { prompt: "An octopus's blood is ___ rather than red.", answer: "blue" },
  { prompt: "An armadillo's protective shell is actually made of ___.", answer: "bone" },
  { prompt: "The only bird that can fly backwards is the ___.", answer: "hummingbird" },
  { prompt: "A snail leaves a trail of ___ to help it glide along the ground.", answer: "slime" },

  // --- Space & science ---
  { prompt: "A single day on Venus lasts longer than a whole ___ on Venus.", answer: "year" },
  { prompt: "Venus spins the opposite way to most planets, so there the Sun rises in the ___.", answer: "west" },
  { prompt: "It rains diamonds on Neptune and ___.", answer: "Uranus" },
  { prompt: "Saturn is so low in density that it would ___ if placed in a big enough tub of water.", answer: "float" },
  { prompt: "A lightning bolt can be several times hotter than the surface of the ___.", answer: "Sun" },
  { prompt: "Helium was discovered in the ___ before it was ever found on Earth.", answer: "Sun" },
  { prompt: "Bananas are slightly radioactive because they're rich in the element ___.", answer: "potassium" },
  { prompt: "The Eiffel Tower can be over 15 cm taller in ___ because the metal expands in the heat.", answer: "summer" },
  { prompt: "The loud crack of a whip happens because its tip breaks the ___.", answer: "sound barrier" },
  { prompt: "Golf balls are covered in dimples because a dimpled ball ___ than a smooth one.", answer: "flies farther" },
  { prompt: "Sound cannot travel at all through a ___.", answer: "vacuum" },
  { prompt: "Hot water can sometimes freeze faster than cold water, an effect named after a schoolboy called ___.", answer: "Mpemba" },
  { prompt: "Astronauts can grow up to 5 cm taller in orbit because their ___ stretches out.", answer: "spine" },

  // --- Earth & geography ---
  { prompt: "The largest desert on Earth is actually ___.", answer: "Antarctica" },
  { prompt: "The Sahara Desert is roughly the same size as the ___.", answer: "United States" },
  { prompt: "Canada contains more ___ than the rest of the world put together.", answer: "lakes" },
  { prompt: "The Canary Islands are actually named after ___, not the birds.", answer: "dogs" },
  { prompt: "Africa is the only continent that lies in all four ___.", answer: "hemispheres" },
  { prompt: "The Dead Sea is so salty that swimmers naturally ___ in it.", answer: "float" },
  { prompt: "The most remote spot in the ocean is so far from land that the nearest people are usually astronauts on the ___.", answer: "space station" },
  { prompt: "In the Norwegian town of Longyearbyen it is famously effectively not allowed to be ___.", answer: "buried" },
  { prompt: "The most expensive spice in the world by weight is ___.", answer: "saffron" },

  // --- History ---
  { prompt: "Cleopatra lived closer in time to the first Moon landing than to the building of the Great ___.", answer: "Pyramid" },
  { prompt: "Oxford University was already teaching students before the ___ Empire even existed.", answer: "Aztec" },
  { prompt: "In medieval Europe, animals such as rats and locusts could be put on trial and formally ___.", answer: "excommunicated" },
  { prompt: "In 1518 a dancing ___ swept through Strasbourg, with people dancing for days on end.", answer: "plague" },
  { prompt: "Ancient Romans collected human ___ and used it as mouthwash and to clean clothes.", answer: "urine" },
  { prompt: "Napoleon was once swarmed and forced to retreat by a horde of ___.", answer: "rabbits" },
  { prompt: "At the court of Henry VIII, one servant's official job was 'Groom of the ___'.", answer: "Stool" },
  { prompt: "The first message sent over the early internet was meant to be 'LOGIN', but the system crashed after the letters ___.", answer: "LO" },
  { prompt: "The English word 'salary' comes from the Latin word for ___.", answer: "salt" },
  { prompt: "The very first item ever sold on eBay was a broken ___.", answer: "laser pointer" },
  { prompt: "Before rubber erasers existed, people rubbed out pencil marks with balled-up ___.", answer: "bread" },
  { prompt: "Tug of war used to be an official Olympic ___.", answer: "event" },
  { prompt: "The first webcam was set up at Cambridge University so researchers could keep an eye on a ___.", answer: "coffee pot" },
  { prompt: "The founder of Twitter's very first tweet was 'just setting up my ___'.", answer: "twttr" },

  // --- Food & plants ---
  { prompt: "Peanuts are not true nuts; botanically they are ___.", answer: "legumes" },
  { prompt: "Botanically speaking, a banana is a ___.", answer: "berry" },
  { prompt: "Carrots were originally purple, and the orange variety was bred in the ___.", answer: "Netherlands" },
  { prompt: "Honey basically never ___ — pots of it from ancient tombs are still edible.", answer: "spoils" },
  { prompt: "A pineapple is not one fruit but a cluster of ___ fused together.", answer: "berries" },
  { prompt: "Almost every banana sold in shops is a single variety called the ___.", answer: "Cavendish" },
  { prompt: "Eaten in large amounts, the spice ___ is mildly hallucinogenic and toxic.", answer: "nutmeg" },
  { prompt: "In the 1830s, ketchup was briefly sold as a ___.", answer: "medicine" },
  { prompt: "Farmers sort cranberries by whether they ___, since fresh ones do and spoiled ones don't.", answer: "bounce" },

  // --- The human body ---
  { prompt: "Babies are born without ___ — they don't fully form until a few years old.", answer: "kneecaps" },
  { prompt: "Relative to its size, the strongest muscle in the human body is the ___.", answer: "masseter" },
  { prompt: "Stomach acid is strong enough to dissolve ___.", answer: "metal" },
  { prompt: "The Mona Lisa famously has no ___.", answer: "eyebrows" },
  { prompt: "The little groove running from your nose to your top lip is called the ___.", answer: "philtrum" },
  { prompt: "Goosebumps are caused by a tiny muscle that tugs on each ___.", answer: "hair" },

  // --- Words, symbols & odds and ends ---
  { prompt: "The dot on top of a lowercase 'i' or 'j' is called a ___.", answer: "tittle" },
  { prompt: "The little plastic or metal tip on the end of a shoelace is called an ___.", answer: "aglet" },
  { prompt: "There are more ways to shuffle a deck of cards than there are ___ on Earth.", answer: "atoms" },
  { prompt: "The King of Hearts is the only king in a standard deck without a ___.", answer: "moustache" },
  { prompt: "The infinity symbol has a proper name: the ___.", answer: "lemniscate" },
  { prompt: "The abbreviation 'OK' is thought to come from a jokey 1830s misspelling of '___'.", answer: "all correct" },
  { prompt: "The letter 'Q' does not appear in the name of any U.S. ___.", answer: "state" },
  { prompt: "A 'baker's dozen' has a spare loaf because bakers once feared being punished for selling ___ bread.", answer: "underweight" },
  { prompt: "The Hawaiian word 'aloha' can mean hello, goodbye and ___.", answer: "love" },
  { prompt: "The longest word in most English dictionaries is a lung disease caused by breathing in ___ dust.", answer: "volcanic" },
  { prompt: "The punctuation mark called a 'full stop' in Britain is called a ___ in America.", answer: "period" },
  { prompt: "Nintendo was founded in 1889 and originally made ___.", answer: "playing cards" },
  { prompt: "Scotland's official national animal is the ___.", answer: "unicorn" },
  { prompt: "An average fluffy cumulus cloud weighs about the same as 100 ___.", answer: "elephants" },
  { prompt: "The combined weight of all the ants on Earth has been estimated to rival that of all the ___.", answer: "humans" },
  { prompt: "The world's first video game, built in 1958, was called '___'.", answer: "Tennis for Two" },
  { prompt: "The cardboard sleeve that stops a takeaway coffee cup burning your hand is called a ___.", answer: "zarf" },
  { prompt: "In 'D-Day', the 'D' officially just stands for ___.", answer: "Day" },
  { prompt: "The 'jack' in a deck of playing cards used to be known as the ___.", answer: "knave" },
  { prompt: "The bumps on the top of a Lego brick are officially called ___.", answer: "studs" },
  { prompt: "Bubble wrap was originally invented and sold as ___.", answer: "wallpaper" },
  { prompt: "The two M's in 'M&M's' stand for Mars and ___.", answer: "Murrie" },
  { prompt: "Flamingos are thought to stand on one leg mainly to help them ___.", answer: "stay warm" },
]

export const id = "fibbage"
export const name = "Fact or Fake"
export const minPlayers = 3

// Time to write a fake answer, and time to vote. The client shows a
// countdown seeded from `msLeft`; when it hits zero the host's device asks
// the server to advance. The host can also advance early.
const WRITE_MS = 45_000
const VOTE_MS = 30_000

// Scoring.
const TRUTH_POINTS = 2 // voted for (or wrote) the real answer
const FOOL_POINTS = 1 // per other player who voted for your fake

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Lowercase, drop a leading article, strip anything that isn't a letter or
// digit, collapse the rest. So "42 Seconds", "forty-two seconds" stay
// distinct (good — different guesses) but "The Sun", "the sun ", "THESUN"
// all collapse together, and a fake that exactly matches the real answer
// gets folded into it.
function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
}

let optionSeq = 0
function makeOptionId() {
  optionSeq += 1
  return `opt_${optionSeq}_${Math.random().toString(36).slice(2, 8)}`
}

export function createGame(playerIds, { rounds }) {
  const requested = Number(rounds)
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.")
  }

  const deck = shuffle(FACTS)
  const totalRounds = Math.min(requested, deck.length)
  const now = Date.now()

  return {
    id,
    phase: "write", // "write" -> "vote" -> "reveal" -> ("write" ...) -> "final"
    totalRounds,
    roundIndex: 0,
    facts: deck.slice(0, totalRounds), // each { prompt, answer }
    submissions: new Map(), // playerId -> fake answer text, current round only
    answerOptions: null, // built by startVoting(); the ONLY place ownership lives
    votes: new Map(), // playerId -> optionId, current round only
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    phaseStartedAt: now,
    deadline: now + WRITE_MS,
    lastResult: null, // filled in by revealRound()
  }
}

// Record (or overwrite) a player's fake answer. Once every present player
// has submitted, voting starts automatically.
export function submitAnswer(game, playerId, rawText, presentPlayerIds) {
  if (game.phase !== "write") return { ok: false }
  if (Date.now() > game.deadline + 1500) return { ok: false, tooLate: true }

  const text = String(rawText ?? "").slice(0, 120).trim()
  if (!text) return { ok: false, empty: true }

  game.submissions.set(playerId, text)

  if (
    presentPlayerIds.length > 0 &&
    presentPlayerIds.every((pid) => game.submissions.has(pid))
  ) {
    startVoting(game, presentPlayerIds)
  }
  return { ok: true, text }
}

// Move from writing to voting: pool the real answer with every fake,
// merging exact-normalized duplicates (including a fake that happens to
// match the truth), then SHUFFLE. After this, `answerOptions` is the
// server's private source of truth for who wrote what.
export function startVoting(game) {
  if (game.phase !== "write") return

  const fact = game.facts[game.roundIndex]
  const options = [
    {
      id: makeOptionId(),
      text: fact.answer,
      normalized: normalize(fact.answer),
      ownerIds: [], // players who wrote something identical to the truth
      isTruth: true,
      voterIds: [],
    },
  ]

  for (const [pid, text] of game.submissions) {
    const norm = normalize(text)
    const existing = norm && options.find((o) => o.normalized === norm)
    if (existing) {
      existing.ownerIds.push(pid)
    } else {
      options.push({
        id: makeOptionId(),
        text,
        normalized: norm,
        ownerIds: [pid],
        isTruth: false,
        voterIds: [],
      })
    }
  }

  game.answerOptions = shuffle(options)
  game.votes = new Map()
  game.phaseStartedAt = Date.now()
  game.deadline = Date.now() + VOTE_MS
  game.phase = "vote"
}

// Record (or change) a player's vote. A player may not vote for an option
// they wrote. Once every present player has voted, the round reveals.
export function submitVote(game, playerId, optionId, presentPlayerIds) {
  if (game.phase !== "vote") return { ok: false }
  if (Date.now() > game.deadline + 1500) return { ok: false, tooLate: true }

  const option = game.answerOptions?.find((o) => o.id === optionId)
  if (!option) return { ok: false }
  if (option.ownerIds.includes(playerId)) return { ok: false, ownAnswer: true }

  game.votes.set(playerId, optionId)

  if (
    presentPlayerIds.length > 0 &&
    presentPlayerIds.every((pid) => game.votes.has(pid))
  ) {
    revealRound(game, presentPlayerIds)
  }
  return { ok: true }
}

// Score the round and freeze a full, no-longer-secret breakdown for the
// reveal screen: the real answer, who wrote each fake, and who voted for
// what.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "vote") return

  const fact = game.facts[game.roundIndex]
  const options = game.answerOptions ?? []

  // Recompute voterIds fresh from the vote map.
  for (const option of options) option.voterIds = []
  for (const [voterId, optionId] of game.votes) {
    const option = options.find((o) => o.id === optionId)
    if (option) option.voterIds.push(voterId)
  }

  // Per-player round breakdown. Kept split by SOURCE so the reveal screen
  // can show "guessed the truth" points separately from "fooled someone"
  // points: gained === truthPoints + foolPoints.
  const roundScores = {}
  const ensure = (pid) => {
    if (!roundScores[pid]) {
      roundScores[pid] = {
        gained: 0,
        foundTruth: false,
        truthPoints: 0,
        fooled: 0,
        foolPoints: 0,
      }
    }
    return roundScores[pid]
  }
  for (const pid of presentPlayerIds) ensure(pid)

  const truth = options.find((o) => o.isTruth)

  // +TRUTH_POINTS for voting for the real answer...
  for (const voterId of truth?.voterIds ?? []) {
    const rs = ensure(voterId)
    if (!rs.foundTruth) {
      rs.foundTruth = true
      rs.truthPoints = TRUTH_POINTS
      rs.gained += TRUTH_POINTS
    }
  }
  // ...and for having written it (those players can't vote for it).
  for (const ownerId of truth?.ownerIds ?? []) {
    const rs = ensure(ownerId)
    if (!rs.foundTruth) {
      rs.foundTruth = true
      rs.truthPoints = TRUTH_POINTS
      rs.gained += TRUTH_POINTS
    }
  }

  // +FOOL_POINTS to a fake's author for each OTHER player who voted for it.
  for (const option of options) {
    if (option.isTruth) continue
    const fooledVoters = option.voterIds.filter((v) => !option.ownerIds.includes(v))
    for (const ownerId of option.ownerIds) {
      const rs = ensure(ownerId)
      rs.fooled += fooledVoters.length
      rs.foolPoints += fooledVoters.length * FOOL_POINTS
      rs.gained += fooledVoters.length * FOOL_POINTS
    }
  }

  for (const [pid, rs] of Object.entries(roundScores)) {
    if (rs.gained) game.scores.set(pid, (game.scores.get(pid) ?? 0) + rs.gained)
  }

  game.lastResult = {
    roundIndex: game.roundIndex,
    prompt: fact.prompt,
    answer: fact.answer,
    options: options.map((o) => ({
      id: o.id,
      text: o.text,
      isTruth: o.isTruth,
      ownerIds: [...o.ownerIds],
      voterIds: [...o.voterIds],
    })),
    roundScores,
  }
  game.phase = "reveal"
}

export function nextRound(game) {
  if (game.phase !== "reveal") return

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final"
    return
  }
  game.roundIndex += 1
  game.submissions = new Map()
  game.answerOptions = null
  game.votes = new Map()
  game.phaseStartedAt = Date.now()
  game.deadline = Date.now() + WRITE_MS
  game.phase = "write"
}

// Optional framework hook: called when the connected-player set changes.
// Don't let a round hang on someone who's gone — if everyone still here has
// submitted / voted, move on.
export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return
  if (game.phase === "write" && presentPlayerIds.every((pid) => game.submissions.has(pid))) {
    startVoting(game, presentPlayerIds)
  } else if (game.phase === "vote" && presentPlayerIds.every((pid) => game.votes.has(pid))) {
    revealRound(game, presentPlayerIds)
  }
}

// The PUBLIC view — identical for every player. The whitelist per phase is
// the privacy boundary: during "write" the real answer is withheld;
// during "vote" the options carry ONLY an opaque id and their text — no
// author, no truth flag, no submission order.
export function getPublicState(game, presentPlayerIds) {
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score)

  const now = Date.now()
  const fact = game.facts[game.roundIndex]

  const state = {
    id: game.id,
    phase: game.phase,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    prompt: fact.prompt,
    totalPlayers: presentPlayerIds.length,
    writeMs: WRITE_MS,
    voteMs: VOTE_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  }

  if (game.phase === "write") {
    state.submittedPlayerIds = presentPlayerIds.filter((pid) => game.submissions.has(pid))
  }

  if (game.phase === "vote") {
    // Anonymized: opaque id + text only, in the pre-shuffled order.
    state.options = (game.answerOptions ?? []).map((o) => ({ id: o.id, text: o.text }))
    state.votedPlayerIds = presentPlayerIds.filter((pid) => game.votes.has(pid))
  }

  if (game.phase === "reveal") {
    state.result = game.lastResult
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : []
  }

  return state
}

// Per-player secret: during voting, tells THIS player which option is
// their own so the client can disable it. Nothing else is private.
export function getPrivateState(game, playerId) {
  if (game.phase === "vote" && game.answerOptions) {
    const mine = game.answerOptions.find((o) => o.ownerIds.includes(playerId))
    return { myOptionId: mine ? mine.id : null }
  }
  return null
}

// --- Tournament Mode: default per-game config when run inside a tournament.
export function tournamentOptions() {
  return { rounds: 3 }
}
