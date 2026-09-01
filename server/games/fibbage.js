// "Fact or Fake" — a bluffing game. Two content modes, chosen by the host
// on the setup screen:
//
//   * BANK mode (default) — each round everyone sees an obscure true fact
//     with a blank, privately types a FAKE answer to fill it; the fakes are
//     shuffled with the REAL answer and shown anonymized; everyone votes
//     for which one they think is true.
//
//   * PERSONAL mode — rounds are built from players' REAL answers about
//     themselves, turning the game into "how well do you know each other".
//     A "truth" phase runs first: each player picks between two prompts —
//     one always a DIRECT prompt, the other NUANCED or FRIEND, no labels
//     shown — and answers one truthfully, ~45s each. Then there's one
//     round PER answer: the
//     subject sits out while everyone else writes a fake answer they think
//     sounds like that person; those plus the subject's real answer are
//     shown anonymized; the others vote for the real one.
//
// Scoring is identical in both modes:
//   * +2 for voting for (or having written) the true answer, plus an
//     inverse "rare guess" bonus by how few players found it
//   * +1 for every OTHER player fooled into voting for your fake
// In personal mode the subject scores nothing on their own round.
//
// Attribution (who wrote which fake) lives ONLY in this module until the
// reveal phase. getPublicState() during "vote" deliberately strips every
// ownership / truth marker — see the whitelist there. Fuzzy answer-matching
// (folding a near-duplicate fake into the truth) applies in bank mode and
// to personal-mode rounds whose prompt is from the DIRECT category only.

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

