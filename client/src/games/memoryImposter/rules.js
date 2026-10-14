// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'Everyone memorizes the same secret sequence. Then one player, the Imposter, loses theirs. Talk it out, bluff, and vote. The Imposter wins only by not getting voted out.',
  bullets: [
    'MEMORIZE: everyone sees the same sequence for a few seconds (digits, colors, shapes, or a mix). Every phone looks the same, because nobody has a role yet. Keep it private, and don\'t read it out loud.',
    'ROLES: when the time is up, one player learns they\'re the Imposter, and their sequence disappears. Everyone else keeps theirs on screen for the rest of the round. The same player is never the Imposter two rounds in a row.',
    'DISCUSS: one shared timer. Talk freely, out loud. Make claims or ask about a position: "the third digit is 7", "is the second one blue?". The Imposter has to bluff from memory.',
    'VOTE: 20 seconds, not for yourself. Most votes is out. A tie means nobody is, so the Imposter gets away.',
    'It gets harder every round: one more item each time, up to 12. Then the look gets half a second shorter each round, down to 3 seconds.',
    'GOT AWAY: the Imposter scores more the harder the round was (3 points on Easy\'s first round, up to 11). Everyone else scores 0. CAUGHT: every player who voted for the Imposter scores +2.',
    'If the Imposter disconnects and doesn\'t come back in time, the round is cancelled with no points and played again with a new Imposter.',
  ],
}
