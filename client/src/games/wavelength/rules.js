// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    "Each round one player is the Clue-Giver: they see a scale (like Quiet ↔ Loud) and a secret number on it, and write a short clue pointing at that number. Everyone else then guesses the number. The closer your guess, the more you score.",
  bullets: [
    "The clue can't contain either pole word (or close variants) or any number — the game checks and makes you try again.",
    "Guessers: an exact hit is 3 points, landing within about 5% of the scale is 2, anything else is 0. Closeness is judged as a share of the scale, so every range is scored fairly.",
    "The Clue-Giver earns 2 points for every other player who nails it exactly and 1 for every other player who gets close. A new player gives the clue each round; highest total at the end wins.",
  ],
}
