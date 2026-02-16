import { Client, Room } from "@colyseus/sdk";

// In dev: "/colyseus" routes through Vite proxy → localhost:2567
// In prod: connect directly (no prefix needed, same server serves client)
const isDev = import.meta.env.DEV;
const client = new Client(isDev ? "/colyseus" : "/");

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
