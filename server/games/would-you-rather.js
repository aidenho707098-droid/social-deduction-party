// "Majority Pick" — a read-the-room poll game. Each round everyone sees the
// same question with 2–4 answer options, privately picks one, and scores by
// landing on whatever option the crowd landed on — not their personal
// favourite. Whichever option gets the most votes is "the majority";
// pickers score on a sliding scale by how lopsided it was (POINT_TIERS),
// plus a flat streak bonus for consecutive majority rounds. Minority picks
// score 0. A tie for the top option means no majority — nobody scores,
// every streak resets.
//
// Two content sources, chosen by the host on the setup screen:
//
//   * BANK mode (default) — questions come from the hardcoded QUESTIONS
//     bank below. Flow: answer -> result -> ... -> final.
//
//   * CUSTOM mode — questions are built from the players' OWN answers to
//     open-ended prompts. Flow adds a "collect" phase up front:
//       1. `promptsPerPlayer` (K) pairing rounds. In each, players are
//          randomly split into pairs; each pair gets one distinct prompt
//          from PROMPTS that BOTH privately answer. An odd player out joins
//          a pair, making it a trio (that prompt becomes a 3-option round).
//       2. Everyone answers their K assigned prompts one at a time, ~45s
//          each. Unanswered prompts are dropped.
//       3. For each prompt used, its 2 (or 3) answers become one question's
//          options — shown ANONYMOUSLY. Authorship is revealed only at the
//          result screen.
//     From the answer phase on, custom mode plays exactly like bank mode,
//     plus the "Crowd Pleaser" bonus (see revealRound): the author(s) of
//     the round's most-voted answer get a flat +1.

import { shuffle, drawWithoutRepeats } from "./deck.js";

