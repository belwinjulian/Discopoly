import React, { useState } from "react";
import { PlayerStoreData } from "../hooks/useGameState";
import { PIECES, getPieceEmoji } from "../data/pieces";
import "../styles/store.css";

interface StoreProps {
  discordUserId: string;
  playerStoreData: PlayerStoreData | null;
  onClose: () => void;
  onUpdate: (data: PlayerStoreData) => void;
}

export const Store: React.FC<StoreProps> = ({
  discordUserId,
  playerStoreData,
  onClose,
  onUpdate,
}) => {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const gems = playerStoreData?.gems ?? 0;
  const ownedPieces = playerStoreData?.ownedPieces ?? [];

  const handleBuy = async (pieceId: string) => {
    if (buying) return;
    setBuying(pieceId);
    setError("");

    try {
      const res = await fetch("/colyseus/store/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId, pieceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to buy piece");
        setBuying(null);
        return;
      }

      // Update parent with new store data
      onUpdate({
        gems: data.gems,
        ownedPieces: data.owned_pieces,
        selectedPiece: data.selected_piece,
      });
      setBuying(null);
    } catch (err) {
      setError("Network error");
      setBuying(null);
    }
  };

  return (
    <div className="store-overlay" onClick={onClose}>
      <div className="store-modal" onClick={(e) => e.stopPropagation()}>
        <div className="store-header">
          <h2 className="store-title">Piece Store</h2>
          <div className="store-gems">
            <span className="store-gems-icon">💎</span>
            <span className="store-gems-count">{gems}</span>
            <span className="store-gems-label">gems</span>
          </div>
          <button className="store-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="store-error">{error}</div>}

        <div className="store-grid">
          {PIECES.map((piece) => {
            const owned = ownedPieces.includes(piece.id);
            const canAfford = gems >= piece.cost;
            const isBuying = buying === piece.id;

            return (
              <div
                key={piece.id}
                className={`store-item ${owned ? "store-item-owned" : ""} ${
                  !owned && !canAfford ? "store-item-locked" : ""
                }`}
              >
                <span className="store-item-emoji">{piece.emoji}</span>
                <span className="store-item-name">{piece.name}</span>
                {owned ? (
                  <span className="store-item-badge">Owned</span>
                ) : (
                  <button
                    className="store-item-buy"
                    disabled={!canAfford || isBuying}
                    onClick={() => handleBuy(piece.id)}
                  >
                    {isBuying ? "..." : `💎 ${piece.cost}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="store-hint">Earn gems by playing games! Winner gets 50, everyone else gets 15.</p>
      </div>
    </div>
  );
};
