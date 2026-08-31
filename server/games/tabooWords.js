// Content bank for "Taboo" — the secret word each Describer gets, plus a
// short list of forbidden words they must avoid saying out loud. Organised
// into categories the host toggles on before starting (plus a "random each
// round" option). 24+ entries per category so a long game rarely repeats.
//
// Shape: { word, taboo: [...], alts: [...] }
//   word  — the secret, shown to the Describer (nice display form)
//   taboo — 4-6 closely related words the Describer may not say
//   alts  — extra accepted spellings/synonyms for the fuzzy guess match
//           (the `word` itself is always accepted; keep these short)

const OBJECTS = [
  { word: "Umbrella", taboo: ["rain", "cover", "open", "handle", "wet"], alts: [] },
  { word: "Toothbrush", taboo: ["teeth", "brush", "paste", "mouth", "clean"], alts: [] },
  { word: "Ladder", taboo: ["climb", "steps", "rungs", "tall", "reach"], alts: [] },
  { word: "Scissors", taboo: ["cut", "paper", "blades", "sharp", "snip"], alts: [] },
  { word: "Pillow", taboo: ["sleep", "head", "soft", "bed", "cushion"], alts: [] },
  { word: "Clock", taboo: ["time", "hands", "tick", "hours", "wall"], alts: [] },
  { word: "Candle", taboo: ["wax", "flame", "light", "wick", "burn"], alts: [] },
  { word: "Mirror", taboo: ["reflection", "glass", "look", "face", "see"], alts: [] },
  { word: "Backpack", taboo: ["bag", "straps", "school", "carry", "shoulders"], alts: ["rucksack"] },
  { word: "Hammer", taboo: ["nail", "tool", "hit", "wood", "build"], alts: [] },
  { word: "Wallet", taboo: ["money", "cards", "pocket", "cash", "leather"], alts: [] },
  { word: "Broom", taboo: ["sweep", "floor", "dust", "bristles", "clean"], alts: [] },
  { word: "Kettle", taboo: ["water", "boil", "tea", "whistle", "hot"], alts: [] },
  { word: "Stapler", taboo: ["paper", "staples", "office", "click", "attach"], alts: [] },
  { word: "Flashlight", taboo: ["light", "dark", "batteries", "beam", "torch"], alts: ["torch"] },
  { word: "Envelope", taboo: ["letter", "mail", "seal", "stamp", "paper"], alts: [] },
  { word: "Sponge", taboo: ["wet", "clean", "dishes", "absorb", "soap"], alts: [] },
  { word: "Anchor", taboo: ["boat", "heavy", "sea", "chain", "ship"], alts: [] },
  { word: "Compass", taboo: ["direction", "north", "needle", "map", "navigate"], alts: [] },
  { word: "Thermometer", taboo: ["temperature", "fever", "degrees", "mercury", "measure"], alts: [] },
  { word: "Whistle", taboo: ["blow", "sound", "referee", "loud", "sports"], alts: [] },
  { word: "Bucket", taboo: ["water", "carry", "handle", "plastic", "fill"], alts: ["pail"] },
  { word: "Zipper", taboo: ["jacket", "pull", "teeth", "close", "pants"], alts: ["zip"] },
  { word: "Magnet", taboo: ["attract", "metal", "fridge", "north", "stick"], alts: [] },
  { word: "Telescope", taboo: ["stars", "space", "lens", "look", "far"], alts: [] },
  { word: "Padlock", taboo: ["key", "lock", "secure", "combination", "chain"], alts: [] },
  { word: "Suitcase", taboo: ["travel", "pack", "clothes", "wheels", "trip"], alts: ["luggage"] },
  { word: "Corkscrew", taboo: ["wine", "bottle", "open", "twist", "cork"], alts: [] },
];

