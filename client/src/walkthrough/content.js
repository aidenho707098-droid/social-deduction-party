import { TIERS as ECHO } from '../games/echoChain/tiers'

// Step-by-step walkthrough copy for the modes complex enough to warrant a
// guided first play: Fact or Fake's Personal Mode, Majority Pick's Custom
// Mode, Fake Artist, Tournament Mode, Wavelength, Black Magic, and Taboo.
//
// Each entry's `steps` double as the persistent "Step X of Y" indicator
// shown during actual gameplay — `phaseSteps` maps a game's `phase` (or a
// tournament's `phase`) to the step index it corresponds to. A phase left
// out of `phaseSteps` (e.g. "final") shows no badge.
export const WALKTHROUGHS = {
  taboo: {
    title: 'How Taboo works',
    steps: [
      {
        icon: '🎤',
        title: "First, the Describer reveals a word",
        text: "One player is the Describer each round. They tap to reveal a secret word plus a list of banned clue-words — that's what starts the clock.",
      },
      {
        icon: '⌨️',
        title: 'Then, everyone else races to guess',
        text: 'The Describer explains the word out loud without ever saying a forbidden word. Everyone else types guesses on their own phone.',
      },
      {
        icon: '🏆',
        title: 'Finally, speed decides the score',
        text: 'Correct guesses are ranked by order — 1st scores the most. Each new correct guess also shaves time off the shared clock.',
      },
    ],
    phaseSteps: { describe: 0, guess: 1, reveal: 2 },
  },

  'black-magic': {
    title: 'How Black Magic works',
    steps: [
      {
        icon: '🔮',
        title: 'First, The Witch picks a secret Curse',
        text: 'One player becomes The Witch each round and privately chooses a hidden behaviour rule to follow while everyone talks to them.',
      },
      {
        icon: '🕵️',
        title: 'Then, everyone else tries to crack it',
        text: "Talk to The Witch and watch for the pattern. Escalating hints unlock automatically the longer the round runs.",
      },
      {
        icon: '🎉',
        title: 'Finally, the first to say it out loud wins',
        text: 'The first Player to say The Curse out loud scores — The Witch taps their name to confirm it and end the round.',
      },
    ],
    phaseSteps: { pick: 0, choose: 0, active: 1, reveal: 2 },
  },

  wavelength: {
    title: 'How Wavelength works',
    steps: [
      {
        icon: '✍️',
        title: 'First, Clue-Givers write clues in private',
        text: "Every round's Clue-Giver sees a secret target on a hidden spectrum (like Bland ↔ Flavorful) and writes one clue to point at it.",
      },
      {
        icon: '🎯',
        title: 'Then, everyone else guesses the spot',
        text: 'Guessers see only the clue and the scale\'s two ends — slide to wherever they think the secret target sits.',
      },
      {
        icon: '📈',
        title: 'Finally, closer guesses score more',
        text: 'The closer a guess lands to the real hidden target, the more points it earns.',
      },
    ],
    phaseSteps: { write: 0, guess: 1, reveal: 2 },
  },

  'fake-artist': {
    title: 'How Fake Artist works',
    steps: [
      {
        icon: '🎭',
        title: 'First, everyone gets a secret word — except one',
        text: 'Every player except the Fake Artist sees the same secret word and category. The Fake Artist only sees the category.',
      },
      {
        icon: '🖊️',
        title: 'Then, take turns adding to one drawing',
        text: "Going in order, everyone adds a bit to a single shared drawing — proving they know the word without making it obvious for the Fake Artist to copy.",
      },
      {
        icon: '🗳️',
        title: 'Next, vote out the Fake Artist',
        text: "Once the drawing's done, everyone votes on who they think was faking it.",
      },
      {
        icon: '🔍',
        title: 'Finally, a caught Fake Artist gets one guess',
        text: 'If caught, the Fake Artist gets one shot to guess the real secret word and steal the win back.',
      },
    ],
    phaseSteps: { brief: 0, draw: 1, gallery: 1, vote: 2, reveal: 3 },
  },

  'fibbage-personal': {
    title: 'How Personal Mode works',
    steps: [
      {
        icon: '🙋',
        title: "First, one player answers about themselves",
        text: "Each round's subject privately answers a personal question — everyone else sits that part out.",
      },
      {
        icon: '✍️',
        title: 'Then, everyone else fakes it',
        text: 'Every other player writes a fake answer that sounds like something the subject would really say.',
      },
      {
        icon: '🗳️',
        title: 'Finally, vote for the real answer',
        text: 'The real answer and every fake get shuffled together — everyone votes for the one they think is true.',
      },
    ],
    phaseSteps: { truth: 0, write: 1, vote: 2, reveal: 2 },
  },

  'would-you-rather-custom': {
    title: 'How Custom Mode works',
    steps: [
      {
        icon: '✍️',
        title: 'First, everyone writes open-ended answers',
        text: 'In Custom Mode, each player privately answers a couple of open-ended prompts about themselves.',
      },
      {
        icon: '🔀',
        title: 'Then, answers become the questions',
        text: "The app pairs up two players' answers into an \"X or Y\" question for the whole room to vote on.",
      },
      {
        icon: '📊',
        title: 'Finally, land on the majority to score',
        text: 'Everyone picks privately — matching the majority answer scores points, with a bonus for whoever wrote the most-picked one.',
      },
    ],
    phaseSteps: { collect: 0, answer: 1, result: 2 },
  },

  'who-am-i': {
    title: 'How Who Am I? works',
    steps: [
      {
        icon: '🎭',
        title: 'First, everyone gets a secret identity — except themselves',
        text: "Every player can see everyone ELSE's identity. Your own is hidden from you until you earn it.",
      },
      {
        icon: '🗣️',
        title: 'Then, take turns asking yes/no questions',
        text: 'Ask the group a question out loud. They answer out loud — you tap Yes (keep going) or No (pass the turn) on your phone.',
      },
      {
        icon: '⌨️',
        title: 'On your turn, you can guess instead',
        text: "Tap Guess and type who you think you are. Right locks you in with a placing and reveals it; wrong just passes the turn.",
      },
      {
        icon: '🏆',
        title: 'Finally, earlier and more efficient guesses score more',
        text: "The round ends once everyone's guessed or run out of questions — placement plus a bonus for asking fewer questions decides the points.",
      },
    ],
    phaseSteps: { turns: 1, reveal: 3 },
  },

  'alphabet-soup-typed': {
    title: 'How Alphabet Soup (Typed) works',
    steps: [
      {
        icon: '🥣',
        title: 'First, the soup picks a category and a letter',
        text: 'Watch the bowl — your 40 seconds only start once the letter lands.',
      },
      {
        icon: '⌨️',
        title: 'Then, send answers one at a time',
        text: 'Up to 5. Each locks in the moment you hit Enter (no take-backs) and gets a ✓ or ✕ a moment later. Wrong letters and your own repeats bounce back for free. A numbered sequel of a title you already used counts as a repeat, and in everyday categories don’t reuse the first word of an earlier answer.',
      },
      {
        icon: '🗳️',
        title: 'Next, see what everyone said',
        text: 'Answers only you gave score +2, shared ones +1. Think one was wrongly rejected? Dispute it — the room votes.',
      },
      {
        icon: '🏆',
        title: 'Finally, scores lock in',
        text: 'Most unique answers in the round earns a +2 bonus. Leaderboard, then the next bowl.',
      },
    ],
    phaseSteps: { intro: 0, answer: 1, checking: 1, review: 2, reveal: 3 },
  },

  'alphabet-soup-spoken': {
    title: 'How Alphabet Soup (Spoken) works',
    steps: [
      {
        icon: '🥣',
        title: 'First, the soup picks a category and a letter',
        text: 'The first turn starts once the letter lands.',
      },
      {
        icon: '🗣️',
        title: 'Then, say an answer out loud on your turn',
        text: 'Tap "Said it" before your ring runs out (10s, a second shorter every lap). Out of time = lose a life.',
      },
      {
        icon: '✋',
        title: 'Anyone can challenge',
        text: 'Wrong letter, doesn’t fit, or a repeat? A numbered sequel of a title already said counts as a repeat, and in everyday categories so does reusing the first word of an earlier answer. Challenge the latest answer any time before the next one is said (twice a round). The clock pauses while the room votes — a majority costs a life, a tie doesn’t.',
      },
      {
        icon: '🏆',
        title: 'Finally, last one standing wins',
        text: '3 lives each. Points go 5 / 3 / 2 / 1 by finishing order.',
      },
    ],
    phaseSteps: { intro: 0, turns: 1, reveal: 3 },
  },

  'hot-potato': {
    title: 'How Hot Potato works',
    steps: [
      {
        icon: '🥔',
        title: 'First, a category and a 3-2-1',
        text: 'Everyone sits in a fixed order (the strip of avatars). Each potato brings a new category, and the first turn starts after the countdown.',
      },
      {
        icon: '🗣️',
        title: 'Then, say one and pass it on',
        text: 'Holding it? Shout something that fits, then tap Pass. Sprint turns get shorter with every pass. A Hidden Fuse goes off at a secret moment, and you get 5s per turn.',
      },
      {
        icon: '✋',
        title: 'Bad answer? Challenge it',
        text: 'Before the next pass, anyone still in can challenge the last answer (twice per potato). The room votes, and if most say No, the potato explodes on whoever said it.',
      },
      {
        icon: '💥',
        title: 'Finally, someone explodes',
        text: 'Short Rounds: the exploder scores 0 and everyone else +2. Elimination: they lose a life, and the last one standing wins the match.',
      },
    ],
    phaseSteps: { intro: 0, live: 1, explode: 3 },
  },

  'memory-imposter': {
    title: 'How Memory Imposter works',
    steps: [
      // Plain typographic symbols, not emoji: this game uses no Twemoji.
      {
        icon: '◎',
        title: 'First, everyone memorizes',
        text: 'The same sequence on every phone, for a few seconds. Keep it private, and don\'t read it out loud.',
      },
      {
        icon: '◐',
        title: 'Then, roles are dealt',
        text: 'One player is the Imposter, and their sequence disappears. Everyone else keeps theirs on screen.',
      },
      {
        icon: '❝',
        title: 'Next, talk it out',
        text: 'One shared timer. Make claims or ask about positions out loud: "the third digit is 7", "is the second one blue?".',
      },
      {
        icon: '✓',
        title: 'Then, vote',
        text: 'Most votes is out, and a tie means nobody is. Not for yourself.',
      },
      {
        icon: '★',
        title: 'Finally, the reveal',
        text: 'Caught: everyone who voted for the Imposter +2. Got away: the Imposter scores more the harder the round was.',
      },
    ],
    phaseSteps: { memorize: 0, roles: 1, discussion: 2, vote: 3, reveal: 4 },
  },

  'echo-chain': {
    title: 'How Echo Chain works',
    steps: [
      {
        icon: '⏱️',
        title: 'First, a 3-2-1',
        text: 'Everyone plays in a fixed order (the strip of avatars). The chain starts empty, so the first player just adds a tile.',
      },
      {
        icon: '🔁',
        title: 'Then, echo the chain',
        text: 'On your turn, tap the whole chain from memory, in order. Everyone sees and hears your taps live. You get 5s for the first tap and 4s between taps.',
      },
      {
        icon: '➕',
        title: 'Next, add one tile',
        text: 'Tap any tile to add it to the end (5s). The chain grows by one, and the next player has to echo all of it.',
      },
      {
        icon: '💔',
        title: 'Miss, and you lose a life',
        text: `A wrong tile (marked with a cross) or running out of time costs a life. On ${ECHO.recall.name}, ${ECHO.retain.name} and ${ECHO.photographic.name} the chain is then replayed once, the only time anyone sees it again. On ${ECHO.savant.name} it never is. At 0 lives you're out and watch.`,
      },
      {
        icon: '🏆',
        title: 'Finally, last one standing wins',
        text: 'Points are rounds survived, on every difficulty. The last player left scores the round the game ended in.',
      },
    ],
    phaseSteps: { countdown: 0, echo: 1, add: 2, miss: 3, replay: 3 },
  },

  'word-heist': {
    title: 'How Word Heist works',
    steps: [
      {
        icon: '🔒',
        title: 'First, set a secret word',
        text: 'Everyone at once, 45 seconds. Pick a prompt (or any word in Free choice), type one 4 to 8 letter word and tap Check word. If the spelling gets fixed, you choose Yes or No.',
      },
      {
        icon: '🔤',
        title: 'Then, crack someone else’s word',
        text: 'Everyone at once, 3 minutes, each on a different player’s word. Green is the right spot, yellow is in the word somewhere else, grey is not in it. One more guess than letters.',
      },
      {
        icon: '🏆',
        title: 'Finally, split the pot',
        text: 'Each word is worth its length + 2. Crack it in g guesses: you score the rest and the setter scores g. Not cracked: the setter takes it all.',
      },
    ],
    phaseSteps: { set: 0, solve: 1, reveal: 2 },
  },

  tournament: {
    title: 'How Tournament Mode works',
    steps: [
      {
        icon: '🎯',
        title: 'First, build the lineup',
        text: 'The host picks which games are in the tournament and configures each one.',
      },
      {
        icon: '🎮',
        title: 'Then, play through each game',
        text: 'Everyone plays each game back-to-back — scores carry over from game to game.',
      },
      {
        icon: '📊',
        title: 'Between games, standings update',
        text: 'After each game ends, see where everyone stands before the next one begins.',
      },
      {
        icon: '🏆',
        title: 'Finally, the highest total wins',
        text: 'After the last game, whoever has the most combined points across every game wins the tournament.',
      },
    ],
    phaseSteps: { lineup: 0, wheel: 1, intro: 1, between: 2, complete: 3 },
  },
}
