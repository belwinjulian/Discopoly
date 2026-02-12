// District colors matching server config
export const DISTRICT_COLORS: Record<string, string> = {
  Suburbs: "#8B4513",
  "Arts District": "#87CEEB",
  University: "#FFA500",
  Waterfront: "#FF0000",
  Financial: "#FFD700",
  Uptown: "#228B22",
  "Luxury Row": "#0000CD",
};

// Player token colors
export const PLAYER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
];

// House cost per district
export const HOUSE_COST: Record<string, number> = {
  "Suburbs":       50,
  "Arts District": 50,
  "University":    100,
  "Waterfront":    150,
  "Financial":     150,
  "Uptown":        200,
  "Luxury Row":    200,
};

// Hotel cost per district
export const HOTEL_COST: Record<string, number> = {
  "Suburbs":       50,
  "Arts District": 50,
  "University":    100,
  "Waterfront":    150,
  "Financial":     150,
  "Uptown":        200,
  "Luxury Row":    200,
};

// Property indices grouped by district
export const DISTRICT_PROPERTIES: Record<string, number[]> = {
  "Suburbs":       [1, 3],
  "Arts District": [5, 6, 8],
  "University":    [12, 13, 15],
  "Waterfront":    [16, 17, 19],
  "Financial":     [20, 22, 23],
  "Uptown":        [24, 25],
  "Luxury Row":    [27],
};

// Space type icons/labels
export const SPACE_TYPE_LABELS: Record<string, string> = {
  payday: "💰 Payday",
  jail: "🚓 Jail",
  goToJail: "👮 Go to Jail",
  parking: "🅿️ City Parking",
  tax: "🏛️ Tax",
  community: "📦 Community Chest",
  chance: "❓ Chance",
  property: "",
};

/**
 * Get the board position layout.
 * Returns which spaces go on which side of the board.
 *
 * Board layout (7 per side):
 *   Top:    14, 15, 16, 17, 18, 19, 20  (left to right)
 *   Right:  21, 22, 23, 24, 25, 26, 27  (top to bottom)
 *   Bottom:  0,  1,  2,  3,  4,  5,  6  (right to left visually, but we reverse for display)
 *   Left:    7,  8,  9, 10, 11, 12, 13  (bottom to top)
 */
export function getBoardLayout() {
  return {
    bottom: [0, 1, 2, 3, 4, 5, 6], // Displayed right to left
    left: [7, 8, 9, 10, 11, 12, 13], // Displayed bottom to top
    top: [14, 15, 16, 17, 18, 19, 20], // Displayed left to right
    right: [21, 22, 23, 24, 25, 26, 27], // Displayed top to bottom
  };
}
