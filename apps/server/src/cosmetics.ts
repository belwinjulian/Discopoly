export interface CosmeticDefinition {
  id: string;
  type: "title" | "theme" | "dice";
  name: string;
  display?: string;    // For titles
  description?: string; // For themes/dice
  cost: number;        // 0 = free default
}

export const TITLES: CosmeticDefinition[] = [
  { id: "tycoon", type: "title", name: "Tycoon", display: "Tycoon", cost: 30 },
  { id: "landlord", type: "title", name: "Landlord", display: "Landlord", cost: 30 },
  { id: "mogul", type: "title", name: "Mogul", display: "Mogul", cost: 50 },
  { id: "baron", type: "title", name: "Baron", display: "Baron", cost: 50 },
  { id: "shark_title", type: "title", name: "Shark", display: "Shark", cost: 75 },
  { id: "whale", type: "title", name: "Whale", display: "Whale", cost: 100 },
  { id: "legend", type: "title", name: "Legend", display: "Legend", cost: 150 },
];

export const THEMES: CosmeticDefinition[] = [
  { id: "classic", type: "theme", name: "Classic", description: "Default theme", cost: 0 },
  { id: "midnight", type: "theme", name: "Midnight", description: "Dark purple/blue tones", cost: 60 },
  { id: "sunset", type: "theme", name: "Sunset", description: "Warm orange/red gradient", cost: 60 },
  { id: "neon", type: "theme", name: "Neon", description: "Bright cyberpunk glow", cost: 80 },
  { id: "royal", type: "theme", name: "Royal", description: "Gold and deep red", cost: 100 },
];

export const DICE_SKINS: CosmeticDefinition[] = [
  { id: "standard", type: "dice", name: "Standard", description: "White dice", cost: 0 },
  { id: "fire", type: "dice", name: "Fire", description: "Red/orange dice", cost: 40 },
  { id: "ice", type: "dice", name: "Ice", description: "Blue/cyan dice", cost: 40 },
  { id: "gold", type: "dice", name: "Golden", description: "Gold dice", cost: 60 },
  { id: "galaxy", type: "dice", name: "Galaxy", description: "Purple/star dice", cost: 80 },
];

export const ALL_COSMETICS = [...TITLES, ...THEMES, ...DICE_SKINS];

export const COSMETICS_MAP = new Map(ALL_COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: string): CosmeticDefinition | undefined {
  return COSMETICS_MAP.get(id);
}
