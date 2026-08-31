// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    "Each round one player is the Describer: they get a secret word plus a list of forbidden words they can't say. They describe it out loud; everyone else races to type the answer on their phone. The faster the room cracks it, the more everyone scores.",
  bullets: [
    "Describer: say anything to get people there — but never a forbidden word, and no rhymes or spelling it out. It's an honour system, so own it if you slip.",
    "Guessers: type your guess and send it the moment you have an idea. Spelling doesn't have to be perfect. A wrong guess costs nothing; a right one locks in your placing.",
    "Correct guesses are ranked by order — 1st is worth the most, then 2nd, 3rd… down to a floor. The Describer scores on how quickly the FIRST correct guess lands.",
    "The Describer taps to reveal their word — that's what starts the 3:00 clock, so they get a beat to prepare first.",
    "Dynamic timer: each new correct guess then knocks 30 seconds off the shared clock (once per guesser) — watch for the −30s flash. Wrong guesses don't affect it.",
    "The host picks which categories are in play, or 'Random each round'. Highest total after the last round wins.",
  ],
}
