export interface CosmeticDefinition {
  id: string;
  type: "title" | "theme" | "dice";
  name: string;
  display?: string;
  description?: string;
  cost: number;
  preview?: string; // emoji or visual hint
}

export const TITLES: CosmeticDefinition[] = [
  { id: "tycoon", type: "title", name: "Tycoon", display: "Tycoon", cost: 30, preview: "🏢" },
  { id: "landlord", type: "title", name: "Landlord", display: "Landlord", cost: 30, preview: "🏠" },
  { id: "mogul", type: "title", name: "Mogul", display: "Mogul", cost: 50, preview: "💼" },
  { id: "baron", type: "title", name: "Baron", display: "Baron", cost: 50, preview: "🎖️" },
  { id: "shark_title", type: "title", name: "Shark", display: "Shark", cost: 75, preview: "🦈" },
  { id: "whale", type: "title", name: "Whale", display: "Whale", cost: 100, preview: "🐋" },
  { id: "legend", type: "title", name: "Legend", display: "Legend", cost: 150, preview: "⭐" },
];

export const THEMES: CosmeticDefinition[] = [
  { id: "classic", type: "theme", name: "Classic", description: "Default theme", cost: 0, preview: "🎲" },
  { id: "midnight", type: "theme", name: "Midnight", description: "Dark purple/blue tones", cost: 60, preview: "🌙" },
  { id: "sunset", type: "theme", name: "Sunset", description: "Warm orange/red gradient", cost: 60, preview: "🌅" },
  { id: "neon", type: "theme", name: "Neon", description: "Bright cyberpunk glow", cost: 80, preview: "💜" },
  { id: "royal", type: "theme", name: "Royal", description: "Gold and deep red", cost: 100, preview: "👑" },
];

export const DICE_SKINS: CosmeticDefinition[] = [
  { id: "standard", type: "dice", name: "Standard", description: "White dice", cost: 0, preview: "⬜" },
  { id: "fire", type: "dice", name: "Fire", description: "Red/orange dice", cost: 40, preview: "🔥" },
  { id: "ice", type: "dice", name: "Ice", description: "Blue/cyan dice", cost: 40, preview: "🧊" },
  { id: "gold", type: "dice", name: "Golden", description: "Gold dice", cost: 60, preview: "✨" },
  { id: "galaxy", type: "dice", name: "Galaxy", description: "Purple/star dice", cost: 80, preview: "🌌" },
];

export const ALL_COSMETICS = [...TITLES, ...THEMES, ...DICE_SKINS];
export const COSMETICS_MAP = new Map(ALL_COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: string): CosmeticDefinition | undefined {
  return COSMETICS_MAP.get(id);
}

export function getTitleDisplay(titleId: string): string {
  const title = TITLES.find((t) => t.id === titleId);
  return title?.display || "";
}
