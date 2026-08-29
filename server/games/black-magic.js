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

// Every Curse carries exactly one category: "physical" (gestures, posture,
// gaze, props, timing tied to movement) or "verbal" (speech patterns, word
// rules, how an answer is delivered). Each round offers one of each.
const CURSES = [
  // ===== Verbal =====
  { category: "verbal", text: "Say \"um\" or \"like\" before answering any question." },
  { category: "verbal", text: "Answer every question with another question." },
  { category: "verbal", text: "Never say \"yes\" — say \"sure\" or \"totally\" instead." },
  { category: "verbal", text: "Repeat the last word of whatever question you were just asked, then answer." },
  { category: "verbal", text: "Refer to yourself in the third person, by your own name." },
  { category: "verbal", text: "Start every answer with the word \"Honestly,\"." },
  { category: "verbal", text: "End every sentence with \"...if that makes sense.\"" },
  { category: "verbal", text: "Work the word \"apparently\" into every answer." },
  { category: "verbal", text: "Never use contractions — say \"do not\", \"cannot\", \"I am\" in full." },
  { category: "verbal", text: "Say \"to be fair\" at least once in every answer." },
  { category: "verbal", text: "Quietly repeat your own answer a second time, more softly." },
  { category: "verbal", text: "Laugh softly, even briefly, after every question asked of you." },
  { category: "verbal", text: "Say \"what?\" every time someone asks you a question, then answer." },
  { category: "verbal", text: "Pause and look mildly confused for about two seconds before every answer." },
  { category: "verbal", text: "Say the asker's name before you respond to them." },
  { category: "verbal", text: "Sigh quietly before answering anything." },
  { category: "verbal", text: "Say \"good question\" before roughly every other answer." },
  { category: "verbal", text: "Compliment something about the asker before you answer them." },
  { category: "verbal", text: "Never use the word \"I\" — rephrase everything to avoid it." },
  { category: "verbal", text: "Never say any number — describe amounts instead (\"a few\", \"some\", \"loads\")." },
  { category: "verbal", text: "Never directly answer — always deflect first (\"that's a good question, but...\")." },
  { category: "verbal", text: "Never say the word \"no\" — talk around it instead." },
  { category: "verbal", text: "Never use anyone's name, including your own." },
  { category: "verbal", text: "Avoid the words \"good\" and \"bad\" — use other words." },
  { category: "verbal", text: "Never say the word \"because\" — restructure your reasoning without it." },
  { category: "verbal", text: "Never say the word \"the\"." },
  { category: "verbal", text: "Never use a word that begins with the letter \"w\"." },
  { category: "verbal", text: "Never use a past-tense verb — describe everything in the present." },
  { category: "verbal", text: "Wait exactly two seconds of silence before responding to anything." },
  { category: "verbal", text: "Answer short questions slowly and long questions quickly." },
  { category: "verbal", text: "Refer to every person by the wrong pronoun on purpose, consistently." },
  { category: "verbal", text: "Ask a follow-up question about something totally unrelated before answering the real question." },
  { category: "verbal", text: "Whisper the first word of every sentence, then talk normally." },
  { category: "verbal", text: "Act surprised by every question, like you weren't expecting it." },
  { category: "verbal", text: "Talk slightly quieter every time you speak, getting softer as the round goes on." },
  { category: "verbal", text: "Bring the conversation back to food or snacks somehow, no matter the topic." },
  { category: "verbal", text: "Answer the question, then immediately ask the person the same question back." },
  { category: "verbal", text: "Trail off the end of every sentence instead of finishing it clearly." },
  { category: "verbal", text: "Add a short pause in the middle of your sentence, like you're choosing words carefully, every time." },
  { category: "verbal", text: "Act like you already knew what someone was going to ask before they finish asking." },
  { category: "verbal", text: "Repeat part of the question back in your own words before actually answering it." },
  { category: "verbal", text: "Give a related fact or piece of trivia before you give your actual answer, every time." },
  { category: "verbal", text: "Deliver every answer as an out-loud numbered list (\"one...\", \"two...\"), even for simple things." },
  { category: "verbal", text: "Answer as if speaking to an imaginary camera or audience, like you're being interviewed." },
  { category: "verbal", text: "Describe the present moment in the past tense, as though narrating a memory." },

  // ===== Physical =====
  { category: "physical", text: "Touch your face or hair before you speak." },
  { category: "physical", text: "Cross your arms whenever someone else is talking." },
  { category: "physical", text: "Point at the person you're responding to." },
  { category: "physical", text: "Look up and to the side before answering, as if thinking." },
  { category: "physical", text: "Nod your head once before every sentence, even when disagreeing." },
  { category: "physical", text: "Tap the table (or your leg) once before you answer." },
  { category: "physical", text: "Lean back slightly whenever someone asks you a question." },
  { category: "physical", text: "Adjust your sleeve, collar, or glasses before each answer." },
  { category: "physical", text: "Keep both hands flat on the table except while you're speaking." },
  { category: "physical", text: "Briefly glance at the ceiling at least once during every answer." },
  { category: "physical", text: "Only make eye contact with someone after you finish answering, never during." },
  { category: "physical", text: "Mirror the last gesture the asker made before you respond." },
  { category: "physical", text: "Match the asker's posture for the length of your answer." },
  { category: "physical", text: "Always answer while looking at a different person than the one who asked." },
  { category: "physical", text: "Take a sip of a drink (or mime it) before every answer." },
  { category: "physical", text: "Blink slowly and deliberately once before you speak." },
  { category: "physical", text: "Only speak while holding an object in your hand; put it down when you finish." },
  { category: "physical", text: "Switch which hand you gesture with every time you talk." },
  { category: "physical", text: "Keep your arms behind your back the entire time you're speaking." },
  { category: "physical", text: "Adjust your posture — sit up straighter — every time you're asked something." },
  { category: "physical", text: "Wait until someone else in the room laughs or reacts before you respond to anything." },
  { category: "physical", text: "Set down whatever you're holding before you answer, then pick it back up when you're done." },
  { category: "physical", text: "Turn your whole body to face whoever asked you before answering, then turn back to neutral." },
  { category: "physical", text: "Rest your chin on your hand while you listen; take it off the moment it's your turn to talk." },
  { category: "physical", text: "Lean (or take a small step) toward whoever asked you a question before you answer." },
  { category: "physical", text: "Fold your hands together the instant anyone starts talking to you." },
  { category: "physical", text: "Keep your feet planted and still while you speak; only shift them between answers." },
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
