// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'A category is dealt and a hot potato goes round the circle. When you\'re holding it, shout something that fits the category and tap Pass. Whoever is holding it when it explodes takes the hit.',
  bullets: [
    'Everyone sits in a fixed order, shown as a strip of avatars. Each pass goes to the next player still in. Each potato starts after a 3-2-1 countdown.',
    'Answers are said OUT LOUD; the app doesn\'t check them. Just after you catch the potato, Pass is locked for a moment, so a double tap can\'t skip anyone.',
    'SPRINT: your turn starts at 8 seconds and gets a quarter-second shorter with every pass (down to 2). Run out and it explodes on you.',
    'HIDDEN FUSE: the potato has a secret fuse of 20 to 60 seconds that nobody can see or hear. You also get 5 seconds per turn so nobody can stall. If either runs out, it explodes on you.',
    'MIXED: every new potato is Sprint or Hidden Fuse at random. The intro tells you which.',
    'Think the last answer was bad? Anyone still in (except the player who said it) can Challenge before the next pass, twice per potato. Everyone else votes, out players included. If most say it was bad, the player who said it explodes on the spot. A tie goes to that player.',
    'SHORT ROUNDS: one potato per round. Whoever explodes scores 0 and everyone else +2. Highest total wins.',
    'ELIMINATION: every explosion costs a life. Lose them all and you\'re out (you still vote). Each explosion brings a new category. Last one standing wins the match: 5 / 3 / 2 / 1 points by finishing order.',
  ],
}
