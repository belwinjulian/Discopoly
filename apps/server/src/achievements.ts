import { getPlayerStats, getPlayerAchievement, unlockAchievement, updateGems, type PlayerStats } from "./db.js";

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: "one_time" | "tiered";
  // For one_time: single gem reward
  gems?: number;
  // For one_time: stat field + threshold
  statField?: keyof Omit<PlayerStats, "discord_user_id">;
  threshold?: number;
  // For tiered: array of tiers
  tiers?: { threshold: number; gems: number }[];
  // For achievements checked in-game (not stat-based)
  inGame?: boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // One-time achievements
  {
    id: "first_win",
    name: "First Victory",
    description: "Win your first game",
    type: "one_time",
    gems: 10,
    statField: "games_won",
    threshold: 1,
  },
  {
    id: "monopoly_maker",
    name: "Monopoly Maker",
    description: "Complete your first monopoly",
    type: "one_time",
    gems: 10,
    statField: "monopolies_completed",
    threshold: 1,
  },
  {
    id: "jail_bird",
    name: "Jailbird",
    description: "Go to jail for the first time",
    type: "one_time",
    gems: 5,
    inGame: true,
  },
  {
    id: "big_spender",
    name: "Big Spender",
    description: "Spend 2000+ coins in one game",
    type: "one_time",
    gems: 10,
    inGame: true,
  },
  {
    id: "lucky_streak",
    name: "Lucky Streak",
    description: "Roll doubles 3 times in one game",
    type: "one_time",
    gems: 8,
    inGame: true,
  },
  {
    id: "full_board",
    name: "Full Board",
    description: "Own 8+ properties at once",
    type: "one_time",
    gems: 15,
    inGame: true,
  },
  {
    id: "hotel_magnate",
    name: "Hotel Magnate",
    description: "Build your first hotel",
    type: "one_time",
    gems: 8,
    statField: "hotels_built",
    threshold: 1,
  },
  {
    id: "comeback_kid",
    name: "Comeback Kid",
    description: "Win a game after having < 100 coins",
    type: "one_time",
    gems: 20,
    inGame: true,
  },
  {
    id: "auction_snipe",
    name: "Auction Snipe",
    description: "Win an auction for less than half the property's list price",
    type: "one_time",
    gems: 10,
    inGame: true,
  },
  {
    id: "rent_collector",
    name: "Rent Day",
    description: "Collect rent 5 times in one game",
    type: "one_time",
    gems: 5,
    inGame: true,
  },

  // Tiered achievements
  {
    id: "games_played",
    name: "Veteran",
    description: "Play games",
    type: "tiered",
    statField: "games_played",
    tiers: [
      { threshold: 5, gems: 5 },
      { threshold: 25, gems: 15 },
      { threshold: 100, gems: 30 },
      { threshold: 250, gems: 50 },
    ],
  },
  {
    id: "games_won",
    name: "Champion",
    description: "Win games",
    type: "tiered",
    statField: "games_won",
    tiers: [
      { threshold: 3, gems: 10 },
      { threshold: 15, gems: 20 },
      { threshold: 50, gems: 40 },
      { threshold: 150, gems: 75 },
    ],
  },
  {
    id: "properties_bought",
    name: "Property Mogul",
    description: "Buy properties",
    type: "tiered",
    statField: "properties_bought",
    tiers: [
      { threshold: 10, gems: 5 },
      { threshold: 50, gems: 15 },
      { threshold: 200, gems: 30 },
      { threshold: 500, gems: 50 },
    ],
  },
  {
    id: "hotels_built",
    name: "Hotel Tycoon",
    description: "Build hotels",
    type: "tiered",
    statField: "hotels_built",
    tiers: [
      { threshold: 3, gems: 8 },
      { threshold: 15, gems: 20 },
      { threshold: 50, gems: 35 },
      { threshold: 100, gems: 60 },
    ],
  },
  {
    id: "trades_done",
    name: "Deal Maker",
    description: "Complete trades",
    type: "tiered",
    statField: "trades_completed",
    tiers: [
      { threshold: 5, gems: 5 },
      { threshold: 25, gems: 15 },
      { threshold: 100, gems: 30 },
    ],
  },
  {
    id: "rent_earned",
    name: "Rent Baron",
    description: "Collect rent",
    type: "tiered",
    statField: "rent_collected_total",
    tiers: [
      { threshold: 5000, gems: 10 },
      { threshold: 25000, gems: 25 },
      { threshold: 100000, gems: 50 },
    ],
  },
  {
    id: "bankrupted",
    name: "Ruthless",
    description: "Bankrupt opponents",
    type: "tiered",
    statField: "bankrupted_opponents",
    tiers: [
      { threshold: 3, gems: 10 },
      { threshold: 15, gems: 25 },
      { threshold: 50, gems: 50 },
    ],
  },
];

export const ACHIEVEMENTS_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export interface AchievementUnlock {
  achievementId: string;
  name: string;
  description: string;
  gems: number;
  tier?: number;
}

/**
 * Check stat-based achievements for a player after stats update.
 * Returns array of newly unlocked achievements.
 */
export function checkStatAchievements(discordUserId: string): AchievementUnlock[] {
  const stats = getPlayerStats(discordUserId);
  const unlocks: AchievementUnlock[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (!ach.statField) continue;

    const statValue = stats[ach.statField];

    if (ach.type === "one_time") {
      if (!ach.threshold) continue;
      const existing = getPlayerAchievement(discordUserId, ach.id);
      if (existing) continue;

      if (statValue >= ach.threshold) {
        unlockAchievement(discordUserId, ach.id, 1);
        updateGems(discordUserId, ach.gems!);
        unlocks.push({
          achievementId: ach.id,
          name: ach.name,
          description: ach.description,
          gems: ach.gems!,
        });
      }
    } else if (ach.type === "tiered" && ach.tiers) {
      const existing = getPlayerAchievement(discordUserId, ach.id);
      const currentTier = existing?.tier || 0;

      for (let t = currentTier; t < ach.tiers.length; t++) {
        if (statValue >= ach.tiers[t].threshold) {
          unlockAchievement(discordUserId, ach.id, t + 1);
          updateGems(discordUserId, ach.tiers[t].gems);
          unlocks.push({
            achievementId: ach.id,
            name: ach.name,
            description: `${ach.description} (Tier ${t + 1})`,
            gems: ach.tiers[t].gems,
            tier: t + 1,
          });
        } else {
          break;
        }
      }
    }
  }

  return unlocks;
}

/**
 * Unlock an in-game achievement (one-time, non-stat-based).
 * Returns unlock info if newly unlocked, null if already had it.
 */
export function tryUnlockInGameAchievement(discordUserId: string, achievementId: string): AchievementUnlock | null {
  const ach = ACHIEVEMENTS_MAP.get(achievementId);
  if (!ach || ach.type !== "one_time") return null;

  const existing = getPlayerAchievement(discordUserId, achievementId);
  if (existing) return null;

  unlockAchievement(discordUserId, achievementId, 1);
  updateGems(discordUserId, ach.gems!);

  return {
    achievementId: ach.id,
    name: ach.name,
    description: ach.description,
    gems: ach.gems!,
  };
}