// --- BANK MODE question bank ----------------------------------------
// Each entry: a self-contained prompt plus 2–4 answer options. Written to
// be genuinely divisive — a table of reasonable people should split fairly
// evenly, not all pile onto one "obviously better" answer. Drawn at random
// with no repeats within a session (see server/games/deck.js).
const QUESTIONS = [
  // --- Death, danger, the body (2-option) ---
  { prompt: "Which is the worse way to go?", options: ["Slowly, with plenty of warning", "Instantly, with none"] },
  { prompt: "You must lose one sense permanently. Which goes?", options: ["Taste", "Smell"] },
  { prompt: "Pick the phobia you'd rather live with.", options: ["Heights", "Enclosed spaces"] },
  { prompt: "Which injury would you rather nurse for a year?", options: ["A bad back", "A bad knee"] },
  { prompt: "Which is the worse age to die at?", options: ["45", "95"] },
  { prompt: "Pick the funeral you'd want.", options: ["A huge party where nobody cries", "A small one where everybody does"] },
  { prompt: "Which chronic low-level misery could you tolerate?", options: ["A permanent dull headache", "Permanently mild nausea"] },
  { prompt: "Which would you rather survive?", options: ["A plane crash", "A shipwreck"] },
  { prompt: "You must give one up for good.", options: ["Sleeping in a bed", "Sitting on chairs"] },
  { prompt: "How would you rather get bad news?", options: ["All at once", "Piece by piece over weeks"] },
  { prompt: "Which is worse to lose in a house fire?", options: ["Every photo you own", "Every letter and note anyone ever wrote you"] },
  { prompt: "Pick the body part to permanently lose feeling in.", options: ["Your hands", "Your feet"] },
  { prompt: "Which would you rather know?", options: ["The exact date you'll die", "The exact cause"] },
  { prompt: "You have to keep one on at all times.", options: ["A blindfold, indoors only", "Earplugs, outdoors only"] },
  { prompt: "Which near-miss would rattle you more?", options: ["A car that swerved away at the last second", "A diagnosis that turned out to be a mix-up"] },

  // --- Career & life (2-option) ---
  { prompt: "Pick the deal.", options: ["3-day week at 60% pay", "6-day week at 140% pay"] },
  { prompt: "Which job do you actually take?", options: ["Work you love, an awful boss", "Work you find dull, a dream boss"] },
  { prompt: "You must choose one career.", options: ["One you're proud of that pays little", "One you're bored by that pays a fortune"] },
  { prompt: "Which retirement?", options: ["Retire at 40 on a tight budget", "Retire at 65 with money to spare"] },
  { prompt: "Pick your commute, forever.", options: ["90 quiet minutes on a train", "20 stressful minutes in traffic"] },
  { prompt: "Which would you rather be known as at work?", options: ["Reliable but forgettable", "Brilliant but unpredictable"] },
  { prompt: "Your work can only matter to one group.", options: ["Strangers you'll never meet", "The people who live with you"] },
  { prompt: "Pick the harder truth.", options: ["You already peaked", "Your best years are decades away"] },
  { prompt: "Which feedback would you rather get?", options: ["Harsh and correct", "Kind and vague"] },
  { prompt: "You must run one.", options: ["A failing business that's yours", "A thriving one that isn't"] },
  { prompt: "Which regret could you live with?", options: ["The job you didn't take", "The one you took and hated for years"] },
  { prompt: "Pick how your work gets recognised.", options: ["A big prize nobody remembers", "Quiet respect from people you rate"] },

  // --- Relationships & social (2-option) ---
  { prompt: "Which is worse in a close friend?", options: ["Always late, always honest", "Always on time, a little fake"] },
  { prompt: "Pick the partner flaw you could live with.", options: ["Never remembers dates", "Never admits they're wrong"] },
  { prompt: "You must choose.", options: ["Five friends who'd drop everything for you", "Fifty who like you but wouldn't"] },
  { prompt: "Which would sting more?", options: ["Being forgotten by someone you loved", "Being remembered by them as the villain"] },
  { prompt: "Pick the reunion.", options: ["See everyone from school again", "Never see any of them again"] },
  { prompt: "Which is the worse housemate?", options: ["Loud but spotless", "Silent but filthy"] },
  { prompt: "You're this person at every party.", options: ["First to arrive", "Last to leave"] },
  { prompt: "Which reply is worse to receive?", options: ["“k”", "A three-paragraph essay, three hours late"] },
  { prompt: "Pick your in-laws.", options: ["Warm and always around", "Polite and distant"] },
  { prompt: "Which would you rather your partner secretly do?", options: ["Read your texts", "Listen to your calls"] },
  { prompt: "You can only keep one.", options: ["The friends who knew you at 15", "The friends you'd choose today"] },
  { prompt: "Which is more embarrassing?", options: ["Waving back at someone who wasn't waving at you", "Calling a teacher “Mum” as an adult"] },
  { prompt: "Pick the worse group-chat crime.", options: ["Leaves everyone on read for days", "Sends 40 messages before you can reply once"] },

  // --- Hypothetical swaps (2-option) ---
  { prompt: "Swap lives for a year with one of them.", options: ["A famous person you admire", "A stranger with a quiet, easy life"] },
  { prompt: "You must swap bodies for a week.", options: ["With someone 30 years older", "With someone 15 years younger"] },
  { prompt: "Trade your memory of your worst year.", options: ["Forget it completely", "Keep it, but relive it once a year"] },
  { prompt: "Swap your phone's entire contents with a random stranger's.", options: ["Do it", "Never"] },
  { prompt: "Trade all your problems for the average person's, unseen.", options: ["Take the swap", "Keep your own"] },
  { prompt: "You can hand one thing to a friend and take theirs.", options: ["Their confidence for your patience", "Their looks for your health"] },
  { prompt: "Swap your childhood with someone else's, at random.", options: ["Roll the dice", "Keep the one you had"] },
  { prompt: "Live one year as the opposite kind of person.", options: ["A total extrovert if you're not", "A total introvert if you're not"] },

  // --- Extremes & absurd scenarios (2-option) ---
  { prompt: "Which is worse, every day?", options: ["Everything you eat is slightly too hot", "Everything you drink is slightly too cold"] },
  { prompt: "Every day you must do one.", options: ["Say exactly what you're thinking for one hour", "Say nothing at all for three"] },
  { prompt: "Pick one, for life.", options: ["Always overdressed", "Always underdressed"] },
  { prompt: "This power switches on and you can't turn it off.", options: ["You hear every thought within 10 feet", "You see 10 seconds into everyone's future"] },
  { prompt: "You must live somewhere.", options: ["A city that never sleeps", "A village where nothing ever happens"] },
  { prompt: "Which curse?", options: ["Everyone finds you slightly annoying", "Nobody remembers you the next day"] },
  { prompt: "Pick your permanent climate.", options: ["Grey and mild all year", "Harsh, but four real seasons"] },
  { prompt: "You must make one thing public.", options: ["Your search history", "Your bank balance"] },
  { prompt: "It's your turn at karaoke and there's no way out.", options: ["Sing badly, completely sincerely", "Refuse and kill the mood"] },
  { prompt: "Pick one.", options: ["Be the funniest person nobody takes seriously", "Be the dullest person everyone respects"] },
  { prompt: "Which would you rather be forced to wear every day?", options: ["Shoes one size too small", "A coat one size too big"] },
  { prompt: "You can only communicate one way for a year.", options: ["Only ever texting, never speaking", "Only ever speaking, never a screen"] },
  { prompt: "Which is the worse quiet catastrophe?", options: ["Your phone autocorrects one word wrong in every message, forever", "Your voice drops the last word of every sentence"] },
  { prompt: "Pick your involuntary tell.", options: ["You laugh when you're nervous", "You cry when you're angry"] },

  // --- Money & stuff (2-option) ---
  { prompt: "Which windfall?", options: ["£20,000 today", "£200 a week for the rest of your life"] },
  { prompt: "Pick the catch on free housing.", options: ["Free rent forever, someone else picks the city", "Cheap rent, you pick"] },
  { prompt: "Spend it in a month or lose it.", options: ["£50,000 on yourself only", "£150,000 on other people only"] },
  { prompt: "Which is worse to lose?", options: ["Your wallet, abroad", "Your phone, at home"] },
  { prompt: "Everything you own is one of these.", options: ["Second-hand and dependable", "Brand new and always breaking"] },
  { prompt: "Pick the inheritance.", options: ["A house you must live in", "The cash, but only in another country"] },
  { prompt: "Which would you rather never pay for again?", options: ["Rent or mortgage", "Everything else, but rent stays"] },

  // --- Everyday dilemmas (2-option) ---
  { prompt: "Which is more maddening, forever?", options: ["A tiny stone in your shoe you can't get out", "A shirt tag you can't cut off"] },
  { prompt: "Pick your flaw.", options: ["Always five minutes early", "Always five minutes late"] },
  { prompt: "This breaks every single time you use it.", options: ["Your headphones", "Your umbrella"] },
  { prompt: "Pick your internet.", options: ["Slow but never drops", "Fast but drops twice a day"] },
  { prompt: "Which is worse all day?", options: ["A song stuck in your head", "A word on the tip of your tongue"] },
  { prompt: "You must do one, always.", options: ["Read the book before the film", "Only ever watch the film"] },
  { prompt: "Pick the chore you do forever.", options: ["Every dish, never cooking", "Every meal, never washing up"] },
  { prompt: "Which alarm would get you out of bed?", options: ["Gentle music that you'll sleep through", "A klaxon that works but you'll hate"] },
  { prompt: "Your device is stuck like this.", options: ["Phone always at 15% battery", "Storage always completely full"] },
  { prompt: "Pick the small daily loss.", options: ["You never find a matching pair of socks", "One shoelace never stays tied"] },

  // --- Food & drink (2-option) ---
  { prompt: "Give one up forever.", options: ["Bread", "Cheese"] },
  { prompt: "Which is the worse life sentence?", options: ["Only sweet food, forever", "Only savoury, forever"] },
  { prompt: "Pick the curse.", options: ["Coffee tastes like dishwater to you", "Chocolate tastes like chalk"] },
  { prompt: "You must eat one way.", options: ["The same great meal every day", "A random meal each day — could be anything"] },
  { prompt: "Which table rule?", options: ["Always split the bill evenly", "Everyone pays exactly for what they had"] },
  { prompt: "Pick one.", options: ["Never eat in a restaurant again", "Never cook for yourself again"] },
  { prompt: "Which is worse?", options: ["Every hot meal arrives lukewarm", "Every cold drink arrives room temperature"] },
  { prompt: "You can only keep one texture.", options: ["Only crunchy foods", "Only soft foods"] },
  { prompt: "Pick your eating company for life.", options: ["Great food, always alone", "Mediocre food, always with people you love"] },

  // --- Fame, reputation, the outside view (2-option) ---
  { prompt: "You will be famous for one thing. Pick the lesser evil.", options: ["A viral clip of you falling over", "A strong opinion you no longer hold"] },
  { prompt: "Which would you rather people believe about you?", options: ["That you're cleverer than you are", "That you're kinder than you are"] },
  { prompt: "Pick the biography.", options: ["Fascinating life, terrible person", "Dull life, wonderful person"] },
  { prompt: "Which would you rather be, at your funeral?", options: ["Deeply missed by a few", "Vaguely remembered fondly by hundreds"] },
  { prompt: "Your worst moment gets one audience.", options: ["Everyone you've ever met, once", "Ten strangers, on a loop forever"] },

  // --- Time, aging, do-overs (2-option) ---
  { prompt: "Pick the do-over.", options: ["Redo one year of your life", "Skip one year you'd rather not live"] },
  { prompt: "Which would you rather?", options: ["Age only from the neck down", "Age only from the neck up"] },
  { prompt: "You get one call.", options: ["Ten minutes with your future self", "Ten minutes with your past self"] },
  { prompt: "Pick the button.", options: ["Pause the world for 60 seconds, once a day", "Rewind 10 seconds, once a day"] },
  { prompt: "Which memory setting?", options: ["Remember every dream in full", "Never dream again, but sleep perfectly"] },

  // --- 3-option ---
  { prompt: "Best way to spend a surprise day off?", options: ["Alone, doing nothing", "With one close friend", "Big group, big plans"] },
  { prompt: "Worst person to be stuck next to on a 10-hour flight?", options: ["A close talker", "A seat-kicker", "A nervous flier who needs reassurance"] },
  { prompt: "Give one up for a year.", options: ["Coffee", "Alcohol", "Sugar"] },
  { prompt: "Pick the everyday superpower.", options: ["Read minds", "Rewind 10 seconds once a day", "Always know when someone's lying"] },
  { prompt: "Which is the worst to lose right now?", options: ["Your keys", "Your phone", "Your wallet"] },
  { prompt: "Best era of pop culture?", options: ["The 80s", "The 90s", "The 2000s"] },
  { prompt: "You must live in one.", options: ["A tiny flat in the perfect city", "A big house in a dull town", "A cabin far from anyone"] },
  { prompt: "Pick the pet situation.", options: ["A dog that needs constant attention", "A cat that mostly ignores you", "No pet, more freedom"] },
  { prompt: "Worst trait in a manager?", options: ["Micromanages everything", "Never around when you need them", "Takes credit for your work"] },
  { prompt: "Choose your last meal.", options: ["Your childhood favourite", "The best meal you've ever eaten", "Something you've never tried"] },
  { prompt: "Which fear would you keep if you had to keep one?", options: ["Spiders", "Heights", "Deep water"] },
  { prompt: "Best age to stay, forever?", options: ["10", "25", "40"] },
  { prompt: "Which would you rather be?", options: ["A little bit famous", "Quietly rich", "Genuinely respected in a small field"] },
  { prompt: "Worst way to be woken up?", options: ["A fire alarm", "A freezing cold room", "A phone call with bad news"] },
  { prompt: "Pick the group holiday.", options: ["All-inclusive resort, no plans", "Backpacking with a loose route", "A city with a packed itinerary"] },
  { prompt: "You keep only one for life.", options: ["Music", "Films and TV", "Books"] },
  { prompt: "Do one job for a week.", options: ["Bin collection", "Call centre", "Night security"] },
  { prompt: "Best superpower for ordinary life?", options: ["Never need to sleep", "Never need to eat", "Teleport short distances"] },
  { prompt: "Never do this again.", options: ["Fly", "Drive", "Take public transport"] },
  { prompt: "Pick your permanent season.", options: ["Spring", "Autumn", "Summer"] },
  { prompt: "Which is the least bad way to cry in public?", options: ["At a wedding", "At work", "On the bus"] },
  { prompt: "You must be the friend who's always...", options: ["Broke", "Busy", "Bailing"] },
  { prompt: "Which household noise could you live with forever?", options: ["A dripping tap", "A buzzing light", "A humming fridge"] },
  { prompt: "Pick the worst text to get from a friend.", options: ["“can we talk”", "“where are you”", "“don't be mad but”"] },
  { prompt: "You must give a speech to a room of...", options: ["Strangers", "Colleagues", "Your extended family"] },

  // --- 4-option ---
  { prompt: "One cuisine for the rest of your life:", options: ["Italian", "Japanese", "Mexican", "Indian"] },
  { prompt: "Best pet:", options: ["Dog", "Cat", "Bird", "None"] },
  { prompt: "Relive one on loop for a month:", options: ["Your best day ever", "A calm, ordinary Tuesday", "Your first day at a new job", "A childhood birthday"] },
  { prompt: "Pick the superpower:", options: ["Fly", "Turn invisible", "Read minds", "Freeze time"] },
  { prompt: "Worst spot on a long journey:", options: ["Middle seat", "Right by the toilet", "Next to a crying baby", "Broken recline"] },
  { prompt: "A talent, handed to you for free:", options: ["Singing", "Drawing", "Dancing", "Stand-up comedy"] },
  { prompt: "Dream home:", options: ["Beach house", "City penthouse", "Forest cabin", "Countryside farm"] },
  { prompt: "Master one instantly:", options: ["A language", "An instrument", "A sport", "Cooking"] },
  { prompt: "Best way to travel:", options: ["Road trip", "Long train journey", "Cruise", "Backpacking"] },
  { prompt: "Visit one for a week:", options: ["The 1920s", "The 1960s", "The 1980s", "The 2050s"] },
  { prompt: "One drink forever:", options: ["Coffee", "Tea", "Fizzy water", "Beer"] },
  { prompt: "Your funeral send-off song should be:", options: ["Triumphant", "Devastating", "Funny", "Weirdly upbeat"] },
  { prompt: "Worst houseguest:", options: ["Never leaves", "Brings extra people", "Eats everything", "Snoops"] },
  { prompt: "Give one up for a year:", options: ["Streaming", "Social media", "Takeaways", "Online shopping"] },
  { prompt: "Best night out:", options: ["A loud club", "A quiet pub", "A gig", "A dinner party"] },
  { prompt: "Be the family's designated:", options: ["Driver", "Cook", "Planner", "Peacemaker"] },
  { prompt: "Pick the weekend class:", options: ["Pottery", "Boxing", "Improv", "Baking"] },
  { prompt: "Keep only one app:", options: ["Maps", "Messages", "Camera", "Music"] },
  { prompt: "Most bearable long-term:", options: ["Slightly too hot", "Slightly too cold", "Slightly too bright", "Slightly too loud"] },
  { prompt: "Which would you least mind being known for?", options: ["A bad haircut in an old photo", "A cringe voicemail", "An outfit at a wedding", "A karaoke performance"] },
];