// --- PERSONAL mode prompt bank -------------------------------------
// Categories are for INTERNAL use only — never shown to players. Each entry
// has a `self` form (shown to the subject: "What is your favorite movie?")
// and an `about` form with a `{name}` placeholder (used to phrase the round
// question: "What is Alex's favorite movie?"). Fuzzy matching is applied
// only to `direct` rounds — the others don't have a single "right" answer.
const PERSONAL_PROMPTS = {
  // DIRECT / MAINSTREAM — clean, single-answer, favourite/least-favourite.
  direct: [
    { self: "What is your favorite movie?", about: "What is {name}'s favorite movie?" },
    { self: "What's a food you refuse to eat?", about: "What's a food {name} refuses to eat?" },
    { self: "What's your dream vacation destination?", about: "What's {name}'s dream vacation destination?" },
    { self: "What's your favorite type of music?", about: "What's {name}'s favorite type of music?" },
    { self: "What's the last show you binge-watched?", about: "What's the last show {name} binge-watched?" },
    { self: "What's your dream job?", about: "What's {name}'s dream job?" },
    { self: "What's your biggest fear?", about: "What's {name}'s biggest fear?" },
    { self: "What's a hobby you'd love to try but haven't?", about: "What's a hobby {name} would love to try but hasn't?" },
    { self: "Where would you want to retire?", about: "Where would {name} want to retire?" },
    { self: "What's the last thing you searched on your phone?", about: "What's the last thing {name} searched on their phone?" },
    { self: "What's a subject you wish you'd studied more?", about: "What's a subject {name} wishes they'd studied more?" },
    { self: "What's something you'd never do, no matter the pay?", about: "What's something {name} would never do, no matter the pay?" },
    { self: "What's the farthest place you've ever traveled to?", about: "What's the farthest place {name} has ever traveled to?" },
    { self: "If you could instantly master one skill, what would it be?", about: "If {name} could instantly master one skill, what would it be?" },
    { self: "What's your favorite video game of all time?", about: "What's {name}'s favorite video game of all time?" },
    { self: "What's your favorite clothing brand?", about: "What's {name}'s favorite clothing brand?" },
    { self: "What's your favorite musical instrument?", about: "What's {name}'s favorite musical instrument?" },
    { self: "What's your favorite fast food restaurant?", about: "What's {name}'s favorite fast food restaurant?" },
    { self: "What's your least favorite video game genre?", about: "What's {name}'s least favorite video game genre?" },
    { self: "What's your favorite season?", about: "What's {name}'s favorite season?" },
    { self: "What's your go-to karaoke song?", about: "What's {name}'s go-to karaoke song?" },
    { self: "What's your favorite board game?", about: "What's {name}'s favorite board game?" },
    { self: "What animal would you most want as a pet?", about: "What animal would {name} most want as a pet?" },
    { self: "What's your dream car?", about: "What's {name}'s dream car?" },
    { self: "What's your favorite holiday?", about: "What's {name}'s favorite holiday?" },
    { self: "What's a book you'd recommend to almost anyone?", about: "What's a book {name} would recommend to almost anyone?" },
    { self: "What's your favorite pizza topping?", about: "What's {name}'s favorite pizza topping?" },
    { self: "What country would you love to live in for a year?", about: "What country would {name} love to live in for a year?" },
    { self: "What's the app you open the most on your phone?", about: "What's the app {name} opens the most on their phone?" },
    { self: "Which celebrity would you most want to have dinner with?", about: "Which celebrity would {name} most want to have dinner with?" },
    { self: "What's your favorite ice cream flavor?", about: "What's {name}'s favorite ice cream flavor?" },
    { self: "What sport would you love to be genuinely great at?", about: "What sport would {name} love to be genuinely great at?" },
    { self: "What's your comfort meal?", about: "What's {name}'s comfort meal?" },
    { self: "What's your least favorite chore?", about: "What's {name}'s least favorite chore?" },
    { self: "What's your favorite TV show?", about: "What's {name}'s favorite TV show?" },
    { self: "What's your favorite YouTuber or content creator?", about: "Who's {name}'s favorite YouTuber or content creator?" },
    { self: "What's your favorite snack?", about: "What's {name}'s favorite snack?" },
    { self: "What's your favorite dessert?", about: "What's {name}'s favorite dessert?" },
    { self: "What's your favorite cuisine (Italian, Mexican, etc.)?", about: "What's {name}'s favorite cuisine (Italian, Mexican, etc.)?" },
    { self: "What's your favorite band or artist?", about: "Who's {name}'s favorite band or artist?" },
    { self: "What's your least favorite music genre?", about: "What's {name}'s least favorite music genre?" },
    { self: "What's your favorite song right now?", about: "What's {name}'s favorite song right now?" },
    { self: "What's your favorite car brand?", about: "What's {name}'s favorite car brand?" },
    { self: "What's your favorite country you've visited (or want to visit)?", about: "What's {name}'s favorite country they've visited (or want to visit)?" },
    { self: "What's your favorite sport to watch?", about: "What's {name}'s favorite sport to watch?" },
    { self: "What's your favorite sports team?", about: "What's {name}'s favorite sports team?" },
  ],
  // NUANCED / PERSONAL — needs real insight, not a clean factual answer.
  nuanced: [
    { self: "What's a small thing that instantly puts you in a bad mood?", about: "What's a small thing that instantly puts {name} in a bad mood?" },
    { self: "What's a phrase or saying you use way more than you think you do?", about: "What's a phrase {name} uses way more than they think they do?" },
    { self: "What's a strange combination of foods you actually enjoy?", about: "What's a strange combination of foods {name} actually enjoys?" },
    { self: "What's a topic you could talk about for way too long?", about: "What's a topic {name} could talk about for way too long?" },
    { self: "What's a small thing that reliably makes your whole day better?", about: "What's a small thing that reliably makes {name}'s whole day better?" },
    { self: "What's an irrational thing that scares you?", about: "What's an irrational thing that scares {name}?" },
    { self: "What's a chore you secretly don't mind doing?", about: "What's a chore {name} secretly doesn't mind doing?" },
    { self: "What do you always go back to when you're stressed?", about: "What does {name} always go back to when they're stressed?" },
    { self: "What's a smell that brings back a specific memory for you?", about: "What's a smell that brings back a specific memory for {name}?" },
    { self: "What's a compliment you never get tired of hearing?", about: "What's a compliment {name} never gets tired of hearing?" },
    { self: "What's something you pretend to understand but really don't?", about: "What's something {name} pretends to understand but really doesn't?" },
    { self: "What's a rule you have for yourself that other people find odd?", about: "What's a rule {name} has for themselves that other people find odd?" },
    { self: "What's an unimportant opinion you'll still defend hard?", about: "What's an unimportant opinion {name} will still defend hard?" },
    { self: "What's a habit you've been meaning to break for years?", about: "What's a habit {name} has been meaning to break for years?" },
    { self: "What's something you loved as a kid and still secretly love?", about: "What's something {name} loved as a kid and still secretly loves?" },
    { self: "In what situation do you always end up being the responsible one?", about: "In what situation does {name} always end up being the responsible one?" },
    { self: "What kind of person can you not stand being around for long?", about: "What kind of person can {name} not stand being around for long?" },
    { self: "What's something you always keep in your bag or pockets?", about: "What's something {name} always keeps in their bag or pockets?" },
    { self: "What's a harmless little lie you tell often?", about: "What's a harmless little lie {name} tells often?" },
    { self: "What's a small moment in a normal day that you look forward to?", about: "What's a small moment in a normal day that {name} looks forward to?" },
    { self: "What are you much better at than people expect?", about: "What is {name} much better at than people expect?" },
    { self: "What's a food you could genuinely eat every single day?", about: "What's a food {name} could genuinely eat every single day?" },
  ],
  // FRIEND-GROUP — taps shared social history and group dynamics.
  friend: [
    { self: "What's a nickname you've been called by friends?", about: "What's a nickname {name} has been called by friends?" },
    { self: "What's a running joke you have with your friends?", about: "What's a running joke {name} has with their friends?" },
    { self: "What's a habit of yours that your friends always point out?", about: "What's a habit of {name}'s that their friends always point out?" },
    { self: "What's something you're weirdly competitive about?", about: "What's something {name} is weirdly competitive about?" },
    { self: "What role do you usually play in your friend group?", about: "What role does {name} usually play in their friend group?" },
    { self: "What's a story your friends won't let you live down?", about: "What's a story {name}'s friends won't let them live down?" },
    { self: "What do your friends always ask you to bring or handle?", about: "What do {name}'s friends always ask them to bring or handle?" },
    { self: "What do your friends tease you about the most?", about: "What do {name}'s friends tease them about the most?" },
    { self: "What group activity are you always the one pushing for?", about: "What group activity is {name} always the one pushing for?" },
    { self: "What do you always say you'll do but never actually do?", about: "What does {name} always say they'll do but never actually do?" },
    { self: "What talent of yours do your friends love to show off to others?", about: "What talent of {name}'s do their friends love to show off to others?" },
    { self: "What kind of plan are you most likely to cancel?", about: "What kind of plan is {name} most likely to cancel?" },
    { self: "What food or drink order would your friends recognize as 'so you'?", about: "What food or drink order would {name}'s friends recognize as 'so them'?" },
    { self: "What's an argument you and your friends have had more than once?", about: "What's an argument {name} and their friends have had more than once?" },
    { self: "What do your friends come to you for advice about?", about: "What do {name}'s friends come to {name} for advice about?" },
    { self: "What category would you win in your friend group (best or worst at something)?", about: "What category would {name} win in their friend group (best or worst at something)?" },
    { self: "What word or emoji do you overuse in the group chat?", about: "What word or emoji does {name} overuse in the group chat?" },
    { self: "Where does your friend group always seem to end up?", about: "Where does {name}'s friend group always seem to end up?" },
    { self: "What's a dare you'd actually go through with?", about: "What's a dare {name} would actually go through with?" },
    { self: "What did you get weirdly good at because of your friends?", about: "What did {name} get weirdly good at because of their friends?" },
    { self: "What are you always running late for?", about: "What is {name} always running late for?" },
  ],
}

