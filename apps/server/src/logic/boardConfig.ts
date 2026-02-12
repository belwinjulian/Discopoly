export interface BoardSpaceConfig {
  index: number;
  name: string;
  spaceType: "property" | "tax" | "payday" | "jail" | "parking" | "goToJail" | "community" | "chance";
  district: string;
  price: number;
  rent: number;
  /** Rent scale: [base, 1house, 2houses, 3houses, 4houses, hotel] */
  rentScale?: number[];
}

// 28-space board: 7 per side, corners at 0, 7, 14, 21
// Districts (color groups):
//   Suburbs (brown)    - 2 properties
//   Arts District (light blue) - 3 properties
//   University (orange) - 3 properties
//   Waterfront (red)   - 3 properties
//   Financial (yellow) - 3 properties
//   Uptown (green)     - 2 properties
//   Luxury Row (blue)  - 1 property

export const BOARD_SPACES: BoardSpaceConfig[] = [
  // === BOTTOM ROW (right to left, index 0-6) ===
  // rentScale: [base, 1house, 2houses, 3houses, 4houses, hotel]
  { index: 0,  name: "Payday",              spaceType: "payday",     district: "",              price: 0,   rent: 0 },
  { index: 1,  name: "Maple Lane Duplex",    spaceType: "property",   district: "Suburbs",       price: 60,  rent: 10,  rentScale: [10, 50, 150, 450, 625, 750] },
  { index: 2,  name: "Community Chest",      spaceType: "community",  district: "",              price: 0,   rent: 0 },
  { index: 3,  name: "Oak Street Cottage",   spaceType: "property",   district: "Suburbs",       price: 80,  rent: 14,  rentScale: [14, 70, 200, 550, 750, 950] },
  { index: 4,  name: "Income Tax",           spaceType: "tax",        district: "",              price: 0,   rent: 0 },
  { index: 5,  name: "Gallery Row Studio",   spaceType: "property",   district: "Arts District", price: 100, rent: 18,  rentScale: [18, 90, 250, 700, 875, 1050] },
  { index: 6,  name: "Pottery Lane Shop",    spaceType: "property",   district: "Arts District", price: 120, rent: 22,  rentScale: [22, 110, 330, 800, 975, 1150] },

  // === LEFT COLUMN (bottom to top, index 7-13) ===
  { index: 7,  name: "Jail",                 spaceType: "jail",       district: "",              price: 0,   rent: 0 },
  { index: 8,  name: "Mural Alley Cafe",     spaceType: "property",   district: "Arts District", price: 140, rent: 26,  rentScale: [26, 130, 390, 900, 1100, 1300] },
  { index: 9,  name: "City Events",          spaceType: "tax",        district: "",              price: 0,   rent: 0 },
  { index: 10, name: "Luxury Tax",           spaceType: "tax",        district: "",              price: 0,   rent: 0 },
  { index: 11, name: "Chance",               spaceType: "chance",     district: "",              price: 0,   rent: 0 },
  { index: 12, name: "Campus Bookstore",     spaceType: "property",   district: "University",    price: 180, rent: 34,  rentScale: [34, 170, 500, 1100, 1300, 1500] },
  { index: 13, name: "Lecture Hall Plaza",    spaceType: "property",   district: "University",    price: 200, rent: 38,  rentScale: [38, 190, 550, 1200, 1400, 1600] },

  // === TOP ROW (left to right, index 14-20) ===
  { index: 14, name: "City Parking",         spaceType: "parking",    district: "",              price: 0,   rent: 0 },
  { index: 15, name: "Dormitory Row",        spaceType: "property",   district: "University",    price: 220, rent: 42,  rentScale: [42, 210, 600, 1300, 1500, 1700] },
  { index: 16, name: "Harbor Fish Market",   spaceType: "property",   district: "Waterfront",    price: 260, rent: 50,  rentScale: [50, 250, 720, 1500, 1700, 1900] },
  { index: 17, name: "Pier 7 Restaurant",    spaceType: "property",   district: "Waterfront",    price: 280, rent: 54,  rentScale: [54, 270, 780, 1600, 1800, 2000] },
  { index: 18, name: "Community Chest",      spaceType: "community",  district: "",              price: 0,   rent: 0 },
  { index: 19, name: "Lighthouse Marina",    spaceType: "property",   district: "Waterfront",    price: 300, rent: 58,  rentScale: [58, 290, 840, 1700, 1900, 2100] },
  { index: 20, name: "Stock Exchange",       spaceType: "property",   district: "Financial",     price: 340, rent: 66,  rentScale: [66, 330, 960, 1900, 2100, 2300] },

  // === RIGHT COLUMN (top to bottom, index 21-27) ===
  { index: 21, name: "Go to Jail",           spaceType: "goToJail",   district: "",              price: 0,   rent: 0 },
  { index: 22, name: "Trade Tower",          spaceType: "property",   district: "Financial",     price: 360, rent: 70,  rentScale: [70, 350, 1000, 2000, 2200, 2400] },
  { index: 23, name: "Bank HQ",             spaceType: "property",   district: "Financial",     price: 380, rent: 74,  rentScale: [74, 370, 1050, 2100, 2300, 2550] },
  { index: 24, name: "Hilltop Estate",       spaceType: "property",   district: "Uptown",        price: 400, rent: 78,  rentScale: [78, 390, 1100, 2200, 2500, 2800] },
  { index: 25, name: "Penthouse Terrace",    spaceType: "property",   district: "Uptown",        price: 420, rent: 82,  rentScale: [82, 410, 1150, 2300, 2600, 2900] },
  { index: 26, name: "Super Tax",            spaceType: "tax",        district: "",              price: 0,   rent: 0 },
  { index: 27, name: "Grand Boulevard",      spaceType: "property",   district: "Luxury Row",    price: 450, rent: 90,  rentScale: [90, 450, 1250, 2500, 2800, 3200] },
];

export const TOTAL_SPACES = BOARD_SPACES.length;

// Tax amounts
export const INCOME_TAX = 100;
export const LUXURY_TAX = 150;
export const SUPER_TAX = 200;

// Payday bonus
export const PAYDAY_BONUS = 200;

// Starting coins
export const STARTING_COINS = 1500;

// Max rounds (for alternative win condition)
export const MAX_ROUNDS = 50;

// District colors for client reference
export const DISTRICT_COLORS: Record<string, string> = {
  "Suburbs":       "#8B4513",
  "Arts District": "#87CEEB",
  "University":    "#FFA500",
  "Waterfront":    "#FF0000",
  "Financial":     "#FFD700",
  "Uptown":        "#228B22",
  "Luxury Row":    "#0000CD",
};

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

// Hotel cost per district (same as house cost in classic rules)
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

export const MAX_HOUSES = 4;

// Jail constants
export const JAIL_FINE = 50;
export const JAIL_SPACE_INDEX = 7;
export const MAX_JAIL_TURNS = 3;