// --- CUSTOM MODE prompt bank ---------------------------------------
// Open-ended, personal, deliberately provocative. Each becomes a question
// once two (or three) players have answered it. Drawn with no repeats
// within a session.
const PROMPTS = [
  "Where would you never want to visit?",
  "What is the worst way to die?",
  "What is the best possible job a person could have?",
  "Who would be the worst person on Earth to swap places with?",
  "What is the worst age to die at?",
  "What is the most overrated thing in life?",
  "What food should honestly be banned?",
  "What is the worst possible superpower to be stuck with?",
  "What is the best age to be, forever?",
  "What is the most useless talent someone could be born with?",
  "What is the worst place to be stuck for 24 hours?",
  "What is something everyone pretends to enjoy but secretly hates?",
  "Whose life looks great from the outside but would actually be miserable?",
  "What is the worst thing to find in your bed?",
  "What is the most irritating sound in the world?",
  "What is the worst possible last meal?",
  "What is the worst trait a partner could have?",
  "What is the best way to spend a totally free Saturday?",
  "What is the most pointless holiday or celebration?",
  "What animal would be the most terrifying at human size?",
  "What is the worst job to have during a zombie apocalypse?",
  "What is a small thing that instantly ruins your day?",
  "Which fictional character would be unbearable to be trapped with?",
  "What is the worst possible name to give a child?",
  "What is the most overrated place to travel?",
  "What skill is a complete waste of time to learn?",
  "What is the worst way to be woken up?",
  "What is the most embarrassing way to become famous?",
  "What is the worst habit a housemate could have?",
  "If you could delete one month from the calendar, which?",
  "What is the worst thing to be really, really good at?",
  "What job should pay far more than it does?",
  "What is the worst possible thing to be allergic to?",
  "What is the most annoying type of person to be stuck with at a party?",
  "What is the worst body part to injure?",
  "What is the most overrated life milestone?",
  "Whose job would you least want to do for a single day?",
  "What is the worst possible thing to be famous for?",
  "What is a place that is far scarier than people admit?",
  "What is the worst age to become a parent?",
  "What power would be a nightmare if you couldn't switch it off?",
  "What is the worst way to blow a huge lottery win?",
  "What hobby is secretly a cry for help?",
  "What is the worst thing to be the 'expert' on among your friends?",
  "If you had to move abroad tomorrow, where would be the worst choice?",
  "What is the worst possible theme for a wedding?",
  "What is the most useless thing to be the best in the world at?",
  "What is the worst decade to have been a teenager?",
  "What job would break you within a week?",
  "What is the worst thing to hear a doctor say casually?",
  "What is the most overrated personality trait?",
  "What would be the worst nickname to be stuck with for life?",
  "What is the most unsettling thing a stranger could say to you?",
  "What is the worst possible superpower to give a toddler?",
  "What is a completely normal thing that becomes horrifying if you think about it too long?",
];