export const id = "fibbage"
export const name = "Fact or Fake"
export const minPlayers = 3

// Personal mode needs at least this many — the subject sits out, so we
// still want two-plus players writing fakes and voting.
const PERSONAL_MIN_PLAYERS = 3

// Time to write a fake answer, and time to vote. The client shows a
// countdown seeded from `msLeft`; when it hits zero the host's device asks
// the server to advance. The host can also advance early.
const WRITE_MS = 45_000
const VOTE_MS = 30_000

// Personal mode "truth" phase, per player, per prompt: time to pick which
// of the two offered prompts to answer, then time to write the answer.
const CHOOSE_MS = 25_000
const TRUTH_MS = 45_000

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

// Names a host's AI "Custom Topic" can't reuse (they'd be confusing next
// to the mode toggles).
export const AI_CONTENT_RESERVED = ["Trivia Bank", "Personal Mode", "Trivia", "Bank"]

export function createGame(playerIds, options = {}) {
  if (options.mode === "personal") return createPersonalGame(playerIds, options)
  if (options.mode === "custom") {
    // An AI-generated topic (see server/aiContent.js). `customTopics` is
    // the room's full list of { name, items:[{prompt,answer}] }; `topic`
    // is the one the host picked on the setup screen.
    const batch = (options.customTopics ?? []).find((t) => t.name === options.topic)
    if (!batch || !Array.isArray(batch.items) || batch.items.length === 0) {
      throw new Error("That custom topic isn't available in this room.")
    }
    return createBankGame(playerIds, options, batch.items)
  }
  return createBankGame(playerIds, options)
}

