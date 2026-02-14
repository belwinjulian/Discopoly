import React, { useState, useEffect, useCallback, useRef } from "react";
import { Room } from "@colyseus/sdk";
import { initDiscordSdk, getAvatarUrl, getAccessToken, getChannelId, DiscordUser } from "./discordSdk";
import { joinOrCreateGame } from "./colyseus";
import { useGameState, PlayerState, PlayerStoreData, BoardSpaceState } from "./hooks/useGameState";
import { usePieceAnimation } from "./hooks/usePieceAnimation";
import { Lobby } from "./components/Lobby";
import { Board } from "./components/Board";
import { DiceRoll } from "./components/DiceRoll";
import { GameControls } from "./components/GameControls";
import { PlayerPanel } from "./components/PlayerPanel";
import { GameOver } from "./components/GameOver";
import { TurnSplash } from "./components/TurnSplash";
import { GameEvent } from "./components/GameEvent";
import { TradeModal } from "./components/TradeModal";
import { CardModal } from "./components/CardModal";
import { PropertyInfoModal } from "./components/PropertyInfoModal";
import { AuctionModal } from "./components/AuctionModal";
import { BankruptcyModal } from "./components/BankruptcyModal";
import { GameLog } from "./components/GameLog";
import { AchievementToast } from "./components/AchievementToast";
import { TurnTimer } from "./components/TurnTimer";
import { DISTRICT_PROPERTIES, HOUSE_COST, HOTEL_COST } from "./data/boardSpaces";
import "./styles/game.css";
import "./styles/auction.css";
import "./styles/gameover.css";
import "./styles/animations.css";
import "./styles/gamelog.css";
import "./styles/goals.css";
import "./styles/achievements.css";
import "./styles/turntimer.css";
import "./styles/bankruptcy.css";

/** Check if player can build anything (used for auto-end decision) */
function canPlayerBuild(boardSpaces: BoardSpaceState[], sessionId: string, coins: number): boolean {
  for (const [district, indices] of Object.entries(DISTRICT_PROPERTIES)) {
    const ownsAll = indices.every((idx) => boardSpaces[idx]?.ownerId === sessionId);
    if (!ownsAll) continue;

    // Can't build if any property in the district is mortgaged
    const anyMortgaged = indices.some((idx) => boardSpaces[idx]?.isMortgaged);
    if (anyMortgaged) continue;

    const houseCost = HOUSE_COST[district] || 100;
    const hotelCost = HOTEL_COST[district] || 100;
    // Can build a house?
    if (coins >= houseCost) {
      for (const idx of indices) {
        const s = boardSpaces[idx];
        if (!s.hasHotel && s.houses < 4) return true;
      }
    }
    // Can build a hotel?
    if (coins >= hotelCost) {
      const allAtFour = indices.every((idx) => {
        const s = boardSpaces[idx];
        return s.houses === 4 || s.hasHotel;
      });
      if (allAtFour && indices.some((idx) => boardSpaces[idx].houses === 4 && !boardSpaces[idx].hasHotel)) {
        return true;
      }
    }
  }
  return false;
}

type AppPhase = "loading" | "connected" | "error";

// Detect event type from lastAction message
function detectEventType(msg: string): "buy" | "rent" | "tax" | "payday" | "bankrupt" | "build" | "trade" | "card" | "info" {
  if (msg.includes("drew \"")) return "card";
  if (msg.includes("completed a trade")) return "trade";
  if (msg.includes("built a house") || msg.includes("built a HOTEL")) return "build";
  if (msg.includes("sold a house") || msg.includes("sold the hotel")) return "build";
  if (msg.includes("bought") || msg.includes("purchased")) return "buy";
  if (msg.includes("won") && msg.includes("for") && msg.includes("coins")) return "buy"; // Auction win
  if (msg.includes("mortgaged") || msg.includes("unmortgaged")) return "buy";
  if (msg.includes("bid") && msg.includes("coins")) return "info"; // Auction bid
  if (msg.includes("auction") || msg.includes("Auction")) return "info"; // Auction events
  if (msg.includes("rent") || msg.includes("paid")) return "rent";
  if (msg.includes("tax") || msg.includes("Tax")) return "tax";
  if (msg.includes("Payday") || msg.includes("payday") || msg.includes("collected")) return "payday";
  if (msg.includes("bankrupt") || msg.includes("Bankrupt")) return "bankrupt";
  return "info";
}

