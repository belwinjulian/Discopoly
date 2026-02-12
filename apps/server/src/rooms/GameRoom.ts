import { Room, Client } from "colyseus";
import { GameState, Player } from "../state/GameState.js";
import { STARTING_COINS } from "../logic/boardConfig.js";
import {
  initializeBoard,
  rollDice,
  getCurrentPlayer,
  getActivePlayers,
  movePlayer,
  processLanding,
  buyProperty,
  skipBuy,
  advanceTurn,
  checkGameOver,
  buildHouse,
  buildHotel,
  getBuildableProperties,
  getHotelUpgradeableProperties,
  validateTradeOffer,
  executeTrade,
  clearTrade,
  drawCard,
  clearDrawnCard,
} from "../logic/gameLogic.js";
import { shuffleDeck, COMMUNITY_CARDS, CHANCE_CARDS } from "../logic/cardData.js";
import { getPlayer, selectPiece, updateGems } from "../db.js";
import { PIECES } from "../pieces.js";

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 1; // TODO: change back to 2 for production

interface JoinOptions {
  discordUserId?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken?: string;
}

export class GameRoom extends Room<{ state: GameState }> {
  private playerOrder: string[] = [];
  private gemsAwarded: boolean = false;
  private communityDeck: string[] = [];
  private chanceDeck: string[] = [];

  onCreate(): void {
    this.state = new GameState();
    initializeBoard(this.state);

    this.maxClients = MAX_PLAYERS;

    // Register message handlers
    this.onMessage("start_game", (client) => this.handleStartGame(client));
    this.onMessage("roll_dice", (client) => this.handleRollDice(client));
    this.onMessage("buy_property", (client) => this.handleBuyProperty(client));
    this.onMessage("skip_buy", (client) => this.handleSkipBuy(client));
    this.onMessage("end_turn", (client) => this.handleEndTurn(client));
    this.onMessage("build_house", (client, data) => this.handleBuildHouse(client, data));
    this.onMessage("build_hotel", (client, data) => this.handleBuildHotel(client, data));
    this.onMessage("select_piece", (client, data) => this.handleSelectPiece(client, data));
    this.onMessage("propose_trade", (client, data) => this.handleProposeTrade(client, data));
    this.onMessage("accept_trade", (client) => this.handleAcceptTrade(client));
    this.onMessage("reject_trade", (client) => this.handleRejectTrade(client));
    this.onMessage("cancel_trade", (client) => this.handleCancelTrade(client));
    this.onMessage("dismiss_card", (client) => this.handleDismissCard(client));

    console.log("GameRoom created:", this.roomId);
  }

