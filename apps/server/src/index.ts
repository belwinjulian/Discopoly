import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import cors from "cors";
import express from "express";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";
import { getPlayer, buyPiece, buyCosmetic, equipCosmetic, getPlayerStats, getPlayerAchievements } from "./db.js";
import { getPiece } from "./pieces.js";
import { getCosmetic, ALL_COSMETICS } from "./cosmetics.js";
import { getPlayerCurrentGoals } from "./goals.js";
import { ACHIEVEMENTS } from "./achievements.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 2567;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";

const gameServer = new Server({
  gracefullyShutdown: false,
  express: (app) => {
    app.use(cors());

    // Strip /colyseus prefix — Discord's URL mapping passes the full path through
    app.use((req: any, _res: any, next: any) => {
      if (req.url.startsWith("/colyseus")) {
        req.url = req.url.replace(/^\/colyseus/, "") || "/";
      }
      next();
    });

    app.use((req: any, _res: any, next: any) => {
      if (req.headers["content-type"]?.includes("application/json")) {
        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try { req.body = JSON.parse(body); } catch { req.body = {}; }
          next();
        });
      } else {
        next();
      }
    });

    app.get("/health", (_req: any, res: any) => {
      res.json({ status: "ok", game: "discopoly" });
    });

    // Discord OAuth2 token exchange handler (shared between /discord_token and /api/token)
    const handleTokenExchange = async (req: any, res: any) => {
      const { code } = req.body || {};
      if (!code) {
        res.status(400).json({ error: "Missing code" });
        return;
      }

      try {
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: `https://${DISCORD_CLIENT_ID}.discordusercontent.com`,
          }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (!tokenResponse.ok) {
          console.error("Discord token exchange failed:", tokenData);
          res.status(tokenResponse.status).json({ error: "Token exchange failed", details: tokenData });
          return;
        }

        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json() as any;

        if (!userResponse.ok) {
          console.error("Discord user fetch failed:", userData);
          res.status(userResponse.status).json({ error: "User fetch failed" });
          return;
        }

        console.log(`Discord auth success: ${userData.global_name || userData.username} (${userData.id})`);

        res.json({
          access_token: tokenData.access_token,
          user: {
            id: userData.id,
            username: userData.username,
            global_name: userData.global_name,
            avatar: userData.avatar,
            discriminator: userData.discriminator,
          },
        });
      } catch (error) {
        console.error("Token exchange error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    };

    app.post("/discord_token", handleTokenExchange);
    app.post("/api/token", handleTokenExchange);

    // Get player profile
    app.get("/player/:discordUserId", (req: any, res: any) => {
      const { discordUserId } = req.params;
      if (!discordUserId) {
        res.status(400).json({ error: "Missing discordUserId" });
        return;
      }
      try {
        const player = getPlayer(discordUserId);
        res.json(player);
      } catch (error) {
        console.error("Get player error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Buy a piece from the store
    app.post("/store/buy", (req: any, res: any) => {
      const { discordUserId, pieceId } = req.body || {};
      if (!discordUserId || !pieceId) {
        res.status(400).json({ error: "Missing discordUserId or pieceId" });
        return;
      }

      const piece = getPiece(pieceId);
      if (!piece) {
        res.status(400).json({ error: "Invalid piece" });
        return;
      }

      if (piece.cost === 0) {
        res.status(400).json({ error: "This piece is free and already owned" });
        return;
      }

      const result = buyPiece(discordUserId, pieceId, piece.cost);
      if (!result) {
        res.status(400).json({ error: "Cannot buy piece - not enough gems or already owned" });
        return;
      }

      console.log(`Player ${discordUserId} bought piece ${pieceId} for ${piece.cost} gems`);
      res.json(result);
    });

    // ==================== Cosmetics Endpoints ====================

    // List all cosmetics
    app.get("/store/cosmetics", (_req: any, res: any) => {
      res.json(ALL_COSMETICS);
    });

    // Buy a cosmetic
    app.post("/store/buy-cosmetic", (req: any, res: any) => {
      const { discordUserId, cosmeticId } = req.body || {};
      if (!discordUserId || !cosmeticId) {
        res.status(400).json({ error: "Missing discordUserId or cosmeticId" });
        return;
      }

      const cosmetic = getCosmetic(cosmeticId);
      if (!cosmetic) {
        res.status(400).json({ error: "Invalid cosmetic" });
        return;
      }

      if (cosmetic.cost === 0) {
        res.status(400).json({ error: "This cosmetic is free" });
        return;
      }

      const result = buyCosmetic(discordUserId, cosmeticId, cosmetic.cost);
      if (!result) {
        res.status(400).json({ error: "Cannot buy cosmetic - not enough gems or already owned" });
        return;
      }

      console.log(`Player ${discordUserId} bought cosmetic ${cosmeticId} for ${cosmetic.cost} gems`);
      res.json(result);
    });

    // Equip a cosmetic
    app.post("/store/equip", (req: any, res: any) => {
      const { discordUserId, type, itemId } = req.body || {};
      if (!discordUserId || !type || itemId === undefined) {
        res.status(400).json({ error: "Missing discordUserId, type, or itemId" });
        return;
      }

      if (!["title", "theme", "dice"].includes(type)) {
        res.status(400).json({ error: "Invalid type. Must be title, theme, or dice" });
        return;
      }

      const success = equipCosmetic(discordUserId, type, itemId);
      if (!success) {
        res.status(400).json({ error: "Cannot equip - item not owned" });
        return;
      }

      const player = getPlayer(discordUserId);
      res.json(player);
    });

    // ==================== Goals Endpoint ====================

    app.get("/player/:discordUserId/goals", (req: any, res: any) => {
      const { discordUserId } = req.params;
      if (!discordUserId) {
        res.status(400).json({ error: "Missing discordUserId" });
        return;
      }
      try {
        const goals = getPlayerCurrentGoals(discordUserId);
        res.json(goals);
      } catch (error) {
        console.error("Get goals error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // ==================== Achievements Endpoint ====================

    app.get("/player/:discordUserId/achievements", (req: any, res: any) => {
      const { discordUserId } = req.params;
      if (!discordUserId) {
        res.status(400).json({ error: "Missing discordUserId" });
        return;
      }
      try {
        const unlocked = getPlayerAchievements(discordUserId);
        const stats = getPlayerStats(discordUserId);
        res.json({
          definitions: ACHIEVEMENTS,
          unlocked,
          stats,
        });
      } catch (error) {
        console.error("Get achievements error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // ==================== Stats Endpoint ====================

    app.get("/player/:discordUserId/stats", (req: any, res: any) => {
      const { discordUserId } = req.params;
      if (!discordUserId) {
        res.status(400).json({ error: "Missing discordUserId" });
        return;
      }
      try {
        const stats = getPlayerStats(discordUserId);
        res.json(stats);
      } catch (error) {
        console.error("Get stats error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // ==================== Static File Serving (Production) ====================

    const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");
    if (existsSync(clientDistPath)) {
      app.use(express.static(clientDistPath));
      app.get("*", (_req: any, res: any) => {
        res.sendFile(path.join(clientDistPath, "index.html"));
      });
      console.log(`Serving client from ${clientDistPath}`);
    }
  },
});

// Register game room — filterBy channelId so each voice channel gets its own room
gameServer.define("game", GameRoom).filterBy(["channelId"]);

gameServer.listen(PORT).then(() => {
  console.log(`Discopoly server listening on port ${PORT}`);
});

// ==================== Graceful Shutdown ====================

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await gameServer.gracefullyShutdown();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});
