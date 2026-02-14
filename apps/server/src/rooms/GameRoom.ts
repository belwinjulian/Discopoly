import { Room, Client, Delayed } from "colyseus";
import { GameState, Player, Spectator, LogEntry } from "../state/GameState.js";
import { STARTING_COINS, JAIL_FINE } from "../logic/boardConfig.js";
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
  sendToJail,
  releaseFromJail,
  bankruptPlayer,
  mortgageProperty,
  unmortgageProperty,
  sellHouse,
  sellHotel,
  startAuction,
  placeBid,
  passAuction,
  handlePlayerDisconnectAuction,
  playerHasMonopoly,
  processCounterOffer,
  clearBankruptcyNegotiation,
  resolveBankruptcyPayment,
  declareBankruptcy,
  handleBankruptcyTimeout,
  isBankruptcyTimedOut,
} from "../logic/gameLogic.js";
import { shuffleDeck, COMMUNITY_CARDS, CHANCE_CARDS } from "../logic/cardData.js";
import { getPlayer, selectPiece, updateGems, incrementStat, getPlayerStats } from "../db.js";
import { PIECES } from "../pieces.js";
import { checkStatAchievements, tryUnlockInGameAchievement, type AchievementUnlock } from "../achievements.js";
import { processGoalTrigger, type GoalCompletionResult } from "../goals.js";
import { DISTRICT_PROPERTIES } from "../logic/boardConfig.js";

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const DEFAULT_TURN_TIME_LIMIT = 60; // seconds
const TIME_EXTENSION_SECONDS = 30;

interface JoinOptions {
  discordUserId?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken?: string;
  channelId?: string;
}

// Per-game tracking for in-game achievements
interface InGameTracking {
  doublesCount: number;
  rentCollections: number;
  coinsSpent: number;
  hadLowCoins: boolean; // went below 100
}

export class GameRoom extends Room<{ state: GameState }> {
  private playerOrder: string[] = [];
  private gemsAwarded: boolean = false;
  private communityDeck: string[] = [];
  private chanceDeck: string[] = [];
  // Track per-player in-game stats for in-game achievements
  private inGameTracking = new Map<string, InGameTracking>();
  // Turn timer
  private turnTimer: Delayed | null = null;
  private turnTimerRemainingMs: number = 0;
  // Bankruptcy negotiation timer
  private bankruptcyTimer: Delayed | null = null;

  private addLog(message: string, type?: string): void {
    const entry = new LogEntry();
    entry.message = message;
    entry.type = type || this.detectLogType(message);
    entry.timestamp = Math.floor(Date.now() / 1000);
    this.state.gameLog.push(entry);
    if (this.state.gameLog.length > 200) {
      this.state.gameLog.shift();
    }
  }

  private detectLogType(msg: string): string {
    if (msg.includes("Jail") || msg.includes("jail")) return "jail";
    if (msg.includes("drew \"")) return "card";
    if (msg.includes("completed a trade")) return "trade";
    if (msg.includes("built a house") || msg.includes("built a HOTEL")) return "build";
    if (msg.includes("sold a house") || msg.includes("sold the hotel")) return "build";
    if (msg.includes("bought") || msg.includes("purchased")) return "buy";
    if (msg.includes("won") && msg.includes("for") && msg.includes("coins")) return "auction";
    if (msg.includes("mortgaged") || msg.includes("unmortgaged")) return "buy";
    if (msg.includes("bid") && msg.includes("coins")) return "auction";
    if (msg.includes("auction") || msg.includes("Auction")) return "auction";
    if (msg.includes("rent") || msg.includes("paid")) return "rent";
    if (msg.includes("tax") || msg.includes("Tax")) return "tax";
    if (msg.includes("Payday") || msg.includes("payday") || msg.includes("collected")) return "payday";
    if (msg.includes("Bankruptcy negotiation") || msg.includes("bankruptcy negotiation")) return "bankruptcy";
    if (msg.includes("raised enough funds")) return "bankruptcy";
    if (msg.includes("declared bankruptcy")) return "bankrupt";
    if (msg.includes("bankrupt") || msg.includes("Bankrupt")) return "bankrupt";
    if (msg.includes("rolled")) return "roll";
    if (msg.includes("'s turn")) return "turn";
    return "info";
  }

  private getInGameTrack(sessionId: string): InGameTracking {
    if (!this.inGameTracking.has(sessionId)) {
      this.inGameTracking.set(sessionId, {
        doublesCount: 0,
        rentCollections: 0,
        coinsSpent: 0,
        hadLowCoins: false,
      });
    }
    return this.inGameTracking.get(sessionId)!;
  }

  /** Send achievement/goal notifications to a client */
  private sendProgressNotifications(
    client: Client,
    achievementUnlocks: AchievementUnlock[],
    goalCompletions: GoalCompletionResult[]
  ): void {
    for (const unlock of achievementUnlocks) {
      client.send("achievement_unlocked", unlock);
    }
    for (const completion of goalCompletions) {
      client.send("goal_completed", completion);
    }
  }