export const id = "would-you-rather";
export const name = "Majority Pick";
export const minPlayers = 2;

// Custom mode needs at least this many players: with two, the two answers
// to every prompt are obviously "yours" and "theirs", so authorship can't
// be anonymous during voting.
const CUSTOM_MIN_PLAYERS = 3;

// How long players get to answer each poll round (both modes). The client
// shows a countdown seeded from `msLeft`; at zero the host's device asks
// the server to reveal. The host can also reveal early.
const ANSWER_MS = 25_000;

// Custom mode only: time to write each open-ended prompt answer, one at a
// time. Tracked per player (each player has their own clock for their
// current prompt) — see getPrivateState / tickCollect.
const COLLECT_MS = 45_000;

// Tiered majority payout, checked high-to-low against the winning option's
// share of everyone who answered. Below 51% (a weak plurality on a 3–4
// option question) the base payout is 0 — but the picker still counts as
// "in the majority" for streak and end-of-game award purposes.
const POINT_TIERS = [
  { min: 0.9, points: 3 },
  { min: 0.7, points: 2 },
  { min: 0.51, points: 1 },
];

// Flat bonus added once a player has been in the majority for 2+ rounds in
// a row, on top of the tiered base.
const STREAK_BONUS = 1;

// Custom mode only: flat, non-scaling bonus to the author(s) of the round's
// most-voted answer.
const CROWD_PLEASER_BONUS = 1;

