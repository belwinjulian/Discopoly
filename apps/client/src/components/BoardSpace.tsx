import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { BoardSpaceState, PlayerState } from "../hooks/useGameState";
import { DISTRICT_COLORS, PLAYER_COLORS } from "../data/boardSpaces";
import { getPieceEmoji } from "../data/pieces";
import { RentPreview } from "./RentPreview";
import "../styles/animations.css";

interface BoardSpaceProps {
  space: BoardSpaceState;
  players: PlayerState[];
  allBoardSpaces: BoardSpaceState[];
  allPlayers: Map<string, PlayerState>;
  isCorner?: boolean;
  side: "top" | "bottom" | "left" | "right";
  hideTokenForSession?: string;
  onClick?: (spaceIndex: number) => void;
}

export const BoardSpaceComponent: React.FC<BoardSpaceProps> = ({
  space,
  players,
  allBoardSpaces,
  allPlayers,
  isCorner = false,
  side,
  hideTokenForSession,
  onClick,
}) => {
  const isClickable = space.spaceType === "property" && !!onClick;
  const isProperty = space.spaceType === "property";
  const districtColor = space.district ? DISTRICT_COLORS[space.district] : undefined;
  const playersHere = players.filter(
    (p) => p.position === space.index && p.isActive && p.sessionId !== hideTokenForSession
  );

  // Hover state for rent preview
  const [showPreview, setShowPreview] = useState(false);
  const [isTouchPreview, setIsTouchPreview] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (!isProperty) return;
    // Small delay to avoid flickering on fast mouse moves
    hoverTimerRef.current = setTimeout(() => {
      if (spaceRef.current) {
        setAnchorRect(spaceRef.current.getBoundingClientRect());
        setIsTouchPreview(false);
        setShowPreview(true);
      }
    }, 200);
  }, [isProperty]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Only dismiss if it was a mouse-triggered preview (touch uses backdrop to dismiss)
    if (!isTouchPreview) {
      setShowPreview(false);
    }
  }, [isTouchPreview]);

  // Touch support: long press to show the preview on touch devices
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isProperty) return;
    hoverTimerRef.current = setTimeout(() => {
      if (spaceRef.current) {
        setAnchorRect(spaceRef.current.getBoundingClientRect());
        setIsTouchPreview(true);
        setShowPreview(true);
      }
    }, 400);
  }, [isProperty]);

  const handleTouchEnd = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const dismissTouchPreview = useCallback(() => {
    setShowPreview(false);
    setIsTouchPreview(false);
  }, []);

  const getSpaceIcon = () => {
    switch (space.spaceType) {
      case "payday":
        return "\uD83D\uDCB0";
      case "jail":
        return "\uD83D\uDE93";
      case "goToJail":
        return "\uD83D\uDC6E";
      case "parking":
        return "\uD83C\uDD7F\uFE0F";
      case "tax":
        return "\uD83C\uDFDB\uFE0F";
      case "community":
        return "\uD83D\uDCE6";
      case "chance":
        return "\u2753";
      default:
        return null;
    }
  };

  const icon = getSpaceIcon();

  return (
    <div
      ref={spaceRef}
      data-space-index={space.index}
      className={`board-space ${isCorner ? "board-space-corner" : ""} board-space-${side} ${playersHere.length > 0 ? "board-space-active" : ""} ${isClickable ? "board-space-clickable" : ""} ${space.isMortgaged ? "board-space-mortgaged" : ""}`}
      title={`${space.name}${space.price ? ` - ${space.price} coins` : ""}${space.isMortgaged ? " (Mortgaged)" : ""}`}
      onClick={isClickable ? () => onClick(space.index) : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* District color stripe */}
      {districtColor && (
        <div
          className={`board-space-stripe board-space-stripe-${side} ${space.isMortgaged ? "board-space-stripe-mortgaged" : ""}`}
          style={{ backgroundColor: districtColor }}
        />
      )}

      <div className="board-space-content">
        {icon && <span className="board-space-icon">{icon}</span>}
        <span className="board-space-name">{space.name}</span>
        {space.spaceType === "property" && space.price > 0 && (
          <span className="board-space-price">{space.price}</span>
        )}
        {/* Show mortgage badge for mortgaged properties, or owned dot for unmortgaged owned properties */}
        {space.ownerId && space.isMortgaged && (
          <div className="board-space-mortgage-badge">M</div>
        )}
        {space.ownerId && !space.isMortgaged && !space.hasHotel && space.houses === 0 && (
          <div className="board-space-owned-dot" />
        )}
      </div>

      {/* Houses / Hotel indicators */}
      {space.ownerId && (space.houses > 0 || space.hasHotel) && (
        <div className={`board-space-buildings board-space-buildings-${side}`}>
          {space.hasHotel ? (
            <span className="board-building-hotel" title="Hotel">{"\uD83C\uDFE8"}</span>
          ) : (
            Array.from({ length: space.houses }).map((_, i) => (
              <span key={i} className="board-building-house" title="House">{"\uD83C\uDFE0"}</span>
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
              {p.inJail && <span className="board-token-jail-icon">{"\uD83D\uDD12"}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Rent preview tooltip - rendered via portal to avoid breaking flex layout */}
      {showPreview && isProperty && createPortal(
        <>
          {/* Touch dismiss backdrop (only visible for touch-activated previews) */}
          {isTouchPreview && (
            <div
              className="rent-preview-touch-backdrop"
              onClick={dismissTouchPreview}
              onTouchStart={dismissTouchPreview}
            />
          )}
          <RentPreview
            space={space}
            boardSpaces={allBoardSpaces}
            players={allPlayers}
            anchorRect={anchorRect}
            side={side}
          />
        </>,
        document.body
      )}
    </div>
  );
};
