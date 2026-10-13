// Alphabet Soup content: the letter pool, the letter-draw weights and the
// category bank.
//
// LETTER_POOL is the whole alphabet — any of the 26 letters can be drawn
// (and burned). Each category lists ONLY the letters that have plenty of
// everyday answers for it, so the game can never pair a category with a
// near-impossible letter ("Countries" + W, "Instruments" + K). When in
// doubt a letter was left out: a smaller, safer set beats a stumper.
//
// The six rare letters (LETTER_DRAW.rareLetters) are drawn far less often,
// and a category only gets one when RARE_EXAMPLES below lists at least
// MIN_RARE_EXAMPLES real answers for that pair — the selftest checks every
// example starts with its letter. A rare letter with fewer than 5 answers
// is simply left off that category.
//
// Keys are stable ids (they travel in saved settings / tournament lineups);
// names are what players see. Adding a category is one line here plus the
// matching line in client/src/games/alphabetSoup/categories.js — the
// selftest asserts the two lists agree.

export const LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Letter-draw weights — the one place to tune them. SERVER-ONLY: neither
// the weights nor the idea of a "rare" letter is ever sent to clients.
// Within a round's eligible letters the weights are renormalized, so with
// every letter eligible a rare letter lands in ~7% of rounds
// (6 × 0.25 / (20 + 6 × 0.25)). A rare letter is never drawn two rounds
// running.
export const LETTER_DRAW = {
  normalWeight: 1,
  rareWeight: 0.25,
  rareLetters: ["Q", "U", "V", "X", "Y", "Z"],
};
export const MIN_RARE_EXAMPLES = 5;

export function isRareLetter(letter) {
  return LETTER_DRAW.rareLetters.includes(letter);
}

export function letterWeight(letter) {
  return isRareLetter(letter) ? LETTER_DRAW.rareWeight : LETTER_DRAW.normalWeight;
}

export const RANDOM_CATEGORY = "__random__";

// Anti-farming flags (Typed mode enforces them; Spoken mode lists them as
// Challenge reasons). Each stops one idea being farmed for extra answers:
//   SEQUELS   — titles with numbered sequels: "Avatar 2" / "Avatar II" are
//               repeats of "Avatar" (different titles in a series aren't).
//   LEAD_WORD — common-noun categories: one player can't reuse the first
//               word of an earlier answer ("Amazonian fly", "Amazonian bee").
// Proper-noun categories (countries, cities, brands, names...) use neither.
const SEQUELS = { blockNumberedSequels: true };
const LEAD_WORD = { blockRepeatedLeadWord: true };

