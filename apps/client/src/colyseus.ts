import { Client, Room } from "@colyseus/sdk";

// Use relative path "/colyseus" so requests go through Discord's proxy.
// Discord's URL Mapping with prefix "/colyseus" forwards to the tunnel,
// and Vite's dev proxy rewrites "/colyseus" → localhost:2567.
const client = new Client("/colyseus");

export interface JoinOptions {
  discordUserId: string;
  displayName: string;
  avatarUrl: string;
  accessToken?: string;
  channelId?: string;
}

/**
 * Join or create a game room.
 */
export async function joinOrCreateGame(options: JoinOptions): Promise<Room> {
  try {
    const room = await client.joinOrCreate("game", options);
    console.log("Joined room:", room.roomId);
    return room;
  } catch (error) {
    console.error("Failed to join room:", error);
    throw error;
  }
}

/**
 * Get the Colyseus client instance.
 */
export function getColyseusClient(): Client {
  return client;
}