function baseGame(playerIds) {
  const now = Date.now()
  return {
    id,
    roundIndex: 0,
    submissions: new Map(), // playerId -> fake answer text, current round only
    answerOptions: null, // built by startVoting(); the ONLY place ownership lives
    votes: new Map(), // playerId -> optionId, current round only
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    phaseStartedAt: now,
    deadline: now + WRITE_MS,
    lastResult: null, // filled in by revealRound()
  }
}

function createBankGame(playerIds, { rounds, memory }, factPool = FACTS) {
  const requested = Number(rounds)
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.")
  }

  const totalRounds = Math.min(requested, factPool.length)
  // Skip facts already used earlier this session. Prompts are unique;
  // answers are not (e.g. "Sun" appears on several), so key on the prompt.
  // A custom topic's prompts share this one seen-list; they won't collide
  // with the built-in bank's prompts.
  const { items, seenKeys } = drawWithoutRepeats(
    factPool,
    totalRounds,
    memory?.seen ?? [],
    (f) => f.prompt
  )

  return {
    ...baseGame(playerIds),
    personal: false,
    phase: "write", // "write" -> "vote" -> "reveal" -> ("write" ...) -> "final"
    totalRounds,
    facts: items, // each { prompt, answer }
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
  }
}

// Personal mode: set up the "truth" phase. Each player gets `k` prompt
// slots; each slot offers exactly two prompts — one always from the DIRECT
// category, the other from NUANCED or FRIEND. Rounds are generated once the
// answers are in.
function createPersonalGame(playerIds, { promptsPerPlayer, memory }) {
  const k = Number(promptsPerPlayer)
  if (!Number.isInteger(k) || k < 1 || k > 2) {
    throw new Error("Choose 1 or 2 prompts per player.")
  }
  if (playerIds.length < PERSONAL_MIN_PLAYERS) {
    throw new Error(`Personal Mode needs at least ${PERSONAL_MIN_PLAYERS} players.`)
  }

  const { slotsByPair, seenKeys } = buildTruthSlots(playerIds.length * k, memory?.seen ?? [])

  const truthAssignments = new Map()
  let cursor = 0
  for (const pid of playerIds) {
    const slots = []
    for (let i = 0; i < k; i++) {
      const [a, b] = slotsByPair[cursor++]
      slots.push({ choices: [a, b], chosen: null, answer: null })
    }
    truthAssignments.set(pid, slots)
  }

  const now = Date.now()
  return {
    ...baseGame(playerIds),
    personal: true,
    phase: "truth", // "truth" -> "write" -> "vote" -> "reveal" -> ... -> "final"
    promptsPerPlayer: k,
    totalRounds: 0, // set by generateRounds()
    rounds: [], // built by generateRounds()
    deckMemory: { seen: seenKeys }, // server-only
    truthAssignments, // playerId -> [{ choices:[promptA,promptB], chosen, answer }]
    truthProgress: new Map(playerIds.map((pid) => [pid, 0])), // slots completed
    truthDeadlineByPlayer: new Map(playerIds.map((pid) => [pid, now + CHOOSE_MS])),
  }
}

// Draw `count` prompt PAIRS, no prompt repeated within the session. Every
// pair is one DIRECT prompt plus one from NUANCED-or-FRIEND (which of those
// two is random per prompt, via the merged pool). Order within the pair is
// shuffled so DIRECT isn't always shown first.
function buildTruthSlots(count, seenKeys) {
  const direct = PERSONAL_PROMPTS.direct.map((p) => ({ ...p, category: "direct" }))
  const other = [
    ...PERSONAL_PROMPTS.nuanced.map((p) => ({ ...p, category: "nuanced" })),
    ...PERSONAL_PROMPTS.friend.map((p) => ({ ...p, category: "friend" })),
  ]

  const dDraw = drawWithoutRepeats(direct, count, seenKeys, (p) => p.self)
  const oDraw = drawWithoutRepeats(other, count, dDraw.seenKeys, (p) => p.self)

  const slotsByPair = []
  for (let i = 0; i < count; i++) {
    const a = dDraw.items[i % dDraw.items.length]
    const b = oDraw.items[i % oDraw.items.length]
    slotsByPair.push(Math.random() < 0.5 ? [a, b] : [b, a])
  }
  return { slotsByPair, seenKeys: oDraw.seenKeys }
}