export const App: React.FC = () => {
  const [appPhase, setAppPhase] = useState<AppPhase>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [mySessionId, setMySessionId] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("Connecting...");
  const [connectionError, setConnectionError] = useState("");

  // Animation states
  const [showTurnSplash, setShowTurnSplash] = useState(false);
  const [turnSplashKey, setTurnSplashKey] = useState(0);
  const [eventMessage, setEventMessage] = useState("");
  const [eventType, setEventType] = useState<"info" | "buy" | "rent" | "tax" | "payday" | "bankrupt" | "build" | "trade" | "card">("info");
  const [eventKey, setEventKey] = useState(0);

  const prevTurnRef = useRef<number>(-1);
  const prevActionRef = useRef<string>("");
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventRef = useRef<{ message: string; type: string } | null>(null);
  const prevAnimatingRef = useRef(false);

  const {
    gameState, error, sendMessage, playerStoreData, setPlayerStoreData,
    achievementNotifications, goalNotifications, dismissAchievement, dismissGoal,
  } = useGameState(room);

  // Board ref for piece animation position calculations
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Piece animation hook
  const pieceAnim = usePieceAnimation(
    gameState?.players ?? new Map(),
    boardRef
  );

  // Initialize Discord SDK and connect to Colyseus
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoadingMessage("Initializing Discord...");
        const user = await initDiscordSdk();

        if (!mounted) return;

        setLoadingMessage("Joining game...");
        const displayName = user?.global_name || user?.username || "Player";
        const avatarUrl = user ? getAvatarUrl(user) : "";

        const userId = user?.id || "";
        setDiscordUserId(userId);

        const joinedRoom = await joinOrCreateGame({
          discordUserId: userId,
          displayName,
          avatarUrl,
          accessToken: getAccessToken() || undefined,
          channelId: getChannelId() || undefined,
        });

        if (!mounted) return;

        setRoom(joinedRoom);
        setMySessionId(joinedRoom.sessionId);
        setAppPhase("connected");

        joinedRoom.onLeave(() => {
          if (mounted) {
            setAppPhase("error");
            setConnectionError("Disconnected from the game.");
          }
        });
      } catch (err) {
        if (mounted) {
          console.error("Failed to initialize:", err);
          setAppPhase("error");
          setConnectionError(
            err instanceof Error ? err.message : "Failed to connect to the game."
          );
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (room) {
        room.leave();
      }
    };
  }, []);

  // Detect turn changes → show splash
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;

    const turnIndex = gameState.currentPlayerIndex;
    if (turnIndex !== prevTurnRef.current && prevTurnRef.current !== -1) {
      setShowTurnSplash(false);
      // Small delay to reset animation
      setTimeout(() => {
        setShowTurnSplash(true);
        setTurnSplashKey((k) => k + 1);
      }, 100);
    } else if (prevTurnRef.current === -1) {
      // First turn of the game
      setShowTurnSplash(true);
      setTurnSplashKey((k) => k + 1);
    }
    prevTurnRef.current = turnIndex;
  }, [gameState?.currentPlayerIndex, gameState?.phase]);

  // Detect action changes → show event animation (deferred if piece is animating)
  // Uses isAnimatingRef (synchronous) instead of isAnimating (state) because
  // both lastAction and position change in the same render, and the animation
  // hook's setAnimState hasn't committed yet when this effect runs.
  useEffect(() => {
    if (!gameState || !gameState.lastAction) return;
    if (gameState.lastAction !== prevActionRef.current && gameState.lastAction !== "") {
      const action = gameState.lastAction;
      // Don't show event for turn start / generic messages
      if (!action.includes("joined") && !action.includes("started") && !action.includes("'s turn")) {
        const type = detectEventType(action);
        if (pieceAnim.isAnimatingRef.current) {
          // Queue event until piece lands
          pendingEventRef.current = { message: action, type };
        } else {
          setEventType(type as typeof eventType);
          setEventMessage(action);
          setEventKey((k) => k + 1);
        }
      }
      prevActionRef.current = action;
    }
  }, [gameState?.lastAction]);

  // Flush pending event when piece animation ends
  useEffect(() => {
    if (prevAnimatingRef.current && !pieceAnim.isAnimating) {
      const pending = pendingEventRef.current;
      if (pending) {
        setEventType(pending.type as typeof eventType);
        setEventMessage(pending.message);
        setEventKey((k) => k + 1);
        pendingEventRef.current = null;
      }
    }
    prevAnimatingRef.current = pieceAnim.isAnimating;
  }, [pieceAnim.isAnimating]);

  // Auto-end turn after rolling (when no buy prompt AND no build options)
  // Delays until piece animation finishes
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;

    // Don't auto-end while piece animation is running, a card is displayed,
    // an auction is active, a trade is pending, or bankruptcy negotiation is active
    if (pieceAnim.isAnimating) return;
    if (gameState.drawnCard.deck !== "") return;
    if (gameState.activeAuction.status === "active") return;
    if (gameState.activeTrade.status === "pending") return;
    if (gameState.bankruptcyNegotiation.status === "active") return;

    const activePlayers = Array.from(gameState.players.values())
      .filter((p) => p.isActive && !p.isBankrupt)
      .sort((a, b) => a.playerIndex - b.playerIndex);
    const currentPlayer = activePlayers[gameState.currentPlayerIndex % activePlayers.length];
    const isMyTurn = currentPlayer?.sessionId === mySessionId;

    // If it's my turn, I've rolled, no buy prompt, and no build options → auto end turn
    // Don't auto-end if still in jail (failed doubles roll)
    if (isMyTurn && gameState.hasRolled && !gameState.awaitingBuy) {
      const myPlayer = gameState.players.get(mySessionId);
      const hasBuildOptions = myPlayer && !myPlayer.inJail
        ? canPlayerBuild(gameState.boardSpaces, mySessionId, myPlayer.coins)
        : false;

      if (!hasBuildOptions && !myPlayer?.inJail) {
        if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = setTimeout(() => {
          sendMessage("end_turn");
        }, 1500);
      }
    }

    return () => {
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    };
  }, [gameState?.hasRolled, gameState?.awaitingBuy, gameState?.currentPlayerIndex, gameState?.boardSpaces, gameState?.drawnCard.deck, gameState?.activeAuction.status, gameState?.activeTrade.status, gameState?.bankruptcyNegotiation.status, mySessionId, sendMessage, pieceAnim.isAnimating]);

  // Piece selection
  const handleSelectPiece = useCallback((pieceId: string) => {
    sendMessage("select_piece", { pieceId });
    // Optimistically update local store data
    if (playerStoreData) {
      setPlayerStoreData({ ...playerStoreData, selectedPiece: pieceId });
    }
  }, [sendMessage, playerStoreData, setPlayerStoreData]);

  const handleStoreUpdate = useCallback((data: PlayerStoreData) => {
    setPlayerStoreData(data);
  }, [setPlayerStoreData]);

  // Game actions
  const handleStartGame = useCallback(() => sendMessage("start_game"), [sendMessage]);
  const handleRollDice = useCallback(() => sendMessage("roll_dice"), [sendMessage]);
  const handleBuyProperty = useCallback(() => {
    sendMessage("buy_property");
    // After buying, the auto-end effect will kick in if no build options
  }, [sendMessage]);
  const handleSkipBuy = useCallback(() => {
    sendMessage("skip_buy");
    // After skipping, the auto-end effect will kick in if no build options
  }, [sendMessage]);
  const handleBuildHouse = useCallback((spaceIndex: number) => {
    sendMessage("build_house", { spaceIndex });
  }, [sendMessage]);
  const handleBuildHotel = useCallback((spaceIndex: number) => {
    sendMessage("build_hotel", { spaceIndex });
  }, [sendMessage]);
  const handleEndTurn = useCallback(() => {
    sendMessage("end_turn");
  }, [sendMessage]);
  const handlePayJailFine = useCallback(() => {
    sendMessage("pay_jail_fine");
  }, [sendMessage]);
  const handleUseJailCard = useCallback(() => {
    sendMessage("use_jail_card");
  }, [sendMessage]);

  // Property info modal state
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | null>(null);

  // Trade state
  const [tradeTargetSessionId, setTradeTargetSessionId] = useState<string | null>(null);

  const handleTradeWith = useCallback((targetSessionId: string) => {
    setTradeTargetSessionId(targetSessionId);
  }, []);

  const handleProposeTrade = useCallback((data: {
    toSessionId: string;
    offeredProperties: number[];
    requestedProperties: number[];
    offeredCoins: number;
    requestedCoins: number;
  }) => {
    sendMessage("propose_trade", data);
    setTradeTargetSessionId(null); // Close propose modal; waiting mode will open via state
  }, [sendMessage]);

  const handleAcceptTrade = useCallback(() => {
    sendMessage("accept_trade");
  }, [sendMessage]);

  const handleRejectTrade = useCallback(() => {
    sendMessage("reject_trade");
  }, [sendMessage]);

  const handleCancelTrade = useCallback(() => {
    sendMessage("cancel_trade");
  }, [sendMessage]);

  const handleCounterOffer = useCallback((data: {
    offeredProperties: number[];
    requestedProperties: number[];
    offeredCoins: number;
    requestedCoins: number;
  }) => {
    sendMessage("counter_offer", data);
  }, [sendMessage]);

  const handleCloseTradeModal = useCallback(() => {
    setTradeTargetSessionId(null);
  }, []);

  // Card dismiss handler
  const handleDismissCard = useCallback(() => {
    sendMessage("dismiss_card");
  }, [sendMessage]);

  // Mortgage handlers
  const handleMortgageProperty = useCallback((spaceIndex: number) => {
    sendMessage("mortgage_property", { spaceIndex });
  }, [sendMessage]);

  const handleUnmortgageProperty = useCallback((spaceIndex: number) => {
    sendMessage("unmortgage_property", { spaceIndex });
  }, [sendMessage]);

  // Sell building handlers
  const handleSellHouse = useCallback((spaceIndex: number) => {
    sendMessage("sell_house", { spaceIndex });
  }, [sendMessage]);

  const handleSellHotel = useCallback((spaceIndex: number, convertToHouses: boolean) => {
    sendMessage("sell_hotel", { spaceIndex, convertToHouses });
  }, [sendMessage]);

  // Auction handlers
  const handlePlaceBid = useCallback((amount: number) => {
    sendMessage("place_bid", { amount });
  }, [sendMessage]);

  const handlePassAuction = useCallback(() => {
    sendMessage("pass_auction");
  }, [sendMessage]);

  // Bankruptcy negotiation handlers
  const handleBankruptcySellBuilding = useCallback((spaceIndex: number, type: string, convertToHouses?: boolean) => {
    sendMessage("bankruptcy_sell_building", { spaceIndex, type, convertToHouses: convertToHouses || false });
  }, [sendMessage]);

  const handleBankruptcyMortgage = useCallback((spaceIndex: number) => {
    sendMessage("bankruptcy_mortgage", { spaceIndex });
  }, [sendMessage]);

  const handleBankruptcyPayDebt = useCallback(() => {
    sendMessage("bankruptcy_pay_debt");
  }, [sendMessage]);

  const handleBankruptcyDeclare = useCallback(() => {
    sendMessage("bankruptcy_declare");
  }, [sendMessage]);

  // Turn timer extension handler
  const handleRequestTimeExtension = useCallback(() => {
    sendMessage("request_time_extension");
  }, [sendMessage]);

  // Quit game state
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const handleQuitGame = useCallback(() => {
    if (room) {
      room.leave();
    }
  }, [room]);

  // Return to lobby handler — resets client-side animation/turn refs
  const handleReturnToLobby = useCallback(() => {
    sendMessage("return_to_lobby");
    prevTurnRef.current = -1;
    prevActionRef.current = "";
    setShowTurnSplash(false);
    setEventMessage("");
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
  }, [sendMessage]);

  // Determine if trade modal should be visible
  const showTradeModal =
    tradeTargetSessionId !== null ||
    (gameState?.activeTrade.status === "pending" &&
      (gameState.activeTrade.toSessionId === mySessionId ||
        gameState.activeTrade.fromSessionId === mySessionId));

  // Loading screen
  if (appPhase === "loading") {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>{loadingMessage}</p>
      </div>
    );
  }

  // Error screen
  if (appPhase === "error") {
    return (
      <div className="loading-screen">
        <p className="error-text">{connectionError}</p>
        <button
          className="retry-btn"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Waiting for state
  if (!gameState) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading game state...</p>
      </div>
    );
  }

  // Derive spectator status
  const isSpectator = gameState.spectators.has(mySessionId);

  // Lobby phase
  if (gameState.phase === "lobby") {
    if (isSpectator) {
      return (
        <div className="loading-screen">
          <p>Waiting for game to start...</p>
        </div>
      );
    }
    return (
      <Lobby
        gameState={gameState}
        mySessionId={mySessionId}
        onStartGame={handleStartGame}
        onSelectPiece={handleSelectPiece}
        playerStoreData={playerStoreData}
        discordUserId={discordUserId}
        onStoreUpdate={handleStoreUpdate}
      />
    );
  }

  // Game over phase
  if (gameState.phase === "finished") {
    return <GameOver gameState={gameState} mySessionId={mySessionId} onReturnToLobby={handleReturnToLobby} />;
  }

  // Playing phase
  const playersArray = Array.from(gameState.players.values());
  const activePlayers = playersArray
    .filter((p) => p.isActive && !p.isBankrupt)
    .sort((a, b) => a.playerIndex - b.playerIndex);
  const currentPlayer = activePlayers[gameState.currentPlayerIndex % activePlayers.length];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;

  return (
    <div className="game-layout">
      {/* Game log overlay */}
      <GameLog gameLog={gameState.gameLog} />

      {/* Achievement / Goal toast notifications */}
      <AchievementToast
        achievementNotifications={achievementNotifications}
        goalNotifications={goalNotifications}
        onDismissAchievement={dismissAchievement}
        onDismissGoal={dismissGoal}
      />

      {/* YOUR TURN splash */}
      <TurnSplash
        key={turnSplashKey}
        visible={showTurnSplash}
        playerName={currentPlayer?.displayName || ""}
        isMyTurn={isMyTurn}
      />

      {/* Game event popup */}
      {eventMessage && (
        <GameEvent
          key={eventKey}
          message={eventMessage}
          type={eventType}
        />
      )}

      {/* Error toast */}
      {error && <div className="error-toast">{error}</div>}

      {/* Main game area */}
      <div className="game-main">
        {/* Dice display */}
        <DiceRoll
          dice1={gameState.dice1}
          dice2={gameState.dice2}
          visible={gameState.hasRolled}
        />

        {/* Board */}
        <Board
          boardSpaces={gameState.boardSpaces}
          players={playersArray}
          lastAction={gameState.lastAction}
          boardRef={boardRef}
          hideTokenForSession={pieceAnim.animatingSessionId}
          isAnimating={pieceAnim.isAnimating}
          animPosition={pieceAnim.currentPos}
          animPieceId={pieceAnim.animPieceId}
          animPlayerIndex={pieceAnim.animPlayerIndex}
          isAnimFinal={pieceAnim.isFinalStep}
          onSpaceClick={(idx) => setSelectedPropertyIndex(idx)}
        />

        {/* Turn Timer */}
        <TurnTimer
          turnStartTime={gameState.turnStartTime}
          turnTimeLimit={gameState.turnTimeLimit}
          turnTimerActive={gameState.turnTimerActive}
          turnExtensionUsed={gameState.turnExtensionUsed}
          currentPlayerName={currentPlayer?.displayName || ""}
          isMyTurn={isMyTurn}
          onRequestExtension={handleRequestTimeExtension}
        />

        {/* Controls */}
        {isSpectator ? (
          <div className="spectator-banner">Spectating</div>
        ) : (
          <div className="controls-bar">
            <GameControls
              gameState={gameState}
              mySessionId={mySessionId}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onBuildHouse={handleBuildHouse}
              onBuildHotel={handleBuildHotel}
              onSellHouse={handleSellHouse}
              onSellHotel={handleSellHotel}
              onEndTurn={handleEndTurn}
              onPayJailFine={handlePayJailFine}
              onUseJailCard={handleUseJailCard}
            />
            <button
              className="controls-btn controls-btn-quit"
              onClick={() => setShowQuitConfirm(true)}
            >
              Quit
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="game-sidebar">
        <PlayerPanel
          gameState={gameState}
          mySessionId={mySessionId}
          onTradeWith={handleTradeWith}
          isSpectator={isSpectator}
        />
      </div>

      {/* Trade modal */}
      {showTradeModal && (
        <TradeModal
          gameState={gameState}
          mySessionId={mySessionId}
          tradeTargetSessionId={tradeTargetSessionId}
          onProposeTrade={handleProposeTrade}
          onAcceptTrade={handleAcceptTrade}
          onRejectTrade={handleRejectTrade}
          onCancelTrade={handleCancelTrade}
          onCounterOffer={handleCounterOffer}
          onClose={handleCloseTradeModal}
        />
      )}

      {/* Card modal */}
      {gameState.drawnCard.deck !== "" && (
        <CardModal
          drawnCard={gameState.drawnCard}
          gameState={gameState}
          mySessionId={mySessionId}
          onDismiss={handleDismissCard}
        />
      )}

      {/* Auction modal */}
      {gameState.activeAuction.status === "active" && (
        <AuctionModal
          gameState={gameState}
          mySessionId={mySessionId}
          onPlaceBid={handlePlaceBid}
          onPass={handlePassAuction}
          isSpectator={isSpectator}
        />
      )}

      {/* Bankruptcy negotiation modal */}
      {gameState.bankruptcyNegotiation.status === "active" && (
        <BankruptcyModal
          gameState={gameState}
          mySessionId={mySessionId}
          onSellBuilding={handleBankruptcySellBuilding}
          onMortgage={handleBankruptcyMortgage}
          onPayDebt={handleBankruptcyPayDebt}
          onDeclareBankruptcy={handleBankruptcyDeclare}
          isSpectator={isSpectator}
        />
      )}

      {/* Property info modal */}
      {selectedPropertyIndex !== null && (
        <PropertyInfoModal
          spaceIndex={selectedPropertyIndex}
          boardSpaces={gameState.boardSpaces}
          players={gameState.players}
          onClose={() => setSelectedPropertyIndex(null)}
          sessionId={mySessionId}
          onMortgage={handleMortgageProperty}
          onUnmortgage={handleUnmortgageProperty}
          onSellHouse={handleSellHouse}
          onSellHotel={handleSellHotel}
        />
      )}

      {/* Quit confirmation */}
      {showQuitConfirm && (
        <div className="quit-overlay">
          <div className="quit-modal">
            <h3 className="quit-title">Quit Game?</h3>
            <p className="quit-text">
              You will go bankrupt and lose all your properties. This cannot be undone.
            </p>
            <div className="quit-buttons">
              <button
                className="quit-btn quit-btn-cancel"
                onClick={() => setShowQuitConfirm(false)}
              >
                Keep Playing
              </button>
              <button
                className="quit-btn quit-btn-confirm"
                onClick={handleQuitGame}
              >
                Quit Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
