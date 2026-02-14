import React from "react";
import { GameStateSnapshot, PlayerState, BoardSpaceState } from "../hooks/useGameState";
import { PLAYER_COLORS, DISTRICT_COLORS } from "../data/boardSpaces";
import { getPieceEmoji } from "../data/pieces";
import "../styles/game.css";
import "../styles/trade.css";

interface PlayerPanelProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  onTradeWith?: (sessionId: string) => void;
  isSpectator?: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  gameState,
  mySessionId,
  onTradeWith,
  isSpectator,
}) => {
  const players = Array.from(gameState.players.values()).sort(
    (a, b) => a.playerIndex - b.playerIndex
  );

  const activePlayers = players.filter((p) => p.isActive && !p.isBankrupt);
  const currentPlayer =
    activePlayers[gameState.currentPlayerIndex % activePlayers.length];

  return (
    <div className="player-panel">
      <h3 className="panel-title">Players</h3>
      <div className="panel-player-list">
        {players.map((player) => {
          const isCurrentTurn = currentPlayer?.sessionId === player.sessionId;
          const isMe = player.sessionId === mySessionId;
          const color = PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length];

          // Get owned property details
          const ownedSpaces = player.ownedProperties
            .map((idx) => gameState.boardSpaces[idx])
            .filter(Boolean);

          return (
            <div
              key={player.sessionId}
              className={`panel-player ${player.isBankrupt ? "panel-player-bankrupt" : ""} ${
                isCurrentTurn ? "panel-player-current" : ""
              } ${isMe ? "panel-player-me" : ""}`}
            >
              <div className="panel-player-header">
                <div className="panel-player-token" style={{ backgroundColor: color }}>
                  <span className="panel-token-emoji">{getPieceEmoji(player.pieceId)}</span>
                </div>
                <div className="panel-player-info">
                  <span className="panel-player-name">
                    {player.displayName}
                    {isMe && <span className="panel-me-tag"> (you)</span>}
                  </span>
                  <span className="panel-player-coins">
                    {player.isBankrupt ? "BANKRUPT" : `${player.coins} coins`}
                  </span>
                </div>
                {isCurrentTurn && <span className="panel-turn-dot" />}
                {!isMe &&
                  !player.isBankrupt &&
                  player.isActive &&
                  gameState.phase === "playing" &&
                  onTradeWith && (
                    <button
                      className="panel-trade-btn"
                      disabled={gameState.activeTrade.status === "pending"}
                      onClick={() => onTradeWith(player.sessionId)}
                    >
                      Trade
                    </button>
                  )}
              </div>

              {/* Owned properties */}
              {ownedSpaces.length > 0 && (
                <div className="panel-player-properties">
                  {ownedSpaces.map((space) => (
                    <div
                      key={space.index}
                      className="panel-property-chip"
                      style={{
                        borderLeftColor:
                          DISTRICT_COLORS[space.district] || "#555",
                      }}
                      title={`${space.name} - Rent: ${space.rent}${space.houses > 0 ? ` (${space.houses} houses)` : ""}${space.hasHotel ? " (Hotel)" : ""}`}
                    >
                      <span className="panel-property-name">{space.name}</span>
                      {space.hasHotel && <span className="panel-property-building">🏨</span>}
                      {!space.hasHotel && space.houses > 0 && (
                        <span className="panel-property-building">
                          {"🏠".repeat(space.houses)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spectator list */}
      {gameState.spectatorCount > 0 && (
        <div className="panel-spectators">
          <h4 className="panel-spectators-title">
            Spectating ({gameState.spectatorCount})
          </h4>
          {Array.from(gameState.spectators.values()).map((spec) => (
            <div key={spec.sessionId} className="panel-spectator">
              <span className="panel-spectator-icon">👁</span>
              <span className="panel-spectator-name">
                {spec.displayName}
                {spec.sessionId === mySessionId && (
                  <span className="panel-me-tag"> (you)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
