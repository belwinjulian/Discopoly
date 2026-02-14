export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: "one_time" | "tiered";
  gems?: number;
  icon: string;
  tiers?: { threshold: number; gems: number; label: string }[];
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // One-time
  { id: "first_win", name: "First Victory", description: "Win your first game", type: "one_time", gems: 10, icon: "🏆" },
  { id: "monopoly_maker", name: "Monopoly Maker", description: "Complete your first monopoly", type: "one_time", gems: 10, icon: "🏘️" },
  { id: "jail_bird", name: "Jailbird", description: "Go to jail for the first time", type: "one_time", gems: 5, icon: "🔒" },
  { id: "big_spender", name: "Big Spender", description: "Spend 2000+ coins in one game", type: "one_time", gems: 10, icon: "💸" },
  { id: "lucky_streak", name: "Lucky Streak", description: "Roll doubles 3 times in one game", type: "one_time", gems: 8, icon: "🎯" },
  { id: "full_board", name: "Full Board", description: "Own 8+ properties at once", type: "one_time", gems: 15, icon: "🗺️" },
  { id: "hotel_magnate", name: "Hotel Magnate", description: "Build your first hotel", type: "one_time", gems: 8, icon: "🏨" },
  { id: "comeback_kid", name: "Comeback Kid", description: "Win after having < 100 coins", type: "one_time", gems: 20, icon: "💪" },
  { id: "auction_snipe", name: "Auction Snipe", description: "Win auction for < half price", type: "one_time", gems: 10, icon: "🎯" },
  { id: "rent_collector", name: "Rent Day", description: "Collect rent 5 times in one game", type: "one_time", gems: 5, icon: "💰" },

  // Tiered
  {
    id: "games_played", name: "Veteran", description: "Play games", type: "tiered", icon: "🎮",
    tiers: [
      { threshold: 5, gems: 5, label: "5 games" },
      { threshold: 25, gems: 15, label: "25 games" },
      { threshold: 100, gems: 30, label: "100 games" },
      { threshold: 250, gems: 50, label: "250 games" },
    ],
  },
  {
    id: "games_won", name: "Champion", description: "Win games", type: "tiered", icon: "👑",
    tiers: [
      { threshold: 3, gems: 10, label: "3 wins" },
      { threshold: 15, gems: 20, label: "15 wins" },
      { threshold: 50, gems: 40, label: "50 wins" },
      { threshold: 150, gems: 75, label: "150 wins" },
    ],
  },
  {
    id: "properties_bought", name: "Property Mogul", description: "Buy properties", type: "tiered", icon: "🏠",
    tiers: [
      { threshold: 10, gems: 5, label: "10 bought" },
      { threshold: 50, gems: 15, label: "50 bought" },
      { threshold: 200, gems: 30, label: "200 bought" },
      { threshold: 500, gems: 50, label: "500 bought" },
    ],
  },
  {
    id: "hotels_built", name: "Hotel Tycoon", description: "Build hotels", type: "tiered", icon: "🏨",
    tiers: [
      { threshold: 3, gems: 8, label: "3 hotels" },
      { threshold: 15, gems: 20, label: "15 hotels" },
      { threshold: 50, gems: 35, label: "50 hotels" },
      { threshold: 100, gems: 60, label: "100 hotels" },
    ],
  },
  {
    id: "trades_done", name: "Deal Maker", description: "Complete trades", type: "tiered", icon: "🤝",
    tiers: [
      { threshold: 5, gems: 5, label: "5 trades" },
      { threshold: 25, gems: 15, label: "25 trades" },
      { threshold: 100, gems: 30, label: "100 trades" },
    ],
  },
  {
    id: "rent_earned", name: "Rent Baron", description: "Collect rent", type: "tiered", icon: "💵",
    tiers: [
      { threshold: 5000, gems: 10, label: "5K coins" },
      { threshold: 25000, gems: 25, label: "25K coins" },
      { threshold: 100000, gems: 50, label: "100K coins" },
    ],
  },
  {
    id: "bankrupted", name: "Ruthless", description: "Bankrupt opponents", type: "tiered", icon: "💀",
    tiers: [
      { threshold: 3, gems: 10, label: "3 bankrupted" },
      { threshold: 15, gems: 25, label: "15 bankrupted" },
      { threshold: 50, gems: 50, label: "50 bankrupted" },
    ],
  },
];

export const ACHIEVEMENTS_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