  async onJoin(client: Client, options: JoinOptions): Promise<void> {
    console.log("[GameRoom] onJoin options:", JSON.stringify({
      displayName: options.displayName,
      discordUserId: options.discordUserId,
      hasAccessToken: !!options.accessToken,
    }));
    let displayName = options.displayName || `Player ${this.state.players.size + 1}`;
    let discordUserId = options.discordUserId || "";
    let avatarUrl = options.avatarUrl || "";

    // If we have an access token, fetch the real Discord user profile
    // This is the authoritative source — overrides whatever the client sent
    if (options.accessToken) {
      try {
        const userRes = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${options.accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json() as any;
          displayName = userData.global_name || userData.username || displayName;
          discordUserId = userData.id || discordUserId;
          if (userData.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
          }
          console.log(`Resolved Discord user from token: ${displayName} (${discordUserId})`);
        } else {
          console.warn("Failed to fetch Discord user from token:", userRes.status);
        }
      } catch (e) {
        console.error("Error fetching Discord user profile:", e);
      }
    }

    // Collect pieces already taken by players in this room
    const takenPieces = new Set<string>();
    this.state.players.forEach((p) => {
      if (p.pieceId) takenPieces.add(p.pieceId);
    });

    // Load player's preferred piece from DB, then ensure it's not taken
    let selectedPiece = "car";
    let ownedPieces: string[] = [];
    if (discordUserId) {
      try {
        const dbPlayer = getPlayer(discordUserId);
        selectedPiece = dbPlayer.selected_piece;
        ownedPieces = dbPlayer.owned_pieces;
      } catch (err) {
        console.error("Failed to load player from DB:", err);
      }
    }

    // If their preferred piece is already taken, find the first available one they own
    if (takenPieces.has(selectedPiece)) {
      const available = ownedPieces.find((id) => !takenPieces.has(id));
      if (available) {
        selectedPiece = available;
      } else {
        // Fallback: pick any piece from the full list that isn't taken
        const fallback = PIECES.find((p) => !takenPieces.has(p.id));
        selectedPiece = fallback?.id || "car";
      }
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.discordUserId = discordUserId;
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.coins = STARTING_COINS;
    player.position = 0;
    player.isActive = true;
    player.isBankrupt = false;
    player.playerIndex = this.state.players.size;
    player.pieceId = selectedPiece;

    this.state.players.set(client.sessionId, player);
    this.playerOrder.push(client.sessionId);
    this.state.playerCount = this.state.players.size as any;

    // First player to join becomes the host
    if (this.state.players.size === 1) {
      this.state.hostSessionId = client.sessionId;
    }

    // Send player's store data so the client knows owned pieces and gems
    if (discordUserId) {
      try {
        const dbPlayer = getPlayer(discordUserId);
        client.send("player_data", {
          gems: dbPlayer.gems,
          ownedPieces: dbPlayer.owned_pieces,
          selectedPiece: dbPlayer.selected_piece,
        });
      } catch (err) {
        console.error("Failed to send player data:", err);
      }
    }

    this.state.lastAction = `${player.displayName} joined the game.`;
    console.log(`Player joined: ${player.displayName} (${client.sessionId})`);
  }

  onLeave(client: Client, code?: number): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.phase === "lobby") {
      // In lobby, remove player entirely
      this.state.players.delete(client.sessionId);
      this.playerOrder = this.playerOrder.filter((id) => id !== client.sessionId);
      this.state.playerCount = this.state.players.size as any;

      // Reassign host if needed
      if (this.state.hostSessionId === client.sessionId && this.state.players.size > 0) {
        const firstPlayer = this.playerOrder[0];
        if (firstPlayer) {
          this.state.hostSessionId = firstPlayer;
        }
      }

      this.state.lastAction = `${player.displayName} left the game.`;
    } else if (this.state.phase === "playing") {
      // Cancel any active trade involving this player
      if (
        this.state.activeTrade.status === "pending" &&
        (this.state.activeTrade.fromSessionId === client.sessionId ||
          this.state.activeTrade.toSessionId === client.sessionId)
      ) {
        clearTrade(this.state);
      }

      // During game, mark as bankrupt
      player.isActive = false;
      player.isBankrupt = true;

      // Release properties
      for (let i = 0; i < player.ownedProperties.length; i++) {
        const spaceIndex = player.ownedProperties[i];
        const space = this.state.boardSpaces[spaceIndex];
        if (space) {
          space.ownerId = "";
        }
      }
      player.ownedProperties.clear();
      this.state.playerCount = getActivePlayers(this.state).length as any;

      this.state.lastAction = `${player.displayName} disconnected and went bankrupt.`;

      // Check if game should end
      if (checkGameOver(this.state)) {
        const result = advanceTurn(this.state);
        this.state.lastAction = result;
      } else {
        // If it was this player's turn, advance to next
        const currentPlayer = getCurrentPlayer(this.state);
        if (currentPlayer && currentPlayer.sessionId === client.sessionId) {
          const result = advanceTurn(this.state);
          this.state.lastAction = result;
        }
      }
    }