const letterFor = (i) => String.fromCharCode(65 + i); // 0 -> "A"
const indexFor = (letter) => letter.charCodeAt(0) - 65; // "A" -> 0

// Loose normaliser for folding two identical prompt answers ("New Jersey"
// / "new jersey ") into one option.
function normalizeAnswer(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function freshStats() {
  return { answered: 0, majority: 0, bestStreak: 0, crowdPleaser: 0 };
}

function baseGame(playerIds) {
  const now = Date.now();
  return {
    id,
    roundIndex: 0,
    answers: new Map(), // playerId -> "A".."D", cleared between rounds
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    streaks: new Map(playerIds.map((pid) => [pid, 0])), // consecutive majority rounds
    stats: new Map(playerIds.map((pid) => [pid, freshStats()])), // end-of-game awards
    deadline: now + ANSWER_MS,
    lastResult: null, // filled in by revealRound()
  };
}

// --- Game creation -------------------------------------------------

export function createGame(playerIds, options = {}) {
  const mode = options.mode === "custom" ? "custom" : "bank";
  return mode === "custom"
    ? createCustomGame(playerIds, options)
    : createBankGame(playerIds, options);
}

// The host picks how many rounds. Draw the whole session's questions up
// front from a shuffled copy of the bank, so none can repeat within a game.
function createBankGame(playerIds, { rounds, memory }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const totalRounds = Math.min(requested, QUESTIONS.length);
  const { items, seenKeys } = drawWithoutRepeats(
    QUESTIONS,
    totalRounds,
    memory?.seen ?? [],
    (q) => `${q.prompt} | ${q.options.join(" | ")}`
  );

  return {
    ...baseGame(playerIds),
    custom: false,
    phase: "answer", // "answer" -> "result" -> ... -> "final"
    totalRounds,
    questions: items, // each { prompt, options: string[] }
    deckMemory: { seen: seenKeys },
  };
}

// Custom mode: build the pairing schedule, assign a distinct prompt to each
// pair/trio, and enter the "collect" phase. Questions are generated once
// everyone's answers are in (see generateQuestions).
function createCustomGame(playerIds, { promptsPerPlayer, memory }) {
  const k = Number(promptsPerPlayer);
  if (!Number.isInteger(k) || k < 2 || k > 4) {
    throw new Error("Choose 2, 3, or 4 prompts per player.");
  }
  if (playerIds.length < CUSTOM_MIN_PLAYERS) {
    throw new Error(`Custom Mode needs at least ${CUSTOM_MIN_PLAYERS} players.`);
  }

  // K pairing rounds; each round splits everyone into pairs (one becomes a
  // trio if the count is odd). Every player lands in exactly one group per
  // round, so everyone answers exactly K prompts.
  const pairingRounds = buildPairings(playerIds, k);
  const slotsNeeded = pairingRounds.reduce((n, groups) => n + groups.length, 0);

  const { items: promptTexts, seenKeys } = drawWithoutRepeats(
    PROMPTS,
    slotsNeeded,
    memory?.seen ?? []
  );

  // Flatten (round, group) -> a numbered prompt slot.
  const promptSlots = [];
  const assignments = new Map(playerIds.map((pid) => [pid, []]));
  for (const groups of pairingRounds) {
    for (const memberIds of groups) {
      const slotId = promptSlots.length;
      promptSlots.push({
        id: slotId,
        text: promptTexts[slotId % promptTexts.length],
        memberIds: [...memberIds],
        answers: new Map(), // playerId -> text
      });
      for (const pid of memberIds) assignments.get(pid).push(slotId);
    }
  }

  const now = Date.now();
  return {
    ...baseGame(playerIds),
    custom: true,
    phase: "collect", // "collect" -> "answer" -> "result" -> ... -> "final"
    promptsPerPlayer: k,
    totalRounds: 0, // set by generateQuestions()
    questions: [], // built by generateQuestions()
    deckMemory: { seen: seenKeys },
    promptSlots,
    assignments, // playerId -> [slotId, ...] in the order they answer them
    progress: new Map(playerIds.map((pid) => [pid, 0])), // how many of their prompts are done
    promptDeadlineByPlayer: new Map(playerIds.map((pid) => [pid, now + COLLECT_MS])),
  };
}

// --- Random pairing algorithm ------------------------------------
// For each of `roundsCount` pairing rounds, shuffle the players and pair
// them off consecutively; an odd one out is folded into the last pair,
// making a trio. Across rounds we bias toward NOT repeating partners: try a
// handful of shuffles and keep whichever reproduces the fewest pairings
// we've already used. (With very few players some repeats are unavoidable —
// the attempt cap makes that a graceful fallback, not a hang.)
function buildPairings(playerIds, roundsCount) {
  const usedPairKeys = new Set();
  const rounds = [];

  for (let r = 0; r < roundsCount; r++) {
    let best = null;
    let bestRepeats = Infinity;
    for (let attempt = 0; attempt < 40; attempt++) {
      const groups = partitionOnce(shuffle(playerIds));
      const repeats = countRepeatedPairs(groups, usedPairKeys);
      if (repeats < bestRepeats) {
        bestRepeats = repeats;
        best = groups;
        if (repeats === 0) break;
      }
    }
    for (const key of groupPairKeys(best)) usedPairKeys.add(key);
    rounds.push(best);
  }
  return rounds;
}

// One shuffled list -> array of groups. Pairs of two, except: an odd tail
// player is appended to the final pair, making it a group of three.
function partitionOnce(shuffled) {
  const groups = [];
  const n = shuffled.length;
  const pairCount = Math.floor(n / 2);
  for (let i = 0; i < pairCount; i++) {
    groups.push([shuffled[2 * i], shuffled[2 * i + 1]]);
  }
  if (n % 2 === 1) groups[groups.length - 1].push(shuffled[n - 1]);
  return groups;
}

const pairKey = (a, b) => [a, b].sort().join("|");

// Every unordered within-group pairing, as stable keys. A trio [a,b,c]
// contributes a|b, a|c, b|c.
function groupPairKeys(groups) {
  const keys = [];
  for (const g of groups) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) keys.push(pairKey(g[i], g[j]));
    }
  }
  return keys;
}

