export interface CardDefinition {
  id: string;
  deck: "community" | "chance";
  title: string;
  description: string;
  effect:
    | "gain_coins"
    | "lose_coins"
    | "move_to"
    | "move_relative"
    | "collect_from_players"
    | "pay_to_players";
  /** Coins to gain/lose, coins per player, or spaces to move (negative = backward) */
  amount?: number;
  /** Target board space index for move_to effect */
  targetSpace?: number;
}

// ==================== Community Chest Cards ====================

export const COMMUNITY_CARDS: CardDefinition[] = [
  {
    id: "comm_tax_refund",
    deck: "community",
    title: "Tax Refund",
    description: "Tax refund! Collect 100 coins.",
    effect: "gain_coins",
    amount: 100,
  },
  {
    id: "comm_holiday_bonus",
    deck: "community",
    title: "Holiday Bonus",
    description: "Holiday bonus! Collect 150 coins.",
    effect: "gain_coins",
    amount: 150,
  },
  {
    id: "comm_life_insurance",
    deck: "community",
    title: "Life Insurance",
    description: "Life insurance matures. Collect 75 coins.",
    effect: "gain_coins",
    amount: 75,
  },
  {
    id: "comm_doctor_fee",
    deck: "community",
    title: "Doctor's Fee",
    description: "Doctor's fee. Pay 50 coins.",
    effect: "lose_coins",
    amount: 50,
  },
  {
    id: "comm_school_fees",
    deck: "community",
    title: "School Fees",
    description: "Pay school fees of 100 coins.",
    effect: "lose_coins",
    amount: 100,
  },
  {
    id: "comm_city_assessment",
    deck: "community",
    title: "City Assessment",
    description: "City assessment. Pay 75 coins.",
    effect: "lose_coins",
    amount: 75,
  },
  {
    id: "comm_birthday",
    deck: "community",
    title: "Birthday Party",
    description: "It's your birthday! Collect 25 coins from each player.",
    effect: "collect_from_players",
    amount: 25,
  },
  {
    id: "comm_fundraiser",
    deck: "community",
    title: "Community Fundraiser",
    description: "Community fundraiser. Pay 50 coins to each player.",
    effect: "pay_to_players",
    amount: 50,
  },
  {
    id: "comm_bank_error",
    deck: "community",
    title: "Bank Error",
    description: "Bank error in your favor. Collect 200 coins.",
    effect: "gain_coins",
    amount: 200,
  },
  {
    id: "comm_hospital_fees",
    deck: "community",
    title: "Hospital Fees",
    description: "Pay hospital fees of 100 coins.",
    effect: "lose_coins",
    amount: 100,
  },
];

// ==================== Chance Cards ====================

export const CHANCE_CARDS: CardDefinition[] = [
  {
    id: "chance_advance_payday",
    deck: "chance",
    title: "Advance to Payday",
    description: "Advance to Payday! Collect bonus if you pass.",
    effect: "move_to",
    targetSpace: 0,
  },
  {
    id: "chance_gallery_row",
    deck: "chance",
    title: "Gallery Row Studio",
    description: "Head to Gallery Row Studio.",
    effect: "move_to",
    targetSpace: 5,
  },
  {
    id: "chance_dormitory",
    deck: "chance",
    title: "Dormitory Row",
    description: "Visit Dormitory Row.",
    effect: "move_to",
    targetSpace: 15,
  },
  {
    id: "chance_stock_exchange",
    deck: "chance",
    title: "Stock Exchange",
    description: "Business trip to Stock Exchange.",
    effect: "move_to",
    targetSpace: 20,
  },
  {
    id: "chance_go_back_3",
    deck: "chance",
    title: "Go Back",
    description: "Go back 3 spaces.",
    effect: "move_relative",
    amount: -3,
  },
  {
    id: "chance_shortcut",
    deck: "chance",
    title: "Shortcut",
    description: "Shortcut! Move forward 2 spaces.",
    effect: "move_relative",
    amount: 2,
  },
  {
    id: "chance_crossword",
    deck: "chance",
    title: "Crossword Winner",
    description: "You won a crossword competition! Collect 100 coins.",
    effect: "gain_coins",
    amount: 100,
  },
  {
    id: "chance_building_loan",
    deck: "chance",
    title: "Building Loan",
    description: "Building loan matures. Collect 150 coins.",
    effect: "gain_coins",
    amount: 150,
  },
  {
    id: "chance_speed_ticket",
    deck: "chance",
    title: "Speed Ticket",
    description: "Speed ticket! Pay 75 coins.",
    effect: "lose_coins",
    amount: 75,
  },
  {
    id: "chance_charity_gala",
    deck: "chance",
    title: "Charity Gala",
    description: "Charity gala. Pay 50 coins to each player.",
    effect: "pay_to_players",
    amount: 50,
  },
];

// ==================== Deck Utilities ====================

/** Create a shuffled array of card IDs from a deck */
export function shuffleDeck(cards: CardDefinition[]): string[] {
  const ids = cards.map((c) => c.id);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/** Look up a card definition by ID */
export function getCardById(id: string): CardDefinition | undefined {
  return (
    COMMUNITY_CARDS.find((c) => c.id === id) ||
    CHANCE_CARDS.find((c) => c.id === id)
  );
}