// Rare-letter answers per category: the evidence that a pair is genuinely
// playable. Only pairs listed here (with MIN_RARE_EXAMPLES+) are drawable.
// Categories and rare letters not listed have fewer than 5 everyday
// answers (e.g. Countries + Z: Zambia, Zimbabwe) and stay off.
export const RARE_EXAMPLES = {
  animals: {
    Q: ["Quail", "Quokka", "Quoll", "Quetzal", "Quagga"],
    V: ["Viper", "Vulture", "Vole", "Vicuna", "Vampire bat"],
    Y: ["Yak", "Yellowjacket", "Yorkshire terrier", "Yabby", "Yellowfin tuna"],
    Z: ["Zebra", "Zebu", "Zebrafish", "Zorilla", "Zonkey"],
  },
  foods: {
    Q: ["Quiche", "Quinoa", "Quesadilla", "Quince", "Queso"],
    U: ["Udon", "Ube", "Ugli fruit", "Upside-down cake", "Unagi"],
    V: ["Vanilla", "Venison", "Veal", "Vermicelli", "Vinegar"],
    Y: ["Yogurt", "Yam", "Yorkshire pudding", "Yuzu", "Yakitori"],
    Z: ["Zucchini", "Ziti", "Zeppole", "Zabaglione", "Za'atar"],
  },
  countries: {
    U: ["Uganda", "Ukraine", "United Kingdom", "United States", "Uruguay", "Uzbekistan"],
  },
  cities: {
    Q: ["Quebec City", "Quito", "Qingdao", "Queenstown", "Quezon City"],
    V: ["Vancouver", "Venice", "Vienna", "Valencia", "Vilnius"],
    Y: ["Yokohama", "York", "Yangon", "Yerevan", "Yonkers"],
    Z: ["Zurich", "Zagreb", "Zaragoza", "Zhengzhou", "Zanzibar City"],
  },
  movies: {
    Q: ["Quantum of Solace", "A Quiet Place", "Quiz Show", "Quills", "Queen of Katwe"],
    U: ["Up", "Us", "Unbreakable", "Uncharted", "Unforgiven"],
    V: ["Vertigo", "V for Vendetta", "Venom", "Vice", "Valkyrie"],
    X: ["X-Men", "xXx", "Xanadu", "The X-Files", "X2"],
    Y: ["Yesterday", "Yes Man", "Young Frankenstein", "You've Got Mail", "Yellow Submarine"],
    Z: ["Zootopia", "Zodiac", "Zoolander", "Zombieland", "Zero Dark Thirty"],
  },
  "tv-shows": {
    Q: ["Queer Eye", "Quantico", "QI", "Quantum Leap", "Queen of the South"],
    U: ["Ugly Betty", "The Umbrella Academy", "Unbreakable Kimmy Schmidt", "Undercover Boss", "Utopia"],
    V: ["Veep", "Vikings", "Victorious", "Veronica Mars", "The Vampire Diaries"],
    X: ["The X Factor", "The X-Files", "Xena: Warrior Princess", "X-Men: The Animated Series", "Xavier Riddle and the Secret Museum"],
    Y: ["Yellowstone", "You", "Young Sheldon", "Yellowjackets", "Younger"],
    Z: ["Zoey 101", "Zoey's Extraordinary Playlist", "Z Nation", "Zorro", "Zig and Sharko"],
  },
  brands: {
    Q: ["Qualcomm", "Quaker", "Qantas", "Quiksilver", "QVC"],
    U: ["Uber", "Under Armour", "Unilever", "Uniqlo", "UPS"],
    V: ["Visa", "Vans", "Volkswagen", "Verizon", "Versace"],
    Y: ["YouTube", "Yahoo", "Yamaha", "Yves Saint Laurent", "Yeti"],
    Z: ["Zara", "Zoom", "Zillow", "Zippo", "Zappos"],
    // X stays off: only four everyday answers (Xbox, Xerox, Xiaomi, Xfinity).
    X: ["Xbox", "Xerox", "Xiaomi", "Xfinity"],
  },
  jobs: {
    U: ["Umpire", "Undertaker", "Upholsterer", "Usher", "Urologist"],
    V: ["Veterinarian", "Valet", "Videographer", "Vintner", "Ventriloquist"],
    Y: ["Yoga instructor", "Youth worker", "YouTuber", "Yacht captain", "Yard worker"],
    // Z stays off: Zookeeper, Zoologist.
    Z: ["Zookeeper", "Zoologist"],
  },
  clothing: {
    U: ["Underwear", "Undershirt", "Uniform", "Uggs", "Underpants"],
    V: ["Vest", "Veil", "Visor", "V-neck", "Varsity jacket"],
  },
  "video-games": {
    U: ["Uncharted", "Undertale", "Until Dawn", "Unravel", "Untitled Goose Game"],
    V: ["Valorant", "Valheim", "Vampire Survivors", "Viewtiful Joe", "Vampyr"],
    X: ["Xenoblade Chronicles", "XCOM", "Xevious", "X-Men Legends", "Xenogears"],
    Y: ["Yoshi's Island", "Yakuza", "Yooka-Laylee", "Yu-Gi-Oh!", "Ys"],
    Z: ["Zelda", "Zoo Tycoon", "Zuma", "Zork", "Zombies Ate My Neighbors"],
  },
  vehicles: {
    U: ["Unicycle", "UFO", "Ute", "U-boat", "Utility truck"],
  },
  drinks: {
    V: ["Vodka", "Vermouth", "Vimto", "V8", "Vanilla latte"],
  },
  instruments: {
    V: ["Violin", "Viola", "Vibraphone", "Vuvuzela", "Valve trombone"],
    // X stays off: Xylophone is the only one most people know.
    X: ["Xylophone"],
  },
  cartoons: {
    V: ["Velma", "Vanellope", "Vegeta", "Violet Parr", "Vector"],
    Y: ["Yogi Bear", "Yosemite Sam", "Yakko", "Yoshi", "Yzma"],
    Z: ["Zim", "Zuko", "Zazu", "Ziggy", "Zoidberg"],
  },
  colors: {
    V: ["Violet", "Vermilion", "Viridian", "Vanilla", "Venetian red"],
  },
  "body-parts": {
    U: ["Uvula", "Ulna", "Uterus", "Ureter", "Urethra"],
    V: ["Vein", "Vertebra", "Ventricle", "Vocal cords", "Voice box"],
  },
  "us-states": {
    // Both stay off: Utah alone; Vermont and Virginia.
    U: ["Utah"],
    V: ["Vermont", "Virginia"],
  },
  "famous-people": {
    Q: ["Quentin Tarantino", "Queen Latifah", "Quincy Jones", "Queen Elizabeth II", "Quavo"],
    U: ["Usain Bolt", "Usher", "Uma Thurman", "Ulysses S. Grant", "Ursula Andress"],
    V: ["Vincent van Gogh", "Venus Williams", "Vin Diesel", "Victoria Beckham", "Vladimir Putin"],
    Y: ["Yoko Ono", "Yao Ming", "Yo-Yo Ma", "Yuri Gagarin", "Yasser Arafat"],
    Z: ["Zendaya", "Zac Efron", "Zinedine Zidane", "Zayn Malik", "Zoe Saldana"],
  },
  "boys-names": {
    Q: ["Quinn", "Quentin", "Quincy", "Quinton", "Qasim"],
    U: ["Uriah", "Uri", "Ulysses", "Umar", "Uriel"],
    V: ["Victor", "Vincent", "Vince", "Vaughn", "Vernon"],
    Y: ["Yusuf", "Yosef", "Yuri", "Yahir", "Yannick"],
    Z: ["Zachary", "Zane", "Zion", "Zack", "Zayn"],
  },
  "girls-names": {
    V: ["Victoria", "Violet", "Vanessa", "Valerie", "Vivian"],
    Y: ["Yasmin", "Yvonne", "Yolanda", "Yara", "Yvette"],
    Z: ["Zoe", "Zara", "Zelda", "Zoey", "Zainab"],
  },
  superheroes: {
    V: ["Vision", "Valkyrie", "Venom", "Vixen", "Vibe"],
  },
  languages: {
    U: ["Urdu", "Ukrainian", "Uzbek", "Uyghur", "Ulster Scots"],
  },
  musicians: {
    Q: ["Queen", "Queens of the Stone Age", "Quavo", "Q-Tip", "Queen Latifah"],
    U: ["U2", "Usher", "UB40", "Uncle Kracker", "Underworld"],
    V: ["Van Halen", "Vampire Weekend", "Village People", "Vanilla Ice", "Vance Joy"],
    X: ["XTC", "Xzibit", "X Ambassadors", "XXXTentacion", "The xx"],
    Y: ["Yes", "Yeah Yeah Yeahs", "Yungblud", "Yo-Yo Ma", "Yung Gravy"],
    Z: ["ZZ Top", "Zedd", "Zayn", "Zac Brown Band", "Zara Larsson"],
  },
  disney: {
    Z: ["Zazu", "Zurg", "Zeus", "Zero", "Zira"],
  },
};

