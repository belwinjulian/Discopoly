import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Handle /api/token directly in Vite's dev server
// so it works inside Discord's Activity iframe proxy
function apiTokenPlugin(): Plugin {
  return {
    name: "api-token-handler",
    configureServer(server) {
      server.middlewares.use("/api/token", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        // Read the request body
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        let code: string;
        try {
          code = JSON.parse(body).code;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing code" }));
          return;
        }

        try {
          // Load all env vars (including non-VITE_ prefixed ones)
          const env = loadEnv("development", process.cwd(), "");
          const DISCORD_CLIENT_ID = env.VITE_DISCORD_CLIENT_ID || "";
          const DISCORD_CLIENT_SECRET = env.DISCORD_CLIENT_SECRET || "";

          const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: `https://${DISCORD_CLIENT_ID}.discordusercontent.com`,
              }),
            }
          );

          const data = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error("Discord token exchange failed:", data);
            res.writeHead(tokenResponse.status, {
              "Content-Type": "application/json",
            });
            res.end(JSON.stringify({ error: "Token exchange failed", details: data }));
            return;
          }

          // Fetch user profile with the access token
          let user = null;
          try {
            const userResponse = await fetch("https://discord.com/api/users/@me", {
              headers: { Authorization: `Bearer ${data.access_token}` },
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              user = {
                id: userData.id,
                username: userData.username,
                global_name: userData.global_name,
                avatar: userData.avatar,
                discriminator: userData.discriminator,
              };
              console.log(`Discord auth success: ${user.global_name || user.username} (${user.id})`);
            }
          } catch (e) {
            console.error("Failed to fetch Discord user profile:", e);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ access_token: data.access_token, user }));
        } catch (error) {
          console.error("Token exchange error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [apiTokenPlugin(), react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
});