const MOVIES = [
  { word: "Titanic", taboo: ["ship", "iceberg", "sink", "DiCaprio", "ocean"], alts: [] },
  { word: "Jaws", taboo: ["shark", "beach", "ocean", "bite", "boat"], alts: [] },
  { word: "Frozen", taboo: ["Elsa", "snow", "ice", "Disney", "sisters"], alts: [] },
  { word: "Avatar", taboo: ["blue", "Pandora", "aliens", "Cameron", "forest"], alts: [] },
  { word: "Shrek", taboo: ["ogre", "swamp", "green", "donkey", "fairytale"], alts: [] },
  { word: "Jurassic Park", taboo: ["dinosaurs", "island", "DNA", "T-Rex", "amber"], alts: [] },
  { word: "The Lion King", taboo: ["Simba", "Mufasa", "savanna", "Disney", "pride"], alts: ["lion king"] },
  { word: "Rocky", taboo: ["boxing", "Philadelphia", "Stallone", "fight", "stairs"], alts: [] },
  { word: "The Matrix", taboo: ["Neo", "pill", "simulation", "Keanu", "bullets"], alts: ["matrix"] },
  { word: "Ghostbusters", taboo: ["ghosts", "proton", "Slimer", "York", "spirits"], alts: [] },
  { word: "Inception", taboo: ["dream", "Nolan", "DiCaprio", "spinning", "layers"], alts: [] },
  { word: "Gladiator", taboo: ["Rome", "arena", "Maximus", "emperor", "sword"], alts: [] },
  { word: "Toy Story", taboo: ["Woody", "Buzz", "Andy", "Pixar", "playroom"], alts: [] },
  { word: "Star Wars", taboo: ["Jedi", "lightsaber", "Force", "Vader", "galaxy"], alts: [] },
  { word: "Home Alone", taboo: ["burglars", "Christmas", "kid", "house", "traps"], alts: [] },
  { word: "The Godfather", taboo: ["mafia", "Corleone", "horse", "Italian", "family"], alts: ["godfather"] },
  { word: "Jumanji", taboo: ["board game", "jungle", "animals", "roll", "dice"], alts: [] },
  { word: "Up", taboo: ["balloons", "house", "old man", "Pixar", "adventure"], alts: [] },
  { word: "Finding Nemo", taboo: ["fish", "ocean", "clownfish", "Pixar", "lost"], alts: [] },
  { word: "The Wizard of Oz", taboo: ["Dorothy", "ruby", "tornado", "yellow", "Kansas"], alts: ["wizard of oz"] },
  { word: "King Kong", taboo: ["gorilla", "Empire State", "island", "big", "climb"], alts: [] },
  { word: "Grease", taboo: ["musical", "cars", "school", "Travolta", "greasers"], alts: [] },
  { word: "Back to the Future", taboo: ["DeLorean", "time", "1955", "Marty", "flux"], alts: [] },
  { word: "The Terminator", taboo: ["robot", "future", "Arnold", "cyborg", "machine"], alts: ["terminator"] },
  { word: "Forrest Gump", taboo: ["running", "chocolate", "bench", "shrimp", "Hanks"], alts: [] },
  { word: "Pulp Fiction", taboo: ["Tarantino", "briefcase", "dance", "hitman", "diner"], alts: [] },
];