// The rare letters a category may draw: those with enough examples.
function rareLettersFor(key) {
  const ex = RARE_EXAMPLES[key] ?? {};
  return LETTER_DRAW.rareLetters.filter((l) => (ex[l]?.length ?? 0) >= MIN_RARE_EXAMPLES);
}

// [key, display name, normal letters, flags?]
const RAW = [
  ["animals", "Animals", "ABCDEFGHIJKLMNOPRSTW", LEAD_WORD],
  ["foods", "Foods", "ABCDEFGHJKLMNOPRSTW", LEAD_WORD],
  ["countries", "Countries", "ABCDEFGHIJKLMNPRST"],
  ["cities", "Cities", "ABCDEFGHIJKLMNOPRSTW"],
  ["movies", "Movies", "ABCDEFGHIJKLMNOPRSTW", SEQUELS],
  ["tv-shows", "TV Shows", "ABCDEFGHLMNOPRSTW", SEQUELS],
  ["sports", "Sports", "ABCDFGHJKLPRSTW", LEAD_WORD],
  ["brands", "Brands", "ABCDFGHKLMNPRST"],
  ["jobs", "Jobs", "ABCDEFGHIJLMNPRSTW", LEAD_WORD],
  ["kitchen", "Kitchen Items", "BCDFGKLMOPSTW", LEAD_WORD],
  ["beach", "Things at the Beach", "BCDFHKLPSTW", LEAD_WORD],
  ["clothing", "Clothing", "BCDGHJLMPRSTW", LEAD_WORD],
  ["video-games", "Video Games", "ABCDFGHMPST", SEQUELS],
  ["school-subjects", "School Subjects", "ABCEGHMPS", LEAD_WORD],
  ["vehicles", "Vehicles", "ABCFHJMPRST", LEAD_WORD],
  ["fruits", "Fruits", "ABCDGLMOPRST", LEAD_WORD],
  ["drinks", "Drinks", "BCEGHJLMPRSTW", LEAD_WORD],
  ["candy", "Candy", "BCGHJKLMPRST", LEAD_WORD],
  ["fast-food", "Fast Food Chains", "BCDKMPSTW"],
  ["instruments", "Musical Instruments", "BCDFGHOPST", LEAD_WORD],
  ["cartoons", "Cartoon Characters", "BCDFGHJMPSTW"],
  ["colors", "Colors", "BCGLMOPRST", LEAD_WORD],
  ["body-parts", "Body Parts", "ABCEFHKLNSTW", LEAD_WORD],
  ["bathroom", "Things in a Bathroom", "BCFHMRST", LEAD_WORD],
  ["classroom", "Things in a Classroom", "BCDEGMPRST", LEAD_WORD],
  ["pizza-toppings", "Pizza Toppings", "ABCHMOPST", LEAD_WORD],
  ["desserts", "Desserts", "BCDFIMPST", LEAD_WORD],
  ["vegetables", "Vegetables", "ABCLOPRS", LEAD_WORD],
  ["us-states", "US States", "ACIMNOW"],
  ["famous-people", "Famous People", "ABCDGHJKLMPRST"],
  ["boys-names", "Boys' Names", "ABCDEFGHIJKLMNOPRSTW"],
  ["girls-names", "Girls' Names", "ABCDEFGHIJKLMNOPRSTW"],
  ["superheroes", "Superheroes", "ABCFGHSTW"],
  ["board-games", "Board Games", "BCMOPRST"],
  ["toys", "Toys", "BDKLPRST", LEAD_WORD],
  ["sky", "Things in the Sky", "ABCHMPRS", LEAD_WORD],
  ["hobbies", "Hobbies", "BCDFGHKPRSW", LEAD_WORD],
  ["car-brands", "Car Brands", "ABCFHJLMPST"],
  ["flowers", "Flowers", "CDLMOPRST", LEAD_WORD],
  ["birds", "Birds", "BCDEFGHKOPRSTW", LEAD_WORD],
  ["sea-creatures", "Sea Creatures", "CDJLOPSTW", LEAD_WORD],
  ["bugs", "Insects & Bugs", "ABCDFGLMTW", LEAD_WORD],
  ["condiments", "Sauces & Condiments", "BGHMPRS", LEAD_WORD],
  ["breakfast", "Breakfast Foods", "BCEGHMOPSTW", LEAD_WORD],
  ["party", "Things at a Party", "BCDGMPS", LEAD_WORD],
  ["park", "Things in a Park", "BDFGKLPST", LEAD_WORD],
  ["tools", "Tools", "CDHLMPSTW", LEAD_WORD],
  ["furniture", "Furniture", "BCDLRSTW", LEAD_WORD],
  ["languages", "Languages", "ACDEFGHIPRST"],
  ["musicians", "Singers & Bands", "ABDEMPRST"],
  ["things-you-open", "Things You Can Open", "BCDEGJLPSW", LEAD_WORD],
  ["round-things", "Things That Are Round", "BCDMOPSTW", LEAD_WORD],
  ["dog-breeds", "Dog Breeds", "BCDGHLPRST", LEAD_WORD],
  ["disney", "Disney Characters", "ABCDEGMPSTW"],
  ["wallet", "Things in a Bag or Wallet", "CGKLMPRST", LEAD_WORD],
];

export const CATEGORIES = RAW.map(([key, name, letters, flags = {}]) => ({
  key,
  name,
  // RAW holds the normal letters only; rare letters join from RARE_EXAMPLES.
  letters: [...letters.split(""), ...rareLettersFor(key)].sort(),
  blockNumberedSequels: flags.blockNumberedSequels === true,
  blockRepeatedLeadWord: flags.blockRepeatedLeadWord === true,
}));

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
