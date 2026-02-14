export interface GoalDefinition {
  id: string;
  description: string;
  target: number;
  gems: number;
  type: "daily" | "weekly";
  icon: string;
}

export const DAILY_GOALS: GoalDefinition[] = [
  { id: "daily_play", description: "Play a game", target: 1, gems: 2, type: "daily", icon: "🎮" },
  { id: "daily_roll", description: "Roll the dice 10 times", target: 10, gems: 2, type: "daily", icon: "🎲" },
  { id: "daily_buy_prop", description: "Buy a property", target: 1, gems: 3, type: "daily", icon: "🏠" },
  { id: "daily_build", description: "Build a house or hotel", target: 1, gems: 3, type: "daily", icon: "🔨" },
  { id: "daily_rent", description: "Collect rent 3 times", target: 3, gems: 3, type: "daily", icon: "💰" },
  { id: "daily_trade", description: "Complete a trade", target: 1, gems: 4, type: "daily", icon: "🤝" },
  { id: "daily_auction", description: "Win an auction", target: 1, gems: 4, type: "daily", icon: "🔨" },
  { id: "daily_payday", description: "Pass Payday 3 times", target: 3, gems: 2, type: "daily", icon: "💵" },
  { id: "daily_doubles", description: "Roll doubles", target: 1, gems: 2, type: "daily", icon: "🎯" },
  { id: "daily_jail_escape", description: "Escape jail", target: 1, gems: 3, type: "daily", icon: "🔓" },
];

export const WEEKLY_GOALS: GoalDefinition[] = [
  { id: "weekly_play_3", description: "Play 3 games", target: 3, gems: 5, type: "weekly", icon: "🎮" },
  { id: "weekly_win", description: "Win a game", target: 1, gems: 8, type: "weekly", icon: "🏆" },
  { id: "weekly_buy_5", description: "Buy 5 properties", target: 5, gems: 5, type: "weekly", icon: "🏠" },
  { id: "weekly_build_5", description: "Build 5 buildings", target: 5, gems: 6, type: "weekly", icon: "🔨" },
  { id: "weekly_earn_coins", description: "Earn 3000 coins total", target: 3000, gems: 5, type: "weekly", icon: "💰" },
  { id: "weekly_trade_3", description: "Complete 3 trades", target: 3, gems: 7, type: "weekly", icon: "🤝" },
  { id: "weekly_collect_rent", description: "Collect rent 15 times", target: 15, gems: 6, type: "weekly", icon: "💵" },
  { id: "weekly_monopoly", description: "Complete a monopoly", target: 1, gems: 8, type: "weekly", icon: "🏘️" },
];

export const ALL_GOALS = [...DAILY_GOALS, ...WEEKLY_GOALS];
export const GOALS_MAP = new Map(ALL_GOALS.map((g) => [g.id, g]));
