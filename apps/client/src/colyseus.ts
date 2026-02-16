import { Client, Room } from "@colyseus/sdk";

// In dev: "/colyseus" routes through Vite proxy → localhost:2567
// In prod: "" routes through Discord's "/" URL mapping → Railway server directly
const colyseusEndpoint = import.meta.env.VITE_COLYSEUS_URL ?? "/colyseus";
const client = new Client(colyseusEndpoint);

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