// The current round's truth text + question, for both modes.
function roundContext(game) {
  if (game.personal) {
    const r = game.rounds[game.roundIndex]
    return { personal: true, prompt: r.questionTemplate, answer: r.answer, subjectId: r.subjectId, category: r.category }
  }
  const f = game.facts[game.roundIndex]
  return { personal: false, prompt: f.prompt, answer: f.answer, subjectId: null, category: null }
}

// The players who write a fake / cast a vote this round: everyone present
// in bank mode; everyone present EXCEPT the subject in personal mode.
function writerIds(game, presentPlayerIds) {
  if (!game.personal) return presentPlayerIds
  const subjectId = game.rounds[game.roundIndex]?.subjectId
  return presentPlayerIds.filter((pid) => pid !== subjectId)
}

// --- Personal mode: "truth" phase -------------------------------

// The subject picks which of their two offered prompts to answer.
export function chooseTruthPrompt(game, playerId, slotIndex, choiceIndex) {
  if (game.phase !== "truth") return { ok: false }
  const slots = game.truthAssignments.get(playerId)
  if (!slots) return { ok: false }
  const idx = game.truthProgress.get(playerId) ?? 0
  if (idx >= slots.length || idx !== Number(slotIndex)) return { ok: false, stale: true }
  const slot = slots[idx]
  if (slot.chosen != null) return { ok: false, already: true }
  const c = Number(choiceIndex)
  if (c !== 0 && c !== 1) return { ok: false }
  slot.chosen = c
  game.truthDeadlineByPlayer.set(playerId, Date.now() + TRUTH_MS) // now the 45s to answer
  return { ok: true }
}

// The subject submits their truthful answer to the chosen prompt (empty =
// skip). Advances them to their next slot, or starts the fib phase once
// everyone present is done.
export function submitTruthAnswer(game, playerId, rawText, presentPlayerIds) {
  if (game.phase !== "truth") return { ok: false }
  const slots = game.truthAssignments.get(playerId)
  if (!slots) return { ok: false }
  const idx = game.truthProgress.get(playerId) ?? 0
  if (idx >= slots.length) return { ok: false, done: true }
  const slot = slots[idx]
  if (slot.chosen == null) return { ok: false, mustChoose: true }

  const deadline = game.truthDeadlineByPlayer.get(playerId) ?? 0
  const text = String(rawText ?? "").slice(0, 120).trim()
  if (text && Date.now() <= deadline + 2000) slot.answer = text

  game.truthProgress.set(playerId, idx + 1)
  startTruthSlot(game, playerId)
  maybeStartFibbing(game, presentPlayerIds)
  return { ok: true, recorded: !!slot.answer }
}

// Arm the clock for a player's current slot (choose step), or leave it if
// they've finished all their slots.
function startTruthSlot(game, playerId) {
  const slots = game.truthAssignments.get(playerId) ?? []
  const idx = game.truthProgress.get(playerId) ?? 0
  if (idx < slots.length) {
    game.truthDeadlineByPlayer.set(playerId, Date.now() + CHOOSE_MS)
  }
}

// Server-interval hook (see server/index.js): auto-pick / auto-skip any
// player whose truth-phase clock has run out, and start the fib phase once
// everyone present has worked through their slots. Returns true if anything
// changed so the caller re-broadcasts.
export function tickTruth(game, presentPlayerIds) {
  if (game.phase !== "truth") return false
  const now = Date.now()
  let changed = false

  for (const pid of presentPlayerIds) {
    const slots = game.truthAssignments.get(pid) ?? []
    const idx = game.truthProgress.get(pid) ?? 0
    if (idx >= slots.length) continue
    const deadline = game.truthDeadlineByPlayer.get(pid) ?? 0
    if (now <= deadline + 2000) continue

    const slot = slots[idx]
    if (slot.chosen == null) {
      slot.chosen = 0 // never picked -> default to the first prompt
      game.truthDeadlineByPlayer.set(pid, now + TRUTH_MS)
    } else {
      game.truthProgress.set(pid, idx + 1) // never answered -> skip this slot
      startTruthSlot(game, pid)
    }
    changed = true
  }

  if (maybeStartFibbing(game, presentPlayerIds)) changed = true
  return changed
}