const PLACES = [
  { word: "Beach", taboo: ["sand", "ocean", "waves", "sun", "swim"], alts: [] },
  { word: "Library", taboo: ["books", "quiet", "shelves", "read", "borrow"], alts: [] },
  { word: "Airport", taboo: ["planes", "flights", "luggage", "gate", "terminal"], alts: [] },
  { word: "Hospital", taboo: ["doctors", "nurses", "sick", "beds", "emergency"], alts: [] },
  { word: "Desert", taboo: ["sand", "dry", "hot", "cactus", "camel"], alts: [] },
  { word: "Volcano", taboo: ["lava", "erupt", "mountain", "magma", "ash"], alts: [] },
  { word: "Museum", taboo: ["art", "exhibits", "history", "paintings", "tour"], alts: [] },
  { word: "Farm", taboo: ["animals", "crops", "barn", "tractor", "fields"], alts: [] },
  { word: "Casino", taboo: ["gambling", "cards", "dice", "Vegas", "chips"], alts: [] },
  { word: "Jungle", taboo: ["trees", "animals", "humid", "vines", "dense"], alts: ["rainforest"] },
  { word: "Prison", taboo: ["jail", "cells", "guards", "inmates", "bars"], alts: ["jail"] },
  { word: "Bakery", taboo: ["bread", "cakes", "oven", "pastries", "fresh"], alts: [] },
  { word: "Stadium", taboo: ["sports", "crowd", "seats", "field", "game"], alts: ["arena"] },
  { word: "Lighthouse", taboo: ["beam", "coast", "ships", "tall", "rocks"], alts: [] },
  { word: "Zoo", taboo: ["animals", "cages", "visitors", "keeper", "exhibits"], alts: [] },
  { word: "Cemetery", taboo: ["graves", "tombstones", "dead", "buried", "quiet"], alts: ["graveyard"] },
  { word: "Waterfall", taboo: ["cascade", "river", "cliff", "spray", "drop"], alts: [] },
  { word: "Castle", taboo: ["king", "moat", "medieval", "towers", "stone"], alts: [] },
  { word: "Subway", taboo: ["train", "underground", "tunnel", "city", "station"], alts: ["metro"] },
  { word: "Gym", taboo: ["weights", "exercise", "treadmill", "workout", "muscles"], alts: [] },
  { word: "Aquarium", taboo: ["fish", "tanks", "water", "sharks", "glass"], alts: [] },
  { word: "Vineyard", taboo: ["grapes", "wine", "rows", "harvest", "hills"], alts: [] },
  { word: "Igloo", taboo: ["ice", "snow", "Inuit", "dome", "cold"], alts: [] },
  { word: "Pharmacy", taboo: ["medicine", "prescription", "drugs", "counter", "pills"], alts: ["chemist"] },
  { word: "Bank", taboo: ["money", "vault", "account", "teller", "loans"], alts: [] },
  { word: "Cinema", taboo: ["movie", "screen", "popcorn", "seats", "film"], alts: ["theater", "movies"] },
];

const FOOD = [
  { word: "Pizza", taboo: ["cheese", "slice", "pepperoni", "Italian", "dough"], alts: [] },
  { word: "Sushi", taboo: ["rice", "fish", "Japan", "roll", "seaweed"], alts: [] },
  { word: "Popcorn", taboo: ["corn", "movie", "butter", "pop", "kernels"], alts: [] },
  { word: "Pancakes", taboo: ["syrup", "breakfast", "stack", "flip", "batter"], alts: ["pancake"] },
  { word: "Spaghetti", taboo: ["pasta", "sauce", "noodles", "Italian", "meatballs"], alts: [] },
  { word: "Taco", taboo: ["shell", "meat", "Mexican", "filling", "fold"], alts: ["tacos"] },
  { word: "Hamburger", taboo: ["beef", "bun", "patty", "grill", "lettuce"], alts: ["burger"] },
  { word: "Ice cream", taboo: ["cold", "cone", "scoop", "dessert", "vanilla"], alts: [] },
  { word: "Pretzel", taboo: ["salt", "twist", "dough", "baked", "knot"], alts: [] },
  { word: "Guacamole", taboo: ["avocado", "dip", "Mexican", "green", "chips"], alts: ["guac"] },
  { word: "Omelette", taboo: ["eggs", "breakfast", "fold", "cheese", "pan"], alts: ["omelet"] },
  { word: "Doughnut", taboo: ["hole", "glaze", "fried", "sweet", "ring"], alts: ["donut"] },
  { word: "Smoothie", taboo: ["blender", "fruit", "drink", "ice", "straw"], alts: [] },
  { word: "Lasagna", taboo: ["layers", "pasta", "cheese", "bake", "Italian"], alts: ["lasagne"] },
  { word: "Waffle", taboo: ["squares", "syrup", "breakfast", "iron", "batter"], alts: [] },
  { word: "Burrito", taboo: ["wrap", "tortilla", "beans", "Mexican", "rice"], alts: [] },
  { word: "Nachos", taboo: ["chips", "cheese", "jalapeno", "dip", "tortilla"], alts: [] },
  { word: "Croissant", taboo: ["flaky", "butter", "French", "crescent", "pastry"], alts: [] },
  { word: "Meatball", taboo: ["beef", "round", "sauce", "ground", "spaghetti"], alts: ["meatballs"] },
  { word: "Cheesecake", taboo: ["cream", "dessert", "crust", "slice", "York"], alts: [] },
  { word: "Milkshake", taboo: ["blender", "ice cream", "straw", "thick", "drink"], alts: ["shake"] },
  { word: "Dumpling", taboo: ["dough", "filling", "steamed", "Chinese", "wrap"], alts: ["dumplings"] },
  { word: "Pineapple", taboo: ["tropical", "spiky", "yellow", "fruit", "juice"], alts: [] },
  { word: "Espresso", taboo: ["coffee", "shot", "strong", "Italian", "caffeine"], alts: [] },
  { word: "Pancake", taboo: ["syrup", "breakfast", "flip", "batter", "griddle"], alts: [] },
  { word: "Bagel", taboo: ["bread", "hole", "cream cheese", "round", "toast"], alts: [] },
];