  /** Find the client for a player by sessionId */
  private getClientBySessionId(sessionId: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sessionId);
  }

  /** Track a stat and check achievements/goals. Returns notifications. */
  private trackStat(
    discordUserId: string,
    stat: string,
    goalTrigger: string,
    amount: number = 1
  ): { achievements: AchievementUnlock[]; goals: GoalCompletionResult[] } {
    if (!discordUserId) return { achievements: [], goals: [] };

    try {
      incrementStat(discordUserId, stat as any, amount);
      const achievements = checkStatAchievements(discordUserId);
      const goals = processGoalTrigger(discordUserId, goalTrigger, amount);
      return { achievements, goals };
    } catch (err) {
      console.error(`Failed to track stat ${stat}:`, err);
      return { achievements: [], goals: [] };
    }
  }

  onCreate(): void {
    this.state = new GameState();
    initializeBoard(this.state);

    this.maxClients = MAX_PLAYERS + 20;

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
    this.onMessage("counter_offer", (client, data) => this.handleCounterOffer(client, data));
    this.onMessage("dismiss_card", (client) => this.handleDismissCard(client));
    this.onMessage("pay_jail_fine", (client) => this.handlePayJailFine(client));
    this.onMessage("use_jail_card", (client) => this.handleUseJailCard(client));
    this.onMessage("mortgage_property", (client, data) => this.handleMortgageProperty(client, data));
    this.onMessage("unmortgage_property", (client, data) => this.handleUnmortgageProperty(client, data));
    this.onMessage("sell_house", (client, data) => this.handleSellHouse(client, data));
    this.onMessage("sell_hotel", (client, data) => this.handleSellHotel(client, data));
    this.onMessage("place_bid", (client, data) => this.handlePlaceBid(client, data));
    this.onMessage("pass_auction", (client) => this.handlePassAuction(client));
    this.onMessage("return_to_lobby", (client) => this.handleReturnToLobby(client));
    this.onMessage("request_time_extension", (client) => this.handleRequestTimeExtension(client));

    // Bankruptcy negotiation handlers
    this.onMessage("bankruptcy_sell_building", (client, data) => this.handleBankruptcySellBuilding(client, data));
    this.onMessage("bankruptcy_mortgage", (client, data) => this.handleBankruptcyMortgage(client, data));
    this.onMessage("bankruptcy_pay_debt", (client) => this.handleBankruptcyPayDebt(client));
    this.onMessage("bankruptcy_declare", (client) => this.handleBankruptcyDeclare(client));

    console.log("GameRoom created:", this.roomId, "channelId:", (this as any).channelId);
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

    if (this.state.phase !== "lobby" || this.state.players.size >= MAX_PLAYERS) {
      this.addSpectator(client, discordUserId, displayName, avatarUrl);
      return;
    }

    const takenPieces = new Set<string>();
    this.state.players.forEach((p) => {
      if (p.pieceId) takenPieces.add(p.pieceId);
    });

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

    if (takenPieces.has(selectedPiece)) {
      const available = ownedPieces.find((id) => !takenPieces.has(id));
      if (available) {
        selectedPiece = available;
      } else {
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

    if (this.state.players.size === 1) {
      this.state.hostSessionId = client.sessionId;
    }

    // Send player's store data (now includes cosmetics)
    if (discordUserId) {
      try {
        const dbPlayer = getPlayer(discordUserId);
        client.send("player_data", {
          gems: dbPlayer.gems,
          ownedPieces: dbPlayer.owned_pieces,
          selectedPiece: dbPlayer.selected_piece,
          ownedCosmetics: dbPlayer.owned_cosmetics,
          equippedTitle: dbPlayer.equipped_title,
          equippedTheme: dbPlayer.equipped_theme,
          equippedDice: dbPlayer.equipped_dice,
        });
      } catch (err) {
        console.error("Failed to send player data:", err);
      }
    }

    this.state.lastAction = `${player.displayName} joined the game.`;
    this.addLog(this.state.lastAction, "info");
    console.log(`Player joined: ${player.displayName} (${client.sessionId})`);
  }

  onLeave(client: Client, code?: number): void {
    if (this.state.spectators.has(client.sessionId)) {
      const spectator = this.state.spectators.get(client.sessionId);
      console.log(`Spectator left: ${spectator?.displayName} (${client.sessionId})`);
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = this.state.spectators.size as any;
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.phase === "lobby") {
      this.state.players.delete(client.sessionId);
      this.playerOrder = this.playerOrder.filter((id) => id !== client.sessionId);
      this.state.playerCount = this.state.players.size as any;

      if (this.state.hostSessionId === client.sessionId && this.state.players.size > 0) {
        const firstPlayer = this.playerOrder[0];
        if (firstPlayer) {
          this.state.hostSessionId = firstPlayer;
        }
      }

      this.state.lastAction = `${player.displayName} left the game.`;
      this.addLog(this.state.lastAction, "info");
    } else if (this.state.phase === "playing") {
      if (
        this.state.activeTrade.status === "pending" &&
        (this.state.activeTrade.fromSessionId === client.sessionId ||
          this.state.activeTrade.toSessionId === client.sessionId)
      ) {
        clearTrade(this.state);
      }

      if (this.state.activeAuction.status === "active") {
        handlePlayerDisconnectAuction(this.state, client.sessionId);
        // If auction ended due to disconnect and current player had doubles, allow re-roll
        if (this.state.activeAuction.status !== "active") {
          const turnPlayer = getCurrentPlayer(this.state);
          if (turnPlayer && turnPlayer.doublesCount > 0 && !turnPlayer.inJail && turnPlayer.isActive) {
            this.state.hasRolled = false;
          }
        }
      }

      // Clear bankruptcy negotiation if the disconnecting player is the debtor
      if (this.state.bankruptcyNegotiation.status === "active" &&
          this.state.bankruptcyNegotiation.debtorSessionId === client.sessionId) {
        clearBankruptcyNegotiation(this.state);
        if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
      }

      bankruptPlayer(this.state, player);

      this.state.lastAction = `${player.displayName} disconnected and went bankrupt.`;
      this.addLog(this.state.lastAction, "bankrupt");

      this.clearTurnTimer();
      if (checkGameOver(this.state)) {
        const result = advanceTurn(this.state);
        this.state.lastAction = result;
        this.addLog(result);
        if ((this.state.phase as string) === "finished") {
          this.awardEndGameGems();
        }
      } else {
        const currentPlayer = getCurrentPlayer(this.state);
        if (currentPlayer && currentPlayer.sessionId === client.sessionId) {
          const result = advanceTurn(this.state);
          this.state.lastAction = result;
          this.addLog(result);
          this.state.turnTimeLimit = DEFAULT_TURN_TIME_LIMIT;
          this.startTurnTimer();
        }
      }
    }

    console.log(`Player left: ${player.displayName} (${client.sessionId})`);
  }

  private addSpectator(client: Client, discordUserId: string, displayName: string, avatarUrl: string): void {
    const spectator = new Spectator();
    spectator.sessionId = client.sessionId;
    spectator.discordUserId = discordUserId;
    spectator.displayName = displayName;
    spectator.avatarUrl = avatarUrl;

    this.state.spectators.set(client.sessionId, spectator);
    this.state.spectatorCount = this.state.spectators.size as any;
    this.state.lastAction = `${displayName} is now spectating.`;
    this.addLog(this.state.lastAction, "info");
    console.log(`Spectator joined: ${displayName} (${client.sessionId})`);
  }

  private isSpectator(client: Client): boolean {
    return this.state.spectators.has(client.sessionId);
  }

  // ==================== Turn Timer ====================

  /** Start (or restart) the turn timer for the current player's turn */
  private startTurnTimer(): void {
    this.clearTurnTimer();

    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer) return;

    this.state.turnStartTime = Date.now();
    this.state.turnTimerActive = true;
    this.state.turnExtensionUsed = false;

    const timeMs = this.state.turnTimeLimit * 1000;

    this.turnTimer = this.clock.setTimeout(() => {
      this.handleAutoSkipTurn();
    }, timeMs);
  }

  /** Clear/cancel the turn timer */
  private clearTurnTimer(): void {
    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
    }
    this.state.turnTimerActive = false;
  }

  /** Pause the turn timer (during auctions, trades, etc.) */
  private pauseTurnTimer(): void {
    if (this.turnTimer && this.state.turnTimerActive) {
      const elapsed = Date.now() - this.state.turnStartTime;
      const totalMs = this.state.turnTimeLimit * 1000;
      this.turnTimerRemainingMs = Math.max(0, totalMs - elapsed);
      this.turnTimer.clear();
      this.turnTimer = null;
    }
    this.state.turnTimerActive = false;
  }

  /** Resume the turn timer after a pause */
  private resumeTurnTimer(): void {
    if (this.turnTimerRemainingMs > 0 && this.state.phase === "playing") {
      const remainingMs = this.turnTimerRemainingMs;
      this.turnTimerRemainingMs = 0;
      this.state.turnTimeLimit = Math.ceil(remainingMs / 1000);
      this.state.turnStartTime = Date.now();
      this.state.turnTimerActive = true;
      this.turnTimer = this.clock.setTimeout(() => {
        this.handleAutoSkipTurn();
      }, remainingMs);
    }
  }

  /** Auto-skip the current player's turn when timer expires */
  private handleAutoSkipTurn(): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer) return;

    console.log(`Turn timer expired for ${currentPlayer.displayName}`);

    // Clear any pending states
    if (this.state.awaitingBuy) {
      const propertyIndex = currentPlayer.position;
      skipBuy(this.state);
      // Don't start auction on timeout - just skip the buy
    }

    if (this.state.activeTrade.status === "pending") {
      clearTrade(this.state);
    }

    if (this.state.drawnCard.forSessionId === currentPlayer.sessionId) {
      clearDrawnCard(this.state);
    }

    // If they haven't rolled yet, just advance the turn
    // If they have rolled, end their turn
    this.clearTurnTimer();

    // Reset doubles since turn is being force-ended
    currentPlayer.doublesCount = 0;

    // Broadcast timeout message to all clients
    this.broadcast("turn_timeout", {
      playerName: currentPlayer.displayName,
      sessionId: currentPlayer.sessionId,
    });

    const timeoutMsg = `${currentPlayer.displayName}'s turn was skipped due to timeout.`;
    this.state.lastAction = timeoutMsg;
    this.addLog(timeoutMsg, "info");

    const result = advanceTurn(this.state);
    this.state.lastAction = result;
    this.addLog(result);

    if ((this.state.phase as string) === "finished") {
      this.awardEndGameGems();
    } else {
      // Start timer for the next player
      this.startTurnTimer();
    }
  }

  /** Handle a player requesting a time extension (one per turn) */
  private handleRequestTimeExtension(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (this.state.turnExtensionUsed) {
      client.send("error", { message: "You already used your time extension this turn." });
      return;
    }

    if (!this.turnTimer) return;

    this.state.turnExtensionUsed = true;

    // Clear old timer and start a new one with remaining + extension time
    const remaining = Math.max(0, (this.state.turnStartTime + this.state.turnTimeLimit * 1000) - Date.now());
    this.clearTurnTimer();

    const newTotalMs = remaining + TIME_EXTENSION_SECONDS * 1000;
    this.state.turnStartTime = Date.now();
    this.state.turnTimeLimit = Math.ceil(newTotalMs / 1000);
    this.state.turnTimerActive = true;

    this.turnTimer = this.clock.setTimeout(() => {
      this.handleAutoSkipTurn();
    }, newTotalMs);

    this.state.lastAction = `${currentPlayer.displayName} requested a ${TIME_EXTENSION_SECONDS}s time extension.`;
    this.addLog(this.state.lastAction, "info");
    console.log(`Time extension granted to ${currentPlayer.displayName}`);
  }

  private handleStartGame(client: Client): void {
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

    // Reset in-game tracking
    this.inGameTracking.clear();
    this.state.players.forEach((player) => {
      this.getInGameTrack(player.sessionId);
    });

    this.communityDeck = shuffleDeck(COMMUNITY_CARDS);
    this.chanceDeck = shuffleDeck(CHANCE_CARDS);

    const firstPlayer = getCurrentPlayer(this.state);
    this.state.lastAction = `Game started! ${firstPlayer?.displayName}'s turn.`;
    this.addLog(this.state.lastAction, "info");

    // Start turn timer for the first player
    this.state.turnTimeLimit = DEFAULT_TURN_TIME_LIMIT;
    this.startTurnTimer();

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

    const [d1, d2] = rollDice();
    this.state.dice1 = d1;
    this.state.dice2 = d2;
    this.state.hasRolled = true;

    const total = d1 + d2;
    const isDoubles = d1 === d2;

    // Track dice roll stat + goals
    const { achievements: rollAch, goals: rollGoals } = this.trackStat(
      currentPlayer.discordUserId, "dice_rolls", "dice_roll"
    );

    let doublesAch: AchievementUnlock[] = [];
    let doublesGoals: GoalCompletionResult[] = [];
    if (isDoubles) {
      const result = this.trackStat(currentPlayer.discordUserId, "doubles_rolled", "doubles_rolled");
      doublesAch = result.achievements;
      doublesGoals = result.goals;

      // Track for in-game lucky_streak achievement
      const track = this.getInGameTrack(currentPlayer.sessionId);
      track.doublesCount++;
      if (track.doublesCount >= 3) {
        const unlock = tryUnlockInGameAchievement(currentPlayer.discordUserId, "lucky_streak");
        if (unlock) doublesAch.push(unlock);
      }
    }

    // Send all roll-related notifications
    this.sendProgressNotifications(client,
      [...rollAch, ...doublesAch],
      [...rollGoals, ...doublesGoals]
    );

    // Jail logic
    if (currentPlayer.inJail) {
      if (isDoubles) {
        releaseFromJail(currentPlayer);
        currentPlayer.doublesCount = 0;

        // Track jail escape
        this.trackAndNotify(client, currentPlayer.discordUserId, "jail_escapes", "jail_escape");

        const passedPayday = movePlayer(currentPlayer, total);
        if (passedPayday) {
          currentPlayer.coins += 200;
          this.trackAndNotify(client, currentPlayer.discordUserId, "paydays_collected", "payday_collected");
        }
        this.state.lastAction = `${currentPlayer.displayName} rolled doubles (${d1}+${d2})! Escaped from Jail!`;
        this.addLog(this.state.lastAction, "jail");
        const landingResult = processLanding(this.state, currentPlayer);
        this.state.lastAction = landingResult;
        this.addLog(landingResult);

        this.handleCardDraw(currentPlayer);
        this.checkRentCollection(currentPlayer, landingResult);
        if (this.state.bankruptcyNegotiation.status === "active") {
          this.startBankruptcyTimer();
          this.pauseTurnTimer();
          return;
        }
      } else {
        currentPlayer.jailTurnsRemaining--;
        if (currentPlayer.jailTurnsRemaining <= 0) {
          if (currentPlayer.coins >= JAIL_FINE) {
            currentPlayer.coins -= JAIL_FINE;
            releaseFromJail(currentPlayer);
            this.trackAndNotify(client, currentPlayer.discordUserId, "jail_escapes", "jail_escape");
            const passedPayday = movePlayer(currentPlayer, total);
            if (passedPayday) {
              currentPlayer.coins += 200;
              this.trackAndNotify(client, currentPlayer.discordUserId, "paydays_collected", "payday_collected");
            }
            this.state.lastAction = `${currentPlayer.displayName} failed to roll doubles. Auto-paid ${JAIL_FINE} coin fine and moved ${total} spaces.`;
            this.addLog(this.state.lastAction, "jail");
            const landingResult = processLanding(this.state, currentPlayer);
            this.state.lastAction = landingResult;
            this.addLog(landingResult);
            this.handleCardDraw(currentPlayer);
            this.checkRentCollection(currentPlayer, landingResult);
            if (this.state.bankruptcyNegotiation.status === "active") {
              this.startBankruptcyTimer();
              this.pauseTurnTimer();
              return;
            }
          } else {
            currentPlayer.coins = 0;
            releaseFromJail(currentPlayer);
            bankruptPlayer(this.state, currentPlayer);
            this.state.lastAction = `${currentPlayer.displayName} couldn't pay the ${JAIL_FINE} coin jail fine and went bankrupt!`;
            this.addLog(this.state.lastAction, "bankrupt");
          }
        } else {
          this.state.lastAction = `${currentPlayer.displayName} rolled ${d1}+${d2} (no doubles). Still in Jail. ${currentPlayer.jailTurnsRemaining} attempt(s) remaining.`;
          this.addLog(this.state.lastAction, "jail");
        }
      }
    } else {
      // Normal (not in jail) roll
      if (isDoubles) {
        currentPlayer.doublesCount++;

        if (currentPlayer.doublesCount >= 3) {
          sendToJail(currentPlayer);
          currentPlayer.doublesCount = 0;
          this.state.lastAction = `${currentPlayer.displayName} rolled doubles 3 times in a row! Go to Jail!`;
          this.addLog(this.state.lastAction, "jail");

          // Track jail_bird achievement
          this.tryInGameAchievement(client, currentPlayer.discordUserId, "jail_bird");

          if (checkGameOver(this.state)) {
            const result = advanceTurn(this.state);
            this.state.lastAction = result;
            this.addLog(result);
            if ((this.state.phase as string) === "finished") {
              this.awardEndGameGems();
            }
          }
          return;
        }
      } else {
        currentPlayer.doublesCount = 0;
      }

      const passedPayday = movePlayer(currentPlayer, total);
      if (passedPayday) {
        currentPlayer.coins += 200;
        this.trackAndNotify(client, currentPlayer.discordUserId, "paydays_collected", "payday_collected");
        // Track coins earned for weekly goal
        this.processGoalAndNotify(client, currentPlayer.discordUserId, "coins_earned", 200);
        this.state.lastAction = `${currentPlayer.displayName} rolled ${d1}+${d2}=${total} and collected 200 coins passing Payday!`;
        this.addLog(this.state.lastAction, "payday");
      } else {
        this.state.lastAction = `${currentPlayer.displayName} rolled ${d1}+${d2}=${total}.`;
        this.addLog(this.state.lastAction, "roll");
      }

      const landingResult = processLanding(this.state, currentPlayer);
      this.state.lastAction = landingResult;
      this.addLog(landingResult);

      this.handleCardDraw(currentPlayer);
      this.checkRentCollection(currentPlayer, landingResult);

      // Start bankruptcy timer if negotiation was triggered
      if (this.state.bankruptcyNegotiation.status === "active") {
        this.startBankruptcyTimer();
        this.pauseTurnTimer();
        return; // Pause game flow until negotiation resolves
      }

      // Pause turn timer if auction was auto-started (player can't afford property)
      if (this.state.activeAuction.status === "active") {
        this.pauseTurnTimer();
      }

      // Check go-to-jail from landing
      if (currentPlayer.inJail) {
        this.tryInGameAchievement(client, currentPlayer.discordUserId, "jail_bird");
      }

      // Track low coins for comeback_kid
      if (currentPlayer.coins < 100 && currentPlayer.isActive) {
        this.getInGameTrack(currentPlayer.sessionId).hadLowCoins = true;
      }

      // Check full_board achievement
      if (currentPlayer.ownedProperties.length >= 8) {
        this.tryInGameAchievement(client, currentPlayer.discordUserId, "full_board");
      }

      if (isDoubles && !currentPlayer.inJail && currentPlayer.isActive && !this.state.awaitingBuy) {
        this.state.hasRolled = false;
        // Restart timer for the doubles re-roll
        this.state.turnTimeLimit = DEFAULT_TURN_TIME_LIMIT;
        this.startTurnTimer();
      }
    }

    // Check game over after landing
    if (checkGameOver(this.state)) {
      this.clearTurnTimer();
      const result = advanceTurn(this.state);
      this.state.lastAction = result;
      this.addLog(result);
      if ((this.state.phase as string) === "finished") {
        this.awardEndGameGems();
      }
    }
  }

  /** Helper to check if rent was just collected from a landing result */
  private checkRentCollection(player: Player, landingResult: string): void {
    if (landingResult.includes("paid") && landingResult.includes("rent")) {
      // Find the owner who collected rent
      const space = this.state.boardSpaces[player.position];
      if (space && space.ownerId && space.ownerId !== player.sessionId) {
        const owner = this.state.players.get(space.ownerId);
        if (owner?.discordUserId) {
          // Extract rent amount from message
          const match = landingResult.match(/paid (\d+) coins rent/);
          const amount = match ? parseInt(match[1]) : 0;

          const ownerClient = this.getClientBySessionId(space.ownerId);
          if (ownerClient) {
            this.trackAndNotify(ownerClient, owner.discordUserId, "rent_collected_total", "rent_collected", amount);
            // Track coins earned for owner
            this.processGoalAndNotify(ownerClient, owner.discordUserId, "coins_earned", amount);
          }

          // In-game rent_collector tracking
          const track = this.getInGameTrack(space.ownerId);
          track.rentCollections++;
          if (track.rentCollections >= 5 && ownerClient) {
            this.tryInGameAchievement(ownerClient, owner.discordUserId, "rent_collector");
          }
        }
      }
    }
  }

  /** Convenience: track stat + send notifications */
  private trackAndNotify(
    client: Client,
    discordUserId: string,
    stat: string,
    goalTrigger: string,
    amount: number = 1
  ): void {
    const { achievements, goals } = this.trackStat(discordUserId, stat, goalTrigger, amount);
    this.sendProgressNotifications(client, achievements, goals);
  }

  /** Convenience: process goal trigger only (no stat) + send notifications */
  private processGoalAndNotify(
    client: Client,
    discordUserId: string,
    trigger: string,
    amount: number = 1
  ): void {
    if (!discordUserId) return;
    try {
      const goals = processGoalTrigger(discordUserId, trigger, amount);
      this.sendProgressNotifications(client, [], goals);
    } catch (err) {
      console.error("Goal trigger error:", err);
    }
  }

  /** Try to unlock an in-game achievement + notify */
  private tryInGameAchievement(client: Client, discordUserId: string, achievementId: string): void {
    if (!discordUserId) return;
    try {
      const unlock = tryUnlockInGameAchievement(discordUserId, achievementId);
      if (unlock) {
        this.sendProgressNotifications(client, [unlock], []);
      }
    } catch (err) {
      console.error("Achievement error:", err);
    }
  }

  private handleCardDraw(player: Player): void {
    const landedSpace = this.state.boardSpaces[player.position];
    if (landedSpace.spaceType === "community" || landedSpace.spaceType === "chance") {
      const deckType = landedSpace.spaceType as "community" | "chance";
      const deck = deckType === "community" ? this.communityDeck : this.chanceDeck;
      const result = drawCard(this.state, player, deckType, deck);
      if (deckType === "community") {
        this.communityDeck = result.deck;
      } else {
        this.chanceDeck = result.deck;
      }
      this.state.lastAction = result.message;
      this.addLog(result.message, "card");
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

    const space = this.state.boardSpaces[currentPlayer.position];
    const costBefore = currentPlayer.coins;

    const result = buyProperty(this.state, currentPlayer);
    this.state.lastAction = result;
    this.addLog(result, "buy");

    // If buy resolved and player had doubles, allow re-roll
    if (!this.state.awaitingBuy && currentPlayer.doublesCount > 0 && !currentPlayer.inJail && currentPlayer.isActive) {
      this.state.hasRolled = false;
    }

    // Track property bought
    if (result.includes("bought")) {
      this.trackAndNotify(client, currentPlayer.discordUserId, "properties_bought", "property_bought");

      // Track spending for in-game big_spender
      const spent = costBefore - currentPlayer.coins;
      const track = this.getInGameTrack(currentPlayer.sessionId);
      track.coinsSpent += spent;
      if (track.coinsSpent >= 2000) {
        this.tryInGameAchievement(client, currentPlayer.discordUserId, "big_spender");
      }

      // Check monopoly completion
      this.checkMonopolyAchievement(client, currentPlayer);
    }
  }

  private handleSkipBuy(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!this.state.awaitingBuy) return;

    const propertyIndex = currentPlayer.position;

    skipBuy(this.state);

    const auctionResult = startAuction(this.state, propertyIndex);
    this.state.lastAction = `${currentPlayer.displayName} declined to buy. ${auctionResult}`;
    this.addLog(this.state.lastAction, "auction");

    // Pause turn timer during auction
    this.pauseTurnTimer();
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

    const costBefore = currentPlayer.coins;
    const result = buildHouse(this.state, currentPlayer, data.spaceIndex);
    this.state.lastAction = result;
    this.addLog(result, "build");

    if (result.includes("built a house")) {
      this.trackAndNotify(client, currentPlayer.discordUserId, "houses_built", "building_built");

      const spent = costBefore - currentPlayer.coins;
      const track = this.getInGameTrack(currentPlayer.sessionId);
      track.coinsSpent += spent;
      if (track.coinsSpent >= 2000) {
        this.tryInGameAchievement(client, currentPlayer.discordUserId, "big_spender");
      }
    }
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

    const costBefore = currentPlayer.coins;
    const result = buildHotel(this.state, currentPlayer, data.spaceIndex);
    this.state.lastAction = result;
    this.addLog(result, "build");

    if (result.includes("built a HOTEL")) {
      this.trackAndNotify(client, currentPlayer.discordUserId, "hotels_built", "building_built");

      const spent = costBefore - currentPlayer.coins;
      const track = this.getInGameTrack(currentPlayer.sessionId);
      track.coinsSpent += spent;
      if (track.coinsSpent >= 2000) {
        this.tryInGameAchievement(client, currentPlayer.discordUserId, "big_spender");
      }
    }
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

    if (this.state.bankruptcyNegotiation.status === "active") {
      client.send("error", { message: "Cannot end turn during bankruptcy negotiation." });
      return;
    }
    if (this.state.activeAuction.status === "active") {
      client.send("error", { message: "Cannot end turn during an auction." });
      return;
    }
    if (this.state.activeTrade.status === "pending") {
      client.send("error", { message: "Cannot end turn during a pending trade." });
      return;
    }

    if (this.state.awaitingBuy) {
      const propertyIndex = currentPlayer.position;
      skipBuy(this.state);
      const auctionResult = startAuction(this.state, propertyIndex);
      this.state.lastAction = `${currentPlayer.displayName} declined to buy. ${auctionResult}`;
      this.addLog(this.state.lastAction, "auction");
      // Pause timer during auction
      this.pauseTurnTimer();
      return;
    }

    this.clearTurnTimer();

    const result = advanceTurn(this.state);
    this.state.lastAction = result;
    this.addLog(result);
    if ((this.state.phase as string) === "finished") {
      this.awardEndGameGems();
    } else {
      // Start timer for the next player
      this.state.turnTimeLimit = DEFAULT_TURN_TIME_LIMIT;
      this.startTurnTimer();
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

    if (player.discordUserId) {
      const success = selectPiece(player.discordUserId, pieceId);
      if (!success) {
        client.send("error", { message: "You don't own that piece." });
        return;
      }
    }

    player.pieceId = pieceId;
    this.state.lastAction = `${player.displayName} chose the ${pieceId} piece.`;
    this.addLog(this.state.lastAction, "info");
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
    // Reset counter-offer state for fresh trades
    trade.counterOfferCount = 0;
    trade.lastModifiedBy = "";
    trade.isCounterOffer = false;
    trade.prevOfferedProperties.clear();
    trade.prevRequestedProperties.clear();
    trade.prevOfferedCoins = 0;
    trade.prevRequestedCoins = 0;

    const fromPlayer = this.state.players.get(client.sessionId);
    const toPlayer = this.state.players.get(toSessionId);
    this.state.lastAction = `${fromPlayer?.displayName} proposed a trade to ${toPlayer?.displayName}.`;
    this.addLog(this.state.lastAction, "trade");
    console.log(`Trade proposed: ${fromPlayer?.displayName} → ${toPlayer?.displayName}`);

    // Pause turn timer during trade
    this.pauseTurnTimer();
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

    const fromPlayer = this.state.players.get(trade.fromSessionId);
    const toPlayer = this.state.players.get(trade.toSessionId);

    const result = executeTrade(this.state);
    this.state.lastAction = result;
    this.addLog(result, "trade");
    console.log("Trade completed:", result);

    // Track trade for both players
    if (fromPlayer?.discordUserId) {
      const fromClient = this.getClientBySessionId(fromPlayer.sessionId);
      if (fromClient) {
        this.trackAndNotify(fromClient, fromPlayer.discordUserId, "trades_completed", "trade_completed");
        this.checkMonopolyAchievement(fromClient, fromPlayer);
      }
    }
    if (toPlayer?.discordUserId) {
      const toClient = this.getClientBySessionId(toPlayer.sessionId);
      if (toClient) {
        this.trackAndNotify(toClient, toPlayer.discordUserId, "trades_completed", "trade_completed");
        this.checkMonopolyAchievement(toClient, toPlayer);
      }
    }

    // Resume turn timer after trade completes
    this.resumeTurnTimer();
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
    this.addLog(this.state.lastAction, "trade");
    clearTrade(this.state);
    console.log(`Trade rejected by ${toPlayer?.displayName}`);

    // Resume turn timer after trade rejected
    this.resumeTurnTimer();
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
    this.addLog(this.state.lastAction, "trade");
    clearTrade(this.state);
    console.log(`Trade cancelled by ${fromPlayer?.displayName}`);

    // Resume turn timer after trade cancelled
    this.resumeTurnTimer();
  }

  private handleCounterOffer(
    client: Client,
    data: {
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

    const { offeredProperties, requestedProperties, offeredCoins, requestedCoins } = data;

    const result = processCounterOffer(
      this.state,
      client.sessionId,
      offeredProperties || [],
      requestedProperties || [],
      offeredCoins || 0,
      requestedCoins || 0
    );

    if (!result.success) {
      client.send("error", { message: result.message });
      return;
    }

    this.state.lastAction = result.message;
    this.addLog(this.state.lastAction, "trade");
    console.log(`Counter-offer: ${result.message}`);
  }

  private handlePayJailFine(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!currentPlayer.inJail) {
      client.send("error", { message: "You are not in jail." });
      return;
    }

    if (this.state.hasRolled) {
      client.send("error", { message: "You already rolled this turn." });
      return;
    }

    if (currentPlayer.coins < JAIL_FINE) {
      client.send("error", { message: `You need at least ${JAIL_FINE} coins to pay the fine.` });
      return;
    }

    currentPlayer.coins -= JAIL_FINE;
    releaseFromJail(currentPlayer);
    this.state.lastAction = `${currentPlayer.displayName} paid ${JAIL_FINE} coins to get out of Jail!`;
    this.addLog(this.state.lastAction, "jail");

    // Track jail escape
    this.trackAndNotify(client, currentPlayer.discordUserId, "jail_escapes", "jail_escape");
  }

  private handleUseJailCard(client: Client): void {
    if (this.state.phase !== "playing") return;

    const currentPlayer = getCurrentPlayer(this.state);
    if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
      client.send("error", { message: "It's not your turn." });
      return;
    }

    if (!currentPlayer.inJail) {
      client.send("error", { message: "You are not in jail." });
      return;
    }

    if (this.state.hasRolled) {
      client.send("error", { message: "You already rolled this turn." });
      return;
    }

    if (currentPlayer.jailFreeCards <= 0) {
      client.send("error", { message: "You don't have a Get Out of Jail Free card." });
      return;
    }

    currentPlayer.jailFreeCards--;
    releaseFromJail(currentPlayer);
    this.state.lastAction = `${currentPlayer.displayName} used a Get Out of Jail Free card!`;
    this.addLog(this.state.lastAction, "jail");

    // Track jail escape
    this.trackAndNotify(client, currentPlayer.discordUserId, "jail_escapes", "jail_escape");
  }

  private handleDismissCard(client: Client): void {
    if (this.state.drawnCard.forSessionId !== client.sessionId) {
      return;
    }
    clearDrawnCard(this.state);
  }

  private handleMortgageProperty(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    const result = mortgageProperty(this.state, player, data.spaceIndex);
    this.state.lastAction = result;
    this.addLog(result);
  }

  private handleUnmortgageProperty(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    const result = unmortgageProperty(this.state, player, data.spaceIndex);
    this.state.lastAction = result;
    this.addLog(result);
  }

  private handleSellHouse(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    const result = sellHouse(this.state, player, data.spaceIndex);
    this.state.lastAction = result;
    this.addLog(result, "build");
  }

  private handleSellHotel(client: Client, data: { spaceIndex: number; convertToHouses: boolean }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    const result = sellHotel(this.state, player, data.spaceIndex, data.convertToHouses ?? false);
    this.state.lastAction = result;
    this.addLog(result, "build");
  }

  private handlePlaceBid(client: Client, data: { amount: number }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    if (this.state.activeAuction.status !== "active") {
      client.send("error", { message: "No auction is currently active." });
      return;
    }

    const auctionPropIndex = this.state.activeAuction.propertyIndex;
    const auctionSpace = this.state.boardSpaces[auctionPropIndex];
    const result = placeBid(this.state, player, data.amount);
    this.state.lastAction = result;
    this.addLog(result, "auction");

    // Check if auction ended with a winner (indicated by "won" in the result)
    if (result.includes("won") && result.includes("for")) {
      // Track auction win
      this.trackAndNotify(client, player.discordUserId, "auctions_won", "auction_won");
      this.trackAndNotify(client, player.discordUserId, "properties_bought", "property_bought");

      // Check auction_snipe achievement
      if (auctionSpace && data.amount < auctionSpace.price / 2) {
        this.tryInGameAchievement(client, player.discordUserId, "auction_snipe");
      }

      // Track spending
      const track = this.getInGameTrack(player.sessionId);
      track.coinsSpent += data.amount;
      if (track.coinsSpent >= 2000) {
        this.tryInGameAchievement(client, player.discordUserId, "big_spender");
      }

      this.checkMonopolyAchievement(client, player);
    }

    // If auction just ended and current player had doubles, allow re-roll
    if (this.state.activeAuction.status !== "active") {
      const turnPlayer = getCurrentPlayer(this.state);
      if (turnPlayer && turnPlayer.doublesCount > 0 && !turnPlayer.inJail && turnPlayer.isActive) {
        this.state.hasRolled = false;
      }
      // Resume turn timer after auction ends
      this.resumeTurnTimer();
    }
  }

  private handlePassAuction(client: Client): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isActive || player.isBankrupt) {
      client.send("error", { message: "You are not an active player." });
      return;
    }

    if (this.state.activeAuction.status !== "active") {
      client.send("error", { message: "No auction is currently active." });
      return;
    }

    const auctionPropIndex = this.state.activeAuction.propertyIndex;
    const auctionSpace = this.state.boardSpaces[auctionPropIndex];
    const highestBidderId = this.state.activeAuction.highestBidderId;
    const currentBid = this.state.activeAuction.currentBid;

    const result = passAuction(this.state, player);
    this.state.lastAction = result;
    this.addLog(result, "auction");

    // Check if auction ended with a winner
    if (result.includes("won") && result.includes("for") && highestBidderId) {
      const winner = this.state.players.get(highestBidderId);
      if (winner?.discordUserId) {
        const winnerClient = this.getClientBySessionId(highestBidderId);
        if (winnerClient) {
          this.trackAndNotify(winnerClient, winner.discordUserId, "auctions_won", "auction_won");
          this.trackAndNotify(winnerClient, winner.discordUserId, "properties_bought", "property_bought");

          if (auctionSpace && currentBid < auctionSpace.price / 2) {
            this.tryInGameAchievement(winnerClient, winner.discordUserId, "auction_snipe");
          }

          const track = this.getInGameTrack(winner.sessionId);
          track.coinsSpent += currentBid;
          if (track.coinsSpent >= 2000) {
            this.tryInGameAchievement(winnerClient, winner.discordUserId, "big_spender");
          }

          this.checkMonopolyAchievement(winnerClient, winner);
        }
      }
    }

    // If auction just ended and current player had doubles, allow re-roll
    if (this.state.activeAuction.status !== "active") {
      const turnPlayer = getCurrentPlayer(this.state);
      if (turnPlayer && turnPlayer.doublesCount > 0 && !turnPlayer.inJail && turnPlayer.isActive) {
        this.state.hasRolled = false;
      }
      // Resume turn timer after auction ends
      this.resumeTurnTimer();
    }
  }

  /** Check if a player just completed a monopoly */
  private checkMonopolyAchievement(client: Client, player: Player): void {
    if (!player.discordUserId) return;

    for (const district of Object.keys(DISTRICT_PROPERTIES)) {
      if (playerHasMonopoly(this.state, player.sessionId, district)) {
        // Track monopoly stat + check achievement
        const { achievements, goals } = this.trackStat(
          player.discordUserId, "monopolies_completed", "monopoly_completed"
        );
        this.sendProgressNotifications(client, achievements, goals);
        // Also try the one-time monopoly_maker
        this.tryInGameAchievement(client, player.discordUserId, "monopoly_maker");
        break; // Only count once per action
      }
    }
  }

  /**
   * Award gems to all players at end of game.
   * Also tracks stats and checks achievements.
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

        // Track games_played stat
        incrementStat(player.discordUserId, "games_played");

        // Track game_played goal trigger
        const pClient = this.getClientBySessionId(player.sessionId);

        if (player.sessionId === winner) {
          incrementStat(player.discordUserId, "games_won");

          // Check comeback_kid
          const track = this.getInGameTrack(player.sessionId);
          if (track.hadLowCoins && pClient) {
            this.tryInGameAchievement(pClient, player.discordUserId, "comeback_kid");
          }
        }

        // Check stat achievements after game end
        const achievements = checkStatAchievements(player.discordUserId);
        const goalCompletions = processGoalTrigger(player.discordUserId, "game_played");

        // Winner also triggers game_won goal
        let wonGoals: GoalCompletionResult[] = [];
        if (player.sessionId === winner) {
          wonGoals = processGoalTrigger(player.discordUserId, "game_won");
        }

        if (pClient) {
          this.sendProgressNotifications(pClient, achievements, [...goalCompletions, ...wonGoals]);
        }
      } catch (err) {
        console.error(`Failed to award gems to ${player.displayName}:`, err);
      }
    });
  }

  private handleReturnToLobby(client: Client): void {
    if (this.state.phase !== "finished") {
      client.send("error", { message: "Game is not finished." });
      return;
    }

    if (client.sessionId !== this.state.hostSessionId) {
      client.send("error", { message: "Only the host can return to the lobby." });
      return;
    }

    this.clearTurnTimer();
    this.state.phase = "lobby";
    this.state.currentPlayerIndex = 0;
    this.state.dice1 = 0;
    this.state.dice2 = 0;
    this.state.turnCount = 0;
    this.state.winnerId = "";
    this.state.lastAction = "";
    this.state.awaitingBuy = false;
    this.state.hasRolled = false;
    this.gemsAwarded = false;

    this.state.boardSpaces.clear();
    initializeBoard(this.state);

    clearTrade(this.state);
    clearDrawnCard(this.state);
    clearBankruptcyNegotiation(this.state);
    if (this.bankruptcyTimer) {
      this.bankruptcyTimer.clear();
      this.bankruptcyTimer = null;
    }
    this.state.activeAuction.status = "none";
    this.state.activeAuction.currentBid = 0;
    this.state.activeAuction.highestBidderId = "";
    this.state.activeAuction.passedPlayers.clear();

    this.state.gameLog.clear();
    this.inGameTracking.clear();

    this.state.players.forEach((player) => {
      player.position = 0;
      player.coins = STARTING_COINS;
      player.ownedProperties.clear();
      player.isActive = true;
      player.isBankrupt = false;
      player.inJail = false;
      player.jailTurnsRemaining = 0;
      player.jailFreeCards = 0;
      player.doublesCount = 0;
    });

    this.playerOrder = [];
    this.state.players.forEach((player) => {
      this.playerOrder.push(player.sessionId);
    });

    // Resend player store data (with cosmetics)
    this.state.players.forEach((player) => {
      if (player.discordUserId) {
        try {
          const dbPlayer = getPlayer(player.discordUserId);
          const playerClient = this.clients.find((c) => c.sessionId === player.sessionId);
          if (playerClient) {
            playerClient.send("player_data", {
              gems: dbPlayer.gems,
              ownedPieces: dbPlayer.owned_pieces,
              selectedPiece: dbPlayer.selected_piece,
              ownedCosmetics: dbPlayer.owned_cosmetics,
              equippedTitle: dbPlayer.equipped_title,
              equippedTheme: dbPlayer.equipped_theme,
              equippedDice: dbPlayer.equipped_dice,
            });
          }
        } catch (err) {
          console.error("Failed to resend player data:", err);
        }
      }
    });

    this.state.lastAction = "Returned to lobby. Ready for a new game!";
    this.addLog(this.state.lastAction, "info");
    console.log("Game returned to lobby");
  }

  private startBankruptcyTimer(): void {
    if (this.bankruptcyTimer) this.bankruptcyTimer.clear();
    this.bankruptcyTimer = this.clock.setInterval(() => {
      if (this.state.bankruptcyNegotiation.status !== "active") {
        if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
        return;
      }
      if (isBankruptcyTimedOut(this.state)) {
        const r = handleBankruptcyTimeout(this.state);
        this.state.lastAction = r;
        this.addLog(r, "bankrupt");
        if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
        if (checkGameOver(this.state)) {
          this.clearTurnTimer();
          const e = advanceTurn(this.state);
          this.state.lastAction = e;
          this.addLog(e);
          if ((this.state.phase as string) === "finished") this.awardEndGameGems();
        } else {
          // Resume turn timer after bankruptcy timeout
          this.resumeTurnTimer();
        }
      }
    }, 1000);
  }

  private handleBankruptcySellBuilding(client: Client, data: { spaceIndex: number; type: string; convertToHouses?: boolean }): void {
    if (this.state.phase !== "playing" || this.state.bankruptcyNegotiation.status !== "active") return;
    if (this.state.bankruptcyNegotiation.debtorSessionId !== client.sessionId) {
      client.send("error", { message: "Not the debtor." });
      return;
    }
    const pl = this.state.players.get(client.sessionId);
    if (!pl) return;
    const res = data.type === "hotel"
      ? sellHotel(this.state, pl, data.spaceIndex, data.convertToHouses ?? false)
      : sellHouse(this.state, pl, data.spaceIndex);
    this.state.lastAction = res;
    this.addLog(res, "build");
  }

  private handleBankruptcyMortgage(client: Client, data: { spaceIndex: number }): void {
    if (this.state.phase !== "playing" || this.state.bankruptcyNegotiation.status !== "active") return;
    if (this.state.bankruptcyNegotiation.debtorSessionId !== client.sessionId) {
      client.send("error", { message: "Not the debtor." });
      return;
    }
    const pl = this.state.players.get(client.sessionId);
    if (!pl) return;
    const res = mortgageProperty(this.state, pl, data.spaceIndex);
    this.state.lastAction = res;
    this.addLog(res);
  }

  private handleBankruptcyPayDebt(client: Client): void {
    if (this.state.phase !== "playing" || this.state.bankruptcyNegotiation.status !== "active") return;
    if (this.state.bankruptcyNegotiation.debtorSessionId !== client.sessionId) {
      client.send("error", { message: "Not the debtor." });
      return;
    }
    const res = resolveBankruptcyPayment(this.state);
    if (!res) {
      client.send("error", { message: "Not enough coins to pay the debt." });
      return;
    }
    this.state.lastAction = res;
    this.addLog(res, "bankruptcy");
    if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
    if (checkGameOver(this.state)) {
      this.clearTurnTimer();
      const e = advanceTurn(this.state);
      this.state.lastAction = e;
      this.addLog(e);
      if ((this.state.phase as string) === "finished") this.awardEndGameGems();
    } else {
      // Resume turn timer after debt paid
      this.resumeTurnTimer();
    }
  }

  private handleBankruptcyDeclare(client: Client): void {
    if (this.state.phase !== "playing" || this.state.bankruptcyNegotiation.status !== "active") return;
    if (this.state.bankruptcyNegotiation.debtorSessionId !== client.sessionId) {
      client.send("error", { message: "Not the debtor." });
      return;
    }
    const res = declareBankruptcy(this.state);
    this.state.lastAction = res;
    this.addLog(res, "bankrupt");
    if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
    if (checkGameOver(this.state)) {
      this.clearTurnTimer();
      const e = advanceTurn(this.state);
      this.state.lastAction = e;
      this.addLog(e);
      if ((this.state.phase as string) === "finished") this.awardEndGameGems();
    } else {
      // Resume turn timer after bankruptcy declared
      this.resumeTurnTimer();
    }
  }
  onDispose(): void {
    this.clearTurnTimer();
    if (this.bankruptcyTimer) { this.bankruptcyTimer.clear(); this.bankruptcyTimer = null; }
    if (this.state.phase === "finished" && this.state.winnerId) {
      this.awardEndGameGems();
    }
    console.log("GameRoom disposed:", this.roomId);
  }
}
