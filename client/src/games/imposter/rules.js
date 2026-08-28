// Plain-language rules for the "How to Play" popup. Kept next to the game
// it describes so a new game just adds its own rules.js and wires it into
// the registry. Shape: a short `summary` sentence or two, then a few
// `bullets` covering how a round works and how you win / score.
export const rules = {
  summary:
    "One or two players are secretly the Imposter. Everyone else — the Crew — shares a secret word; the Imposter only knows its category. The Crew is trying to sniff out the faker without giving the word away.",
  bullets: [
    "Each round, go around in turn order and say ONE word out loud that hints at the secret word. The Imposter has to bluff something that fits the category.",
    "After everyone has spoken, vote for who you think the Imposter is. You get one vote per Imposter in the game.",
    "The Crew wins if every Imposter ends up among the most-voted players. If even one Imposter slips through, the Imposters win.",
  ],
}
