// Wavelength — the scale/category prompt bank.
//
// Each scale: a category, two pole labels, and the numeric range those
// poles span. The secret target is randomised within [min, max] every time
// a scale is used. `banned` is a short list of lowercase stems the
// Clue-Giver may not use in their clue — the pole words and obvious
// variants; typos and morphological forms are caught by the fuzzy matcher
// in wavelengthRules.js, so this list only needs the roots.
//
// `category` is a short, player-facing noun. Ranges vary on purpose
// (0–10, 1–24, 1–100, …); the client shows a slider for every range.

export const SCALES = [
  { category: "Temperature", poleA: "Freezing", poleB: "Scorching", min: 0, max: 10, banned: ["freezing", "freeze", "frozen", "scorching", "scorch"] },
  { category: "Comedy", poleA: "Not funny at all", poleB: "Hilarious", min: 0, max: 10, banned: ["funny", "unfunny", "hilarious", "hilarity"] },
  { category: "Spice", poleA: "Bland", poleB: "Flavorful", min: 0, max: 10, banned: ["bland", "flavorful", "flavourful", "flavor", "flavour", "flavored"] },
  { category: "Danger", poleA: "Totally safe", poleB: "Certain death", min: 0, max: 10, banned: ["safe", "safety", "death", "deadly", "dead", "certain"] },
  { category: "Effort", poleA: "Zero effort", poleB: "Maximum effort", min: 0, max: 10, banned: ["effort", "effortless", "maximum", "minimum"] },
  { category: "Time of Day", poleA: "Midnight", poleB: "Next midnight", min: 1, max: 24, banned: ["midnight", "midday", "noon"] },
  { category: "Transport", poleA: "Slow", poleB: "Fast", min: 0, max: 10, banned: ["slow", "sluggish", "fast", "quick", "speedy", "rapid"] },
  { category: "Distance", poleA: "Near", poleB: "Far", min: 1, max: 10, banned: ["near", "nearby", "close", "far", "faraway", "distant"] },
  { category: "Age", poleA: "1 year", poleB: "100 years", min: 1, max: 100, banned: ["young", "old", "elderly", "age", "aged", "ancient", "newborn"] },
  { category: "Money", poleA: "1 million USD", poleB: "10 million USD", min: 1, max: 10, banned: ["poor", "rich", "wealthy", "wealth", "broke", "millionaire", "money"] },
  { category: "Rarity", poleA: "Everywhere", poleB: "One-of-a-kind", min: 1, max: 10, banned: ["everywhere", "common", "rare", "unique", "oneofakind", "kind"] },
  { category: "Height", poleA: "Short", poleB: "Tall", min: 1, max: 10, banned: ["short", "tall", "height", "tiny", "towering"] },
  { category: "Movies", poleA: "Terrible", poleB: "Masterpiece", min: 0, max: 10, banned: ["terrible", "awful", "masterpiece", "brilliant"] },
  { category: "Subjects", poleA: "Easy A", poleB: "Near impossible", min: 0, max: 10, banned: ["easy", "impossible", "hard", "difficult", "near"] },
  { category: "School", poleA: "Terrible", poleB: "Incredible", min: 0, max: 10, banned: ["terrible", "awful", "incredible", "amazing"] },
  { category: "Strength", poleA: "Weak", poleB: "Strong", min: 0, max: 10, banned: ["weak", "strong", "strength", "powerful", "feeble"] },
  { category: "Looks", poleA: "Repulsive", poleB: "Attractive", min: 0, max: 10, banned: ["repulsive", "repulse", "ugly", "attractive", "attract", "gorgeous"] },
  { category: "Fame", poleA: "Unknown", poleB: "Famous", min: 0, max: 10, banned: ["unknown", "obscure", "famous", "fame", "popular", "celebrity"] },
  { category: "Punishment", poleA: "Torturous", poleB: "Pleasurable", min: 0, max: 10, banned: ["torturous", "torture", "painful", "pleasurable", "pleasure", "pleasant"] },
  { category: "World News", poleA: "Horrific", poleB: "Incredible", min: 0, max: 10, banned: ["horrific", "horrible", "horror", "incredible", "amazing"] },
  { category: "Price", poleA: "Cheap", poleB: "Expensive", min: 0, max: 10, banned: ["cheap", "inexpensive", "expensive", "pricey", "costly", "price"] },
  { category: "Brightness", poleA: "Dark", poleB: "Bright", min: 0, max: 10, banned: ["dark", "darkness", "dim", "bright", "brightness", "luminous"] },
  { category: "Volume", poleA: "Quiet", poleB: "Loud", min: 0, max: 10, banned: ["quiet", "silent", "loud", "noisy", "volume", "deafening"] },
  { category: "Weight", poleA: "Heavy", poleB: "Light", min: 0, max: 10, banned: ["heavy", "weight", "light", "weightless", "featherweight"] },
  { category: "Morality", poleA: "Evil", poleB: "Good", min: 0, max: 10, banned: ["evil", "wicked", "immoral", "good", "moral", "virtuous", "saintly"] },
  { category: "Permanence", poleA: "Permanent", poleB: "Temporary", min: 0, max: 10, banned: ["permanent", "permanence", "forever", "eternal", "temporary", "fleeting"] },
  { category: "Resources", poleA: "Scarce", poleB: "Abundant", min: 0, max: 10, banned: ["scarce", "scarcity", "sparse", "abundant", "abundance", "plentiful"] },
  { category: "Activities", poleA: "Individual", poleB: "Collective", min: 0, max: 10, banned: ["individual", "solo", "solitary", "collective", "group", "together"] },
  { category: "Facts", poleA: "Objective", poleB: "Subjective", min: 0, max: 10, banned: ["objective", "factual", "subjective", "opinion", "biased"] },
];

// A stable key for the no-repeat deck memory.
export const scaleKey = (s) => s.category;
