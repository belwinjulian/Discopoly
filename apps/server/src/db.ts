import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "discopoly.db");

const FREE_PIECES = ["car", "tophat", "dog", "rocket", "bolt", "guitar"];
const STARTING_GEMS = 30;

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    discord_user_id TEXT PRIMARY KEY,
    gems INTEGER NOT NULL DEFAULT ${STARTING_GEMS},
    owned_pieces TEXT NOT NULL DEFAULT '${JSON.stringify(FREE_PIECES)}',
    selected_piece TEXT NOT NULL DEFAULT 'car',
    owned_cosmetics TEXT NOT NULL DEFAULT '[]',
    equipped_title TEXT NOT NULL DEFAULT '',
    equipped_theme TEXT NOT NULL DEFAULT 'classic',
    equipped_dice TEXT NOT NULL DEFAULT 'standard'
  )
`);

// Add new columns to existing players table if they don't exist
try { db.exec("ALTER TABLE players ADD COLUMN owned_cosmetics TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE players ADD COLUMN equipped_title TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE players ADD COLUMN equipped_theme TEXT NOT NULL DEFAULT 'classic'"); } catch {}
try { db.exec("ALTER TABLE players ADD COLUMN equipped_dice TEXT NOT NULL DEFAULT 'standard'"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS player_stats (
    discord_user_id TEXT PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_coins_earned INTEGER DEFAULT 0,
    properties_bought INTEGER DEFAULT 0,
    hotels_built INTEGER DEFAULT 0,
    houses_built INTEGER DEFAULT 0,
    rent_collected_total INTEGER DEFAULT 0,
    bankrupted_opponents INTEGER DEFAULT 0,
    trades_completed INTEGER DEFAULT 0,
    auctions_won INTEGER DEFAULT 0,
    jail_escapes INTEGER DEFAULT 0,
    paydays_collected INTEGER DEFAULT 0,
    dice_rolls INTEGER DEFAULT 0,
    doubles_rolled INTEGER DEFAULT 0,
    monopolies_completed INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_achievements (
    discord_user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 1,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (discord_user_id, achievement_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_goals (
    discord_user_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT 0,
    reset_date TEXT NOT NULL,
    PRIMARY KEY (discord_user_id, goal_id, reset_date)
  )
`);

// ==================== Player Data ====================

export interface PlayerData {
  discord_user_id: string;
  gems: number;
  owned_pieces: string[];
  selected_piece: string;
  owned_cosmetics: string[];
  equipped_title: string;
  equipped_theme: string;
  equipped_dice: string;
}

function rowToPlayerData(row: any): PlayerData {
  return {
    discord_user_id: row.discord_user_id,
    gems: row.gems,
    owned_pieces: JSON.parse(row.owned_pieces),
    selected_piece: row.selected_piece,
    owned_cosmetics: JSON.parse(row.owned_cosmetics),
    equipped_title: row.equipped_title || "",
    equipped_theme: row.equipped_theme || "classic",
    equipped_dice: row.equipped_dice || "standard",
  };
}

