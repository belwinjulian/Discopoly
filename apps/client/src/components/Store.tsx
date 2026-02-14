import React, { useState } from "react";
import { PlayerStoreData } from "../hooks/useGameState";
import { PIECES, getPieceEmoji } from "../data/pieces";
import { TITLES, THEMES, DICE_SKINS, type CosmeticDefinition } from "../data/cosmetics";
import "../styles/store.css";

type StoreTab = "pieces" | "titles" | "themes" | "dice";

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
  const [activeTab, setActiveTab] = useState<StoreTab>("pieces");
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const gems = playerStoreData?.gems ?? 0;
  const ownedPieces = playerStoreData?.ownedPieces ?? [];
  const ownedCosmetics = playerStoreData?.ownedCosmetics ?? [];
  const equippedTitle = playerStoreData?.equippedTitle ?? "";
  const equippedTheme = playerStoreData?.equippedTheme ?? "classic";
  const equippedDice = playerStoreData?.equippedDice ?? "standard";

  const handleBuyPiece = async (pieceId: string) => {
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

      onUpdate({
        gems: data.gems,
        ownedPieces: data.owned_pieces,
        selectedPiece: data.selected_piece,
        ownedCosmetics: data.owned_cosmetics,
        equippedTitle: data.equipped_title,
        equippedTheme: data.equipped_theme,
        equippedDice: data.equipped_dice,
      });
      setBuying(null);
    } catch (err) {
      setError("Network error");
      setBuying(null);
    }
  };

  const handleBuyCosmetic = async (cosmeticId: string) => {
    if (buying) return;
    setBuying(cosmeticId);
    setError("");

    try {
      const res = await fetch("/colyseus/store/buy-cosmetic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId, cosmeticId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to buy cosmetic");
        setBuying(null);
        return;
      }

      onUpdate({
        gems: data.gems,
        ownedPieces: data.owned_pieces,
        selectedPiece: data.selected_piece,
        ownedCosmetics: data.owned_cosmetics,
        equippedTitle: data.equipped_title,
        equippedTheme: data.equipped_theme,
        equippedDice: data.equipped_dice,
      });
      setBuying(null);
    } catch (err) {
      setError("Network error");
      setBuying(null);
    }
  };

  const handleEquip = async (type: "title" | "theme" | "dice", itemId: string) => {
    setError("");
    try {
      const res = await fetch("/colyseus/store/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordUserId, type, itemId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to equip");
        return;
      }

      onUpdate({
        gems: data.gems,
        ownedPieces: data.owned_pieces,
        selectedPiece: data.selected_piece,
        ownedCosmetics: data.owned_cosmetics,
        equippedTitle: data.equipped_title,
        equippedTheme: data.equipped_theme,
        equippedDice: data.equipped_dice,
      });
    } catch (err) {
      setError("Network error");
    }
  };

  const isOwnedCosmetic = (id: string, cost: number) => {
    return cost === 0 || ownedCosmetics.includes(id);
  };

  const renderCosmeticGrid = (
    items: CosmeticDefinition[],
    type: "title" | "theme" | "dice",
    equippedId: string
  ) => (
    <div className="store-grid">
      {items.map((item) => {
        const owned = isOwnedCosmetic(item.id, item.cost);
        const equipped = equippedId === item.id;
        const canAfford = gems >= item.cost;
        const isBuying = buying === item.id;

        return (
          <div
            key={item.id}
            className={`store-item ${owned ? "store-item-owned" : ""} ${
              equipped ? "store-item-equipped" : ""
            } ${!owned && !canAfford ? "store-item-locked" : ""}`}
            onClick={() => {
              if (owned && !equipped) handleEquip(type, item.id);
            }}
            style={{ cursor: owned && !equipped ? "pointer" : undefined }}
          >
            <span className="store-item-emoji">{item.preview || item.display || item.name[0]}</span>
            <span className="store-item-name">{item.name}</span>
            {item.description && (
              <span className="store-item-desc">{item.description}</span>
            )}
            {equipped ? (
              <span className="store-item-badge store-item-badge-equipped">Equipped</span>
            ) : owned ? (
              <span className="store-item-badge">Owned</span>
            ) : (
              <button
                className="store-item-buy"
                disabled={!canAfford || isBuying}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBuyCosmetic(item.id);
                }}
              >
                {isBuying ? "..." : `\u{1F48E} ${item.cost}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="store-overlay" onClick={onClose}>
      <div className="store-modal" onClick={(e) => e.stopPropagation()}>
        <div className="store-header">
          <h2 className="store-title">Store</h2>
          <div className="store-gems">
            <span className="store-gems-icon">{"\u{1F48E}"}</span>
            <span className="store-gems-count">{gems}</span>
            <span className="store-gems-label">gems</span>
          </div>
          <button className="store-close" onClick={onClose}>{"\u2715"}</button>
        </div>

        {/* Tabs */}
        <div className="store-tabs">
          {(["pieces", "titles", "themes", "dice"] as StoreTab[]).map((tab) => (
            <button
              key={tab}
              className={`store-tab ${activeTab === tab ? "store-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "pieces" ? "\u{265F}\uFE0F" : tab === "titles" ? "\u{1F3F7}\uFE0F" : tab === "themes" ? "\u{1F3A8}" : "\u{1F3B2}"}{" "}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="store-error">{error}</div>}

        {/* Pieces Tab */}
        {activeTab === "pieces" && (
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
                      onClick={() => handleBuyPiece(piece.id)}
                    >
                      {isBuying ? "..." : `\u{1F48E} ${piece.cost}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Titles Tab */}
        {activeTab === "titles" && renderCosmeticGrid(TITLES, "title", equippedTitle)}

        {/* Themes Tab */}
        {activeTab === "themes" && renderCosmeticGrid(THEMES, "theme", equippedTheme)}

        {/* Dice Tab */}
        {activeTab === "dice" && renderCosmeticGrid(DICE_SKINS, "dice", equippedDice)}

        <p className="store-hint">
          {activeTab === "pieces"
            ? "Earn gems by playing games! Winner gets 50, everyone else gets 15."
            : activeTab === "titles"
            ? "Titles show as a badge next to your name. Click an owned title to equip it."
            : activeTab === "themes"
            ? "Themes change how the board looks for you. Click to equip."
            : "Dice skins change your dice display. Click to equip."}
        </p>
      </div>
    </div>
  );
};
