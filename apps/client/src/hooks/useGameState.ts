import { useState, useEffect, useCallback, useRef } from "react";
import { Room } from "@colyseus/sdk";

export interface PlayerState {
  sessionId: string;
  discordUserId: string;
  displayName: string;
  avatarUrl: string;
  position: number;
  coins: number;
  ownedProperties: number[];
  isActive: boolean;
  isBankrupt: boolean;
  inJail: boolean;
  jailTurnsRemaining: number;
  jailFreeCards: number;
  doublesCount: number;
  playerIndex: number;
  pieceId: string;
}

export interface BoardSpaceState {
  index: number;
  name: string;
  spaceType: string;
  district: string;
  price: number;
  rent: number;
  ownerId: string;
  houses: number;
  hasHotel: boolean;
  isMortgaged: boolean;
}

export interface TradeOfferState {
  status: string; // "none" | "pending"
  fromSessionId: string;
  toSessionId: string;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredCoins: number;
  requestedCoins: number;
  counterOfferCount: number;
  lastModifiedBy: string;
  isCounterOffer: boolean;
  prevOfferedProperties: number[];
  prevRequestedProperties: number[];
  prevOfferedCoins: number;
  prevRequestedCoins: number;
}

export interface DrawnCardState {
  deck: string;          // "community" | "chance" | ""
  title: string;
  description: string;
  forSessionId: string;  // who drew it
}

export interface SpectatorState {
  sessionId: string;
  discordUserId: string;
  displayName: string;
  avatarUrl: string;
}

export interface LogEntryState {
  message: string;
  type: string;
  timestamp: number;
}

export interface AuctionState {
  status: string;          // "none" | "active"
  propertyIndex: number;
  currentBid: number;
  highestBidderId: string;
  passedPlayers: string[];
}

export interface BankruptcyNegotiationState {
  status: string;           // "none" | "active"
  debtorSessionId: string;
  creditorSessionId: string; // empty = bank
  amountOwed: number;
  reason: string;           // "rent" | "tax" | "card" | "jail_fine"
  deadline: number;         // Unix timestamp (seconds)
}

export interface GameStateSnapshot {
  phase: string;
  currentPlayerIndex: number;
  players: Map<string, PlayerState>;
  boardSpaces: BoardSpaceState[];
  dice1: number;
  dice2: number;
  turnCount: number;
  winnerId: string;
  hostSessionId: string;
  playerCount: number;
  lastAction: string;
  awaitingBuy: boolean;
  hasRolled: boolean;
  activeTrade: TradeOfferState;
  drawnCard: DrawnCardState;
  activeAuction: AuctionState;
  bankruptcyNegotiation: BankruptcyNegotiationState;
  spectators: Map<string, SpectatorState>;
  spectatorCount: number;
  gameLog: LogEntryState[];
  // Turn timer
  turnStartTime: number;
  turnTimeLimit: number;
  turnTimerActive: boolean;
  turnExtensionUsed: boolean;
}