function truthDone(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return false
  return presentPlayerIds.every((pid) => {
    const slots = game.truthAssignments.get(pid) ?? []
    return (game.truthProgress.get(pid) ?? 0) >= slots.length
  })
}

function maybeStartFibbing(game, presentPlayerIds) {
  if (game.phase !== "truth" || !truthDone(game, presentPlayerIds)) return false
  generateRounds(game)
  return true
}

// One round per truth answer that came back. Rounds are shuffled so a
// subject's own rounds aren't necessarily consecutive.
function generateRounds(game) {
  const rounds = []
  for (const [subjectId, slots] of game.truthAssignments) {
    for (const slot of slots) {
      if (slot.chosen == null) continue
      const answer = String(slot.answer ?? "").trim()
      if (!answer) continue // unanswered -> no round
      const prompt = slot.choices[slot.chosen]
      rounds.push({
        subjectId,
        category: prompt.category,
        questionTemplate: prompt.about, // contains "{name}"
        answer,
      })
    }
  }

  game.rounds = shuffle(rounds)
  game.totalRounds = game.rounds.length
  game.roundIndex = 0
  game.submissions = new Map()
  game.answerOptions = null
  game.votes = new Map()

  if (game.totalRounds === 0) {
    game.phase = "final"
    game.lastResult = null
    return
  }
  game.phaseStartedAt = Date.now()
  game.deadline = Date.now() + WRITE_MS
  game.phase = "write"
}