const ANIMALS = [
  { word: "Penguin", taboo: ["Antarctica", "waddle", "tuxedo", "cold", "swim"], alts: [] },
  { word: "Kangaroo", taboo: ["Australia", "pouch", "hop", "jump", "marsupial"], alts: [] },
  { word: "Elephant", taboo: ["trunk", "tusks", "big", "gray", "ears"], alts: [] },
  { word: "Giraffe", taboo: ["neck", "tall", "spots", "Africa", "leaves"], alts: [] },
  { word: "Octopus", taboo: ["tentacles", "ocean", "eight", "ink", "suckers"], alts: [] },
  { word: "Owl", taboo: ["night", "hoot", "wise", "feathers", "rotate"], alts: [] },
  { word: "Squirrel", taboo: ["nuts", "tree", "tail", "acorn", "bury"], alts: [] },
  { word: "Dolphin", taboo: ["ocean", "smart", "jump", "mammal", "fins"], alts: [] },
  { word: "Cheetah", taboo: ["fast", "spots", "Africa", "run", "cat"], alts: [] },
  { word: "Koala", taboo: ["Australia", "eucalyptus", "tree", "sleep", "marsupial"], alts: [] },
  { word: "Hedgehog", taboo: ["spikes", "curl", "small", "prickly", "nocturnal"], alts: [] },
  { word: "Flamingo", taboo: ["pink", "leg", "wading", "feathers", "water"], alts: [] },
  { word: "Bat", taboo: ["night", "wings", "cave", "echo", "fly"], alts: [] },
  { word: "Beaver", taboo: ["dam", "teeth", "wood", "river", "tail"], alts: [] },
  { word: "Crocodile", taboo: ["jaws", "river", "teeth", "reptile", "snap"], alts: ["croc"] },
  { word: "Peacock", taboo: ["feathers", "tail", "blue", "display", "bird"], alts: [] },
  { word: "Rhinoceros", taboo: ["horn", "thick", "gray", "charge", "Africa"], alts: ["rhino"] },
  { word: "Sloth", taboo: ["slow", "tree", "hang", "claws", "jungle"], alts: [] },
  { word: "Camel", taboo: ["desert", "hump", "sand", "ride", "thirsty"], alts: [] },
  { word: "Woodpecker", taboo: ["peck", "tree", "beak", "drum", "holes"], alts: [] },
  { word: "Jellyfish", taboo: ["sting", "ocean", "float", "tentacles", "clear"], alts: [] },
  { word: "Chameleon", taboo: ["color", "change", "lizard", "tongue", "eyes"], alts: [] },
  { word: "Walrus", taboo: ["tusks", "blubber", "Arctic", "whiskers", "ice"], alts: [] },
  { word: "Porcupine", taboo: ["quills", "spikes", "rodent", "sharp", "defense"], alts: [] },
  { word: "Hippopotamus", taboo: ["river", "big", "mouth", "Africa", "water"], alts: ["hippo"] },
  { word: "Ostrich", taboo: ["bird", "fast", "run", "eggs", "neck"], alts: [] },
];