function snapshotState(state: any): GameStateSnapshot {
  const players = new Map<string, PlayerState>();
  if (state.players) {
    state.players.forEach((player: any, key: string) => {
      players.set(key, {
        sessionId: player.sessionId,
        discordUserId: player.discordUserId,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        position: player.position,
        coins: player.coins,
        ownedProperties: player.ownedProperties
          ? Array.from(player.ownedProperties)
          : [],
        isActive: player.isActive,
        isBankrupt: player.isBankrupt,
        inJail: player.inJail || false,
        jailTurnsRemaining: player.jailTurnsRemaining || 0,
        jailFreeCards: player.jailFreeCards || 0,
        doublesCount: player.doublesCount || 0,
        playerIndex: player.playerIndex,
        pieceId: player.pieceId || "car",
      });
    });
  }

  const boardSpaces: BoardSpaceState[] = [];
  if (state.boardSpaces) {
    state.boardSpaces.forEach((space: any) => {
      boardSpaces.push({
        index: space.index,
        name: space.name,
        spaceType: space.spaceType,
        district: space.district,
        price: space.price,
        rent: space.rent,
        ownerId: space.ownerId,
        houses: space.houses || 0,
        hasHotel: space.hasHotel || false,
        isMortgaged: space.isMortgaged || false,
      });
    });
  }

  const activeTrade: TradeOfferState = {
    status: state.activeTrade?.status || "none",
    fromSessionId: state.activeTrade?.fromSessionId || "",
    toSessionId: state.activeTrade?.toSessionId || "",
    offeredProperties: state.activeTrade?.offeredProperties
      ? Array.from(state.activeTrade.offeredProperties)
      : [],
    requestedProperties: state.activeTrade?.requestedProperties
      ? Array.from(state.activeTrade.requestedProperties)
      : [],
    offeredCoins: state.activeTrade?.offeredCoins || 0,
    requestedCoins: state.activeTrade?.requestedCoins || 0,
    counterOfferCount: state.activeTrade?.counterOfferCount || 0,
    lastModifiedBy: state.activeTrade?.lastModifiedBy || "",
    isCounterOffer: state.activeTrade?.isCounterOffer || false,
    prevOfferedProperties: state.activeTrade?.prevOfferedProperties
      ? Array.from(state.activeTrade.prevOfferedProperties)
      : [],
    prevRequestedProperties: state.activeTrade?.prevRequestedProperties
      ? Array.from(state.activeTrade.prevRequestedProperties)
      : [],
    prevOfferedCoins: state.activeTrade?.prevOfferedCoins || 0,
    prevRequestedCoins: state.activeTrade?.prevRequestedCoins || 0,
  };

  const drawnCard: DrawnCardState = {
    deck: state.drawnCard?.deck || "",
    title: state.drawnCard?.title || "",
    description: state.drawnCard?.description || "",
    forSessionId: state.drawnCard?.forSessionId || "",
  };

  const spectators = new Map<string, SpectatorState>();
  if (state.spectators) {
    state.spectators.forEach((spectator: any, key: string) => {
      spectators.set(key, {
        sessionId: spectator.sessionId,
        discordUserId: spectator.discordUserId,
        displayName: spectator.displayName,
        avatarUrl: spectator.avatarUrl,
      });
    });
  }

  const activeAuction: AuctionState = {
    status: state.activeAuction?.status || "none",
    propertyIndex: state.activeAuction?.propertyIndex || 0,
    currentBid: state.activeAuction?.currentBid || 0,
    highestBidderId: state.activeAuction?.highestBidderId || "",
    passedPlayers: state.activeAuction?.passedPlayers
      ? Array.from(state.activeAuction.passedPlayers)
      : [],
  };

  const bankruptcyNegotiation: BankruptcyNegotiationState = {
    status: state.bankruptcyNegotiation?.status || "none",
    debtorSessionId: state.bankruptcyNegotiation?.debtorSessionId || "",
    creditorSessionId: state.bankruptcyNegotiation?.creditorSessionId || "",
    amountOwed: state.bankruptcyNegotiation?.amountOwed || 0,
    reason: state.bankruptcyNegotiation?.reason || "",
    deadline: state.bankruptcyNegotiation?.deadline || 0,
  };

  const gameLog: LogEntryState[] = [];
  if (state.gameLog) {
    state.gameLog.forEach((entry: any) => {
      gameLog.push({
        message: entry.message || "",
        type: entry.type || "info",
        timestamp: entry.timestamp || 0,
      });
    });
  }

  return {
    phase: state.phase || "lobby",
    currentPlayerIndex: state.currentPlayerIndex || 0,
    players,
    boardSpaces,
    dice1: state.dice1 || 0,
    dice2: state.dice2 || 0,
    turnCount: state.turnCount || 0,
    winnerId: state.winnerId || "",
    hostSessionId: state.hostSessionId || "",
    playerCount: state.playerCount || 0,
    lastAction: state.lastAction || "",
    awaitingBuy: state.awaitingBuy || false,
    hasRolled: state.hasRolled || false,
    activeTrade,
    drawnCard,
    activeAuction,
    bankruptcyNegotiation,
    spectators,
    spectatorCount: state.spectatorCount || 0,
    gameLog,
    // Turn timer
    turnStartTime: state.turnStartTime || 0,
    turnTimeLimit: state.turnTimeLimit || 60,
    turnTimerActive: state.turnTimerActive || false,
    turnExtensionUsed: state.turnExtensionUsed || false,
  };
}

export interface PlayerStoreData {
  gems: number;
  ownedPieces: string[];
  selectedPiece: string;
  ownedCosmetics: string[];
  equippedTitle: string;
  equippedTheme: string;
  equippedDice: string;
}

export interface AchievementNotification {
  achievementId: string;
  name: string;
  description: string;
  gems: number;
  tier?: number;
}

export interface GoalNotification {
  goalId: string;
  description: string;
  gems: number;
  type: "daily" | "weekly";
}

export function useGameState(room: Room | null) {
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerStoreData, setPlayerStoreData] = useState<PlayerStoreData | null>(null);
  const [achievementNotifications, setAchievementNotifications] = useState<AchievementNotification[]>([]);
  const [goalNotifications, setGoalNotifications] = useState<GoalNotification[]>([]);

  useEffect(() => {
    if (!room) return;

    const handleStateChange = (state: any) => {
      setGameState(snapshotState(state));
    };

    room.onStateChange(handleStateChange);

    room.onMessage("error", (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    room.onMessage("player_data", (data: PlayerStoreData) => {
      setPlayerStoreData(data);
    });

    room.onMessage("achievement_unlocked", (data: AchievementNotification) => {
      setAchievementNotifications((prev) => [...prev, data]);
    });

    room.onMessage("goal_completed", (data: GoalNotification) => {
      setGoalNotifications((prev) => [...prev, data]);
    });

    if (room.state) {
      setGameState(snapshotState(room.state));
    }

    return () => {};
  }, [room]);

  const sendMessage = useCallback(
    (type: string, data?: any) => {
      if (room) {
        room.send(type, data);
      }
    },
    [room]
  );

  const dismissAchievement = useCallback((index: number) => {
    setAchievementNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const dismissGoal = useCallback((index: number) => {
    setGoalNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    gameState,
    error,
    sendMessage,
    playerStoreData,
    setPlayerStoreData,
    achievementNotifications,
    goalNotifications,
    dismissAchievement,
    dismissGoal,
  };
}
