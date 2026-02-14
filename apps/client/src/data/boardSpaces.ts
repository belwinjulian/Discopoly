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

// Rent scales per property index: [base, 1house, 2houses, 3houses, 4houses, hotel]
export const RENT_SCALES: Record<number, number[]> = {
  1:  [10, 50, 150, 450, 625, 750],     // Maple Lane Duplex
  3:  [14, 70, 200, 550, 750, 950],     // Oak Street Cottage
  5:  [18, 90, 250, 700, 875, 1050],    // Gallery Row Studio
  6:  [22, 110, 330, 800, 975, 1150],   // Pottery Lane Shop
  8:  [26, 130, 390, 900, 1100, 1300],  // Mural Alley Cafe
  12: [34, 170, 500, 1100, 1300, 1500], // Campus Bookstore
  13: [38, 190, 550, 1200, 1400, 1600], // Lecture Hall Plaza
  15: [42, 210, 600, 1300, 1500, 1700], // Dormitory Row
  16: [50, 250, 720, 1500, 1700, 1900], // Harbor Fish Market
  17: [54, 270, 780, 1600, 1800, 2000], // Pier 7 Restaurant
  19: [58, 290, 840, 1700, 1900, 2100], // Lighthouse Marina
  20: [66, 330, 960, 1900, 2100, 2300], // Stock Exchange
  22: [70, 350, 1000, 2000, 2200, 2400], // Trade Tower
  23: [74, 370, 1050, 2100, 2300, 2550], // Bank HQ
  24: [78, 390, 1100, 2200, 2500, 2800], // Hilltop Estate
  25: [82, 410, 1150, 2300, 2600, 2900], // Penthouse Terrace
  27: [90, 450, 1250, 2500, 2800, 3200], // Grand Boulevard
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

// ==================== Sell Building Utilities ====================

/**
 * Calculate the sell value for a house (50% of house cost).
 */
export function getHouseSellValue(district: string): number {
  const houseCost = HOUSE_COST[district] || 100;
  return Math.floor(houseCost / 2);
}

/**
 * Calculate the sell value for a hotel (50% of hotel cost).
 */
export function getHotelSellValue(district: string): number {
  const hotelCost = HOTEL_COST[district] || 100;
  return Math.floor(hotelCost / 2);
}

export interface BoardSpaceInfo {
  index: number;
  name: string;
  district: string;
  ownerId: string;
  houses: number;
  hasHotel: boolean;
}

/**
 * Check if a player has a monopoly (owns all properties in a district).
 */
export function playerHasMonopoly(
  boardSpaces: BoardSpaceInfo[],
  sessionId: string,
  district: string
): boolean {
  const indices = DISTRICT_PROPERTIES[district];
  if (!indices || indices.length === 0) return false;
  return indices.every((idx) => boardSpaces[idx]?.ownerId === sessionId);
}

/**
 * Get all districts where the player has a monopoly.
 */
export function getPlayerMonopolies(
  boardSpaces: BoardSpaceInfo[],
  sessionId: string
): string[] {
  const monopolies: string[] = [];
  for (const district of Object.keys(DISTRICT_PROPERTIES)) {
    if (playerHasMonopoly(boardSpaces, sessionId, district)) {
      monopolies.push(district);
    }
  }
  return monopolies;
}

/**
 * Get properties where a player can sell a house.
 * Rules: must own (monopoly), must have at least 1 house (no hotel),
 * and must follow even selling (can only sell from properties with MAX houses in district).
 */
export function getSellableHouseProperties(
  boardSpaces: BoardSpaceInfo[],
  sessionId: string
): number[] {
  const monopolies = getPlayerMonopolies(boardSpaces, sessionId);
  const sellable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];

    // Get current house counts (hotels count as 5)
    const houseCounts = indices.map((idx) => {
      const s = boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const maxHouses = Math.max(...houseCounts);

    // Can only sell houses (not hotels) - hotels must be sold separately
    // Even selling: can only sell from properties with the max houses in the district
    for (let i = 0; i < indices.length; i++) {
      const space = boardSpaces[indices[i]];
      if (space.hasHotel) continue; // must sell hotel first
      if (space.houses === 0) continue; // no houses to sell
      // Even selling: can only sell if this property has the max houses in the district
      if (houseCounts[i] >= maxHouses) {
        sellable.push(indices[i]);
      }
    }
  }

  return sellable;
}

/**
 * Get properties where a player can sell a hotel.
 * Rules: must own (monopoly), must have a hotel,
 * and for even selling: can only sell if it's at the max level in the district.
 */
export function getSellableHotelProperties(
  boardSpaces: BoardSpaceInfo[],
  sessionId: string
): number[] {
  const monopolies = getPlayerMonopolies(boardSpaces, sessionId);
  const sellable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];

    // Get current house counts (hotels count as 5)
    const houseCounts = indices.map((idx) => {
      const s = boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const maxHouses = Math.max(...houseCounts);

    // For hotels, we need to check even selling
    // Can only sell a hotel if it's at the max level in the district
    for (let i = 0; i < indices.length; i++) {
      const space = boardSpaces[indices[i]];
      if (!space.hasHotel) continue; // no hotel to sell
      // Even selling: can only sell if this property has the max (which is 5 for hotel)
      if (houseCounts[i] >= maxHouses) {
        sellable.push(indices[i]);
      }
    }
  }

  return sellable;
}
