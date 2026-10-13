// THE shared category bank for Alphabet Soup and Hot Potato's selector —
// the client half of server/games/alphabetSoupBank.js (keys + labels must
// match; the selftest checks). Which letters each category allows is the
// server's business; `tags` are search words for the selector.
export const CATEGORY_OPTIONS = [
  { key: 'animals', label: 'Animals', tags: ['wildlife', 'pets', 'creatures', 'zoo'] },
  { key: 'foods', label: 'Foods', tags: ['food', 'dishes', 'meals', 'cooking'] },
  { key: 'countries', label: 'Countries', tags: ['geography', 'nations', 'world', 'places'] },
  { key: 'cities', label: 'Cities', tags: ['geography', 'towns', 'places', 'travel'] },
  { key: 'movies', label: 'Movies', tags: ['films', 'cinema', 'entertainment'] },
  { key: 'tv-shows', label: 'TV Shows', tags: ['television', 'series', 'entertainment'] },
  { key: 'sports', label: 'Sports', tags: ['games', 'athletics', 'exercise'] },
  { key: 'brands', label: 'Brands', tags: ['companies', 'logos', 'shopping'] },
  { key: 'jobs', label: 'Jobs', tags: ['careers', 'work', 'professions'] },
  { key: 'kitchen', label: 'Kitchen Items', tags: ['kitchen', 'utensils', 'cooking', 'household'] },
  { key: 'beach', label: 'Things at the Beach', tags: ['beach', 'summer', 'ocean', 'holiday'] },
  { key: 'clothing', label: 'Clothing', tags: ['clothes', 'fashion', 'outfits'] },
  { key: 'video-games', label: 'Video Games', tags: ['games', 'gaming', 'consoles'] },
  { key: 'school-subjects', label: 'School Subjects', tags: ['school', 'classes', 'education'] },
  { key: 'vehicles', label: 'Vehicles', tags: ['transport', 'cars', 'travel'] },
  { key: 'fruits', label: 'Fruits', tags: ['fruit', 'food', 'produce', 'healthy'] },
  { key: 'drinks', label: 'Drinks', tags: ['beverages', 'food', 'cocktails'] },
  { key: 'candy', label: 'Candy', tags: ['sweets', 'food', 'snacks', 'chocolate'] },
  { key: 'fast-food', label: 'Fast Food Chains', tags: ['food', 'restaurants', 'brands'] },
  { key: 'instruments', label: 'Musical Instruments', tags: ['music', 'band', 'orchestra'] },
  { key: 'cartoons', label: 'Cartoon Characters', tags: ['cartoons', 'animation', 'kids', 'characters'] },
  { key: 'colors', label: 'Colors', tags: ['colours', 'paint', 'shades'] },
  { key: 'body-parts', label: 'Body Parts', tags: ['body', 'anatomy', 'health'] },
  { key: 'bathroom', label: 'Things in a Bathroom', tags: ['bathroom', 'household', 'home'] },
  { key: 'classroom', label: 'Things in a Classroom', tags: ['school', 'classroom', 'education'] },
  { key: 'pizza-toppings', label: 'Pizza Toppings', tags: ['pizza', 'food', 'toppings'] },
  { key: 'desserts', label: 'Desserts', tags: ['sweets', 'food', 'cakes', 'baking'] },
  { key: 'vegetables', label: 'Vegetables', tags: ['veg', 'food', 'produce', 'healthy'] },
  { key: 'us-states', label: 'US States', tags: ['america', 'geography', 'usa', 'places'] },
  { key: 'famous-people', label: 'Famous People', tags: ['celebrities', 'stars', 'people'] },
  { key: 'boys-names', label: "Boys' Names", tags: ['names', 'people', 'baby names'] },
  { key: 'girls-names', label: "Girls' Names", tags: ['names', 'people', 'baby names'] },
  { key: 'superheroes', label: 'Superheroes', tags: ['heroes', 'comics', 'marvel', 'dc'] },
  { key: 'board-games', label: 'Board Games', tags: ['games', 'tabletop', 'family'] },
  { key: 'toys', label: 'Toys', tags: ['kids', 'games', 'playtime'] },
  { key: 'sky', label: 'Things in the Sky', tags: ['sky', 'space', 'weather', 'flying'] },
  { key: 'hobbies', label: 'Hobbies', tags: ['activities', 'pastimes', 'leisure'] },
  { key: 'car-brands', label: 'Car Brands', tags: ['cars', 'brands', 'vehicles'] },
  { key: 'flowers', label: 'Flowers', tags: ['plants', 'garden', 'nature'] },
  { key: 'birds', label: 'Birds', tags: ['animals', 'wildlife', 'nature'] },
  { key: 'sea-creatures', label: 'Sea Creatures', tags: ['ocean', 'animals', 'fish', 'marine'] },
  { key: 'bugs', label: 'Insects & Bugs', tags: ['insects', 'animals', 'creepy crawlies'] },
  { key: 'condiments', label: 'Sauces & Condiments', tags: ['sauces', 'food', 'dips'] },
  { key: 'breakfast', label: 'Breakfast Foods', tags: ['breakfast', 'food', 'morning', 'brunch'] },
  { key: 'party', label: 'Things at a Party', tags: ['party', 'celebration', 'birthday'] },
  { key: 'park', label: 'Things in a Park', tags: ['park', 'outdoors', 'nature'] },
  { key: 'tools', label: 'Tools', tags: ['diy', 'hardware', 'workshop'] },
  { key: 'furniture', label: 'Furniture', tags: ['home', 'household', 'decor'] },
  { key: 'languages', label: 'Languages', tags: ['words', 'world', 'speaking'] },
  { key: 'musicians', label: 'Singers & Bands', tags: ['music', 'musicians', 'artists', 'bands'] },
  { key: 'things-you-open', label: 'Things You Can Open', tags: ['household', 'objects', 'containers'] },
  { key: 'round-things', label: 'Things That Are Round', tags: ['shapes', 'objects', 'circles'] },
  { key: 'dog-breeds', label: 'Dog Breeds', tags: ['dogs', 'pets', 'animals'] },
  { key: 'disney', label: 'Disney Characters', tags: ['disney', 'cartoons', 'movies', 'characters'] },
  { key: 'wallet', label: 'Things in a Bag or Wallet', tags: ['bag', 'wallet', 'everyday', 'objects'] },
]

// Retired "Random Category" marker: a saved setting that still has it (or
// no categories at all) means the whole bank. See normalizeSelection.
export const RANDOM = '__random__'
export const ALL_KEYS = CATEGORY_OPTIONS.map((c) => c.key)
export const LABEL_BY_KEY = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.key, c.label]))

// A saved selection, made valid: known keys only (bank + this room's custom
// ones); nothing usable, or the retired Random option, becomes the whole bank.
export function normalizeSelection(saved, customKeys = []) {
  const list = Array.isArray(saved) ? saved : []
  if (list.length === 0 || list.includes(RANDOM)) return [...ALL_KEYS]
  const valid = new Set([...ALL_KEYS, ...customKeys])
  const keys = [...new Set(list.filter((k) => valid.has(k)))]
  return keys.length ? keys : [...ALL_KEYS]
}