function countRepeatedPairs(groups, usedPairKeys) {
  return groupPairKeys(groups).filter((k) => usedPairKeys.has(k)).length;
}

// --- Collect phase (custom mode) --------------------------------

// A player submits (or the timer skips) one of their assigned prompts.
// Empty text = skipped. Either way their pointer advances and their clock
// resets for the next prompt. Once every present player has worked through
// their whole queue, questions are generated and the answer phase begins.
export function submitPrompt(game, playerId, rawText, presentPlayerIds) {
  if (game.phase !== "collect") return { ok: false };

  const queue = game.assignments.get(playerId);
  if (!queue) return { ok: false };
  const done = game.progress.get(playerId) ?? 0;
  if (done >= queue.length) return { ok: false, alreadyDone: true };

  const slot = game.promptSlots[queue[done]];
  const deadline = game.promptDeadlineByPlayer.get(playerId) ?? 0;
  const text = String(rawText ?? "").slice(0, 120).trim();

  // Accept the text if it's non-empty and roughly on time; otherwise this
  // counts as a skip but the pointer still moves on.
  if (text && Date.now() <= deadline + 2000) {
    slot.answers.set(playerId, text);
  }

  game.progress.set(playerId, done + 1);
  game.promptDeadlineByPlayer.set(playerId, Date.now() + COLLECT_MS);

  maybeStartAnswering(game, presentPlayerIds);
  return { ok: true, recorded: !!slot.answers.get(playerId) };
}

// Server-interval hook (see server/index.js): auto-skip any player whose
// clock for their current prompt has run out, and start the answer phase
// if that was the last thing everyone was waiting on. Returns true if
// anything changed so the caller knows to re-broadcast.
export function tickCollect(game, presentPlayerIds) {
  if (game.phase !== "collect") return false;
  const now = Date.now();
  let changed = false;

  for (const pid of presentPlayerIds) {
    const queue = game.assignments.get(pid) ?? [];
    const done = game.progress.get(pid) ?? 0;
    if (done >= queue.length) continue;
    const deadline = game.promptDeadlineByPlayer.get(pid) ?? 0;
    if (now > deadline + 2000) {
      game.progress.set(pid, done + 1); // time ran out on this prompt -> skip
      game.promptDeadlineByPlayer.set(pid, now + COLLECT_MS);
      changed = true;
    }
  }

  if (maybeStartAnswering(game, presentPlayerIds)) changed = true;
  return changed;
}

function collectDone(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return false;
  return presentPlayerIds.every((pid) => {
    const queue = game.assignments.get(pid) ?? [];
    return (game.progress.get(pid) ?? 0) >= queue.length;
  });
}

function maybeStartAnswering(game, presentPlayerIds) {
  if (game.phase !== "collect") return false;
  if (!collectDone(game, presentPlayerIds)) return false;
  generateQuestions(game);
  return true;
}

// Turn the collected answers into this session's questions: one per prompt
// slot that got at least two DISTINCT answers. Identical answers within a
// slot merge into a single option credited to both authors. Options are
// shuffled so their order doesn't hint at who wrote them. Authorship
// (`authorIds`, an array of arrays parallel to `options`) stays private
// until revealRound().
function generateQuestions(game) {
  const questions = [];

  for (const slot of game.promptSlots) {
    const merged = [];
    for (const [pid, text] of slot.answers) {
      const clean = String(text ?? "").trim();
      if (!clean) continue;
      const norm = normalizeAnswer(clean);
      const hit = norm && merged.find((m) => m.norm === norm);
      if (hit) hit.authorIds.push(pid);
      else merged.push({ text: clean, norm, authorIds: [pid] });
    }
    if (merged.length < 2) continue; // unanswered / one-sided -> excluded

    const ordered = shuffle(merged);
    questions.push({
      prompt: slot.text,
      options: ordered.map((m) => m.text),
      authorIds: ordered.map((m) => [...m.authorIds]),
    });
  }

  game.questions = shuffle(questions);
  game.totalRounds = game.questions.length;
  game.roundIndex = 0;
  game.answers = new Map();

  if (game.totalRounds === 0) {
    // Nothing usable came back (e.g. everyone dropped mid-collect).
    game.phase = "final";
    game.lastResult = null;
    return;
  }
  game.deadline = Date.now() + ANSWER_MS;
  game.phase = "answer";
}

