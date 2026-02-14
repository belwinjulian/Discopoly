import React, { useState } from "react";
import { GameStateSnapshot, PlayerStoreData } from "../hooks/useGameState";
import { PLAYER_COLORS } from "../data/boardSpaces";
import { getPieceEmoji, PIECES } from "../data/pieces";
import { getTitleDisplay } from "../data/cosmetics";
import { Store } from "./Store";
import { GoalsPanel } from "./GoalsPanel";
import { AchievementsPanel } from "./AchievementsPanel";
import "../styles/lobby.css";

interface LobbyProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  onStartGame: () => void;
  onSelectPiece: (pieceId: string) => void;
  playerStoreData: PlayerStoreData | null;
  discordUserId: string;
  onStoreUpdate: (data: PlayerStoreData) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  gameState,
  mySessionId,
  onStartGame,
  onSelectPiece,
  playerStoreData,
  discordUserId,
  onStoreUpdate,
}) => {
  const [showStore, setShowStore] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const isHost = gameState.hostSessionId === mySessionId;
  const players = Array.from(gameState.players.values());
  const canStart = players.length >= 1; // TODO: change back to 2 for production

  const myPlayer = gameState.players.get(mySessionId);
  const ownedPieces = playerStoreData?.ownedPieces || ["car", "tophat", "dog", "rocket", "bolt", "guitar"];

  // Build a map of pieceId → player name for pieces taken by OTHER players
  const takenPieces = new Map<string, string>();
  players.forEach((p) => {
    if (p.sessionId !== mySessionId && p.pieceId) {
      takenPieces.set(p.pieceId, p.displayName);
    }
  });

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1 className="lobby-title">Discopoly</h1>
        <p className="lobby-subtitle">A City Building Board Game</p>
      </div>

      <div className="lobby-players">
        <h2>
          Players ({players.length}/6)
          {players.length < 1 && (
            <span className="lobby-hint"> - Need at least 1 to start</span>
          )}
        </h2>
        <div className="lobby-player-list">
          {players.map((player, idx) => (
            <div
              key={player.sessionId}
              className={`lobby-player ${
                player.sessionId === mySessionId ? "lobby-player-me" : ""
              }`}
            >
              <div
                className="lobby-player-avatar"
                style={{ backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}
              >
                <span className="lobby-player-piece-emoji">
                  {getPieceEmoji(player.pieceId)}
                </span>
              </div>
              <div className="lobby-player-info">
                <span className="lobby-player-name">
                  {player.displayName}
                  {player.sessionId === mySessionId && playerStoreData?.equippedTitle && (
                    <span className="lobby-title-badge">{getTitleDisplay(playerStoreData.equippedTitle)}</span>
                  )}
                </span>
                {player.sessionId === gameState.hostSessionId && (
                  <span className="lobby-host-badge">HOST</span>
                )}
                {player.sessionId === mySessionId && (
                  <span className="lobby-you-badge">YOU</span>
                )}
              </div>
            </div>
          ))}
          {/* Show empty slots: 2 if few players, 1 if 3+, none if full */}
          {Array.from({ length: Math.min(players.length >= 3 ? 1 : 2, 6 - players.length) }).map((_, idx) => (
            <div key={`empty-${idx}`} className="lobby-player lobby-player-empty">
              <div className="lobby-player-avatar lobby-avatar-empty">
                <span>?</span>
              </div>
              <div className="lobby-player-info">
                <span className="lobby-player-name">Waiting...</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Piece Selector */}
      <div className="lobby-piece-selector">
        <h3 className="lobby-piece-title">Choose Your Piece</h3>
        <div className="lobby-piece-grid">
          {ownedPieces.map((pieceId) => {
            const piece = PIECES.find((p) => p.id === pieceId);
            if (!piece) return null;
            const isSelected = myPlayer?.pieceId === pieceId;
            const takenBy = takenPieces.get(pieceId);
            const isTaken = !!takenBy;
            return (
              <button
                key={pieceId}
                className={`lobby-piece-btn ${isSelected ? "lobby-piece-selected" : ""} ${isTaken ? "lobby-piece-taken" : ""}`}
                onClick={() => !isTaken && onSelectPiece(pieceId)}
                disabled={isTaken}
                title={isTaken ? `Taken by ${takenBy}` : piece.name}
              >
                <span className="lobby-piece-emoji">{piece.emoji}</span>
                <span className="lobby-piece-name">{isTaken ? "Taken" : piece.name}</span>
              </button>
            );
          })}
        </div>
        <div className="lobby-action-btns">
          <button
            className="lobby-store-btn"
            onClick={() => setShowStore(true)}
          >
            💎 Store {playerStoreData ? `(${playerStoreData.gems} gems)` : ""}
          </button>
          <button
            className="lobby-goals-btn"
            onClick={() => setShowGoals(true)}
          >
            🎯 Goals
          </button>
          <button
            className="lobby-achievements-btn"
            onClick={() => setShowAchievements(true)}
          >
            🏆 Achievements
          </button>
        </div>
      </div>

      <div className="lobby-actions">
        {isHost ? (
          <button
            className={`lobby-start-btn ${canStart ? "" : "lobby-start-btn-disabled"}`}
            onClick={onStartGame}
            disabled={!canStart}
          >
            {canStart ? "Start Game" : "Waiting for players..."}
          </button>
        ) : (
          <p className="lobby-waiting">Waiting for the host to start the game...</p>
        )}
      </div>

      {gameState.lastAction && (
        <p className="lobby-last-action">{gameState.lastAction}</p>
      )}

      {/* Store Modal */}
      {showStore && (
        <Store
          discordUserId={discordUserId}
          playerStoreData={playerStoreData}
          onClose={() => setShowStore(false)}
          onUpdate={onStoreUpdate}
        />
      )}

      {/* Goals Modal */}
      {showGoals && (
        <GoalsPanel
          discordUserId={discordUserId}
          onClose={() => setShowGoals(false)}
        />
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <AchievementsPanel
          discordUserId={discordUserId}
          onClose={() => setShowAchievements(false)}
        />
      )}
    </div>
  );
};