export function getPlayer(discordUserId: string): PlayerData {
  const row = db
    .prepare("SELECT * FROM players WHERE discord_user_id = ?")
    .get(discordUserId) as any;

  if (!row) {
    db.prepare(
      "INSERT INTO players (discord_user_id, gems, owned_pieces, selected_piece, owned_cosmetics, equipped_title, equipped_theme, equipped_dice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(discordUserId, STARTING_GEMS, JSON.stringify(FREE_PIECES), "car", "[]", "", "classic", "standard");

    return {
      discord_user_id: discordUserId,
      gems: STARTING_GEMS,
      owned_pieces: [...FREE_PIECES],
      selected_piece: "car",
      owned_cosmetics: [],
      equipped_title: "",
      equipped_theme: "classic",
      equipped_dice: "standard",
    };
  }

  return rowToPlayerData(row);
}

export function updateGems(discordUserId: string, amount: number): number {
  getPlayer(discordUserId);

  db.prepare("UPDATE players SET gems = gems + ? WHERE discord_user_id = ?").run(
    amount,
    discordUserId
  );

  const row = db
    .prepare("SELECT gems FROM players WHERE discord_user_id = ?")
    .get(discordUserId) as any;

  return row.gems;
}

export function buyPiece(
  discordUserId: string,
  pieceId: string,
  cost: number
): PlayerData | null {
  const player = getPlayer(discordUserId);

  if (player.owned_pieces.includes(pieceId)) return null;
  if (player.gems < cost) return null;

  const newPieces = [...player.owned_pieces, pieceId];

  db.prepare(
    "UPDATE players SET gems = gems - ?, owned_pieces = ? WHERE discord_user_id = ?"
  ).run(cost, JSON.stringify(newPieces), discordUserId);

  return getPlayer(discordUserId);
}

export function selectPiece(discordUserId: string, pieceId: string): boolean {
  const player = getPlayer(discordUserId);

  if (!player.owned_pieces.includes(pieceId)) return false;

  db.prepare(
    "UPDATE players SET selected_piece = ? WHERE discord_user_id = ?"
  ).run(pieceId, discordUserId);

  return true;
}

// ==================== Cosmetics ====================

export function buyCosmetic(
  discordUserId: string,
  cosmeticId: string,
  cost: number
): PlayerData | null {
  const player = getPlayer(discordUserId);

  if (player.owned_cosmetics.includes(cosmeticId)) return null;
  if (player.gems < cost) return null;

  const newCosmetics = [...player.owned_cosmetics, cosmeticId];

  db.prepare(
    "UPDATE players SET gems = gems - ?, owned_cosmetics = ? WHERE discord_user_id = ?"
  ).run(cost, JSON.stringify(newCosmetics), discordUserId);

  return getPlayer(discordUserId);
}

export function equipCosmetic(
  discordUserId: string,
  type: "title" | "theme" | "dice",
  itemId: string
): boolean {
  const player = getPlayer(discordUserId);

  // Free defaults don't need to be owned
  const freeDefaults = ["classic", "standard", ""];
  if (!freeDefaults.includes(itemId) && !player.owned_cosmetics.includes(itemId)) {
    return false;
  }

  const column = type === "title" ? "equipped_title" : type === "theme" ? "equipped_theme" : "equipped_dice";
  db.prepare(`UPDATE players SET ${column} = ? WHERE discord_user_id = ?`).run(itemId, discordUserId);
  return true;
}

// ==================== Player Stats ====================

export interface PlayerStats {
  discord_user_id: string;
  games_played: number;
  games_won: number;
  total_coins_earned: number;
  properties_bought: number;
  hotels_built: number;
  houses_built: number;
  rent_collected_total: number;
  bankrupted_opponents: number;
  trades_completed: number;
  auctions_won: number;
  jail_escapes: number;
  paydays_collected: number;
  dice_rolls: number;
  doubles_rolled: number;
  monopolies_completed: number;
}

export function getPlayerStats(discordUserId: string): PlayerStats {
  const row = db
    .prepare("SELECT * FROM player_stats WHERE discord_user_id = ?")
    .get(discordUserId) as any;

  if (!row) {
    db.prepare("INSERT INTO player_stats (discord_user_id) VALUES (?)").run(discordUserId);
    return {
      discord_user_id: discordUserId,
      games_played: 0, games_won: 0, total_coins_earned: 0,
      properties_bought: 0, hotels_built: 0, houses_built: 0,
      rent_collected_total: 0, bankrupted_opponents: 0, trades_completed: 0,
      auctions_won: 0, jail_escapes: 0, paydays_collected: 0,
      dice_rolls: 0, doubles_rolled: 0, monopolies_completed: 0,
    };
  }

  return row as PlayerStats;
}

export function incrementStat(discordUserId: string, stat: keyof Omit<PlayerStats, "discord_user_id">, amount: number = 1): PlayerStats {
  getPlayerStats(discordUserId); // Ensure row exists
  db.prepare(`UPDATE player_stats SET ${stat} = ${stat} + ? WHERE discord_user_id = ?`).run(amount, discordUserId);
  return getPlayerStats(discordUserId);
}

// ==================== Achievements ====================

export interface PlayerAchievement {
  discord_user_id: string;
  achievement_id: string;
  tier: number;
  unlocked_at: string;
}

export function getPlayerAchievements(discordUserId: string): PlayerAchievement[] {
  return db
    .prepare("SELECT * FROM player_achievements WHERE discord_user_id = ?")
    .all(discordUserId) as PlayerAchievement[];
}

export function getPlayerAchievement(discordUserId: string, achievementId: string): PlayerAchievement | null {
  const row = db
    .prepare("SELECT * FROM player_achievements WHERE discord_user_id = ? AND achievement_id = ?")
    .get(discordUserId, achievementId) as any;
  return row || null;
}

export function unlockAchievement(discordUserId: string, achievementId: string, tier: number = 1): void {
  db.prepare(`
    INSERT INTO player_achievements (discord_user_id, achievement_id, tier, unlocked_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (discord_user_id, achievement_id) DO UPDATE SET tier = ?, unlocked_at = ?
  `).run(discordUserId, achievementId, tier, new Date().toISOString(), tier, new Date().toISOString());
}

// ==================== Goals ====================

export interface PlayerGoal {
  discord_user_id: string;
  goal_id: string;
  progress: number;
  completed: boolean;
  reset_date: string;
}

export function getPlayerGoals(discordUserId: string, resetDate: string): PlayerGoal[] {
  return db
    .prepare("SELECT * FROM player_goals WHERE discord_user_id = ? AND reset_date = ?")
    .all(discordUserId, resetDate) as PlayerGoal[];
}

export function getPlayerGoal(discordUserId: string, goalId: string, resetDate: string): PlayerGoal | null {
  const row = db
    .prepare("SELECT * FROM player_goals WHERE discord_user_id = ? AND goal_id = ? AND reset_date = ?")
    .get(discordUserId, goalId, resetDate) as any;
  return row || null;
}

export function incrementGoalProgress(discordUserId: string, goalId: string, resetDate: string, amount: number = 1): PlayerGoal {
  const existing = getPlayerGoal(discordUserId, goalId, resetDate);
  if (!existing) {
    db.prepare(
      "INSERT INTO player_goals (discord_user_id, goal_id, progress, completed, reset_date) VALUES (?, ?, ?, 0, ?)"
    ).run(discordUserId, goalId, amount, resetDate);
  } else {
    db.prepare(
      "UPDATE player_goals SET progress = progress + ? WHERE discord_user_id = ? AND goal_id = ? AND reset_date = ?"
    ).run(amount, discordUserId, goalId, resetDate);
  }
  return getPlayerGoal(discordUserId, goalId, resetDate)!;
}

export function completeGoal(discordUserId: string, goalId: string, resetDate: string): void {
  db.prepare(
    "UPDATE player_goals SET completed = 1 WHERE discord_user_id = ? AND goal_id = ? AND reset_date = ?"
  ).run(discordUserId, goalId, resetDate);
}

export default db;
