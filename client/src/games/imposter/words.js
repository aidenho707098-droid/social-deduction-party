// Keep this in sync with server/games/imposter.js — the server is the
// source of truth for which word actually gets used (it picks randomly
// from the chosen category), this list just drives the host's category
// picker UI.
export const CATEGORY_NAMES = [
  "Animals",
  "Food",
  "Places",
  "Movies",
  "Sports",
  "Jobs",
  "Around the House",
];

// Picker sends this instead of a real name to have the server roll the
// category itself (mirrors RANDOM_CATEGORY on the server).
export const RANDOM_CATEGORY = "__random__";
