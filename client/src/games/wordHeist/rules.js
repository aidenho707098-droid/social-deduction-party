// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'A Wordle duel. Every round, everyone secretly sets one word, then cracks one other player’s word, Wordle-style. Crack it fast to score, or set a word that stumps your solver.',
  bullets: [
    'SET (45 seconds, everyone at once): one word, letters only, 4 to 8 letters. Prompted mode: pick one of your two prompts, like “Name an instrument”. Free choice: any word you like.',
    'CHECK: a quick check makes sure it’s a real, fair word (not too obscure, and it fits your prompt). A spelling fix is offered as “Did you mean …?”, and only Yes locks it in. You get 3 checks a round; run out, or the clock does, and you’re given a word.',
    'No repeats: a word used earlier in the game can’t be used again.',
    'SOLVE (3 minutes, everyone at once): you crack one other player’s word (never your own, and a different setter each round). You get one more guess than the word has letters. Any letters count as a guess, so names work.',
    'COLOURS: green is the right letter in the right spot, yellow is in the word but somewhere else, grey is not in the word (or no more copies of it).',
    'HINTS: Prompted mode shows the prompt the whole time. Free choice shows a category hint after your 3rd guess.',
    'SCORING: each word is worth its length + 2. Cracked in g guesses: the solver scores the rest and the setter scores g. Not cracked: the setter takes it all. Highest total wins.',
    'If a solver leaves and doesn’t come back in time, that pairing scores nothing for either player.',
  ],
}
