import React from "react";
import { BoardSpaceState, PlayerState } from "../hooks/useGameState";
import { DISTRICT_COLORS, PLAYER_COLORS } from "../data/boardSpaces";
import { getPieceEmoji } from "../data/pieces";
import "../styles/animations.css";

interface BoardSpaceProps {
  space: BoardSpaceState;
  players: PlayerState[];
  isCorner?: boolean;
  side: "top" | "bottom" | "left" | "right";
  hideTokenForSession?: string;
}

export const BoardSpaceComponent: React.FC<BoardSpaceProps> = ({
  space,
  players,
  isCorner = false,
  side,
  hideTokenForSession,
}) => {
  const districtColor = space.district ? DISTRICT_COLORS[space.district] : undefined;
  const playersHere = players.filter(
    (p) => p.position === space.index && p.isActive && p.sessionId !== hideTokenForSession
  );

  const getSpaceIcon = () => {
    switch (space.spaceType) {
      case "payday":
        return "💰";
      case "jail":
        return "🚓";
      case "goToJail":
        return "👮";
      case "parking":
        return "🅿️";
      case "tax":
        return "🏛️";
      case "community":
        return "📦";
      case "chance":
        return "❓";
      default:
        return null;
    }
  };

  const icon = getSpaceIcon();

  return (
    <div
      data-space-index={space.index}
      className={`board-space ${isCorner ? "board-space-corner" : ""} board-space-${side} ${playersHere.length > 0 ? "board-space-active" : ""}`}
      title={`${space.name}${space.price ? ` - ${space.price} coins` : ""}`}
    >
      {/* District color stripe */}
      {districtColor && (
        <div
          className={`board-space-stripe board-space-stripe-${side}`}
          style={{ backgroundColor: districtColor }}
        />
      )}

      <div className="board-space-content">
        {icon && <span className="board-space-icon">{icon}</span>}
        <span className="board-space-name">{space.name}</span>
        {space.spaceType === "property" && space.price > 0 && (
          <span className="board-space-price">{space.price}</span>
        )}
        {space.ownerId && !space.hasHotel && space.houses === 0 && (
          <div className="board-space-owned-dot" />
        )}
      </div>

      {/* Houses / Hotel indicators */}
      {space.ownerId && (space.houses > 0 || space.hasHotel) && (
        <div className={`board-space-buildings board-space-buildings-${side}`}>
          {space.hasHotel ? (
            <span className="board-building-hotel" title="Hotel">🏨</span>
          ) : (
            Array.from({ length: space.houses }).map((_, i) => (
              <span key={i} className="board-building-house" title="House">🏠</span>
            ))
          )}
        </div>
      )}

      {/* Player tokens */}
      {playersHere.length > 0 && (
        <div className="board-space-tokens">
          {playersHere.map((p) => (
            <div
              key={p.sessionId}
              className={`board-space-token board-space-token-moved${p.inJail ? " board-space-token-jailed" : ""}`}
              style={{
                backgroundColor:
                  PLAYER_COLORS[p.playerIndex % PLAYER_COLORS.length],
              }}
              title={p.inJail ? `${p.displayName} (In Jail)` : p.displayName}
            >
              <span className="board-token-emoji">{getPieceEmoji(p.pieceId)}</span>
              {p.inJail && <span className="board-token-jail-icon">🔒</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
