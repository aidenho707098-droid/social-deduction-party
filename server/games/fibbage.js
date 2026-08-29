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

import { shuffle, drawWithoutRepeats } from "./deck.js"

// Each entry: a prompt containing the marker "___" and the real answer
// that fills it. Every answer is a WORD or SHORT PHRASE (never a bare
// number) — open-ended answers make for funnier, more creative fake
// submissions than guessing a plausible figure. Facts are picked at
// random with no repeats within a session (see server/games/deck.js).
const FACTS = [
  // --- Animals ---
  { prompt: "A group of flamingos is called a ___.", answer: "flamboyance" },
  { prompt: "A group of pugs is called a ___.", answer: "grumble" },
  { prompt: "A group of ferrets is called a ___.", answer: "business" },
  { prompt: "A group of porcupines is called a ___.", answer: "prickle" },
  { prompt: "A shrimp's heart is located in its ___.", answer: "head" },
  { prompt: "Crocodiles are physically unable to stick out their ___.", answer: "tongue" },
  { prompt: "Bees can be trained to recognise human ___.", answer: "faces" },
  { prompt: "Reindeer eyes change colour from gold in summer to ___ in the dark of winter.", answer: "blue" },
  { prompt: "A swirling, shape-shifting flock of starlings is called a ___.", answer: "murmuration" },
  { prompt: "Tigers have striped ___, not just striped fur.", answer: "skin" },
  { prompt: "Slugs and snails scrape food with a tongue-like organ covered in tiny teeth called a ___.", answer: "radula" },
  { prompt: "Dairy cows form close friendships and get visibly stressed when separated from their ___.", answer: "best friend" },
  { prompt: "An armadillo's protective shell is actually made of ___.", answer: "bone" },
  { prompt: "A woodpecker's tongue wraps around the back of its ___ to cushion the hammering.", answer: "skull" },
  { prompt: "A newborn kangaroo is roughly the size of a ___.", answer: "jellybean" },
  { prompt: "Wombat pouches face ___ so they don't fill with dirt while the mother digs.", answer: "backwards" },
  { prompt: "Sea otters keep a favourite ___ in a loose pouch of skin under one arm.", answer: "rock" },
  { prompt: "Housecats cannot taste ___ at all.", answer: "sweetness" },
  { prompt: "Turritopsis jellyfish can revert to an earlier life stage, making them effectively ___.", answer: "immortal" },
  { prompt: "Naked mole rats are strikingly resistant to ___ and barely age.", answer: "cancer" },
  { prompt: "Barn owls are almost silent in flight thanks to the fringed edges of their ___.", answer: "feathers" },
  { prompt: "Tardigrades have survived direct exposure to the vacuum of ___.", answer: "space" },
  { prompt: "A domestic cat's 'meow' is mostly reserved for talking to ___, not to other cats.", answer: "humans" },
  { prompt: "Male ring-tailed lemurs have 'stink fights', wafting scent from their ___ at rivals.", answer: "tails" },
  { prompt: "Vultures often urinate on their own ___ to kill bacteria and cool off.", answer: "legs" },
  { prompt: "A pistol shrimp's claw snaps shut so fast it briefly produces a flash of ___.", answer: "light" },
  { prompt: "Elephants can recognise themselves in a ___, a rare sign of self-awareness.", answer: "mirror" },
  { prompt: "Emperor penguins can dive deeper than 500 metres and stay under for over 20 ___.", answer: "minutes" },
  { prompt: "The mantis shrimp's eyes can detect a kind of light humans can't: ___ light.", answer: "polarised" },
  { prompt: "Herring are thought to communicate at night by releasing bursts of ___.", answer: "bubbles" },

  // --- Space & science ---
  { prompt: "Venus spins backwards compared with most planets, so there the Sun rises in the ___.", answer: "west" },
  { prompt: "Saturn's density is so low that the whole planet would ___ in a big enough tub of water.", answer: "float" },
  { prompt: "Helium was detected in the ___ before it was ever found on Earth.", answer: "Sun" },
  { prompt: "Hot water can sometimes freeze faster than cold water — an effect named after a schoolboy called ___.", answer: "Mpemba" },
  { prompt: "Astronauts can grow up to 5 cm taller in orbit because their ___ stretches out.", answer: "spine" },
  { prompt: "A day on Mercury (sunrise to sunrise) lasts about two Mercury ___.", answer: "years" },
  { prompt: "The footprints left by the Apollo astronauts should last millions of years because the Moon has almost no ___.", answer: "erosion" },
  { prompt: "Glass is not truly a solid or a liquid; physicists often call it an ___ solid.", answer: "amorphous" },
  { prompt: "The element gallium has such a low melting point that it turns to liquid in your ___.", answer: "hand" },
  { prompt: "Honey's resistance to spoiling comes partly from its very low ___ content.", answer: "water" },
  { prompt: "A teaspoonful of material from a neutron star would weigh about the same as a ___.", answer: "mountain" },
  { prompt: "The Voyager 1 probe carries a golden ___ with sounds and images from Earth.", answer: "record" },
  { prompt: "Lightning strikes can fuse sand into brittle glass tubes called ___.", answer: "fulgurites" },
  { prompt: "The smell of rain on dry ground has a name: ___.", answer: "petrichor" },
  { prompt: "Because light takes time to travel, looking at distant galaxies is effectively looking into the ___.", answer: "past" },
  { prompt: "In 1976 the Viking landers ran the only life-detection experiments ever performed on the surface of ___.", answer: "Mars" },
  { prompt: "Cosmic rays passing through your body cause a few of your atoms to change, a process called ___.", answer: "mutation" },
  { prompt: "Diamonds are not forever: left long enough they slowly turn into ___.", answer: "graphite" },
  { prompt: "The loudest sound in recorded history was the 1883 eruption of ___.", answer: "Krakatoa" },
  { prompt: "Water can exist as solid, liquid and gas all at once at a specific temperature and pressure called the ___ point.", answer: "triple" },

  // --- Earth & geography ---
  { prompt: "The Canary Islands are named after ___, not the birds.", answer: "dogs" },
  { prompt: "Africa is the only continent that lies in all four ___.", answer: "hemispheres" },
  { prompt: "The oceanic point farthest from any land is nicknamed Point ___.", answer: "Nemo" },
  { prompt: "In the Svalbard town of Longyearbyen it is effectively not permitted to be ___.", answer: "buried" },
  { prompt: "The country with the most time zones, counting its overseas territories, is ___.", answer: "France" },
  { prompt: "The Sargasso Sea is the only sea on Earth with no ___.", answer: "coastline" },
  { prompt: "Mount Everest is not the point farthest from Earth's centre — that's Mount ___ in Ecuador.", answer: "Chimborazo" },
  { prompt: "The Caspian Sea is, by most definitions, actually the world's largest ___.", answer: "lake" },
  { prompt: "Lake Baikal in Siberia holds about one fifth of the world's unfrozen fresh ___.", answer: "water" },
  { prompt: "The town of Hell, ___, USA regularly does freeze over in winter.", answer: "Michigan" },
  { prompt: "The Atacama Desert in Chile has places where no ___ has ever been recorded.", answer: "rain" },
  { prompt: "The Danakil Depression in Ethiopia has ground temperatures making it one of the hottest inhabited places, and its pools are coloured by ___.", answer: "sulphur" },
  { prompt: "Australia is wider than the ___.", answer: "Moon" },
  { prompt: "There is a waterfall beneath the ocean's surface near ___, formed by dense cold water sinking.", answer: "Denmark" },
  { prompt: "Nauru, once one of the richest countries per person, built its wealth on bird ___.", answer: "droppings" },
  { prompt: "The Great Wall of China is held together in places by mortar mixed with sticky ___.", answer: "rice" },

  // --- History ---
  { prompt: "Oxford University was already teaching students before the ___ Empire even existed.", answer: "Aztec" },
  { prompt: "In medieval Europe, animals such as rats and locusts could be put on trial and formally ___.", answer: "excommunicated" },
  { prompt: "In 1518, a dancing ___ swept through Strasbourg, with people dancing for days on end.", answer: "plague" },
  { prompt: "Ancient Romans collected human ___ and used it as mouthwash and to clean togas.", answer: "urine" },
  { prompt: "At the Tudor court, one trusted servant held the post of 'Groom of the ___'.", answer: "Stool" },
  { prompt: "The first message sent over the ARPANET was meant to be 'LOGIN' but the system crashed after the letters ___.", answer: "LO" },
  { prompt: "Before rubber erasers, people rubbed out pencil marks with balled-up ___.", answer: "bread" },
  { prompt: "Tug of war was an official Olympic ___ from 1900 to 1920.", answer: "event" },
  { prompt: "The first webcam watched a ___ in a Cambridge computer lab so people could see if it was empty.", answer: "coffee pot" },
  { prompt: "The Ottoman Empire still officially existed during the lifetime of the founder of ___.", answer: "Warner Bros" },
  { prompt: "The shortest war in history, between Britain and Zanzibar in 1896, lasted under 45 ___.", answer: "minutes" },
  { prompt: "Cleopatra was not Egyptian by descent but ___.", answer: "Greek" },
  { prompt: "Fanta was invented in Germany during the Second World War because they couldn't get ___ syrup.", answer: "Coca-Cola" },
  { prompt: "Nikola Tesla was, by his own account, deeply attached to a particular ___.", answer: "pigeon" },
  { prompt: "The Eiffel Tower was meant to be temporary and was saved because it was useful as a radio ___.", answer: "antenna" },
  { prompt: "During the 1908 Olympic marathon in London, the winner was carried over the line and later ___.", answer: "disqualified" },
  { prompt: "The Mongol Empire ran a vast horseback relay postal system known as the ___.", answer: "Yam" },
  { prompt: "The Great Emu War of 1932 in Australia was a military operation that the ___ effectively won.", answer: "emus" },
  { prompt: "In 1386 in Falaise, France, a ___ was put on trial, dressed in human clothes, and executed for killing a child.", answer: "pig" },
  { prompt: "Vikings navigated partly using crystals they called sun ___.", answer: "stones" },
  { prompt: "France carried out its last execution by ___ in 1977, the year Star Wars was released.", answer: "guillotine" },
  { prompt: "Roman concrete gets stronger over centuries because seawater keeps growing crystals in the ___.", answer: "cracks" },

  // --- Language & words ---
  { prompt: "The King of Hearts is the only king in a standard deck without a ___.", answer: "moustache" },
  { prompt: "The infinity symbol has a proper name: the ___.", answer: "lemniscate" },
  { prompt: "The letter 'Q' does not appear in the name of any U.S. ___.", answer: "state" },
  { prompt: "A 'baker's dozen' has a spare loaf because bakers feared being punished for selling ___ bread.", answer: "underweight" },
  { prompt: "The '#' symbol has a rarely-used formal name coined at Bell Labs: the ___.", answer: "octothorpe" },
  { prompt: "The space between your eyebrows is called the ___.", answer: "glabella" },
  { prompt: "The plastic table that stops the lid touching your pizza is officially called a pizza ___.", answer: "saver" },
  { prompt: "The word 'nice' originally meant ___.", answer: "foolish" },
  { prompt: "The little wire cage that holds a Champagne cork in place is called a ___.", answer: "muselet" },
  { prompt: "'Set' has more distinct meanings in the Oxford English Dictionary than almost any other English ___.", answer: "word" },
  { prompt: "The formal medical name for brain freeze is sphenopalatine ganglio-___.", answer: "neuralgia" },
  { prompt: "A 'quire' of paper is 25 sheets; twenty quires make a ___.", answer: "ream" },
  { prompt: "The word 'robot' comes from a Czech play and originally meant forced ___.", answer: "labour" },
  { prompt: "The two tiny dots in 'naïve' or 'Zoë' are called a ___.", answer: "diaeresis" },
  { prompt: "A rabbit's happy little mid-air twist-and-kick is called a ___.", answer: "binky" },
  { prompt: "Splitting a phrase to slot a word inside it, as in 'a whole nother thing', is called ___.", answer: "tmesis" },

  // --- Food & drink ---
  { prompt: "Carrots were originally purple; the orange variety was bred in the ___.", answer: "Netherlands" },
  { prompt: "A pineapple is not one fruit but a cluster of ___ fused around a core.", answer: "berries" },
  { prompt: "Eaten by the spoonful, the spice ___ is mildly hallucinogenic and toxic.", answer: "nutmeg" },
  { prompt: "In the 1830s in the USA, ketchup was briefly sold as a ___.", answer: "medicine" },
  { prompt: "Growers sort cranberries by whether they ___ — fresh ones do, spoiled ones don't.", answer: "bounce" },
  { prompt: "Cashews grow attached to a fruit called the cashew ___.", answer: "apple" },
  { prompt: "Worcestershire sauce is fermented for months and contains dissolved ___.", answer: "anchovies" },
  { prompt: "The holes in Swiss cheese are made by bubbles of ___ released by bacteria.", answer: "carbon dioxide" },
  { prompt: "Ripe cranberries and blueberries have a natural whitish coating called the ___.", answer: "bloom" },
  { prompt: "Real wasabi is so hard to grow that most 'wasabi' served is dyed ___.", answer: "horseradish" },
  { prompt: "The red colour in some yoghurts and sweets, cochineal, is made from crushed ___.", answer: "insects" },
  { prompt: "Rhubarb leaves are poisonous because they contain high levels of ___ acid.", answer: "oxalic" },
  { prompt: "The 'best before' bubbles in Champagne come from a second fermentation that happens in the ___.", answer: "bottle" },
  { prompt: "Peanuts and cashews are technically not nuts; a true botanical nut is a ___.", answer: "hazelnut" },
  { prompt: "Vanilla flavour is so expensive partly because each flower must be pollinated by ___.", answer: "hand" },
  { prompt: "Pound cake got its name from its original recipe: a pound each of butter, sugar, eggs and ___.", answer: "flour" },
  { prompt: "Fresh pineapple can't set in jelly because an enzyme in it breaks down ___.", answer: "gelatin" },
  { prompt: "The little paper cup a muffin bakes in is called a ___.", answer: "wrapper" },

  // --- The human body ---
  { prompt: "Relative to its size, the strongest muscle in the human body is the ___, the jaw muscle.", answer: "masseter" },
  { prompt: "The little groove between your nose and top lip is called the ___.", answer: "philtrum" },
  { prompt: "The only part of the body with no blood supply of its own is the ___ of the eye.", answer: "cornea" },
  { prompt: "You are very slightly taller in the ___ than at night.", answer: "morning" },
  { prompt: "The acid in your stomach is renewed so fast that the lining largely rebuilds every few ___.", answer: "days" },
  { prompt: "Fingernails grow faster on your ___ hand.", answer: "dominant" },
  { prompt: "The hard enamel on your teeth is the only part of the body that cannot ___ itself.", answer: "repair" },
  { prompt: "Humans glow very faintly with visible ___, far too dim to see.", answer: "light" },
  { prompt: "The clicking of a cracked knuckle is a bubble collapsing in the joint ___.", answer: "fluid" },
  { prompt: "Your sense of ___ is the only one that doesn't pass through the brain's central relay before being processed.", answer: "smell" },
  { prompt: "Newborn babies don't produce ___ when they cry for the first few weeks.", answer: "tears" },
  { prompt: "The loop of skin connecting your tongue to the floor of your mouth is the ___.", answer: "frenulum" },

  // --- Culture, invention & odds and ends ---
  { prompt: "The longest word in most dictionaries names a lung disease caused by breathing in ___ dust.", answer: "volcanic" },
  { prompt: "An average fluffy cumulus cloud weighs roughly the same as 100 ___.", answer: "elephants" },
  { prompt: "The cardboard sleeve on a takeaway coffee cup is called a ___.", answer: "zarf" },
  { prompt: "The two M's in 'M&M's' stand for Mars and ___.", answer: "Murrie" },
  { prompt: "The 'Bluetooth' wireless standard is named after a 10th-century Scandinavian ___.", answer: "king" },
  { prompt: "The distinctive smell of old books has a name coined by researchers: ___.", answer: "must" },
  { prompt: "The first product ever scanned with a supermarket barcode, in 1974, was a pack of ___.", answer: "chewing gum" },
  { prompt: "The 'save' icon on most software is a picture of a ___ that few young users have seen.", answer: "floppy disk" },
  { prompt: "Monopoly was based on an earlier game designed to teach the dangers of ___.", answer: "landlords" },
  { prompt: "The Slinky was invented by accident by an engineer working on springs for ___.", answer: "ships" },
  { prompt: "Play-Doh was originally sold as a compound for cleaning ___.", answer: "wallpaper" },
  { prompt: "The 'new car smell' is largely the odour of ___ evaporating from the interior.", answer: "chemicals" },
  { prompt: "The default Windows XP wallpaper 'Bliss' is an unedited photo of a hill in ___.", answer: "California" },
  { prompt: "The colour on the London Underground map for the Bakerloo line is ___.", answer: "brown" },
  { prompt: "The little arrow next to the fuel gauge in most cars tells you which side the fuel ___ is on.", answer: "cap" },
  { prompt: "Each IKEA bed and wardrobe is named after a real ___ in Norway.", answer: "place" },
  { prompt: "The ridges milled onto the edge of a coin are called ___.", answer: "reeding" },
  { prompt: "The Nobel Prize has no category for ___.", answer: "mathematics" },
  { prompt: "The 'Wilhelm scream' is a stock sound effect of a man ___, reused in hundreds of films.", answer: "screaming" },
  { prompt: "A curved shape of constant width that isn't a circle, used for some drill bits, is a Reuleaux ___.", answer: "triangle" },
  { prompt: "The plastic or metal tube protecting the wick in the middle of a candle stub is called the ___.", answer: "wick tab" },
  { prompt: "Ketchup was once sold in glass bottles designed so the '57' on the neck was where you ___ to make it pour.", answer: "tap" },
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

// Inverse "rare guess" bonus: the FEWER players who found the real answer
// this round, the MORE each of them earns on top of TRUTH_POINTS. Keyed by
// how many players found it (voted for it or wrote it); 4+ finders = 0.
const TRUTH_BONUS_BY_FINDERS = { 1: 3, 2: 2, 3: 1 }

// --- Lenient answer matching -----------------------------------------
// Fold spelled-out numbers to digits so "seventeen seconds" and
// "17 seconds" collapse together. Handles 0–99 plus hundred/thousand/
// million (e.g. "one hundred twenty" -> "120", "twenty one" -> "21").
const SMALL_NUM = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}
const MAGNITUDE_NUM = { hundred: 100, thousand: 1000, million: 1000000 }

