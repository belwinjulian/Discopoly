import React from "react";
import { BoardSpaceState, PlayerState } from "../hooks/useGameState";
import {
  DISTRICT_COLORS,
  DISTRICT_PROPERTIES,
  HOUSE_COST,
  HOTEL_COST,
  RENT_SCALES,
  getSellableHouseProperties,
  getSellableHotelProperties,
  getHouseSellValue,
  getHotelSellValue,
} from "../data/boardSpaces";
import "../styles/property-info.css";

interface PropertyInfoModalProps {
  spaceIndex: number;
  boardSpaces: BoardSpaceState[];
  players: Map<string, PlayerState>;
  onClose: () => void;
  sessionId?: string;
  onMortgage?: (spaceIndex: number) => void;
  onUnmortgage?: (spaceIndex: number) => void;
  onSellHouse?: (spaceIndex: number) => void;
  onSellHotel?: (spaceIndex: number, convertToHouses: boolean) => void;
}

const RENT_LABELS = ["Base rent", "1 House", "2 Houses", "3 Houses", "4 Houses", "Hotel"];

function getCurrentRentLevel(space: BoardSpaceState): number {
  if (space.hasHotel) return 5;
  return space.houses;
}

export const PropertyInfoModal: React.FC<PropertyInfoModalProps> = ({
  spaceIndex,
  boardSpaces,
  players,
  onClose,
  sessionId,
  onMortgage,
  onUnmortgage,
  onSellHouse,
  onSellHotel,
}) => {
  const space = boardSpaces[spaceIndex];
  if (!space || space.spaceType !== "property") return null;

  const districtColor = space.district ? DISTRICT_COLORS[space.district] : "#555";
  const rentScale = RENT_SCALES[spaceIndex];
  const currentLevel = getCurrentRentLevel(space);
  const mortgageValue = Math.floor(space.price / 2);
  const unmortgageCost = Math.floor(space.price * 0.55);
  const houseCost = space.district ? HOUSE_COST[space.district] : 0;
  const hotelCost = space.district ? HOTEL_COST[space.district] : 0;
  const houseSellValue = space.district ? getHouseSellValue(space.district) : 0;
  const hotelSellValue = space.district ? getHotelSellValue(space.district) : 0;

  // Find owner name and check if current player is owner
  let ownerName: string | null = null;
  let isOwner = false;
  if (space.ownerId) {
    const owner = players.get(space.ownerId);
    ownerName = owner?.displayName || "Unknown";
    isOwner = sessionId === space.ownerId;
  }

  // Check if property can be mortgaged (no buildings)
  const canMortgage = isOwner && !space.isMortgaged && space.houses === 0 && !space.hasHotel;
  
  // Check if property can be unmortgaged (player has enough coins)
  const currentPlayer = sessionId ? players.get(sessionId) : null;
  const canUnmortgage = isOwner && space.isMortgaged && currentPlayer && currentPlayer.coins >= unmortgageCost;

  // Check if property can sell houses/hotels (must follow even selling rule)
  const sellableHouseProps = sessionId ? getSellableHouseProperties(boardSpaces, sessionId) : [];
  const sellableHotelProps = sessionId ? getSellableHotelProperties(boardSpaces, sessionId) : [];
  const canSellHouse = isOwner && sellableHouseProps.includes(spaceIndex);
  const canSellHotel = isOwner && sellableHotelProps.includes(spaceIndex);

  // Find district siblings
  const districtEntry = Object.entries(DISTRICT_PROPERTIES).find(
    ([, indices]) => indices.includes(spaceIndex)
  );
  const districtIndices = districtEntry ? districtEntry[1] : [spaceIndex];

  return (
    <div className="property-info-overlay" onClick={onClose}>
      <div className="property-info-modal" onClick={(e) => e.stopPropagation()}>
        {/* District color header */}
        <div className="property-info-header" style={{ background: districtColor }}>
          {space.district || "Property"}
        </div>

        {/* Property name */}
        <h3 className="property-info-name">{space.name}</h3>

        {/* Mortgage status badge */}
        {space.isMortgaged && (
          <div className="property-info-mortgage-badge">MORTGAGED</div>
        )}

        {/* Basic info */}
        <div className="property-info-details">
          <div className="property-info-row">
            <span className="label">Price</span>
            <span className="value">{space.price} coins</span>
          </div>
          <div className="property-info-row">
            <span className="label">Mortgage value</span>
            <span className="value">{mortgageValue} coins</span>
          </div>
          {space.isMortgaged && (
            <div className="property-info-row">
              <span className="label">Unmortgage cost</span>
              <span className="value">{unmortgageCost} coins</span>
            </div>
          )}
          <div className="property-info-row">
            <span className="label">Owner</span>
            {ownerName ? (
              <span className="value">{ownerName}</span>
            ) : (
              <span className="value-unowned">Unowned</span>
            )}
          </div>
        </div>

        {/* Rent schedule */}
        {rentScale && (
          <>
            <div className="property-info-section">
              Rent Schedule {space.isMortgaged && <span className="section-note">(No rent while mortgaged)</span>}
            </div>
            <div className={`property-info-rent-table ${space.isMortgaged ? "mortgaged" : ""}`}>
              {rentScale.map((rent, i) => (
                <div
                  key={i}
                  className={`property-info-rent-row ${i === currentLevel && space.ownerId && !space.isMortgaged ? "current" : ""}`}
                >
                  <span className="rent-label">{RENT_LABELS[i]}</span>
                  <span className="rent-value">{rent} coins</span>
                  <span className="rent-indicator">
                    {i === currentLevel && space.ownerId && !space.isMortgaged ? "\u2190" : ""}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Build costs */}
        {houseCost > 0 && (
          <div className="property-info-details" style={{ marginTop: 8 }}>
            <div className="property-info-row">
              <span className="label">House cost</span>
              <span className="value">{houseCost} coins</span>
            </div>
            <div className="property-info-row">
              <span className="label">Hotel cost</span>
              <span className="value">{hotelCost} coins</span>
            </div>
          </div>
        )}

        {/* District group */}
        <div className="property-info-section">District</div>
        <div className="property-info-district-list">
          {districtIndices.map((idx) => {
            const districtSpace = boardSpaces[idx];
            return (
              <div
                key={idx}
                className={`property-info-district-item ${idx === spaceIndex ? "current-property" : ""} ${districtSpace?.isMortgaged ? "mortgaged" : ""}`}
              >
                {districtSpace?.name || `Space ${idx}`}
                {districtSpace?.isMortgaged && <span className="district-mortgaged-tag">M</span>}
              </div>
            );
          })}
        </div>

        {/* Sell buildings section for owner */}
        {isOwner && (space.houses > 0 || space.hasHotel) && (
          <div className="property-info-sell-actions">
            <div className="property-info-section">Sell Buildings</div>
            {canSellHouse && onSellHouse && (
              <button
                className="property-info-sell-btn"
                onClick={() => onSellHouse(spaceIndex)}
              >
                Sell House for +{houseSellValue} coins
              </button>
            )}
            {canSellHotel && onSellHotel && (
              <>
                <button
                  className="property-info-sell-btn"
                  onClick={() => onSellHotel(spaceIndex, false)}
                >
                  Sell Hotel for +{hotelSellValue} coins
                </button>
                <button
                  className="property-info-sell-btn property-info-sell-convert"
                  onClick={() => onSellHotel(spaceIndex, true)}
                >
                  Downgrade to 4 Houses (+{hotelSellValue} coins)
                </button>
              </>
            )}
            {!canSellHouse && !canSellHotel && (space.houses > 0 || space.hasHotel) && (
              <div className="property-info-sell-note">
                Sell evenly across district (sell from properties with most buildings first)
              </div>
            )}
          </div>
        )}

        {/* Mortgage/Unmortgage buttons for owner */}
        {isOwner && (
          <div className="property-info-mortgage-actions">
            {canMortgage && onMortgage && (
              <button
                className="property-info-mortgage-btn"
                onClick={() => onMortgage(spaceIndex)}
              >
                Mortgage for {mortgageValue} coins
              </button>
            )}
            {space.isMortgaged && onUnmortgage && (
              <button
                className="property-info-unmortgage-btn"
                onClick={() => onUnmortgage(spaceIndex)}
                disabled={!canUnmortgage}
                title={!canUnmortgage ? `Need ${unmortgageCost} coins to unmortgage` : ""}
              >
                Unmortgage for {unmortgageCost} coins
              </button>
            )}
            {!canMortgage && !space.isMortgaged && (space.houses > 0 || space.hasHotel) && (
              <div className="property-info-mortgage-note">
                Sell all buildings to mortgage
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="property-info-footer">
          <button className="property-info-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
