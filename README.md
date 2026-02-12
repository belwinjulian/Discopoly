# Discopoly

A Monopoly-inspired city-building board game that runs as a **Discord Activity** inside voice channels. Built with React + TypeScript (client) and Colyseus (server).

## Features

- **2-6 players** in a turn-based board game
- **28-space board** with 8 city districts to build your empire
- Roll dice, buy properties, collect rent, and bankrupt your opponents
- Runs directly inside Discord voice channels as an embedded Activity
- Real-time multiplayer via Colyseus state synchronization

## Project Structure

```
Discopoly/
  package.json                # Root workspace config (npm workspaces)
  apps/
    client/                   # React + Vite + TypeScript frontend
      src/
        components/           # React UI components (Board, Lobby, etc.)
        hooks/                # Custom hooks (useGameState)
        data/                 # Board space definitions, colors
        styles/               # CSS stylesheets
    server/                   # Colyseus + TypeScript backend
      src/
        rooms/                # GameRoom handler
        state/                # Colyseus Schema definitions
        logic/                # Game rules and board config
```

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Discord Application](https://discord.com/developers/applications) with Activities enabled
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for local tunnel (or ngrok)

## Discord Developer Portal Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Under **OAuth2**, copy your **Client ID** and **Client Secret**
3. Under **OAuth2 > Redirects**, add your tunnel URL (e.g., `https://your-tunnel.trycloudflare.com`)
4. Under **Activities**, enable the Activity and configure:
   - **URL Mappings > Root Mapping > Target**: Your client URL (tunnel URL for dev)
   - **URL Mappings > Prefix `/colyseus` > Target**: Your server URL (for production)
5. Under **Activities > Supported Platforms**, enable Desktop, Web, and/or Mobile

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example env files and fill in your Discord credentials:

```bash
cp apps/client/.env.example apps/client/.env
cp apps/server/.env.example apps/server/.env
```

Edit both `.env` files with your Discord Application's Client ID (and Client Secret for the server).

### 3. Start Development Servers

Open three terminal windows:

**Terminal 1 - Start the Colyseus server:**
```bash
npm run start:server
```

**Terminal 2 - Start the Vite client:**
```bash
npm run start:client
```

**Terminal 3 - Start the cloudflared tunnel:**
```bash
npm run cloudflared
```

> **Note:** Each time you run cloudflared, it generates a new URL. Update your Discord Application's OAuth2 Redirect URL and URL Mappings to match.

### 4. Test in Discord

1. Open Discord and join a voice channel
2. Click the Activities rocket icon
3. Select your application from the list
4. The game lobby should appear - invite others to join!

## Game Rules

- Each player starts with **1,500 coins**
- Roll 2 dice and move around the 28-space board
- **Land on an unowned property**: choose to buy it at the listed price
- **Land on an owned property**: pay rent to the owner
- **Pass Payday**: collect 200 coins
- **Traffic Jam**: skip your next turn
- **Detour**: sent to Traffic Jam
- **Tax spaces**: pay a fixed tax to the bank
- **Bankruptcy**: if you can't pay, you're eliminated and properties return to the bank
- **Win**: be the last player standing, or have the most wealth after 50 rounds

## City Districts

| District | Properties | Price Range |
|----------|-----------|-------------|
| Suburbs | 2 | 60-80 |
| Arts District | 3 | 100-140 |
| Midtown | 3 | 160-200 |
| University | 3 | 220-260 |
| Waterfront | 3 | 280-320 |
| Financial | 3 | 340-380 |
| Uptown | 2 | 400-420 |
| Luxury Row | 1 | 450 |

## Tech Stack

- **Client**: React 18, TypeScript, Vite, @discord/embedded-app-sdk, @colyseus/sdk
- **Server**: Node.js, Colyseus 0.17, Express, TypeScript
- **Communication**: WebSockets (Colyseus protocol)

## License

MIT
