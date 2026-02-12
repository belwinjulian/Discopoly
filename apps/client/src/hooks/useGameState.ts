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
  skipNextTurn: boolean;
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
}

export interface TradeOfferState {
  status: string; // "none" | "pending"
  fromSessionId: string;
  toSessionId: string;
  offeredProperties: number[];
  requestedProperties: number[];
  offeredCoins: number;
  requestedCoins: number;
}

export interface DrawnCardState {
  deck: string;          // "community" | "chance" | ""
  title: string;
  description: string;
  forSessionId: string;  // who drew it
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
        skipNextTurn: player.skipNextTurn,
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
  };

  const drawnCard: DrawnCardState = {
    deck: state.drawnCard?.deck || "",
    title: state.drawnCard?.title || "",
    description: state.drawnCard?.description || "",
    forSessionId: state.drawnCard?.forSessionId || "",
  };

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
  };
}

export interface PlayerStoreData {
  gems: number;
  ownedPieces: string[];
  selectedPiece: string;
}

export function useGameState(room: Room | null) {
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerStoreData, setPlayerStoreData] = useState<PlayerStoreData | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleStateChange = (state: any) => {
      setGameState(snapshotState(state));
    };

    // Listen for state changes
    room.onStateChange(handleStateChange);

    // Listen for errors from server
    room.onMessage("error", (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    // Listen for player store data (gems, owned pieces)
    room.onMessage("player_data", (data: PlayerStoreData) => {
      setPlayerStoreData(data);
    });

    // Set initial state if available
    if (room.state) {
      setGameState(snapshotState(room.state));
    }

    return () => {
      // Cleanup is handled by room.leave()
    };
  }, [room]);

  const sendMessage = useCallback(
    (type: string, data?: any) => {
      if (room) {
        room.send(type, data);
      }
    },
    [room]
  );

  return { gameState, error, sendMessage, playerStoreData, setPlayerStoreData };
}