// Record (or overwrite) a player's fake answer. Once every present player
// has submitted, voting starts automatically.
export function submitAnswer(game, playerId, rawText, presentPlayerIds) {
  if (game.phase !== "write") return { ok: false }
  // Personal mode: the round's subject sits out — no fake from them.
  if (game.personal && playerId === game.rounds[game.roundIndex].subjectId) {
    return { ok: false, isSubject: true }
  }
  if (Date.now() > game.deadline + 1500) return { ok: false, tooLate: true }

  const text = String(rawText ?? "").slice(0, 120).trim()
  if (!text) return { ok: false, empty: true }

  game.submissions.set(playerId, text)

  const need = writerIds(game, presentPlayerIds)
  if (need.length > 0 && need.every((pid) => game.submissions.has(pid))) {
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

  const { answer: truthText, category } = roundContext(game)
  // Fuzzy fold applies in bank mode, and only to `direct` personal rounds —
  // nuanced / friend-group prompts have no single "right" wording, so a
  // fake that merely resembles the answer stays its own option.
  const useFuzzy = !game.personal || category === "direct"
  const truthNorm = normalize(truthText)

  const truthOption = {
    id: makeOptionId(),
    text: truthText,
    normalized: truthNorm,
    ownerIds: [], // players who wrote the truth, exactly or near enough
    isTruth: true,
    voterIds: [],
  }
  const options = [truthOption]

  for (const [pid, text] of game.submissions) {
    // Always fold an EXACT match into the truth (two identical-looking
    // options would be nonsense); fold near-matches only when fuzzy is on.
    const foldIntoTruth = useFuzzy
      ? isNearTruth(text, truthText)
      : truthNorm !== "" && normalize(text) === truthNorm
    if (foldIntoTruth) {
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
  if (game.personal && playerId === game.rounds[game.roundIndex].subjectId) {
    return { ok: false, isSubject: true } // the subject doesn't vote on their own round
  }
  if (Date.now() > game.deadline + 1500) return { ok: false, tooLate: true }

  const option = game.answerOptions?.find((o) => o.id === optionId)
  if (!option) return { ok: false }
  if (!option.isTruth && option.ownerIds.includes(playerId)) {
    return { ok: false, ownAnswer: true }
  }

  game.votes.set(playerId, optionId)

  const need = writerIds(game, presentPlayerIds)
  if (need.length > 0 && need.every((pid) => game.votes.has(pid))) {
    revealRound(game, presentPlayerIds)
  }
  return { ok: true }
}

// Score the round and freeze a full, no-longer-secret breakdown for the
// reveal screen: the real answer, who wrote each fake, and who voted for
// what.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "vote") return

  const ctx = roundContext(game)
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
  // The subject writes no fake and casts no vote, so they get no round
  // score row (the reveal screen shows them as sitting out instead).
  for (const pid of presentPlayerIds) {
    if (ctx.personal && pid === ctx.subjectId) continue
    ensure(pid)
  }

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
    prompt: ctx.prompt, // bank: "... ___ ..."  |  personal: "What is {name}'s ...?"
    answer: ctx.answer,
    personal: ctx.personal,
    subjectId: ctx.subjectId,
    category: ctx.category,
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
  if (game.phase === "truth") {
    maybeStartFibbing(game, presentPlayerIds)
  } else if (game.phase === "write" && writerIds(game, presentPlayerIds).every((pid) => game.submissions.has(pid))) {
    startVoting(game, presentPlayerIds)
  } else if (game.phase === "vote" && writerIds(game, presentPlayerIds).every((pid) => game.votes.has(pid))) {
    revealRound(game, presentPlayerIds)
  }
}

// Host "Force proceed": move the game on with only the input that's in.
// During "truth", build the rounds from whatever answers came back; during
// "write", pool whatever fakes were submitted and start voting; during
// "vote", reveal and score the votes cast.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "truth") generateRounds(game)
  else if (game.phase === "write") startVoting(game, presentPlayerIds)
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

  const state = {
    id: game.id,
    phase: game.phase,
    personal: !!game.personal,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    totalPlayers: presentPlayerIds.length,
    writeMs: WRITE_MS,
    voteMs: VOTE_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  }

  // Personal mode "truth" phase — the per-player prompt + clock is private
  // (getPrivateState); the public view is just progress.
  if (game.phase === "truth") {
    const doneCount = presentPlayerIds.filter((pid) => {
      const slots = game.truthAssignments.get(pid) ?? []
      return (game.truthProgress.get(pid) ?? 0) >= slots.length
    }).length
    state.truth = {
      promptsPerPlayer: game.promptsPerPlayer,
      doneCount,
      totalPlayers: presentPlayerIds.length,
      chooseMs: CHOOSE_MS,
      truthMs: TRUTH_MS,
    }
    return state
  }

  // A round exists in every phase except a degenerate personal-mode "final"
  // reached with zero usable rounds.
  const hasRound = !game.personal || game.roundIndex < game.rounds.length
  if (hasRound) {
    const ctx = roundContext(game)
    state.prompt = ctx.prompt // bank: "... ___ ..."  |  personal: "What is {name}'s ...?"
    if (game.personal) {
      state.subjectId = ctx.subjectId
      // How many players write / vote this round (all present minus the subject).
      state.expectedCount = writerIds(game, presentPlayerIds).length
    }
  }

  if (game.phase === "write") {
    state.submittedPlayerIds = writerIds(game, presentPlayerIds).filter((pid) => game.submissions.has(pid))
  }

  if (game.phase === "vote") {
    // Anonymized: opaque id + text only, in the pre-shuffled order.
    state.options = (game.answerOptions ?? []).map((o) => ({ id: o.id, text: o.text }))
    state.votedPlayerIds = writerIds(game, presentPlayerIds).filter((pid) => game.votes.has(pid))
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
  if (game.phase === "truth") {
    const slots = game.truthAssignments.get(playerId) ?? []
    const idx = game.truthProgress.get(playerId) ?? 0
    if (idx >= slots.length) {
      return { truth: { done: true, slotNumber: slots.length, slotCount: slots.length } }
    }
    const slot = slots[idx]
    const deadline = game.truthDeadlineByPlayer.get(playerId) ?? Date.now()
    const msLeft = Math.max(0, deadline - Date.now())
    if (slot.chosen == null) {
      return {
        truth: {
          done: false,
          choosing: true,
          slotNumber: idx + 1,
          slotCount: slots.length,
          options: slot.choices.map((c) => c.self), // plain text, NO category shown
          msLeft,
          stepMs: CHOOSE_MS,
        },
      }
    }
    return {
      truth: {
        done: false,
        choosing: false,
        slotNumber: idx + 1,
        slotCount: slots.length,
        prompt: slot.choices[slot.chosen].self,
        alreadyAnswered: slot.answer ?? null,
        msLeft,
        stepMs: TRUTH_MS,
      },
    }
  }

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
