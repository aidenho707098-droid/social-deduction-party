// Player colour identity — the palette every player is assigned from, and
// the rules for picking one. Keep this in sync with the client's copy at
// client/src/playerColors.js (same ids, same hex, same order). The server
// is the authority: it assigns a colour on join and enforces "no two
// players in one room share a colour"; the client copy is only for
// rendering and the lobby colour picker.
//
// The palette expands on the brand trio (violet / coral / mustard) with
// warm, slightly-muted tints in the same "quirky but clean" family, plus
// cooler counterpoints (teal, sage, denim, pine, periwinkle) for contrast.
// Ordered most-distinct-first, so small rooms get maximally different dots.
// Every hex is spaced to stay visually distinct from the rest — no near-
// duplicates — so even a 20-player room reads apart at a glance.

export const PLAYER_COLORS = [
  { id: "violet", hex: "#5B3E99" }, // brand
  { id: "coral", hex: "#FF7A50" }, // brand
  { id: "mustard", hex: "#F0B429" }, // brand
  { id: "teal", hex: "#2F9C9C" }, // cooler counterpoint
  { id: "rose", hex: "#E06B93" }, // warm pink
  { id: "sage", hex: "#7FA37A" }, // muted green counterpoint
  { id: "terracotta", hex: "#C05C3E" }, // warm earthy red
  { id: "plum", hex: "#8A5CA8" }, // lighter violet
  { id: "amber", hex: "#C6871C" }, // deeper gold
  { id: "mulberry", hex: "#9C4E72" }, // muted berry
  { id: "sand", hex: "#CBA36B" }, // warm neutral tint
  { id: "indigo", hex: "#4B4790" }, // deep blue-violet
  { id: "pumpkin", hex: "#DA7B37" }, // burnt orange, between terracotta & amber
  { id: "denim", hex: "#4C79A8" }, // muted slate blue counterpoint
  { id: "brick", hex: "#AC4348" }, // muted crimson red
  { id: "pine", hex: "#4C9575" }, // deep muted green counterpoint
  { id: "orchid", hex: "#9A4FA0" }, // saturated magenta-purple
  { id: "periwinkle", hex: "#7C84C8" }, // soft light blue-violet counterpoint
  { id: "olive", hex: "#8B8A47" }, // dark khaki
  { id: "cocoa", hex: "#7B5142" }, // deep warm brown
];

export const PLAYER_COLOR_IDS = PLAYER_COLORS.map((c) => c.id);

export function isValidColorId(id) {
  return PLAYER_COLOR_IDS.includes(id);
}

export function hexOf(id) {
  return (PLAYER_COLORS.find((c) => c.id === id) ?? PLAYER_COLORS[0]).hex;
}

// Pick a colour for a joining player: the first palette colour not already
// worn by someone in the room. If every colour is taken (a room bigger
// than the palette), fall back to cycling so a join still succeeds.
export function assignPlayerColor(usedColorIds) {
  const used = new Set(usedColorIds);
  const free = PLAYER_COLORS.find((c) => !used.has(c.id));
  return (free ?? PLAYER_COLORS[used.size % PLAYER_COLORS.length]).id;
}
