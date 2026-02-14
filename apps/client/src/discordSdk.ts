import { DiscordSDK } from "@discord/embedded-app-sdk";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

let discordSdk: DiscordSDK | null = null;
let isReady = false;

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  global_name: string | null;
}

let currentUser: DiscordUser | null = null;
let accessToken: string | null = null;
let authCode: string | null = null;
let channelId: string | null = null;

/**
 * Initialize the Discord Embedded App SDK.
 * Returns the authenticated user info.
 * Cached to prevent double-initialization (React strict mode calls useEffect twice).
 */
let initPromise: Promise<DiscordUser | null> | null = null;

export function initDiscordSdk(): Promise<DiscordUser | null> {
  if (!initPromise) {
    initPromise = doInitDiscordSdk();
  }
  return initPromise;
}

async function doInitDiscordSdk(): Promise<DiscordUser | null> {
  if (!DISCORD_CLIENT_ID) {
    console.warn("VITE_DISCORD_CLIENT_ID not set. Running in standalone mode.");
    // Return a mock user for local development without Discord
    return {
      id: "dev-user-" + Math.random().toString(36).substring(7),
      username: "DevPlayer",
      avatar: null,
      discriminator: "0000",
      global_name: "Dev Player",
    };
  }

  try {
    discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);

    // Add timeout to ready() - it hangs if not in Discord iframe
    console.log("[Discord] Waiting for SDK ready...");
    await Promise.race([
      discordSdk.ready(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Discord SDK ready() timed out")), 8000)
      ),
    ]);
    isReady = true;
    channelId = discordSdk.channelId;
    console.log("[Discord] SDK ready! channelId:", channelId);

    // Authorize with Discord
    console.log("[Discord] Requesting authorization...");
    const { code } = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"],
    });
    console.log("[Discord] Got auth code");

    // Exchange the code for an access token + user info
    // Try /api/token first (Vite middleware, always available), then /colyseus/discord_token (proxy)
    console.log("[Discord] Exchanging code for token...");
    let access_token: string | null = null;
    let user: any = null;

    // Primary: /api/token (handled directly by Vite dev server)
    try {
      const tokenRes = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (tokenRes.ok) {
        const data = await tokenRes.json();
        access_token = data.access_token;
        // Save module-level token IMMEDIATELY so getAccessToken() works
        // even if later steps fail
        if (access_token) accessToken = access_token;
        user = data.user;
        console.log("[Discord] /api/token success:", user?.global_name || user?.username);
      } else {
        console.warn("[Discord] /api/token failed status:", tokenRes.status, "trying fallback...");
      }
    } catch (e) {
      console.warn("[Discord] /api/token error, trying fallback...", e);
    }

    // Fallback: /colyseus/discord_token (proxied to Colyseus server)
    if (!access_token) {
      const tokenRes = await fetch("/colyseus/discord_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        console.error("[Discord] Token exchange failed:", errData);
        throw new Error("Token exchange failed");
      }
      const data = await tokenRes.json();
      access_token = data.access_token;
      if (access_token) accessToken = access_token;
      user = data.user;
      console.log("[Discord] /colyseus/discord_token success:", user?.global_name || user?.username);
    }

    if (!access_token) {
      throw new Error("No access token received");
    }

    console.log("[Discord] Got token and user:", user?.global_name || user?.username);

    accessToken = access_token;

    // Save the user data immediately so we have it even if authenticate() fails
    if (user) {
      currentUser = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        discriminator: user.discriminator || "0",
        global_name: user.global_name,
      };
    }

    // Authenticate with Discord SDK - required for full SDK features
    // but not required for having the user's identity
    try {
      console.log("[Discord] Authenticating SDK...");
      await discordSdk.commands.authenticate({ access_token });
      console.log("[Discord] SDK authenticated!");
    } catch (authErr) {
      console.warn("[Discord] SDK authenticate() failed (user data still available):", authErr);
    }

    // Return the real user if we have it
    if (currentUser) {
      return currentUser;
    }

    // If we somehow have a token but no user, throw to trigger fallback
    throw new Error("Token received but no user data");
  } catch (error) {
    console.error("[Discord] Failed to initialize:", error);

    // If we already captured the real user during partial auth, return it
    if (currentUser) {
      console.log("[Discord] Using previously captured user:", currentUser.global_name || currentUser.username);
      return currentUser;
    }

    // Fallback to mock user for development
    return {
      id: "dev-user-" + Math.random().toString(36).substring(7),
      username: "DevPlayer",
      avatar: null,
      discriminator: "0000",
      global_name: "Dev Player",
    };
  }
}

/**
 * Get the current Discord user.
 */
export function getDiscordUser(): DiscordUser | null {
  return currentUser;
}

/**
 * Get the Discord SDK instance.
 */
export function getDiscordSdk(): DiscordSDK | null {
  return discordSdk;
}

/**
 * Get the access token obtained during init.
 * Available even if initDiscordSdk() falls back to mock user.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Get the Discord auth code for server-side token exchange.
 */
export function getAuthCode(): string | null {
  return authCode;
}

/**
 * Get the channel ID for the current Discord voice channel.
 * Used to scope Colyseus rooms to specific voice channels.
 */
export function getChannelId(): string | null {
  return channelId;
}

/**
 * Get the Discord avatar URL for a user.
 */
export function getAvatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  // Default avatar
  const defaultIndex = Number(user.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}