    console.log(`Player left: ${player.displayName} (${client.sessionId})`);
  }

  private handleStartGame(client: Client): void {
    // Only the host can start
    if (client.sessionId !== this.state.hostSessionId) {
      client.send("error", { message: "Only the host can start the game." });
      return;
    }

    if (this.state.phase !== "lobby") {
      client.send("error", { message: "Game has already started." });
      return;
    }

    if (this.state.players.size < MIN_PLAYERS) {
      client.send("error", { message: `Need at least ${MIN_PLAYERS} players to start.` });
      return;
    }

    this.state.phase = "playing";
    this.state.currentPlayerIndex = 0;
    this.state.turnCount = 0;
    this.state.hasRolled = false;

    // Shuffle card decks
    this.communityDeck = shuffleDeck(COMMUNITY_CARDS);
    this.chanceDeck = shuffleDeck(CHANCE_CARDS);

    const firstPlayer = getCurrentPlayer(this.state);
    this.state.lastAction = `Game started! ${firstPlayer?.displayName}'s turn.`;

    // Lock the room
    this.lock();

    console.log("Game started with", this.state.players.size, "players");
  }

  private handleRollDice(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (this.state.hasRolled) {
      client.send("error", { message: "You already rolled this turn." });
      return;
    }

    // Roll dice
    const [d1, d2] = rollDice();
    this.state.dice1 = d1;
    this.state.dice2 = d2;
    this.state.hasRolled = true;

    const total = d1 + d2;

    // Move player
    const passedPayday = movePlayer(currentPlayer, total);
    if (passedPayday) {
      currentPlayer.coins += 200; // PAYDAY_BONUS
      this.state.lastAction = `${currentPlayer.displayName} rolled ${d1}+${d2}=${total} and collected 200 coins passing Payday!`;
    } else {
      this.state.lastAction = `${currentPlayer.displayName} rolled ${d1}+${d2}=${total}.`;
    }

    // Process landing
    const landingResult = processLanding(this.state, currentPlayer);
    this.state.lastAction = landingResult;

    // If player landed on a card space, draw a card
    const landedSpace = this.state.boardSpaces[currentPlayer.position];
    if (landedSpace.spaceType === "community" || landedSpace.spaceType === "chance") {
      const deckType = landedSpace.spaceType as "community" | "chance";
      const deck = deckType === "community" ? this.communityDeck : this.chanceDeck;
      const result = drawCard(this.state, currentPlayer, deckType, deck);
      // Update the deck reference (may have been reshuffled)
      if (deckType === "community") {
        this.communityDeck = result.deck;
      } else {
        this.chanceDeck = result.deck;
      }
      this.state.lastAction = result.message;
    }

    // Check game over after landing
    if (checkGameOver(this.state)) {
      const result = advanceTurn(this.state);
      this.state.lastAction = result;
      if ((this.state.phase as string) === "finished") {
        this.awardEndGameGems();
      }
    }
  }

  private handleBuyProperty(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.awaitingBuy) {
      client.send("error", { message: "No property available to buy." });
      return;
    }

    const result = buyProperty(this.state, currentPlayer);
    this.state.lastAction = result;
  }

  private handleSkipBuy(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.awaitingBuy) return;

    skipBuy(this.state);
    this.state.lastAction = `${currentPlayer.displayName} decided not to buy.`;
  }

  private handleBuildHouse(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.hasRolled) {
      client.send("error", { message: "Roll the dice before building." });
      return;
    }

    const result = buildHouse(this.state, currentPlayer, data.spaceIndex);
    this.state.lastAction = result;
  }

  private handleBuildHotel(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.hasRolled) {
      client.send("error", { message: "Roll the dice before building." });
      return;
    }

    const result = buildHotel(this.state, currentPlayer, data.spaceIndex);
    this.state.lastAction = result;
  }

  private handleEndTurn(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.hasRolled) {
      client.send("error", { message: "You must roll the dice first." });
      return;
    }

    if (this.state.awaitingBuy) {
      // Auto-skip buying if ending turn
      skipBuy(this.state);
    }

    const result = advanceTurn(this.state);
    this.state.lastAction = result;
    if ((this.state.phase as string) === "finished") {
      this.awardEndGameGems();
    }
  }

  private handleSelectPiece(client: Client, data: { pieceId: string }): void {
    if (this.state.phase !== "lobby") {
      client.send("error", { message: "Can only change piece in lobby." });
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const { pieceId } = data;
    if (!pieceId) return;

    // Check if another player already has this piece
    let taken = false;
    this.state.players.forEach((other) => {
      if (other.sessionId !== client.sessionId && other.pieceId === pieceId) {
        taken = true;
      }
    });
    if (taken) {
      client.send("error", { message: "That piece is already taken by another player." });
      return;
    }

    // Validate ownership in DB
    if (player.discordUserId) {
      const success = selectPiece(player.discordUserId, pieceId);
      if (!success) {
        client.send("error", { message: "You don't own that piece." });
        return;
      }
    }

    player.pieceId = pieceId;
    this.state.lastAction = `${player.displayName} chose the ${pieceId} piece.`;
    console.log(`${player.displayName} selected piece: ${pieceId}`);
  }

  private handleProposeTrade(
    client: Client,
    data: {
      toSessionId: string;
      offeredProperties: number[];
      requestedProperties: number[];
      offeredCoins: number;
      requestedCoins: number;
    }
  ): void {
    if (this.state.phase !== "playing") {
      client.send("error", { message: "Can only trade during the game." });
      return;
    }

    if (this.state.activeTrade.status === "pending") {
      client.send("error", { message: "A trade is already in progress." });
      return;
    }

    const { toSessionId, offeredProperties, requestedProperties, offeredCoins, requestedCoins } = data;

    const validation = validateTradeOffer(
      this.state,
      client.sessionId,
      toSessionId,
      offeredProperties || [],
      requestedProperties || [],
      offeredCoins || 0,
      requestedCoins || 0
    );

    if (!validation.valid) {
      client.send("error", { message: validation.error || "Invalid trade." });
      return;
    }

    // Set up the active trade
    const trade = this.state.activeTrade;
    trade.status = "pending";
    trade.fromSessionId = client.sessionId;
    trade.toSessionId = toSessionId;
    trade.offeredProperties.clear();
    for (const idx of (offeredProperties || [])) {
      trade.offeredProperties.push(idx);
    }
    trade.requestedProperties.clear();
    for (const idx of (requestedProperties || [])) {
      trade.requestedProperties.push(idx);
    }
    trade.offeredCoins = offeredCoins || 0;
    trade.requestedCoins = requestedCoins || 0;

    const fromPlayer = this.state.players.get(client.sessionId);
    const toPlayer = this.state.players.get(toSessionId);
    this.state.lastAction = `${fromPlayer?.displayName} proposed a trade to ${toPlayer?.displayName}.`;
    console.log(`Trade proposed: ${fromPlayer?.displayName} → ${toPlayer?.displayName}`);
  }

  private handleAcceptTrade(client: Client): void {
    if (this.state.activeTrade.status !== "pending") {
      client.send("error", { message: "No active trade to accept." });
      return;
    }

    if (this.state.activeTrade.toSessionId !== client.sessionId) {
      client.send("error", { message: "This trade is not for you." });
      return;
    }

    // Re-validate the trade (state may have changed since proposal)
    const trade = this.state.activeTrade;
    const validation = validateTradeOffer(
      this.state,
      trade.fromSessionId,
      trade.toSessionId,
      Array.from(trade.offeredProperties),
      Array.from(trade.requestedProperties),
      trade.offeredCoins,
      trade.requestedCoins
    );

    if (!validation.valid) {
      client.send("error", { message: validation.error || "Trade is no longer valid." });
      clearTrade(this.state);
      return;
    }

    const result = executeTrade(this.state);
    this.state.lastAction = result;
    console.log("Trade completed:", result);
  }

  private handleRejectTrade(client: Client): void {
    if (this.state.activeTrade.status !== "pending") {
      client.send("error", { message: "No active trade to reject." });
      return;
    }

    if (this.state.activeTrade.toSessionId !== client.sessionId) {
      client.send("error", { message: "This trade is not for you." });
      return;
    }

    const fromPlayer = this.state.players.get(this.state.activeTrade.fromSessionId);
    const toPlayer = this.state.players.get(client.sessionId);
    this.state.lastAction = `${toPlayer?.displayName} declined ${fromPlayer?.displayName}'s trade offer.`;
    clearTrade(this.state);
    console.log(`Trade rejected by ${toPlayer?.displayName}`);
  }

  private handleCancelTrade(client: Client): void {
    if (this.state.activeTrade.status !== "pending") {
      client.send("error", { message: "No active trade to cancel." });
      return;
    }

    if (this.state.activeTrade.fromSessionId !== client.sessionId) {
      client.send("error", { message: "Only the proposer can cancel a trade." });
      return;
    }

    const fromPlayer = this.state.players.get(client.sessionId);
    this.state.lastAction = `${fromPlayer?.displayName} cancelled their trade offer.`;
    clearTrade(this.state);
    console.log(`Trade cancelled by ${fromPlayer?.displayName}`);
  }

  private handleDismissCard(client: Client): void {
    // Only the player who drew the card can dismiss it
    if (this.state.drawnCard.forSessionId !== client.sessionId) {
      return;
    }
    clearDrawnCard(this.state);
  }

  /**
   * Award gems to all players at end of game.
   * Winner gets 50, others get 15.
   */
  private awardEndGameGems(): void {
    if (this.gemsAwarded) return;
    this.gemsAwarded = true;

    const winner = this.state.winnerId;
    this.state.players.forEach((player) => {
      if (!player.discordUserId) return;
      try {
        const gems = player.sessionId === winner ? 50 : 15;
        updateGems(player.discordUserId, gems);
        console.log(`Awarded ${gems} gems to ${player.displayName}`);
      } catch (err) {
        console.error(`Failed to award gems to ${player.displayName}:`, err);
      }
    });
  }

  onDispose(): void {
    // Award gems if the game was finished
    if (this.state.phase === "finished" && this.state.winnerId) {
      this.awardEndGameGems();
    }
    console.log("GameRoom disposed:", this.roomId);
  }
}
