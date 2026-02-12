import React, { useState } from "react";
import { GameStateSnapshot, BoardSpaceState } from "../hooks/useGameState";
import { DISTRICT_COLORS, DISTRICT_PROPERTIES, HOUSE_COST, HOTEL_COST } from "../data/boardSpaces";
import "../styles/game.css";
import "../styles/animations.css";

interface GameControlsProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  onRollDice: () => void;
  onBuyProperty: () => void;
  onSkipBuy: () => void;
  onBuildHouse: (spaceIndex: number) => void;
  onBuildHotel: (spaceIndex: number) => void;
  onEndTurn: () => void;
  onPayJailFine: () => void;
  onUseJailCard: () => void;
}

/** Check if a player owns all properties in a district */
function hasMonopoly(boardSpaces: BoardSpaceState[], sessionId: string, district: string): boolean {
  const indices = DISTRICT_PROPERTIES[district];
  if (!indices || indices.length === 0) return false;
  return indices.every((idx) => boardSpaces[idx]?.ownerId === sessionId);
}

/** Get buildable properties (even building rule) */
function getBuildableProps(boardSpaces: BoardSpaceState[], sessionId: string, coins: number): number[] {
  const buildable: number[] = [];
  for (const [district, indices] of Object.entries(DISTRICT_PROPERTIES)) {
    if (!hasMonopoly(boardSpaces, sessionId, district)) continue;
    const cost = HOUSE_COST[district] || 100;
    if (coins < cost) continue;

    const houseCounts = indices.map((idx) => {
      const s = boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const minHouses = Math.min(...houseCounts);

    for (let i = 0; i < indices.length; i++) {
      const space = boardSpaces[indices[i]];
      if (space.hasHotel) continue;
      if (space.houses >= 4) continue;
      if (houseCounts[i] <= minHouses) {
        buildable.push(indices[i]);
      }
    }
  }
  return buildable;
}

/** Get hotel-upgradeable properties */
function getHotelProps(boardSpaces: BoardSpaceState[], sessionId: string, coins: number): number[] {
  const upgradeable: number[] = [];
  for (const [district, indices] of Object.entries(DISTRICT_PROPERTIES)) {
    if (!hasMonopoly(boardSpaces, sessionId, district)) continue;
    const cost = HOTEL_COST[district] || 100;
    if (coins < cost) continue;

    const allAtFour = indices.every((idx) => {
      const s = boardSpaces[idx];
      return s.houses === 4 || s.hasHotel;
    });
    if (!allAtFour) continue;

    for (const idx of indices) {
      const space = boardSpaces[idx];
      if (space.houses === 4 && !space.hasHotel) {
        upgradeable.push(idx);
      }
    }
  }
  return upgradeable;
}

export const GameControls: React.FC<GameControlsProps> = ({
  gameState,
  mySessionId,
  onRollDice,
  onBuyProperty,
  onSkipBuy,
  onBuildHouse,
  onBuildHotel,
  onEndTurn,
  onPayJailFine,
  onUseJailCard,
}) => {
  const [showBuild, setShowBuild] = useState(false);

  const activePlayers = Array.from(gameState.players.values())
    .filter((p) => p.isActive && !p.isBankrupt)
    .sort((a, b) => a.playerIndex - b.playerIndex);

  const currentPlayer = activePlayers[gameState.currentPlayerIndex % activePlayers.length];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const myPlayer = gameState.players.get(mySessionId);

  if (!myPlayer) return null;

  const currentSpace =
    currentPlayer && gameState.boardSpaces[currentPlayer.position]
      ? gameState.boardSpaces[currentPlayer.position]
      : null;

  // Building info
  const buildableProps = isMyTurn && gameState.hasRolled
    ? getBuildableProps(gameState.boardSpaces, mySessionId, myPlayer.coins)
    : [];
  const hotelProps = isMyTurn && gameState.hasRolled
    ? getHotelProps(gameState.boardSpaces, mySessionId, myPlayer.coins)
    : [];
  const canBuild = buildableProps.length > 0 || hotelProps.length > 0;

  return (
    <div className="game-controls">
      {/* Turn indicator */}
      <div className="controls-turn-indicator">
        {isMyTurn ? (
          <span className="controls-your-turn">Your Turn</span>
        ) : (
          <span className="controls-waiting">
            {currentPlayer?.displayName}'s turn
          </span>
        )}
      </div>

      {/* Action buttons */}
      {isMyTurn && (
        <div className="controls-actions">
          {/* Jail panel: shown when in jail and haven't rolled yet */}
          {myPlayer.inJail && !gameState.hasRolled && (
            <div className="controls-jail-panel">
              <span className="controls-jail-label">🔒 In Jail — {myPlayer.jailTurnsRemaining} attempt(s) left</span>
              <button
                className="controls-btn controls-btn-jail-fine"
                onClick={onPayJailFine}
                disabled={myPlayer.coins < 50}
              >
                💰 Pay $50 Fine
              </button>
              {myPlayer.jailFreeCards > 0 && (
                <button
                  className="controls-btn controls-btn-jail-card"
                  onClick={onUseJailCard}
                >
                  🃏 Use Get Out of Jail Free Card
                </button>
              )}
              <button className="controls-btn controls-btn-roll" onClick={onRollDice}>
                🎲 Roll for Doubles
              </button>
            </div>
          )}

          {/* Normal roll button (not in jail) */}
          {!myPlayer.inJail && !gameState.hasRolled && (
            <button className="controls-btn controls-btn-roll" onClick={onRollDice}>
              🎲 Roll Dice
            </button>
          )}

          {gameState.awaitingBuy && currentSpace && (
            <div className="controls-buy-prompt">
              <p className="controls-buy-text">
                Buy <strong>{currentSpace.name}</strong> for{" "}
                <strong>{currentSpace.price}</strong>?
              </p>
              <div className="controls-buy-buttons">
                <button
                  className="controls-btn controls-btn-buy"
                  onClick={onBuyProperty}
                >
                  🏠 Buy
                </button>
                <button
                  className="controls-btn controls-btn-skip"
                  onClick={onSkipBuy}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {gameState.hasRolled && !gameState.awaitingBuy && (
            <div className="controls-post-roll">
              {!myPlayer.inJail && canBuild && (
                <button
                  className="controls-btn controls-btn-build"
                  onClick={() => setShowBuild(!showBuild)}
                >
                  🏗️ Build {showBuild ? "▲" : "▼"}
                </button>
              )}
              <button
                className="controls-btn controls-btn-end"
                onClick={onEndTurn}
              >
                End Turn ➜
              </button>
            </div>
          )}
        </div>
      )}

      {/* Build panel */}
      {showBuild && isMyTurn && gameState.hasRolled && !gameState.awaitingBuy && (
        <div className="controls-build-panel">
          {buildableProps.length > 0 && (
            <div className="build-section">
              <span className="build-section-title">🏠 Build House</span>
              <div className="build-options">
                {buildableProps.map((idx) => {
                  const space = gameState.boardSpaces[idx];
                  const cost = HOUSE_COST[space.district] || 100;
                  return (
                    <button
                      key={idx}
                      className="build-option-btn"
                      onClick={() => onBuildHouse(idx)}
                      style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                    >
                      <span className="build-option-name">{space.name}</span>
                      <span className="build-option-houses">
                        {"🏠".repeat(space.houses)}
                        {space.houses === 0 && "—"}
                      </span>
                      <span className="build-option-cost">{cost} 🪙</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {hotelProps.length > 0 && (
            <div className="build-section">
              <span className="build-section-title">🏨 Upgrade to Hotel</span>
              <div className="build-options">
                {hotelProps.map((idx) => {
                  const space = gameState.boardSpaces[idx];
                  const cost = HOTEL_COST[space.district] || 100;
                  return (
                    <button
                      key={idx}
                      className="build-option-btn build-option-hotel"
                      onClick={() => onBuildHotel(idx)}
                      style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                    >
                      <span className="build-option-name">{space.name}</span>
                      <span className="build-option-houses">🏠🏠🏠🏠 → 🏨</span>
                      <span className="build-option-cost">{cost} 🪙</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