// --- Answer / reveal (both modes) ------------------------------

// Record (or change) a player's pick. Once every present player has
// answered, the round reveals itself without waiting for the timer.
export function submitAnswer(game, playerId, choice, presentPlayerIds) {
  if (game.phase !== "answer") return;

  const optionCount = game.questions[game.roundIndex].options.length;
  const idx = typeof choice === "string" ? indexFor(choice) : -1;
  if (idx < 0 || idx >= optionCount) return;

  game.answers.set(playerId, choice);

  const everyoneAnswered = presentPlayerIds.every((pid) => game.answers.has(pid));
  if (everyoneAnswered) revealRound(game, presentPlayerIds);
}

// Tally the round, find the winning option, and hand out points:
//   base   — POINT_TIERS payout for the winning option's vote share (0 if <51%)
//   bonus  — flat STREAK_BONUS once a player's majority streak reaches 2
//   crowd  — custom mode only: flat CROWD_PLEASER_BONUS to the author(s)
//            of the most-voted answer
// Minority picks score 0 and reset that player's streak. A tie for the top
// option means no majority: nobody scores majority points, every present
// player's streak resets. (Crowd Pleaser is separate — a tie for most votes
// pays every tied answer's author.)
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "answer") return;

  const question = game.questions[game.roundIndex];
  const optionCount = question.options.length;

  const picks = presentPlayerIds
    .filter((pid) => game.answers.has(pid))
    .map((pid) => [pid, game.answers.get(pid)]);

  const counts = {};
  for (let i = 0; i < optionCount; i++) counts[letterFor(i)] = 0;
  for (const [, choice] of picks) counts[choice] += 1;

  const totalAnswered = picks.length;
  const maxVotes = Math.max(0, ...Object.values(counts));
  const topKeys = Object.keys(counts).filter((k) => counts[k] === maxVotes && maxVotes > 0);
  const tie = topKeys.length !== 1;
  const majorityKey = tie ? null : topKeys[0];
  const majorityPct = majorityKey ? maxVotes / totalAnswered : 0;
  const tier = POINT_TIERS.find((t) => majorityPct >= t.min);
  const tierPoints = tier ? tier.points : 0;

  const roundScores = {};
  for (const [pid, choice] of picks) {
    const st = game.stats.get(pid) ?? freshStats();
    st.answered += 1;

    const inMajority = majorityKey !== null && choice === majorityKey;
    let base = 0;
    let bonus = 0;
    let streak = 0;

    if (inMajority) {
      st.majority += 1;
      streak = (game.streaks.get(pid) ?? 0) + 1;
      game.streaks.set(pid, streak);
      if (streak > st.bestStreak) st.bestStreak = streak;
      base = tierPoints;
      bonus = streak >= 2 ? STREAK_BONUS : 0;
    } else {
      game.streaks.set(pid, 0);
    }

    game.stats.set(pid, st);
    const total = base + bonus;
    if (total) game.scores.set(pid, (game.scores.get(pid) ?? 0) + total);
    roundScores[pid] = { inMajority, base, bonus, crowdPleaser: 0, total, streak };
  }

  // Sitting a round out breaks a majority streak too.
  for (const pid of presentPlayerIds) {
    if (!game.answers.has(pid)) game.streaks.set(pid, 0);
  }

  // --- Crowd Pleaser (custom mode) ---
  let authorsByKey = null;
  let crowdPleaserIds = [];
  if (game.custom) {
    authorsByKey = {};
    (question.authorIds ?? []).forEach((authors, i) => {
      authorsByKey[letterFor(i)] = [...authors];
    });

    if (maxVotes > 0) {
      const winners = new Set();
      for (const key of Object.keys(counts)) {
        if (counts[key] === maxVotes) {
          for (const pid of authorsByKey[key] ?? []) winners.add(pid);
        }
      }
      for (const pid of winners) {
        if (!roundScores[pid]) {
          roundScores[pid] = {
            inMajority: false,
            base: 0,
            bonus: 0,
            crowdPleaser: 0,
            total: 0,
            streak: game.streaks.get(pid) ?? 0,
          };
        }
        roundScores[pid].crowdPleaser = CROWD_PLEASER_BONUS;
        roundScores[pid].total += CROWD_PLEASER_BONUS;
        game.scores.set(pid, (game.scores.get(pid) ?? 0) + CROWD_PLEASER_BONUS);
        const st = game.stats.get(pid);
        if (st) st.crowdPleaser = (st.crowdPleaser ?? 0) + 1;
      }
      crowdPleaserIds = [...winners];
    }
  }

  game.lastResult = {
    roundIndex: game.roundIndex,
    optionCount,
    counts,
    totalAnswered,
    majorityKey,
    majorityPct,
    tie,
    tierPoints,
    answers: Object.fromEntries(picks), // playerId -> "A".."D"
    roundScores, // playerId -> { inMajority, base, bonus, crowdPleaser, total, streak }
    custom: !!game.custom,
    authorsByKey, // custom only: "A"->[pid], ... (revealed now)
    crowdPleaserIds, // custom only
  };
  game.phase = "result";
}

// Optional framework hook: called when the connected-player set changes.
// Don't let a phase hang on someone who's gone.
export function reconcilePresence(game, presentPlayerIds) {
  if (presentPlayerIds.length === 0) return;
  if (game.phase === "collect") {
    maybeStartAnswering(game, presentPlayerIds);
  } else if (game.phase === "answer" && presentPlayerIds.every((pid) => game.answers.has(pid))) {
    revealRound(game, presentPlayerIds);
  }
}

// Host "Force proceed": push the current phase forward with only the input
// that's in. During "collect", generate questions from whatever's been
// answered; during "answer", reveal and score the picks cast.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "collect") generateQuestions(game);
  else if (game.phase === "answer") revealRound(game, presentPlayerIds);
}

