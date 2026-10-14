// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'Everyone gets a secret sequence of digits, colored shapes or emoji. The Witnesses can see it all round. The Imposter only gets a quick look before it disappears, and has to bluff as if they can still see it. The Imposter wins only by surviving the vote.',
  bullets: [
    'Each round, one player is secretly the Imposter. Everyone else is a Witness. Everyone gets a turn as the Imposter before anyone gets a second one.',
    'MEMORIZE: Witnesses keep the sequence on screen for the whole round. Keep it private, and don\'t read it out loud. The Imposter sees it for a few seconds (8 on Easy, 6 on Medium, 5 on Hard), then it\'s gone.',
    'STATEMENTS: in a random order, everyone says ONE true thing about the sequence out loud, then taps Done (15 seconds each). The Imposter has to bluff, and listen closely. With 5 or fewer players, everyone gets two turns.',
    'PROOF QUESTIONS: everyone answers the same questions in private, against the clock. Whatever you\'ve picked when time runs out counts, and nobody sees any results until every question is done.',
    'EVIDENCE: a table shows everyone\'s answers next to the right ones. Some questions are tricky, so honest Witnesses slip up too. One mistake isn\'t proof.',
    'DISCUSS, then VOTE (20 seconds, not for yourself). The player with the most votes is out. A tie means nobody is out, so the Imposter gets away.',
    'CAUGHT: every Witness who voted for the Imposter scores +3, other Witnesses +1, and the Imposter 0. GOT AWAY: the Imposter scores +4 and everyone else 0.',
    'If the Imposter disconnects during their look and doesn\'t come back in time, that round is cancelled with no points and a new Imposter is dealt.',
  ],
}
