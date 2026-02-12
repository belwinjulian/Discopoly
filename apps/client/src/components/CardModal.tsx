import React from "react";
import { DrawnCardState, GameStateSnapshot } from "../hooks/useGameState";
import "../styles/card.css";

interface CardModalProps {
  drawnCard: DrawnCardState;
  gameState: GameStateSnapshot;
  mySessionId: string;
  onDismiss: () => void;
}

const DECK_ICONS: Record<string, string> = {
  community: "📦",
  chance: "❓",
};

export const CardModal: React.FC<CardModalProps> = ({
  drawnCard,
  gameState,
  mySessionId,
  onDismiss,
}) => {
  if (!drawnCard.deck) return null;

  const isMyCard = drawnCard.forSessionId === mySessionId;
  const drawnByPlayer = gameState.players.get(drawnCard.forSessionId);
  const drawnByName = drawnByPlayer?.displayName || "A player";
  const deckLabel = drawnCard.deck === "community" ? "Community Chest" : "Chance";
  const icon = DECK_ICONS[drawnCard.deck] || "🃏";

  return (
    <div className="card-overlay">
      <div className={`card-modal card-modal-${drawnCard.deck}`}>
        {/* Header */}
        <div className="card-header">
          {deckLabel}
        </div>

        {/* Body */}
        <div className="card-body">
          <div className="card-icon">{icon}</div>
          <h3 className="card-title">{drawnCard.title}</h3>
          <p className="card-description">{drawnCard.description}</p>
          {!isMyCard && (
            <p className="card-drawn-by">Drawn by {drawnByName}</p>
          )}
        </div>

        {/* Footer */}
        {isMyCard ? (
          <div className="card-footer">
            <button className="card-dismiss-btn" onClick={onDismiss}>
              OK
            </button>
          </div>
        ) : (
          <p className="card-waiting">
            Waiting for {drawnByName} to continue...
          </p>
        )}
      </div>
    </div>
  );
};
