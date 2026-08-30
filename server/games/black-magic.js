// "Black Magic" — a secret-behavior guessing game. Each round one player
// is "The Witch". At the start of a round The Witch is shown TWO Curses to
// choose from — one Physical, one Verbal — and picks whichever they'd
// rather perform. That choice stays private to The Witch and is visible on
// their screen all round. Everyone else ("Players") talks to The Witch,
// trying to spot the pattern. The first Player to say The Curse out loud
// has "Lifted the Curse"; The Witch taps that Player's name to award the
// point and end the round. The Witch can also "Reveal the Curse" early,
// and there's a hard 5-minute limit ("Curse Unbroken").
//
// Timing is authoritative here: the round clock is `Date.now() -
// roundStartedAt` on the SERVER (it only starts once The Witch has chosen
// their Curse), frozen into `endedAt` the instant the round ends. Clients
// only display it. Neither Curse option is ever in the public state —
// getPrivateState() hands the pair to The Witch during the "choose" phase
// and the chosen one during "active".

import { shuffle, drawWithoutRepeats } from "./deck.js";

// Every Curse carries exactly one `category`: "physical" (gestures,
// posture, gaze, props, timing tied to movement) or "verbal" (speech
// patterns, word rules, how an answer is delivered). Each round offers one
// of each.
//
// Every Curse ALSO carries a `subcategory` — a finer grouping revealed to
// Players as the second escalating hint (see HINT_SCHEDULE) — and a short,
// deliberately vague `hint` unique to that Curse, revealed as the third.
// Subcategories in use:
//   verbal:   "speech pattern" · "word avoidance" · "reaction-based"
//             · "callback" · "misdirection" · "feigned familiarity"
//             · "social trick"
//   physical: "gesture" · "posture/stance" · "timing-based movement"
//             · "gaze" · "mirroring" · "prop" · "misdirection"
//             · "social trick"
const CURSES = [
  // ===== Verbal =====
  { category: "verbal", subcategory: "speech pattern", text: "Say \"um\" or \"like\" before answering any question.", hint: "Listen to how every answer starts." },
  { category: "verbal", subcategory: "misdirection", text: "Answer every question with another question.", hint: "Notice who ends up asking whom." },
  { category: "verbal", subcategory: "word avoidance", text: "Never say \"yes\" — say \"sure\" or \"totally\" instead.", hint: "One ordinary word of agreement never appears." },
  { category: "verbal", subcategory: "speech pattern", text: "Repeat the last word of whatever question you were just asked, then answer.", hint: "Your last word tends to echo back." },
  { category: "verbal", subcategory: "speech pattern", text: "Refer to yourself in the third person, by your own name.", hint: "Listen for how they name themselves." },
  { category: "verbal", subcategory: "speech pattern", text: "Start every answer with the word \"Honestly,\".", hint: "Every answer opens the same way." },
  { category: "verbal", subcategory: "speech pattern", text: "End every sentence with \"...if that makes sense.\"", hint: "Every sentence lands on the same note." },
  { category: "verbal", subcategory: "speech pattern", text: "Work the word \"apparently\" into every answer.", hint: "One particular word keeps turning up." },
  { category: "verbal", subcategory: "word avoidance", text: "Never use contractions — say \"do not\", \"cannot\", \"I am\" in full.", hint: "Their speech is oddly formal." },
  { category: "verbal", subcategory: "speech pattern", text: "Say \"to be fair\" at least once in every answer.", hint: "A stock phrase recurs every turn." },
  { category: "verbal", subcategory: "speech pattern", text: "Quietly repeat your own answer a second time, more softly.", hint: "Answers seem to arrive twice." },
  { category: "verbal", subcategory: "reaction-based", text: "Laugh softly, even briefly, after every question asked of you.", hint: "Something happens the moment they're asked." },
  { category: "verbal", subcategory: "reaction-based", text: "Say \"what?\" every time someone asks you a question, then answer.", hint: "They react before they answer." },
  { category: "verbal", subcategory: "reaction-based", text: "Pause and look mildly confused for about two seconds before every answer.", hint: "Watch the beat before each answer." },
  { category: "verbal", subcategory: "speech pattern", text: "Say the asker's name before you respond to them.", hint: "You keep getting addressed by name." },
  { category: "verbal", subcategory: "reaction-based", text: "Sigh quietly before answering anything.", hint: "There's a small sound before each answer." },
  { category: "verbal", subcategory: "speech pattern", text: "Say \"good question\" before roughly every other answer.", hint: "Your questions keep getting graded." },
  { category: "verbal", subcategory: "speech pattern", text: "Compliment something about the asker before you answer them.", hint: "You keep getting flattered first." },
  { category: "verbal", subcategory: "word avoidance", text: "Never use the word \"I\" — rephrase everything to avoid it.", hint: "One very common little word is missing." },
  { category: "verbal", subcategory: "word avoidance", text: "Never say any number — describe amounts instead (\"a few\", \"some\", \"loads\").", hint: "Quantities stay strangely vague." },
  { category: "verbal", subcategory: "misdirection", text: "Never directly answer — always deflect first (\"that's a good question, but...\").", hint: "The real answer always arrives late." },
  { category: "verbal", subcategory: "word avoidance", text: "Never say the word \"no\" — talk around it instead.", hint: "Disagreeing takes them a while." },
  { category: "verbal", subcategory: "word avoidance", text: "Never use anyone's name, including your own.", hint: "Nobody ever gets named." },
  { category: "verbal", subcategory: "word avoidance", text: "Avoid the words \"good\" and \"bad\" — use other words.", hint: "Simple judgements come out wordy." },
  { category: "verbal", subcategory: "word avoidance", text: "Never say the word \"because\" — restructure your reasoning without it.", hint: "Reasons get explained the long way round." },
  { category: "verbal", subcategory: "word avoidance", text: "Never say the word \"the\".", hint: "A tiny everyday word has gone missing." },
  { category: "verbal", subcategory: "word avoidance", text: "Never use a word that begins with the letter \"w\".", hint: "Certain plain questions get awkward to answer." },
  { category: "verbal", subcategory: "word avoidance", text: "Never use a past-tense verb — describe everything in the present.", hint: "Old events sound like they're happening now." },
  { category: "verbal", subcategory: "speech pattern", text: "Wait exactly two seconds of silence before responding to anything.", hint: "The gap before each reply is always the same." },
  { category: "verbal", subcategory: "speech pattern", text: "Answer short questions slowly and long questions quickly.", hint: "Their pace seems tied to the question's length." },
  { category: "verbal", subcategory: "speech pattern", text: "Refer to every person by the wrong pronoun on purpose, consistently.", hint: "People keep getting mislabelled the same way." },
  { category: "verbal", subcategory: "misdirection", text: "Ask a follow-up question about something totally unrelated before answering the real question.", hint: "A detour comes before the answer." },
  { category: "verbal", subcategory: "speech pattern", text: "Whisper the first word of every sentence, then talk normally.", hint: "Each sentence starts hard to hear." },
  { category: "verbal", subcategory: "reaction-based", text: "Act surprised by every question, like you weren't expecting it.", hint: "Nothing ever seems anticipated." },
  { category: "verbal", subcategory: "speech pattern", text: "Talk slightly quieter every time you speak, getting softer as the round goes on.", hint: "Compare their volume now to ten minutes ago." },
  { category: "verbal", subcategory: "misdirection", text: "Bring the conversation back to food or snacks somehow, no matter the topic.", hint: "The subject keeps drifting one direction." },
  { category: "verbal", subcategory: "misdirection", text: "Answer the question, then immediately ask the person the same question back.", hint: "The question keeps bouncing back to you." },
  { category: "verbal", subcategory: "speech pattern", text: "Trail off the end of every sentence instead of finishing it clearly.", hint: "Sentences don't quite land." },
  { category: "verbal", subcategory: "speech pattern", text: "Add a short pause in the middle of your sentence, like you're choosing words carefully, every time.", hint: "There's always a hitch mid-sentence." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Act like you already knew what someone was going to ask before they finish asking.", hint: "Nothing seems to catch them off guard." },
  { category: "verbal", subcategory: "speech pattern", text: "Repeat part of the question back in your own words before actually answering it.", hint: "Your question gets played back first." },
  { category: "verbal", subcategory: "speech pattern", text: "Give a related fact or piece of trivia before you give your actual answer, every time.", hint: "A little lesson precedes each answer." },
  { category: "verbal", subcategory: "speech pattern", text: "Deliver every answer as an out-loud numbered list (\"one...\", \"two...\"), even for simple things.", hint: "Answers come pre-organised." },
  { category: "verbal", subcategory: "speech pattern", text: "Answer as if speaking to an imaginary camera or audience, like you're being interviewed.", hint: "Who are they actually talking to?" },
  { category: "verbal", subcategory: "speech pattern", text: "Describe the present moment in the past tense, as though narrating a memory.", hint: "Right now keeps getting talked about like it's over." },

  // ===== Verbal — subtle callbacks, misdirection & social tricks =====
  { category: "verbal", subcategory: "misdirection", text: "Correct your own sentence partway through, like you misspoke, every time.", hint: "They keep walking back their own words." },
  { category: "verbal", subcategory: "callback", text: "Reference something that happened \"last time\" even if this is the first round.", hint: "They keep pointing at a past that didn't happen." },
  { category: "verbal", subcategory: "misdirection", text: "Give a one-word answer first, then explain it after a pause.", hint: "The answer arrives in two separate pieces." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Respond to every question as though you already answered it once before (\"like I said...\").", hint: "Everything sounds like a repeat to them." },
  { category: "verbal", subcategory: "feigned familiarity", text: "After answering, add \"...but you probably already knew that.\"", hint: "They keep assuming you're a step ahead." },
  { category: "verbal", subcategory: "callback", text: "Begin answers with \"so, going back to what you asked earlier...\" even on the first question.", hint: "Everything is framed as picking up a thread." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Claim you \"was just about to say that\" whenever someone makes a point.", hint: "They're always about to have said it." },
  { category: "verbal", subcategory: "callback", text: "Pretend to remember a previous conversation with the asker that never happened (\"like we talked about\").", hint: "They keep invoking chats you don't remember." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Refer to the current topic as something \"we always end up talking about.\"", hint: "Every subject gets treated as a rerun." },
  { category: "verbal", subcategory: "misdirection", text: "Before answering, restate the question as if clarifying it for someone else in the room.", hint: "Your question gets relayed to the group first." },
  { category: "verbal", subcategory: "misdirection", text: "Answer a slightly different question than the one you were asked, confidently.", hint: "The answer's solid — but to what?" },
  { category: "verbal", subcategory: "misdirection", text: "Give your answer, then credit it to \"something someone told me once.\"", hint: "Every answer has a vague, missing source." },
  { category: "verbal", subcategory: "callback", text: "Casually mention you \"called this\" earlier whenever something is confirmed.", hint: "They keep claiming they saw it coming." },
  { category: "verbal", subcategory: "misdirection", text: "Address part of every answer to a person who didn't ask.", hint: "Half of each answer lands on the wrong person." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Treat every question as a callback to a joke from earlier (\"ha, this again\").", hint: "They meet new questions like old jokes." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Answer as if the asker already knows and you're just confirming it for them.", hint: "They only ever seem to be confirming." },
  { category: "verbal", subcategory: "feigned familiarity", text: "Bring up a detail about the asker as if you've known them for years.", hint: "They seem to know everyone a little too well." },
  { category: "verbal", subcategory: "callback", text: "Slip in \"as I was saying\" after any interruption or pause, even the first one.", hint: "They're always resuming something." },
  { category: "verbal", subcategory: "misdirection", text: "Reply to questions with \"we'll come back to that,\" then answer them anyway.", hint: "Everything's deferred and then isn't." },
  { category: "verbal", subcategory: "social trick", text: "Lower your voice slightly when answering, as if it's just between you and the asker.", hint: "Answers keep feeling like confidences." },
  { category: "verbal", subcategory: "social trick", text: "Mirror the asker's tone — match their energy up or down — with every reply.", hint: "Try changing your own energy and see if they follow." },
  { category: "verbal", subcategory: "misdirection", text: "Give a short answer, then fill the silence with \"...anyway\" and stop.", hint: "Answers keep getting closed off with the same word." },
  { category: "verbal", subcategory: "feigned familiarity", text: "React to each question with a knowing \"mm\" before answering, like you expected it.", hint: "Every question gets the same knowing sound." },
  { category: "verbal", subcategory: "callback", text: "Refer back to your own earlier answers by number (\"like my second point\").", hint: "They cite themselves like a document." },
  { category: "verbal", subcategory: "misdirection", text: "Attribute your own opinion to someone else in the room first (\"[name] put it well, but I agree\").", hint: "Their views always seem to belong to someone else first." },
  { category: "verbal", subcategory: "social trick", text: "Agree out loud with the last thing said before you answer, whatever it was.", hint: "They sign off on the room before speaking." },

  // ===== Physical =====
  { category: "physical", subcategory: "timing-based movement", text: "Touch your face or hair before you speak.", hint: "Watch their hands during pauses." },
  { category: "physical", subcategory: "posture/stance", text: "Cross your arms whenever someone else is talking.", hint: "Their body closes up when they're not the one talking." },
  { category: "physical", subcategory: "gesture", text: "Point at the person you're responding to.", hint: "Notice where their hands aim." },
  { category: "physical", subcategory: "gaze", text: "Look up and to the side before answering, as if thinking.", hint: "Their eyes go the same place before every answer." },
  { category: "physical", subcategory: "gesture", text: "Nod your head once before every sentence, even when disagreeing.", hint: "A small head movement kicks off each sentence." },
  { category: "physical", subcategory: "timing-based movement", text: "Tap the table (or your leg) once before you answer.", hint: "Listen for a tap just before they speak." },
  { category: "physical", subcategory: "posture/stance", text: "Lean back slightly whenever someone asks you a question.", hint: "Being asked pushes them backward." },
  { category: "physical", subcategory: "timing-based movement", text: "Adjust your sleeve, collar, or glasses before each answer.", hint: "A little tidy-up precedes each answer." },
  { category: "physical", subcategory: "posture/stance", text: "Keep both hands flat on the table except while you're speaking.", hint: "Their hands only move when it's their turn." },
  { category: "physical", subcategory: "gaze", text: "Briefly glance at the ceiling at least once during every answer.", hint: "Something up there keeps catching their eye." },
  { category: "physical", subcategory: "gaze", text: "Only make eye contact with someone after you finish answering, never during.", hint: "Eye contact comes at the end, not the middle." },
  { category: "physical", subcategory: "mirroring", text: "Mirror the last gesture the asker made before you respond.", hint: "Your own gestures come back at you." },
  { category: "physical", subcategory: "mirroring", text: "Match the asker's posture for the length of your answer.", hint: "Try shifting how you're sitting and watch." },
  { category: "physical", subcategory: "gaze", text: "Always answer while looking at a different person than the one who asked.", hint: "They answer you while facing somebody else." },
  { category: "physical", subcategory: "prop", text: "Take a sip of a drink (or mime it) before every answer.", hint: "A drink comes up before each answer." },
  { category: "physical", subcategory: "timing-based movement", text: "Blink slowly and deliberately once before you speak.", hint: "Watch their eyes right before they talk." },
  { category: "physical", subcategory: "prop", text: "Only speak while holding an object in your hand; put it down when you finish.", hint: "Something's always in their hand while they talk." },
  { category: "physical", subcategory: "gesture", text: "Switch which hand you gesture with every time you talk.", hint: "The gesturing hand keeps changing." },
  { category: "physical", subcategory: "posture/stance", text: "Keep your arms behind your back the entire time you're speaking.", hint: "Where do their hands go when they speak?" },
  { category: "physical", subcategory: "posture/stance", text: "Adjust your posture — sit up straighter — every time you're asked something.", hint: "A question makes them straighten up." },
  { category: "physical", subcategory: "social trick", text: "Wait until someone else in the room laughs or reacts before you respond to anything.", hint: "Their timing depends on the room, not the question." },
  { category: "physical", subcategory: "timing-based movement", text: "Set down whatever you're holding before you answer, then pick it back up when you're done.", hint: "Whatever they're holding gets parked, then reclaimed." },
  { category: "physical", subcategory: "mirroring", text: "Turn your whole body to face whoever asked you before answering, then turn back to neutral.", hint: "They square up to the asker, then reset." },
  { category: "physical", subcategory: "posture/stance", text: "Rest your chin on your hand while you listen; take it off the moment it's your turn to talk.", hint: "Their hand leaves their face right on cue." },
  { category: "physical", subcategory: "mirroring", text: "Lean (or take a small step) toward whoever asked you a question before you answer.", hint: "They drift toward whoever just spoke." },
  { category: "physical", subcategory: "posture/stance", text: "Fold your hands together the instant anyone starts talking to you.", hint: "Their hands come together when you start speaking." },
  { category: "physical", subcategory: "timing-based movement", text: "Keep your feet planted and still while you speak; only shift them between answers.", hint: "Watch their feet — still, then restless." },

  // ===== Physical — subtle misdirection & social tricks =====
  { category: "physical", subcategory: "misdirection", text: "Check your phone screen (even if it's off) before responding to anything.", hint: "A glance down comes before every reply." },
  { category: "physical", subcategory: "social trick", text: "Lean slightly toward the person asking before responding.", hint: "They close the gap to whoever asked." },
  { category: "physical", subcategory: "misdirection", text: "Adjust an object near you (phone, cup, etc.) every time before speaking.", hint: "Something near their hand gets nudged first." },
  { category: "physical", subcategory: "misdirection", text: "Glance at someone other than the asker before you start answering, then answer normally.", hint: "Their eyes go to the wrong person first." },
  { category: "physical", subcategory: "social trick", text: "Pause and look at whoever asked as though waiting for them to finish — then answer.", hint: "They wait a beat too long, like there's more coming." },
  { category: "physical", subcategory: "social trick", text: "Nod slowly at the asker as if agreeing before you've said anything.", hint: "Agreement seems to arrive before the answer does." },
  { category: "physical", subcategory: "misdirection", text: "Glance at the person who spoke last before answering the person who actually asked.", hint: "Their attention checks in with the wrong person." },
  { category: "physical", subcategory: "misdirection", text: "Touch or pick up your phone, then set it aside \"to focus\" before answering.", hint: "A small ritual with the phone precedes answers." },
  { category: "physical", subcategory: "misdirection", text: "Straighten or square an object in front of you whenever a question is directed at you.", hint: "Something gets tidied every time they're asked." },
  { category: "physical", subcategory: "misdirection", text: "Answer while glancing at the door or window, as if you'd rather be elsewhere.", hint: "Their eyes keep drifting toward the exit." },
];

const VERBAL = CURSES.filter((c) => c.category === "verbal");
const PHYSICAL = CURSES.filter((c) => c.category === "physical");

export const id = "black-magic";
export const name = "Black Magic";
export const minPlayers = 3;

// Hard per-round limit. When the clock reaches this with no correct
// guess, the round auto-reveals as "Curse Unbroken". Overridable via env
// for testing.
const LIMIT_MS = Number(process.env.BLACK_MAGIC_LIMIT_MS) || 5 * 60 * 1000;

// Escalating hints shown to Players (never The Witch) during an active
// round, each tier unlocking on the authoritative server clock. The 1s
// ticker (syncBlackMagicTicker in index.js) re-broadcasts public state, so
// a tier surfaces within a second of its mark. The 5-minute auto-reveal is
// unchanged and remains the final, total reveal.
//   ~1:00 — whether The Curse is Physical or Verbal
//   ~2:30 — the finer subcategory tag
//   ~4:00 — one short, vague, Curse-specific clue
const HINT_SCHEDULE = [
  { at: 60_000, level: 1, label: "Curse type", field: "category" },
  { at: 150_000, level: 2, label: "More specifically", field: "subcategory" },
  { at: 240_000, level: 3, label: "A clue", field: "hint" },
];

// The hint tiers unlocked so far, given elapsed round time. Values are
// already display-ready; category is title-cased ("Physical" / "Verbal").
function revealedHints(curse, elapsedMs) {
  if (!curse) return [];
  const out = [];
  for (const tier of HINT_SCHEDULE) {
    if (elapsedMs < tier.at) break;
    const raw = curse[tier.field];
    const text =
      tier.field === "category"
        ? raw === "physical"
          ? "Physical"
          : "Verbal"
        : raw;
    out.push({ level: tier.level, at: tier.at, label: tier.label, text });
  }
  return out;
}

// Points for the Player who Lifted the Curse, by elapsed time.
//   <30s = 4 · 30s-1m = 3 · 1-3m = 2 · 3-5m = 1 · unbroken = 0
function playerPointsFor(elapsedMs) {
  if (elapsedMs < 30_000) return 4;
  if (elapsedMs < 60_000) return 3;
  if (elapsedMs < 180_000) return 2;
  if (elapsedMs < 300_000) return 1;
  return 0;
}

// Points for The Witch, by elapsed time (they earn more the longer they
// go unguessed).
//   <30s = 0 · 30s-1m = 1 · 1-3m = 2 · 3-5m = 3 · unbroken = 4
function witchPointsFor(elapsedMs) {
  if (elapsedMs < 30_000) return 0;
  if (elapsedMs < 60_000) return 1;
  if (elapsedMs < 180_000) return 2;
  if (elapsedMs < 300_000) return 3;
  return 4;
}

// Round flow: the host picks The Witch (phase "pick"), OR under rotation
// the role is auto-assigned; either way it lands on "choose", where The
// Witch picks one of two Curses. Picking starts the clock and moves to
// "active".
export function createGame(playerIds, { rounds, assignment, memory }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const method = assignment === "rotation" ? "rotation" : "host";
  // Each round offers one fresh Physical and one fresh Verbal Curse. Draw
  // both decks skipping any Curse this session has already offered (chosen
  // or not) — Curse texts are unique across both categories, so one shared
  // seen list covers them.
  const totalRounds = Math.min(requested, VERBAL.length, PHYSICAL.length);
  const rotationOrder = shuffle(playerIds);
  const keyOf = (c) => c.text;
  const verbalDraw = drawWithoutRepeats(VERBAL, totalRounds, memory?.seen ?? [], keyOf);
  const physicalDraw = drawWithoutRepeats(PHYSICAL, totalRounds, verbalDraw.seenKeys, keyOf);

  const game = {
    id,
    phase: "pick", // "pick" -> "choose" -> "active" -> "reveal" -> (...) -> "final"
    assignment: method,
    totalRounds,
    roundIndex: 0,
    verbalDeck: verbalDraw.items,
    physicalDeck: physicalDraw.items,
    deckMemory: { seen: physicalDraw.seenKeys }, // server-only; harvested by index.js
    curse: null, // { category, text } — set once The Witch chooses
    rotationOrder,
    witchId: null,
    roundStartedAt: null, // server epoch ms; the clock's zero, set on choose
    endedAt: null, // frozen the instant the round ends
    limitMs: LIMIT_MS,
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    lastResult: null,
  };

  if (method === "rotation") {
    game.witchId = rotationOrder[0];
    game.phase = "choose";
  }

  return game;
}

function rotationWitch(game, presentPlayerIds) {
  const order = game.rotationOrder.filter((pid) => presentPlayerIds.includes(pid));
  if (order.length === 0) return presentPlayerIds[0] ?? game.rotationOrder[0];
  return order[game.roundIndex % order.length];
}

// Host chose The Witch — go to the Curse-choice screen (clock not running).
export function pickWitch(game, witchId, presentPlayerIds) {
  if (game.phase !== "pick") return;
  if (!presentPlayerIds.includes(witchId)) return;
  game.witchId = witchId;
  game.phase = "choose";
}

// The Witch picked one of their two Curses ("physical" | "verbal") —
// lock it in and start the round clock.
export function chooseCurse(game, pick) {
  if (game.phase !== "choose") return;
  const chosen =
    pick === "physical"
      ? game.physicalDeck[game.roundIndex]
      : pick === "verbal"
        ? game.verbalDeck[game.roundIndex]
        : null;
  if (!chosen) return;
  game.curse = { ...chosen };
  game.roundStartedAt = Date.now();
  game.endedAt = null;
  game.phase = "active";
}

// The single place a round ends. `outcome`:
//   "lifted"   — a Player said The Curse; guesser + Witch score by time
//   "revealed" — The Witch ended it manually; only The Witch scores
//   "unbroken" — hit the 5-minute limit; Witch gets the full 4
//   "aborted"  — The Witch left mid-round; nobody scores
export function endRound(game, outcome, guesserId = null) {
  if (game.phase !== "active" && game.phase !== "choose") return;

  const now = Date.now();
  game.endedAt = now;
  const elapsedMs = game.roundStartedAt ? Math.max(0, now - game.roundStartedAt) : 0;
  const witchId = game.witchId;

  let witchPts = 0;
  let playerPts = 0;
  if (outcome === "lifted") {
    witchPts = witchPointsFor(elapsedMs);
    playerPts = playerPointsFor(elapsedMs);
  } else if (outcome === "revealed") {
    witchPts = witchPointsFor(elapsedMs);
  } else if (outcome === "unbroken") {
    witchPts = 4;
  }

  if (witchPts) {
    game.scores.set(witchId, (game.scores.get(witchId) ?? 0) + witchPts);
  }
  if (outcome === "lifted" && guesserId && playerPts) {
    game.scores.set(guesserId, (game.scores.get(guesserId) ?? 0) + playerPts);
  }

  game.lastResult = {
    roundIndex: game.roundIndex,
    curse: game.curse ? { ...game.curse } : null,
    witchId,
    outcome,
    guesserId: outcome === "lifted" ? guesserId : null,
    elapsedMs,
    witchPts,
    playerPts: outcome === "lifted" ? playerPts : 0,
  };
  game.phase = "reveal";
}

// The Witch tapped the name of whoever Lifted the Curse.
export function awardGuess(game, guesserId, presentPlayerIds) {
  if (game.phase !== "active") return;
  if (guesserId === game.witchId) return;
  if (!presentPlayerIds.includes(guesserId)) return;
  endRound(game, "lifted", guesserId);
}

// The Witch (or host, as a fallback) ended the round manually.
export function revealCurse(game) {
  endRound(game, "revealed");
}

// Optional framework hook: if The Witch drops out mid-round (while
// choosing or performing) the round can't continue — abandon it, no
// points.
export function reconcilePresence(game, presentPlayerIds) {
  if (
    (game.phase === "active" || game.phase === "choose") &&
    !presentPlayerIds.includes(game.witchId)
  ) {
    endRound(game, "aborted");
  }
}

// Host "Force proceed": the round is stuck on The Witch. If they never
// chose a Curse, abandon the round (nobody scores); if a round is dragging,
// end it as if The Witch had revealed. Either way the game continues and
// The Witch can still play later rounds.
export function forceAdvance(game) {
  if (game.phase === "choose") endRound(game, "aborted");
  else if (game.phase === "active") endRound(game, "revealed");
}

export function nextRound(game, presentPlayerIds) {
  if (game.phase !== "reveal") return;

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  game.endedAt = null;
  game.lastResult = null;
  game.curse = null;
  game.roundStartedAt = null;

  if (game.assignment === "rotation") {
    game.witchId = rotationWitch(game, presentPlayerIds);
    game.phase = "choose";
  } else {
    game.witchId = null;
    game.phase = "pick";
  }
}

// The PUBLIC view — identical for every player. Everyone can see WHO The
// Witch is and the running clock; neither Curse option is ever here.
export function getPublicState(game, presentPlayerIds) {
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const state = {
    id: game.id,
    phase: game.phase,
    assignment: game.assignment,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    witchId: game.witchId,
    limitMs: game.limitMs,
    scores,
  };

  if (game.phase === "pick") {
    state.pickablePlayerIds = [...presentPlayerIds];
  }

  if (game.phase === "active") {
    const raw = Date.now() - game.roundStartedAt;
    state.elapsedMs = Math.max(0, Math.min(game.limitMs, raw));
    // Players-only escalating hints. Safe to put in the shared public
    // state: the client hides these on The Witch's screen, and The Witch
    // already knows their own Curse anyway.
    state.hints = revealedHints(game.curse, Math.max(0, raw));
  }

  if (game.phase === "reveal") {
    state.result = game.lastResult;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// Per-player secret. During "choose", only The Witch gets the two Curse
// options. During "active", only The Witch gets the chosen Curse.
// Everyone else just learns they're a plain Player.
export function getPrivateState(game, playerId) {
  if (game.phase === "choose") {
    if (playerId === game.witchId) {
      return {
        role: "witch",
        choosing: true,
        options: {
          physical: { ...game.physicalDeck[game.roundIndex] },
          verbal: { ...game.verbalDeck[game.roundIndex] },
        },
      };
    }
    return { role: "player" };
  }

  if (game.phase === "active") {
    if (playerId === game.witchId) {
      return { role: "witch", curse: game.curse ? { ...game.curse } : null };
    }
    return { role: "player" };
  }

  if (game.phase === "pick") return { role: "player" };
  return null;
}

// --- Tournament Mode: default per-game config when run inside a tournament.
// Rotation assignment so no host-pick step interrupts the flow.
export function tournamentOptions() {
  return { rounds: 2, assignment: "rotation" };
}
