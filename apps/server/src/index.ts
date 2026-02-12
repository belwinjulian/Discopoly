import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";
import { getPlayer, buyPiece } from "./db.js";
import { getPiece } from "./pieces.js";

const PORT = Number(process.env.PORT) || 2567;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";

const gameServer = new Server({
  express: (app) => {
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

    // Discord OAuth2 token exchange + user info endpoint
    // Client sends the auth code, server exchanges it for token + fetches user profile
    app.post("/discord_token", async (req: any, res: any) => {
      const { code } = req.body || {};
      if (!code) {
        res.status(400).json({ error: "Missing code" });
        return;
      }

      try {
        // Exchange code for access token
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

        // Fetch user profile
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
    });

    // Get player profile (gems, pieces, selected piece)
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
  },
});

// Register game room
gameServer.define("game", GameRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Discopoly server listening on port ${PORT}`);
});
