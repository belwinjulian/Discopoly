export interface PieceDefinition {
  id: string;
  emoji: string;
  name: string;
  cost: number; // 0 = free starter piece
}

export const PIECES: PieceDefinition[] = [
  // Free starter pieces
  { id: "car", emoji: "🚗", name: "Car", cost: 0 },
  { id: "tophat", emoji: "🎩", name: "Top Hat", cost: 0 },
  { id: "dog", emoji: "🐕", name: "Dog", cost: 0 },
  { id: "rocket", emoji: "🚀", name: "Rocket", cost: 0 },
  { id: "bolt", emoji: "⚡", name: "Lightning", cost: 0 },
  { id: "guitar", emoji: "🎸", name: "Guitar", cost: 0 },
  // Store pieces (cost gems)
  { id: "crown", emoji: "👑", name: "Crown", cost: 25 },
  { id: "dragon", emoji: "🐲", name: "Dragon", cost: 40 },
  { id: "diamond", emoji: "💎", name: "Diamond", cost: 50 },
  { id: "unicorn", emoji: "🦄", name: "Unicorn", cost: 35 },
  { id: "ghost", emoji: "👻", name: "Ghost", cost: 20 },
  { id: "alien", emoji: "👽", name: "Alien", cost: 30 },
  { id: "robot", emoji: "🤖", name: "Robot", cost: 45 },
  { id: "phoenix", emoji: "🦅", name: "Phoenix", cost: 60 },
  { id: "shark", emoji: "🦈", name: "Shark", cost: 75 },
  { id: "wizard", emoji: "🧙", name: "Wizard", cost: 80 },
  { id: "dino", emoji: "🦖", name: "T-Rex", cost: 100 },
  { id: "penguin", emoji: "🐧", name: "Penguin", cost: 50 },
];

export const PIECES_MAP = new Map(PIECES.map((p) => [p.id, p]));

export function getPiece(id: string): PieceDefinition | undefined {
  return PIECES_MAP.get(id);
}