export function nextRound(game) {
  if (game.phase !== "result") return;

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  game.answers = new Map();
  game.deadline = Date.now() + ANSWER_MS;
  game.phase = "answer";
}

// 1–4 lighthearted superlatives from per-player session stats. Only players
// who answered at least two rounds are eligible; each award goes to a
// different person.
function computeAwards(game, presentPlayerIds) {
  const rows = presentPlayerIds
    .map((pid) => ({ pid, ...(game.stats.get(pid) ?? freshStats()) }))
    .filter((r) => r.answered >= 2);
  if (rows.length < 2) return [];

  const awards = [];
  const taken = new Set();
  const majorityRate = (r) => r.majority / r.answered;

  const predictable = [...rows].sort(
    (a, b) => majorityRate(b) - majorityRate(a) || b.majority - a.majority
  )[0];
  if (predictable.majority > 0) {
    awards.push({
      id: "most-predictable",
      emoji: "🎯",
      title: "Most Predictable",
      playerId: predictable.pid,
      detail: `With the majority in ${predictable.majority} of ${predictable.answered} rounds (${Math.round(
        majorityRate(predictable) * 100
      )}%)`,
    });
    taken.add(predictable.pid);
  }

  const wildcard = [...rows].sort(
    (a, b) =>
      (1 - majorityRate(b)) - (1 - majorityRate(a)) ||
      (b.answered - b.majority) - (a.answered - a.majority)
  )[0];
  const wildMisses = wildcard.answered - wildcard.majority;
  if (wildMisses > 0 && !taken.has(wildcard.pid)) {
    awards.push({
      id: "wildcard",
      emoji: "🃏",
      title: "Wildcard",
      playerId: wildcard.pid,
      detail: `Went against the crowd in ${wildMisses} of ${wildcard.answered} rounds (${Math.round(
        (wildMisses / wildcard.answered) * 100
      )}%)`,
    });
    taken.add(wildcard.pid);
  }

  const streaker = [...rows].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  if (streaker.bestStreak >= 3 && !taken.has(streaker.pid)) {
    awards.push({
      id: "hot-streak",
      emoji: "🔥",
      title: "Hot Streak",
      playerId: streaker.pid,
      detail: `${streaker.bestStreak} rounds in the majority in a row`,
    });
    taken.add(streaker.pid);
  }

  // Custom mode: who wrote the most-voted answer most often.
  if (game.custom) {
    const pleaser = [...rows].sort((a, b) => b.crowdPleaser - a.crowdPleaser)[0];
    if (pleaser.crowdPleaser >= 2 && !taken.has(pleaser.pid)) {
      awards.push({
        id: "crowd-pleaser",
        emoji: "👑",
        title: "Crowd Pleaser",
        playerId: pleaser.pid,
        detail: `Wrote the most-voted answer in ${pleaser.crowdPleaser} rounds`,
      });
      taken.add(pleaser.pid);
    }
  }

  return awards;
}

// The PUBLIC view — identical for every player. The only things withheld:
// a pick that hasn't been revealed (those live on the clients), and, in
// custom mode, which player wrote which option (until the result screen).
export function getPublicState(game, presentPlayerIds) {
  const scores = presentPlayerIds
    .map((pid) => ({
      playerId: pid,
      score: game.scores.get(pid) ?? 0,
      streak: game.streaks.get(pid) ?? 0,
    }))
    .sort((x, y) => y.score - x.score);

  const state = {
    id: game.id,
    phase: game.phase,
    custom: !!game.custom,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    totalPlayers: presentPlayerIds.length,
    answerMs: ANSWER_MS,
    msLeft: Math.max(0, game.deadline - Date.now()),
    scores,
  };

  if (game.phase === "collect") {
    const doneCount = presentPlayerIds.filter((pid) => {
      const queue = game.assignments.get(pid) ?? [];
      return (game.progress.get(pid) ?? 0) >= queue.length;
    }).length;
    state.collect = {
      promptsPerPlayer: game.promptsPerPlayer,
      doneCount,
      promptSlotCount: game.promptSlots.length,
      collectMs: COLLECT_MS,
    };
    return state;
  }

  const question = game.questions[game.roundIndex];
  if (question) {
    state.question = { prompt: question.prompt, options: [...question.options] };
  }
  state.answeredPlayerIds = presentPlayerIds.filter((pid) => game.answers.has(pid));

  if (game.phase === "result") {
    state.result = game.lastResult;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
    state.awards = computeAwards(game, presentPlayerIds);
  }

  return state;
}

// Per-player secret: only used in the custom-mode "collect" phase, where it
// carries the single prompt this player is currently answering plus their
// remaining time. No secrets in any other phase.
export function getPrivateState(game, playerId) {
  if (game.phase !== "collect") return null;

  const queue = game.assignments.get(playerId) ?? [];
  const done = game.progress.get(playerId) ?? 0;

  if (done >= queue.length) {
    return { collect: { done: true, promptCount: queue.length, promptNumber: queue.length } };
  }

  const slot = game.promptSlots[queue[done]];
  const deadline = game.promptDeadlineByPlayer.get(playerId) ?? Date.now();
  return {
    collect: {
      done: false,
      slotId: slot.id,
      prompt: slot.text,
      promptNumber: done + 1,
      promptCount: queue.length,
      collectMs: COLLECT_MS,
      msLeft: Math.max(0, deadline - Date.now()),
      alreadyAnswered: slot.answers.get(playerId) ?? null,
    },
  };
}

// --- Tournament Mode: default per-game config. Always bank mode —
// custom mode's collect phase doesn't fit the tournament flow.
export function tournamentOptions() {
  return { rounds: 3 };
}
