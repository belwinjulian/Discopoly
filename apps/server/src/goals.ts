import {
  getPlayerGoals,
  incrementGoalProgress,
  completeGoal,
  updateGems,
  type PlayerGoal,
} from "./db.js";

export interface GoalDefinition {
  id: string;
  description: string;
  target: number;
  gems: number;
  type: "daily" | "weekly";
  // Which stat event triggers progress
  trigger: string;
}

export const DAILY_GOALS: GoalDefinition[] = [
  { id: "daily_play", description: "Play a game", target: 1, gems: 2, type: "daily", trigger: "game_played" },
  { id: "daily_roll", description: "Roll the dice 10 times", target: 10, gems: 2, type: "daily", trigger: "dice_roll" },
  { id: "daily_buy_prop", description: "Buy a property", target: 1, gems: 3, type: "daily", trigger: "property_bought" },
  { id: "daily_build", description: "Build a house or hotel", target: 1, gems: 3, type: "daily", trigger: "building_built" },
  { id: "daily_rent", description: "Collect rent 3 times", target: 3, gems: 3, type: "daily", trigger: "rent_collected" },
  { id: "daily_trade", description: "Complete a trade", target: 1, gems: 4, type: "daily", trigger: "trade_completed" },
  { id: "daily_auction", description: "Win an auction", target: 1, gems: 4, type: "daily", trigger: "auction_won" },
  { id: "daily_payday", description: "Pass Payday 3 times", target: 3, gems: 2, type: "daily", trigger: "payday_collected" },
  { id: "daily_doubles", description: "Roll doubles", target: 1, gems: 2, type: "daily", trigger: "doubles_rolled" },
  { id: "daily_jail_escape", description: "Escape jail", target: 1, gems: 3, type: "daily", trigger: "jail_escape" },
];

export const WEEKLY_GOALS: GoalDefinition[] = [
  { id: "weekly_play_3", description: "Play 3 games", target: 3, gems: 5, type: "weekly", trigger: "game_played" },
  { id: "weekly_win", description: "Win a game", target: 1, gems: 8, type: "weekly", trigger: "game_won" },
  { id: "weekly_buy_5", description: "Buy 5 properties", target: 5, gems: 5, type: "weekly", trigger: "property_bought" },
  { id: "weekly_build_5", description: "Build 5 buildings", target: 5, gems: 6, type: "weekly", trigger: "building_built" },
  { id: "weekly_earn_coins", description: "Earn 3000 coins total", target: 3000, gems: 5, type: "weekly", trigger: "coins_earned" },
  { id: "weekly_trade_3", description: "Complete 3 trades", target: 3, gems: 7, type: "weekly", trigger: "trade_completed" },
  { id: "weekly_collect_rent", description: "Collect rent 15 times", target: 15, gems: 6, type: "weekly", trigger: "rent_collected" },
  { id: "weekly_monopoly", description: "Complete a monopoly", target: 1, gems: 8, type: "weekly", trigger: "monopoly_completed" },
];

const ALL_GOALS = [...DAILY_GOALS, ...WEEKLY_GOALS];
export const GOALS_MAP = new Map(ALL_GOALS.map((g) => [g.id, g]));

/**
 * Simple seeded random for deterministic goal selection.
 */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
}

/**
 * Get the current daily reset date (YYYY-MM-DD in UTC).
 */
export function getDailyResetDate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Get the current weekly reset date (Monday YYYY-MM-DD in UTC).
 */
export function getWeeklyResetDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  return monday.toISOString().split("T")[0];
}

/**
 * Select 3 daily goals for a player on a given date.
 * Deterministic per player+date.
 */
export function selectDailyGoals(discordUserId: string, date: string): GoalDefinition[] {
  const rng = seededRandom(`daily:${discordUserId}:${date}`);
  const pool = [...DAILY_GOALS];
  const selected: GoalDefinition[] = [];

  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}

/**
 * Select 2 weekly goals for a player on a given week.
 * Deterministic per player+week.
 */
export function selectWeeklyGoals(discordUserId: string, weekDate: string): GoalDefinition[] {
  const rng = seededRandom(`weekly:${discordUserId}:${weekDate}`);
  const pool = [...WEEKLY_GOALS];
  const selected: GoalDefinition[] = [];

  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}

export interface GoalProgress {
  goal: GoalDefinition;
  progress: number;
  completed: boolean;
  resetDate: string;
}

/**
 * Get all current goals + progress for a player.
 */
export function getPlayerCurrentGoals(discordUserId: string): GoalProgress[] {
  const dailyDate = getDailyResetDate();
  const weeklyDate = getWeeklyResetDate();

  const dailyGoals = selectDailyGoals(discordUserId, dailyDate);
  const weeklyGoals = selectWeeklyGoals(discordUserId, weeklyDate);

  const dailyProgress = getPlayerGoals(discordUserId, dailyDate);
  const weeklyProgress = getPlayerGoals(discordUserId, weeklyDate);

  const dailyMap = new Map(dailyProgress.map((g) => [g.goal_id, g]));
  const weeklyMap = new Map(weeklyProgress.map((g) => [g.goal_id, g]));

  const result: GoalProgress[] = [];

  for (const goal of dailyGoals) {
    const prog = dailyMap.get(goal.id);
    result.push({
      goal,
      progress: prog?.progress || 0,
      completed: !!prog?.completed,
      resetDate: dailyDate,
    });
  }

  for (const goal of weeklyGoals) {
    const prog = weeklyMap.get(goal.id);
    result.push({
      goal,
      progress: prog?.progress || 0,
      completed: !!prog?.completed,
      resetDate: weeklyDate,
    });
  }

  return result;
}

export interface GoalCompletionResult {
  goalId: string;
  description: string;
  gems: number;
  type: "daily" | "weekly";
}

/**
 * Process a trigger event for a player's goals.
 * Returns any newly completed goals.
 */
export function processGoalTrigger(
  discordUserId: string,
  trigger: string,
  amount: number = 1
): GoalCompletionResult[] {
  const dailyDate = getDailyResetDate();
  const weeklyDate = getWeeklyResetDate();

  const dailyGoals = selectDailyGoals(discordUserId, dailyDate);
  const weeklyGoals = selectWeeklyGoals(discordUserId, weeklyDate);

  const completions: GoalCompletionResult[] = [];

  // Check daily goals
  for (const goal of dailyGoals) {
    if (goal.trigger !== trigger) continue;
    const resetDate = dailyDate;
    const updated = incrementGoalProgress(discordUserId, goal.id, resetDate, amount);
    if (!updated.completed && updated.progress >= goal.target) {
      completeGoal(discordUserId, goal.id, resetDate);
      updateGems(discordUserId, goal.gems);
      completions.push({
        goalId: goal.id,
        description: goal.description,
        gems: goal.gems,
        type: "daily",
      });
    }
  }

  // Check weekly goals
  for (const goal of weeklyGoals) {
    if (goal.trigger !== trigger) continue;
    const resetDate = weeklyDate;
    const updated = incrementGoalProgress(discordUserId, goal.id, resetDate, amount);
    if (!updated.completed && updated.progress >= goal.target) {
      completeGoal(discordUserId, goal.id, resetDate);
      updateGems(discordUserId, goal.gems);
      completions.push({
        goalId: goal.id,
        description: goal.description,
        gems: goal.gems,
        type: "weekly",
      });
    }
  }

  return completions;
}
