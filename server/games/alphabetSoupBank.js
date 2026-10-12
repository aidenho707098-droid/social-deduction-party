// Alphabet Soup content: the letter pool and the category bank.
//
// LETTER_POOL is the whole alphabet minus the hard letters (Q, U, V, X, Y,
// Z) — 20 letters. Each category then lists ONLY the letters that have
// plenty of everyday answers for it, so the game can never pair a category
// with a near-impossible letter ("Countries" + W, "Instruments" + K). When
// in doubt a letter was left out: a smaller, safer set beats a stumper.
//
// Keys are stable ids (they travel in saved settings / tournament lineups);
// names are what players see. Adding a category is one line here plus the
// matching line in client/src/games/alphabetSoup/categories.js — the
// selftest asserts the two lists agree.

export const HARD_LETTERS = ["Q", "U", "V", "X", "Y", "Z"];
export const LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  .split("")
  .filter((l) => !HARD_LETTERS.includes(l));

export const RANDOM_CATEGORY = "__random__";

// [key, display name, letters]
const RAW = [
  ["animals", "Animals", "ABCDEFGHIJKLMNOPRSTW"],
  ["foods", "Foods", "ABCDEFGHJKLMNOPRSTW"],
  ["countries", "Countries", "ABCDEFGHIJKLMNPRST"],
  ["cities", "Cities", "ABCDEFGHIJKLMNOPRSTW"],
  ["movies", "Movies", "ABCDEFGHIJKLMNOPRSTW"],
  ["tv-shows", "TV Shows", "ABCDEFGHLMNOPRSTW"],
  ["sports", "Sports", "ABCDFGHJKLPRSTW"],
  ["brands", "Brands", "ABCDFGHKLMNPRST"],
  ["jobs", "Jobs", "ABCDEFGHIJLMNPRSTW"],
  ["kitchen", "Kitchen Items", "BCDFGKLMOPSTW"],
  ["beach", "Things at the Beach", "BCDFHKLPSTW"],
  ["clothing", "Clothing", "BCDGHJLMPRSTW"],
  ["video-games", "Video Games", "ABCDFGHMPST"],
  ["school-subjects", "School Subjects", "ABCEGHMPS"],
  ["vehicles", "Vehicles", "ABCFHJMPRST"],
  ["fruits", "Fruits", "ABCDGLMOPRST"],
  ["drinks", "Drinks", "BCEGHJLMPRSTW"],
  ["candy", "Candy", "BCGHJKLMPRST"],
  ["fast-food", "Fast Food Chains", "BCDKMPSTW"],
  ["instruments", "Musical Instruments", "BCDFGHOPST"],
  ["cartoons", "Cartoon Characters", "BCDFGHJMPSTW"],
  ["colors", "Colors", "BCGLMOPRST"],
  ["body-parts", "Body Parts", "ABCEFHKLNSTW"],
  ["bathroom", "Things in a Bathroom", "BCFHMRST"],
  ["classroom", "Things in a Classroom", "BCDEGMPRST"],
  ["pizza-toppings", "Pizza Toppings", "ABCHMOPST"],
  ["desserts", "Desserts", "BCDFIMPST"],
  ["vegetables", "Vegetables", "ABCLOPRS"],
  ["us-states", "US States", "ACIMNOW"],
  ["famous-people", "Famous People", "ABCDGHJKLMPRST"],
  ["boys-names", "Boys' Names", "ABCDEFGHIJKLMNOPRSTW"],
  ["girls-names", "Girls' Names", "ABCDEFGHIJKLMNOPRSTW"],
  ["superheroes", "Superheroes", "ABCFGHSTW"],
  ["board-games", "Board Games", "BCMOPRST"],
  ["toys", "Toys", "BDKLPRST"],
  ["sky", "Things in the Sky", "ABCHMPRS"],
  ["hobbies", "Hobbies", "BCDFGHKPRSW"],
  ["car-brands", "Car Brands", "ABCFHJLMPST"],
  ["flowers", "Flowers", "CDLMOPRST"],
  ["birds", "Birds", "BCDEFGHKOPRSTW"],
  ["sea-creatures", "Sea Creatures", "CDJLOPSTW"],
  ["bugs", "Insects & Bugs", "ABCDFGLMTW"],
  ["condiments", "Sauces & Condiments", "BGHMPRS"],
  ["breakfast", "Breakfast Foods", "BCEGHMOPSTW"],
  ["party", "Things at a Party", "BCDGMPS"],
  ["park", "Things in a Park", "BDFGKLPST"],
  ["tools", "Tools", "CDHLMPSTW"],
  ["furniture", "Furniture", "BCDLRSTW"],
  ["languages", "Languages", "ACDEFGHIPRST"],
  ["musicians", "Singers & Bands", "ABDEMPRST"],
  ["things-you-open", "Things You Can Open", "BCDEGJLPSW"],
  ["round-things", "Things That Are Round", "BCDMOPSTW"],
  ["dog-breeds", "Dog Breeds", "BCDGHLPRST"],
  ["disney", "Disney Characters", "ABCDEGMPSTW"],
  ["wallet", "Things in a Bag or Wallet", "CGKLMPRST"],
];

export const CATEGORIES = RAW.map(([key, name, letters]) => ({
  key,
  name,
  letters: letters.split(""),
}));

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
