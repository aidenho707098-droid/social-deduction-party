// Plain-language rules for the "How to Play" popup. See
// imposter/rules.js for the shape.
export const rules = {
  summary:
    'A grid of tiles and a chain that keeps growing. On your turn, tap back the whole chain from memory, then add one tile of your own. Miss and you lose a life. The last player standing wins.',
  bullets: [
    'Everyone plays in a fixed order, shuffled once at the start and shown as a strip of avatars. The game starts with a 3-2-1 and an empty chain, so the first player just adds a tile.',
    'ECHO: tap the whole chain so far, in order, from memory. Every tap lights up on everyone\'s phone with its note. The app never shows you the answer or hints at the next tile.',
    'ADD: then tap any one tile to add it to the end. The chain grows by one and the turn passes to the next player still in.',
    'TIMERS: 5 seconds for your first echo tap, 4 seconds between taps, and 5 seconds to add your tile. Running out counts as a miss.',
    'A MISS (wrong tile or out of time) costs one life and the chain doesn\'t grow. The correct chain is then replayed once for everyone, getting faster as it grows, and the next player echoes that same chain.',
    'Nobody sees the chain again except in that replay after a miss. Watch and listen to every turn.',
    'A tile is its POSITION on the grid. Colours and notes are just there to help, and notes repeat on the bigger boards. Easy is 3 by 3, Medium 4 by 4 and Hard 5 by 5.',
    'At 0 lives you\'re out of the order and watch the rest. The last player standing wins. There\'s no limit on how long the chain gets.',
    'POINTS are rounds survived. A round ends each time the turn comes back to the first player. Out in round 3? You score 2. The winner scores the round the game ended in. If the host ends the game early, everyone still in scores the current round minus 1.',
  ],
}