const ACTIVITIES = [
  { word: "Fishing", taboo: ["rod", "bait", "lake", "hook", "catch"], alts: [] },
  { word: "Camping", taboo: ["tent", "fire", "outdoors", "sleeping bag", "woods"], alts: [] },
  { word: "Bowling", taboo: ["pins", "lane", "ball", "strike", "alley"], alts: [] },
  { word: "Skiing", taboo: ["snow", "slopes", "poles", "mountain", "downhill"], alts: [] },
  { word: "Painting", taboo: ["brush", "canvas", "colors", "easel", "art"], alts: [] },
  { word: "Gardening", taboo: ["plants", "soil", "weeds", "flowers", "dig"], alts: [] },
  { word: "Surfing", taboo: ["waves", "board", "ocean", "balance", "ride"], alts: [] },
  { word: "Knitting", taboo: ["yarn", "needles", "wool", "scarf", "stitch"], alts: [] },
  { word: "Chess", taboo: ["board", "checkmate", "king", "pieces", "strategy"], alts: [] },
  { word: "Karaoke", taboo: ["sing", "microphone", "lyrics", "bar", "song"], alts: [] },
  { word: "Yoga", taboo: ["poses", "mat", "stretch", "breathe", "balance"], alts: [] },
  { word: "Photography", taboo: ["camera", "lens", "picture", "focus", "shutter"], alts: ["photo"] },
  { word: "Cycling", taboo: ["bike", "pedals", "wheels", "ride", "helmet"], alts: ["biking"] },
  { word: "Baking", taboo: ["oven", "flour", "cake", "dough", "recipe"], alts: [] },
  { word: "Hiking", taboo: ["trail", "boots", "mountain", "walk", "backpack"], alts: [] },
  { word: "Juggling", taboo: ["balls", "throw", "catch", "circus", "hands"], alts: [] },
  { word: "Skateboarding", taboo: ["board", "wheels", "tricks", "ramp", "ollie"], alts: ["skating"] },
  { word: "Scuba diving", taboo: ["tank", "underwater", "mask", "oxygen", "reef"], alts: ["diving", "scuba"] },
  { word: "Archery", taboo: ["bow", "arrow", "target", "aim", "bullseye"], alts: [] },
  { word: "Gymnastics", taboo: ["flips", "beam", "mat", "tumble", "flexible"], alts: [] },
  { word: "Rock climbing", taboo: ["wall", "rope", "grip", "harness", "cliff"], alts: ["climbing"] },
  { word: "Sculpting", taboo: ["clay", "chisel", "statue", "mold", "art"], alts: [] },
  { word: "Bird watching", taboo: ["binoculars", "birds", "spot", "nature", "quiet"], alts: ["birding"] },
  { word: "Origami", taboo: ["paper", "fold", "crane", "Japanese", "shapes"], alts: [] },
  { word: "Snowboarding", taboo: ["snow", "board", "mountain", "slope", "ride"], alts: [] },
  { word: "Pottery", taboo: ["clay", "wheel", "kiln", "bowl", "spin"], alts: [] },
];

// Each bank gets its items tagged with their category key so a pooled draw
// can still show "this round is a Food" and the reveal can group by source.
function tag(list, category) {
  return list.map((e) => ({ ...e, category }));
}

export const BANKS = {
  objects: tag(OBJECTS, "objects"),
  movies: tag(MOVIES, "movies"),
  places: tag(PLACES, "places"),
  food: tag(FOOD, "food"),
  animals: tag(ANIMALS, "animals"),
  activities: tag(ACTIVITIES, "activities"),
};

export const CATEGORIES = [
  { key: "objects", name: "Objects" },
  { key: "movies", name: "Movies" },
  { key: "places", name: "Places" },
  { key: "food", name: "Food & Drink" },
  { key: "animals", name: "Animals" },
  { key: "activities", name: "Activities" },
];

export const CATEGORY_NAME = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.name])
);

// Sentinel the host can pick instead of a fixed set: each round draws a
// random category from ALL of them, then a word from within it.
export const RANDOM_CATEGORY = "random";
