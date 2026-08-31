// Secret-word bank for "Fake Artist". Every entry has to be something a
// group can recognisably DRAW together in a few small strokes each, so the
// list leans hard on concrete, iconic nouns. Category names line up with
// the Imposter word bank where it made sense (Animals, Food, Places) and
// add a few drawing-friendly ones.
//
// The category is shown to the Fake Artist as their only hint ("it's an
// animal"), so each word must sit unambiguously under its label.

export const CATEGORIES = {
  Animals: [
    "Elephant", "Cat", "Dog", "Fish", "Snake",
    "Owl", "Penguin", "Turtle", "Rabbit", "Snail",
    "Butterfly", "Spider", "Crab", "Whale", "Octopus",
    "Frog", "Bee", "Ladybug", "Duck", "Horse",
    "Giraffe", "Bat", "Shark", "Dinosaur",
  ],
  "Food & Drink": [
    "Pizza", "Ice Cream Cone", "Banana", "Apple", "Hamburger",
    "Hot Dog", "Donut", "Cupcake", "Fried Egg", "Cheese Wedge",
    "Pineapple", "Carrot", "Watermelon Slice", "Taco", "Sushi Roll",
    "Coffee Cup", "Milkshake", "Lollipop", "Pretzel", "Baguette",
    "Cherry", "Popsicle", "Fortune Cookie", "Corn on the Cob",
  ],
  "Household Objects": [
    "Umbrella", "Key", "Scissors", "Toothbrush", "Light Bulb",
    "Clock", "Ladder", "Hammer", "Fork", "Spoon",
    "Teapot", "Candle", "Anchor", "Padlock", "Paperclip",
    "Sunglasses", "Backpack", "Balloon", "Wristwatch", "Frying Pan",
    "Broom", "Bell", "Magnet", "Envelope",
  ],
  Places: [
    "House", "Castle", "Lighthouse", "Tent", "Igloo",
    "Windmill", "Pyramid", "Barn", "Church", "Skyscraper",
    "Bridge", "Treehouse", "Ferris Wheel", "Volcano", "Island",
    "Well", "Fire Hydrant", "Mailbox", "Bus Stop", "Fountain",
    "Campfire", "Hot Air Balloon", "Sandcastle", "Beach Chair",
  ],
  Nature: [
    "Tree", "Flower", "Cactus", "Mushroom", "Sun",
    "Moon", "Cloud", "Rainbow", "Snowflake", "Lightning Bolt",
    "Star", "Mountain", "Leaf", "Acorn", "Pinecone",
    "Wave", "Tornado", "Palm Tree", "Rose", "Sunflower",
    "Iceberg", "Raindrop", "Seashell", "Coral",
  ],
  "Vehicles & Transport": [
    "Car", "Bicycle", "Airplane", "Rocket", "Sailboat",
    "Hot Rod", "Train", "Helicopter", "Submarine", "Skateboard",
    "Scooter", "Tractor", "Fire Truck", "Hot Air Balloon", "Canoe",
    "Motorcycle", "Bus", "Ambulance", "Pirate Ship", "Wheelbarrow",
    "Unicycle", "Jet Ski", "Cable Car", "Blimp",
  ],
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

// Sentinel the host's picker sends for "surprise me" — the server rolls the
// category itself so the host doesn't know it going in (they get a role
// like everyone else).
export const RANDOM_CATEGORY = "__random__";

// Flat [{ word, category }] for a pooled, no-repeat draw across a game.
export const ALL_WORDS = CATEGORY_NAMES.flatMap((cat) =>
  CATEGORIES[cat].map((word) => ({ word, category: cat }))
);