function wordsToNumbers(str) {
  const out = []
  let cur = null
  const flush = () => {
    if (cur !== null) out.push(String(cur))
    cur = null
  }
  for (const tok of String(str).toLowerCase().replace(/-/g, " ").split(/\s+/)) {
    if (tok === "and" || tok === "") continue
    if (tok in SMALL_NUM) {
      cur = (cur ?? 0) + SMALL_NUM[tok]
    } else if (tok in MAGNITUDE_NUM) {
      cur = (cur === null || cur === 0 ? 1 : cur) * MAGNITUDE_NUM[tok]
    } else {
      flush()
      out.push(tok)
    }
  }
  flush()
  return out.join(" ")
}

// Lowercase, fold number words to digits, drop a leading article, strip
// anything that isn't a letter or digit, collapse the rest. So "The Sun",
// "the sun ", "THESUN" all become "sun"; "forty-two seconds" and
// "42 seconds" both become "42seconds".
function normalize(value) {
  return wordsToNumbers(String(value ?? ""))
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
}

// Classic Levenshtein edit distance between two short strings.
function editDistance(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

// Is `text` close enough to the real answer to count as effectively the
// same? Same idea as Emoji Movie's guess matching: exact after
// normalizing, or within a small edit distance that grows with length
// (short answers must be spot-on, longer ones tolerate a typo or two).
export function isNearTruth(text, truthAnswer) {
  const g = normalize(text)
  const t = normalize(truthAnswer)
  if (!g || !t) return false
  if (g === t) return true
  // If either answer contains a number, the number runs must match exactly.
  // Otherwise "ten seconds" -> "10seconds" and "seventeen seconds" ->
  // "17seconds" would be just one edit apart and wrongly fold together.
  const digitsOf = (s) => (s.match(/\d+/g) ?? []).join(",")
  if (digitsOf(g) !== digitsOf(t)) return false
  const tolerance = t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2
  return tolerance > 0 && editDistance(g, t) <= tolerance
}

let optionSeq = 0
function makeOptionId() {
  optionSeq += 1
  return `opt_${optionSeq}_${Math.random().toString(36).slice(2, 8)}`
}

export function createGame(playerIds, { rounds, memory }) {
  const requested = Number(rounds)
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.")
  }

  const totalRounds = Math.min(requested, FACTS.length)
  // Skip facts already used earlier this session. Prompts are unique;
  // answers are not (e.g. "Sun" appears on several), so key on the prompt.
  const { items, seenKeys } = drawWithoutRepeats(
    FACTS,
    totalRounds,
    memory?.seen ?? [],
    (f) => f.prompt
  )
  const now = Date.now()

  return {
    id,
    phase: "write", // "write" -> "vote" -> "reveal" -> ("write" ...) -> "final"
    totalRounds,
    roundIndex: 0,
    facts: items, // each { prompt, answer }
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
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

// Move from writing to voting: pool the real answer with every fake, then
// SHUFFLE. A fake that is a NEAR-duplicate of the real answer (fuzzy match
// — "17 seconds" vs "seventeen seconds", a typo, minor rewording) is folded
// into the truth option rather than shown as its own choice, and its author
// is credited as having found the truth. Exact-normalized fakes that match
// each other are merged too. After this, `answerOptions` is the server's
// private source of truth for who wrote what.
export function startVoting(game) {
  if (game.phase !== "write") return

  const fact = game.facts[game.roundIndex]
  const truthOption = {
    id: makeOptionId(),
    text: fact.answer,
    normalized: normalize(fact.answer),
    ownerIds: [], // players who wrote the truth, exactly or near enough
    isTruth: true,
    voterIds: [],
  }
  const options = [truthOption]

  for (const [pid, text] of game.submissions) {
    if (isNearTruth(text, fact.answer)) {
      truthOption.ownerIds.push(pid) // effectively correct — never its own option
      continue
    }
    const norm = normalize(text)
    const existing = norm && options.find((o) => !o.isTruth && o.normalized === norm)
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

// Record (or change) a player's vote. A player may not vote for a FAKE
// they wrote — but if their submission happened to match the real answer,
// it got folded into the truth option, and voting for the truth is always
// allowed (they'd get the +2 for "wrote the truth" regardless). Once every
// present player has voted, the round reveals.
export function submitVote(game, playerId, optionId, presentPlayerIds) {
  if (game.phase !== "vote") return { ok: false }
  if (Date.now() > game.deadline + 1500) return { ok: false, tooLate: true }

  const option = game.answerOptions?.find((o) => o.id === optionId)
  if (!option) return { ok: false }
  if (!option.isTruth && option.ownerIds.includes(playerId)) {
    return { ok: false, ownAnswer: true }
  }

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
        truthBonus: 0,
        fooled: 0,
        foolPoints: 0,
      }
    }
    return roundScores[pid]
  }
  for (const pid of presentPlayerIds) ensure(pid)

  const truth = options.find((o) => o.isTruth)

  // Everyone who found the real answer this round — voted for it OR wrote
  // it (an exact or fuzzy-folded near-duplicate counts as writing it).
  const finders = new Set([
    ...(truth?.voterIds ?? []),
    ...(truth?.ownerIds ?? []),
  ])
  // Inverse "rare guess" bonus: fewer finders -> bigger bonus each.
  const bonusEach = TRUTH_BONUS_BY_FINDERS[finders.size] ?? 0

  for (const pid of finders) {
    const rs = ensure(pid)
    rs.foundTruth = true
    rs.truthPoints = TRUTH_POINTS
    rs.truthBonus = bonusEach
    rs.gained += TRUTH_POINTS + bonusEach
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
    truthFinderCount: finders.size,
    truthBonusEach: bonusEach,
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

// Host "Force proceed": move the round on with only the input that's in.
// During "write", pool whatever fakes were submitted and start voting;
// during "vote", reveal and score the votes cast. A player who didn't act
// simply has no fake / no vote this round.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "write") startVoting(game, presentPlayerIds)
  else if (game.phase === "vote") revealRound(game, presentPlayerIds)
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
// their own FAKE so the client can disable it. If their submission matched
// the real answer it was folded into the truth option — that's not "their
// fake" and stays selectable, so the truth option is never reported here.
export function getPrivateState(game, playerId) {
  if (game.phase === "vote" && game.answerOptions) {
    const mine = game.answerOptions.find(
      (o) => !o.isTruth && o.ownerIds.includes(playerId)
    )
    return { myOptionId: mine ? mine.id : null }
  }
  return null
}

// --- Tournament Mode: default per-game config when run inside a tournament.
export function tournamentOptions() {
  return { rounds: 3 }
}
