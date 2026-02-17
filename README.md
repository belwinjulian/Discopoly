# Discopoly

A Monopoly-inspired city-building board game that runs directly inside **Discord voice channels**. Roll dice, buy properties, collect rent, and bankrupt your friends — all without leaving Discord.

**[Add Discopoly to your server](https://discord.com/oauth2/authorize?client_id=1470907522444558481)**

---

## How to Play

1. **Add the bot** to your Discord server using the link above
2. **Join a voice channel** in your server
3. Click the **Activities** rocket icon in the voice channel toolbar
4. Select **Landlord Tycoon** from the list
5. Wait for friends to join, then the host clicks **Start Game**

That's it — no downloads, no sign-ups, no extra setup.

---

## Game Overview

- **2-6 players** per game
- **28-space board** with 8 city districts
- Roll dice, buy properties, collect rent, and outplay your opponents
- Players start with **1,500 coins**
- Collect **200 coins** each time you pass Payday
- Last player standing wins — or the wealthiest after 50 rounds

### Special Spaces

| Space | Effect |
|-------|--------|
| Payday | Collect 200 coins when you pass |
| Tax | Pay a fixed tax to the bank |
| Traffic Jam | Skip your next turn |
| Detour | Sent to Traffic Jam |

### City Districts

| District | Properties | Price Range |
|----------|-----------|-------------|
| Suburbs | 2 | 60 - 80 |
| Arts District | 3 | 100 - 140 |
| Midtown | 3 | 160 - 200 |
| University | 3 | 220 - 260 |
| Waterfront | 3 | 280 - 320 |
| Financial | 3 | 340 - 380 |
| Uptown | 2 | 400 - 420 |
| Luxury Row | 1 | 450 |

### Features

- Animated dice rolls and board pieces
- Property auctions and player-to-player trading
- In-game store with cosmetic pieces
- Achievement and goals system
- Turn timer to keep games moving
- Real-time game log

---

## Self-Hosting / Development

Want to run your own instance? Discopoly is open source.

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- A [Discord Application](https://discord.com/developers/applications) with Activities enabled
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for local tunneling

### Discord Developer Portal Setup

1. Create a new application at the [Discord Developer Portal](https://discord.com/developers/applications)
2. Under **OAuth2**, copy your **Client ID** and **Client Secret**
3. Under **OAuth2 > Redirects**, add your tunnel URL (e.g. `https://your-tunnel.trycloudflare.com`)
4. Under **Activities**, enable the Activity and configure:
   - **URL Mappings > Root Mapping > Target**: your tunnel URL (for dev)
   - **URL Mappings > Prefix `/colyseus` > Target**: your server URL (for production)
5. Under **Activities > Supported Platforms**, enable Desktop, Web, and/or Mobile

### Quick Start

```bash
# Clone the repo
git clone https://github.com/belwinjulian/Discopoly.git
cd Discopoly

# Install dependencies
npm install

# Set up environment variables
cp apps/client/.env.example apps/client/.env
cp apps/server/.env.example apps/server/.env
```

Fill in your Discord credentials in both `.env` files:

- `apps/client/.env` — set `VITE_DISCORD_CLIENT_ID`
- `apps/server/.env` — set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`

Then start the dev servers in three terminals:

```bash
# Terminal 1 — Colyseus game server
npm run start:server

# Terminal 2 — Vite dev client
npm run start:client

# Terminal 3 — Cloudflare tunnel
npm run cloudflared
```

> **Note:** Cloudflare generates a new URL each run. Update your Discord app's OAuth2 Redirect URL and Activity URL Mappings to match.

Open Discord, join a voice channel, launch the Activity, and you're in.

### Project Structure

```
Discopoly/
  apps/
    client/          # React + Vite + TypeScript
      src/
        components/  # Board, Lobby, Modals, etc.
        hooks/       # Game state management
        data/        # Board layout, cosmetics, pieces
        styles/      # CSS
    server/          # Colyseus + Express + TypeScript
      src/
        rooms/       # GameRoom handler
        state/       # Colyseus Schema definitions
        logic/       # Game rules engine
```

### Tech Stack

- **Client**: React 18, TypeScript, Vite, Discord Embedded App SDK, Colyseus SDK
- **Server**: Node.js, Colyseus 0.17, Express, better-sqlite3
- **Communication**: WebSockets (Colyseus protocol)

---

## License

MIT
