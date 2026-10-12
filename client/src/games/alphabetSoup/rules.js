// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'Every round shows a CATEGORY and a LETTER. Name things in that category starting with that letter — typed on your phone, or out loud with your turn on the line, depending on the mode the host picked.',
  bullets: [
    'The letter is stirred out of a bowl of alphabet soup at the start of each round — your clock only starts once it lands.',
    'A leading "The", "A" or "An" can be skipped: "The Office" counts for T or for O.',
    'TYPED mode: you have 40 seconds for up to 5 answers. Each one locks in the moment you send it — no editing. Wrong letters and repeats of your own answers bounce straight back without using a slot.',
    'Each answer is checked against the category in the background (✓ or ✕). Rarity scores: an answer only YOU gave is Unique (+2), one others gave too is Shared (+1 each). Most unique answers in the round earns +2.',
    "Think an answer was wrongly rejected? You can dispute ONE per round — everyone else votes, and a majority lets it count (ties don't).",
    'SPOKEN mode: take turns saying an answer out loud and tap "Said it" before your timer runs out. The timer starts at 10 seconds and gets a second shorter every full lap (down to 4).',
    'Anyone can Challenge an answer (wrong letter, doesn\'t fit, or a repeat) — up to twice a round. The room votes: a majority costs the speaker a life, a tie goes to the speaker. Running out of time costs a life too.',
    'Everyone starts with 3 lives. Lose them all and you\'re out (you still vote). Last one standing wins: 5 / 3 / 2 / 1 points by finishing order.',
    'Burned Letters (optional): once a letter is used it\'s gone for the rest of the game.',
  ],
}
