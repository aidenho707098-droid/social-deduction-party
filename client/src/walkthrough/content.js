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
