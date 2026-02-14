import React, { useRef, useLayoutEffect, useState } from "react";
import { BoardSpaceState, PlayerState } from "../hooks/useGameState";
import {
  DISTRICT_COLORS,
  DISTRICT_PROPERTIES,
  HOUSE_COST,
  HOTEL_COST,
  RENT_SCALES,
  playerHasMonopoly,
} from "../data/boardSpaces";
import "../styles/rent-preview.css";

interface RentPreviewProps {
  space: BoardSpaceState;
  boardSpaces: BoardSpaceState[];
  players: Map<string, PlayerState>;
  /** Position of the hovered board space element */
  anchorRect: DOMRect | null;
  /** Which side of the board the space is on (affects tooltip positioning) */
  side: "top" | "bottom" | "left" | "right";
}

const RENT_LABELS = ["Base rent", "1 House", "2 Houses", "3 Houses", "4 Houses", "Hotel"];

function getCurrentRentLevel(space: BoardSpaceState): number {
  if (space.hasHotel) return 5;
  return space.houses;
}

export const RentPreview: React.FC<RentPreviewProps> = ({
  space,
  boardSpaces,
  players,
  anchorRect,
  side,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Calculate position after render so we know the tooltip dimensions
  useLayoutEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const gap = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = 0;
    let left = 0;

    // Position based on which side of the board the space is on
    // We want the tooltip to appear toward the center of the board (inward)
    switch (side) {
      case "top":
        // Tooltip below the space
        top = anchorRect.bottom + gap;
        left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        // Tooltip above the space
        top = anchorRect.top - tooltipHeight - gap;
        left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        // Tooltip to the right of the space
        top = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
        left = anchorRect.right + gap;
        break;
      case "right":
        // Tooltip to the left of the space
        top = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
        left = anchorRect.left - tooltipWidth - gap;
        break;
    }

    // Clamp to viewport
    if (left + tooltipWidth > viewportW - 8) {
      left = viewportW - tooltipWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }
    if (top + tooltipHeight > viewportH - 8) {
      top = viewportH - tooltipHeight - 8;
    }
    if (top < 8) {
      top = 8;
    }

    setPosition({ top, left });
  }, [anchorRect, side]);

  if (!anchorRect) return null;

  const districtColor = space.district ? DISTRICT_COLORS[space.district] : "#555";
  const rentScale = RENT_SCALES[space.index];
  const currentLevel = getCurrentRentLevel(space);
  const houseCost = space.district ? HOUSE_COST[space.district] : 0;
  const hotelCost = space.district ? HOTEL_COST[space.district] : 0;

  // Owner info
  let ownerName: string | null = null;
  if (space.ownerId) {
    const owner = players.get(space.ownerId);
    ownerName = owner?.displayName || "Unknown";
  }

  // Monopoly check
  const hasMonopoly =
    space.ownerId && space.district
      ? playerHasMonopoly(boardSpaces, space.ownerId, space.district)
      : false;

  // For the "current" rent row: if owner has monopoly and no houses, base rent is doubled
  const isMonopolyDoubled =
    hasMonopoly && space.ownerId && space.houses === 0 && !space.hasHotel && !space.isMortgaged;

  return (
    <div
      ref={tooltipRef}
      className="rent-preview"
      style={{ top: position.top, left: position.left }}
    >
      {/* District color header */}
      <div className="rent-preview-header" style={{ background: districtColor }}>
        {space.district || "Property"}
      </div>

      {/* Property name */}
      <div className="rent-preview-name">{space.name}</div>

      {/* Mortgage badge */}
      {space.isMortgaged && (
        <>
          <div className="rent-preview-mortgage-badge">Mortgaged</div>
          <div className="rent-preview-mortgage-note">No rent collected</div>
        </>
      )}

      {/* Monopoly badge */}
      {hasMonopoly && !space.isMortgaged && (
        <div className="rent-preview-monopoly-badge">Monopoly</div>
      )}

      {/* Basic info */}
      <div className="rent-preview-details">
        <div className="rent-preview-row">
          <span className="rp-label">Price</span>
          <span className="rp-value">{space.price} coins</span>
        </div>
        <div className="rent-preview-row">
          <span className="rp-label">Owner</span>
          {ownerName ? (
            <span className="rp-value">{ownerName}</span>
          ) : (
            <span className="rp-value-unowned">Unowned</span>
          )}
        </div>
      </div>

      {/* Rent schedule */}
      {rentScale && (
        <>
          <div className="rent-preview-section">Rent</div>
          <div className={`rent-preview-rent-table ${space.isMortgaged ? "rp-mortgaged" : ""}`}>
            {rentScale.map((rent, i) => {
              const isCurrent = i === currentLevel && space.ownerId && !space.isMortgaged;
              // Show monopoly doubled base rent as the current level
              const isMonopolyRow = i === 0 && isMonopolyDoubled;
              const displayRent = isMonopolyRow ? rent * 2 : rent;
              const rowClass = isCurrent
                ? isMonopolyRow
                  ? "rent-preview-rent-row rp-current rp-monopoly-base"
                  : "rent-preview-rent-row rp-current"
                : "rent-preview-rent-row";

              return (
                <div key={i} className={rowClass}>
                  <span className="rp-rent-label">
                    {RENT_LABELS[i]}
                    {isMonopolyRow ? " (x2)" : ""}
                  </span>
                  <span className="rp-rent-value">{displayRent}</span>
                  <span className="rp-rent-indicator">
                    {isCurrent ? "\u25C0" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Build costs */}
      {houseCost > 0 && (
        <>
          <div className="rent-preview-section">Building Costs</div>
          <div className="rent-preview-build-costs">
            <div className="rent-preview-build-row">
              <span className="rp-label">House</span>
              <span className="rp-build-value">{houseCost} coins</span>
            </div>
            <div className="rent-preview-build-row">
              <span className="rp-label">Hotel</span>
              <span className="rp-build-value">{hotelCost} coins</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
