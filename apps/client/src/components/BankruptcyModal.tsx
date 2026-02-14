import React, { useState, useEffect } from "react";
import { GameStateSnapshot, PlayerState, BoardSpaceState } from "../hooks/useGameState";
import {
  DISTRICT_COLORS,
  DISTRICT_PROPERTIES,
  HOUSE_COST,
  HOTEL_COST,
  getHouseSellValue,
  getHotelSellValue,
  getSellableHouseProperties,
  getSellableHotelProperties,
} from "../data/boardSpaces";
import "../styles/bankruptcy.css";

interface BankruptcyModalProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  onSellBuilding: (spaceIndex: number, type: string, convertToHouses?: boolean) => void;
  onMortgage: (spaceIndex: number) => void;
  onPayDebt: () => void;
  onDeclareBankruptcy: () => void;
  isSpectator?: boolean;
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  gameState,
  mySessionId,
  onSellBuilding,
  onMortgage,
  onPayDebt,
  onDeclareBankruptcy,
  isSpectator,
}) => {
  const negotiation = gameState.bankruptcyNegotiation;
  const [timeLeft, setTimeLeft] = useState(0);

  // Update countdown timer
  useEffect(() => {
    if (negotiation.status !== "active") return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, negotiation.deadline - now);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [negotiation.deadline, negotiation.status]);

  if (negotiation.status !== "active") return null;

  const isDebtor = negotiation.debtorSessionId === mySessionId;
  const debtor = gameState.players.get(negotiation.debtorSessionId);
  const creditor = negotiation.creditorSessionId
    ? gameState.players.get(negotiation.creditorSessionId)
    : null;

  if (!debtor) return null;

  const canPayDebt = debtor.coins >= negotiation.amountOwed;

  // Get mortgageable properties (no buildings, not already mortgaged)
  const mortgageableProps: { space: BoardSpaceState; mortgageValue: number }[] = [];
  for (const propIdx of debtor.ownedProperties) {
    const space = gameState.boardSpaces[propIdx];
    if (!space) continue;
    if (space.isMortgaged) continue;
    if (space.houses > 0 || space.hasHotel) continue;
    mortgageableProps.push({
      space,
      mortgageValue: Math.floor(space.price / 2),
    });
  }

  // Get sellable houses and hotels
  const sellableHouses = getSellableHouseProperties(gameState.boardSpaces, negotiation.debtorSessionId);
  const sellableHotels = getSellableHotelProperties(gameState.boardSpaces, negotiation.debtorSessionId);

  // Format reason
  const reasonLabel = {
    rent: "Rent",
    tax: "Tax",
    card: "Card Effect",
    jail_fine: "Jail Fine",
  }[negotiation.reason] || "Debt";

  // Timer color based on urgency
  const timerColor = timeLeft <= 10 ? "#ff4444" : timeLeft <= 20 ? "#ffa500" : "#4ade80";

  return (
    <div className="bankruptcy-overlay">
      <div className="bankruptcy-modal">
        {/* Header */}
        <div className="bankruptcy-header">
          BANKRUPTCY NEGOTIATION
        </div>

        {/* Debt info */}
        <div className="bankruptcy-debt-info">
          <div className="bankruptcy-debt-row">
            <span className="bankruptcy-debt-label">Debtor</span>
            <span className="bankruptcy-debt-value">{debtor.displayName}</span>
          </div>
          <div className="bankruptcy-debt-row">
            <span className="bankruptcy-debt-label">Owed To</span>
            <span className="bankruptcy-debt-value">{creditor ? creditor.displayName : "Bank"}</span>
          </div>
          <div className="bankruptcy-debt-row">
            <span className="bankruptcy-debt-label">Reason</span>
            <span className="bankruptcy-debt-value">{reasonLabel}</span>
          </div>
          <div className="bankruptcy-debt-row bankruptcy-debt-amount-row">
            <span className="bankruptcy-debt-label">Amount Owed</span>
            <span className="bankruptcy-debt-amount">{negotiation.amountOwed} coins</span>
          </div>
          <div className="bankruptcy-debt-row">
            <span className="bankruptcy-debt-label">Current Cash</span>
            <span className={`bankruptcy-cash ${canPayDebt ? "enough" : "short"}`}>
              {debtor.coins} coins
            </span>
          </div>
          <div className="bankruptcy-debt-row">
            <span className="bankruptcy-debt-label">Still Need</span>
            <span className="bankruptcy-need">
              {canPayDebt ? "Ready to pay!" : `${negotiation.amountOwed - debtor.coins} more coins`}
            </span>
          </div>
        </div>

        {/* Countdown timer */}
        <div className="bankruptcy-timer" style={{ color: timerColor, borderColor: timerColor }}>
          <span className="bankruptcy-timer-icon">&#9202;</span>
          <span className="bankruptcy-timer-value">{timeLeft}s</span>
          <span className="bankruptcy-timer-label">remaining</span>
        </div>

        {/* Debtor controls */}
        {isDebtor && !isSpectator && (
          <div className="bankruptcy-controls">
            {/* Sellable buildings */}
            {(sellableHouses.length > 0 || sellableHotels.length > 0) && (
              <div className="bankruptcy-section">
                <div className="bankruptcy-section-title">Sell Buildings</div>
                <div className="bankruptcy-items">
                  {sellableHotels.map((idx) => {
                    const space = gameState.boardSpaces[idx];
                    const sellValue = getHotelSellValue(space.district);
                    return (
                      <div key={`hotel-${idx}`} className="bankruptcy-item-group">
                        <button
                          className="bankruptcy-item-btn"
                          onClick={() => onSellBuilding(idx, "hotel", false)}
                          style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                        >
                          <span className="bankruptcy-item-name">{space.name}</span>
                          <span className="bankruptcy-item-detail">Hotel &rarr; Empty</span>
                          <span className="bankruptcy-item-value">+{sellValue}</span>
                        </button>
                        <button
                          className="bankruptcy-item-btn bankruptcy-item-alt"
                          onClick={() => onSellBuilding(idx, "hotel", true)}
                          style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                        >
                          <span className="bankruptcy-item-name">{space.name}</span>
                          <span className="bankruptcy-item-detail">Hotel &rarr; 4 Houses</span>
                          <span className="bankruptcy-item-value">+{sellValue}</span>
                        </button>
                      </div>
                    );
                  })}
                  {sellableHouses.map((idx) => {
                    const space = gameState.boardSpaces[idx];
                    const sellValue = getHouseSellValue(space.district);
                    return (
                      <button
                        key={`house-${idx}`}
                        className="bankruptcy-item-btn"
                        onClick={() => onSellBuilding(idx, "house")}
                        style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                      >
                        <span className="bankruptcy-item-name">{space.name}</span>
                        <span className="bankruptcy-item-detail">
                          {"[H]".repeat(space.houses)} ({space.houses} houses)
                        </span>
                        <span className="bankruptcy-item-value">+{sellValue}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mortgageable properties */}
            {mortgageableProps.length > 0 && (
              <div className="bankruptcy-section">
                <div className="bankruptcy-section-title">Mortgage Properties</div>
                <div className="bankruptcy-items">
                  {mortgageableProps.map(({ space, mortgageValue }) => (
                    <button
                      key={`mortgage-${space.index}`}
                      className="bankruptcy-item-btn bankruptcy-item-mortgage"
                      onClick={() => onMortgage(space.index)}
                      style={{ borderLeftColor: DISTRICT_COLORS[space.district] || "#555" }}
                    >
                      <span className="bankruptcy-item-name">{space.name}</span>
                      <span className="bankruptcy-item-detail">{space.district}</span>
                      <span className="bankruptcy-item-value">+{mortgageValue}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="bankruptcy-actions">
              <button
                className="bankruptcy-btn bankruptcy-btn-pay"
                onClick={onPayDebt}
                disabled={!canPayDebt}
              >
                {canPayDebt ? `Pay ${negotiation.amountOwed} Coins` : `Need ${negotiation.amountOwed - debtor.coins} More`}
              </button>
              <button
                className="bankruptcy-btn bankruptcy-btn-declare"
                onClick={onDeclareBankruptcy}
              >
                Declare Bankruptcy
              </button>
            </div>
          </div>
        )}

        {/* Other players see a notification */}
        {!isDebtor && (
          <div className="bankruptcy-spectator-msg">
            {debtor.displayName} is trying to raise funds to pay their debt.
            <br />
            Waiting for them to resolve or time out...
          </div>
        )}
      </div>
    </div>
  );
};
