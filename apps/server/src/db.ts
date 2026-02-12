import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "discopoly.db");

const FREE_PIECES = ["car", "tophat", "dog", "rocket", "bolt", "guitar"];
const STARTING_GEMS = 30;

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    discord_user_id TEXT PRIMARY KEY,
    gems INTEGER NOT NULL DEFAULT ${STARTING_GEMS},
    owned_pieces TEXT NOT NULL DEFAULT '${JSON.stringify(FREE_PIECES)}',
    selected_piece TEXT NOT NULL DEFAULT 'car'
  )
`);

export interface PlayerData {
  discord_user_id: string;
  gems: number;
  owned_pieces: string[];
  selected_piece: string;
}

/**
 * Get or create a player record by Discord user ID.
 */
export function getPlayer(discordUserId: string): PlayerData {
  const row = db
    .prepare("SELECT * FROM players WHERE discord_user_id = ?")
    .get(discordUserId) as any;

  if (!row) {
    // Create new player with defaults
    db.prepare(
      "INSERT INTO players (discord_user_id, gems, owned_pieces, selected_piece) VALUES (?, ?, ?, ?)"
    ).run(discordUserId, STARTING_GEMS, JSON.stringify(FREE_PIECES), "car");

    return {
      discord_user_id: discordUserId,
      gems: STARTING_GEMS,
      owned_pieces: [...FREE_PIECES],
      selected_piece: "car",
    };
  }

  return {
    discord_user_id: row.discord_user_id,
    gems: row.gems,
    owned_pieces: JSON.parse(row.owned_pieces),
    selected_piece: row.selected_piece,
  };
}

/**
 * Update a player's gem count (add or subtract).
 */
export function updateGems(discordUserId: string, amount: number): number {
  // Ensure player exists
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

/**
 * Buy a piece for a player. Returns updated player data or null if failed.
 */
export function buyPiece(
  discordUserId: string,
  pieceId: string,
  cost: number
): PlayerData | null {
  const player = getPlayer(discordUserId);

  // Check if already owned
  if (player.owned_pieces.includes(pieceId)) {
    return null;
  }

  // Check if enough gems
  if (player.gems < cost) {
    return null;
  }

  const newPieces = [...player.owned_pieces, pieceId];

  db.prepare(
    "UPDATE players SET gems = gems - ?, owned_pieces = ? WHERE discord_user_id = ?"
  ).run(cost, JSON.stringify(newPieces), discordUserId);

  return getPlayer(discordUserId);
}

/**
 * Select a piece for a player. Returns true if successful.
 */
export function selectPiece(discordUserId: string, pieceId: string): boolean {
  const player = getPlayer(discordUserId);

  if (!player.owned_pieces.includes(pieceId)) {
    return false;
  }

  db.prepare(
    "UPDATE players SET selected_piece = ? WHERE discord_user_id = ?"
  ).run(pieceId, discordUserId);

  return true;
}

export default db;
