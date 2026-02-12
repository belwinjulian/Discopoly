import React, { useState, useMemo } from "react";
import {
  GameStateSnapshot,
  PlayerState,
  BoardSpaceState,
  TradeOfferState,
} from "../hooks/useGameState";
import { DISTRICT_COLORS } from "../data/boardSpaces";
import "../styles/trade.css";

interface TradeModalProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  /** Set when the local player is creating a new trade proposal */
  tradeTargetSessionId: string | null;
  onProposeTrade: (data: {
    toSessionId: string;
    offeredProperties: number[];
    requestedProperties: number[];
    offeredCoins: number;
    requestedCoins: number;
  }) => void;
  onAcceptTrade: () => void;
  onRejectTrade: () => void;
  onCancelTrade: () => void;
  onClose: () => void;
}

/** Get tradeable properties for a player (no buildings) */
function getTradeableProperties(
  boardSpaces: BoardSpaceState[],
  sessionId: string
): BoardSpaceState[] {
  return boardSpaces.filter(
    (s) =>
      s.ownerId === sessionId &&
      s.spaceType === "property" &&
      s.houses === 0 &&
      !s.hasHotel
  );
}

type TradeMode = "propose" | "respond" | "waiting";

export const TradeModal: React.FC<TradeModalProps> = ({
  gameState,
  mySessionId,
  tradeTargetSessionId,
  onProposeTrade,
  onAcceptTrade,
  onRejectTrade,
  onCancelTrade,
  onClose,
}) => {
  const [selectedOffer, setSelectedOffer] = useState<Set<number>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<Set<number>>(new Set());
  const [offeredCoins, setOfferedCoins] = useState<string>("");
  const [requestedCoins, setRequestedCoins] = useState<string>("");

  const activeTrade = gameState.activeTrade;

  // Determine the mode
  const mode: TradeMode = useMemo(() => {
    if (activeTrade.status === "pending") {
      if (activeTrade.toSessionId === mySessionId) return "respond";
      if (activeTrade.fromSessionId === mySessionId) return "waiting";
    }
    return "propose";
  }, [activeTrade, mySessionId]);

  // Get the target player for propose mode
  const targetSessionId =
    mode === "propose"
      ? tradeTargetSessionId
      : mode === "respond"
      ? activeTrade.fromSessionId
      : activeTrade.toSessionId;

  const targetPlayer = targetSessionId
    ? gameState.players.get(targetSessionId)
    : null;

  const myPlayer = gameState.players.get(mySessionId);

  // Get tradeable properties
  const myTradeableProps = useMemo(
    () => getTradeableProperties(gameState.boardSpaces, mySessionId),
    [gameState.boardSpaces, mySessionId]
  );

  const targetTradeableProps = useMemo(
    () =>
      targetSessionId
        ? getTradeableProperties(gameState.boardSpaces, targetSessionId)
        : [],
    [gameState.boardSpaces, targetSessionId]
  );

  const toggleOffer = (idx: number) => {
    setSelectedOffer((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleRequest = (idx: number) => {
    setSelectedRequest((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSend = () => {
    if (!targetSessionId) return;
    const offCoins = Math.max(0, Math.floor(Number(offeredCoins) || 0));
    const reqCoins = Math.max(0, Math.floor(Number(requestedCoins) || 0));

    onProposeTrade({
      toSessionId: targetSessionId,
      offeredProperties: Array.from(selectedOffer),
      requestedProperties: Array.from(selectedRequest),
      offeredCoins: offCoins,
      requestedCoins: reqCoins,
    });
  };

  const canSend =
    selectedOffer.size > 0 ||
    selectedRequest.size > 0 ||
    Number(offeredCoins) > 0 ||
    Number(requestedCoins) > 0;

  if (!targetPlayer || !myPlayer) return null;

  // ========== PROPOSE MODE ==========
  if (mode === "propose") {
    return (
      <div className="trade-overlay" onClick={onClose}>
        <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="trade-header">
            <h2 className="trade-title">
              Trade with {targetPlayer.displayName}
            </h2>
            <button className="trade-close" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="trade-columns">
            {/* You Offer */}
            <div className="trade-column trade-column-offer">
              <div className="trade-column-title">You Offer</div>

              <span className="trade-props-label">Properties</span>
              <div className="trade-props-list">
                {myTradeableProps.length === 0 ? (
                  <span className="trade-no-props">No tradeable properties</span>
                ) : (
                  myTradeableProps.map((space) => (
                    <div
                      key={space.index}
                      className={`trade-prop-chip ${
                        selectedOffer.has(space.index)
                          ? "trade-prop-chip-selected"
                          : ""
                      }`}
                      style={{
                        borderLeftColor:
                          DISTRICT_COLORS[space.district] || "#555",
                      }}
                      onClick={() => toggleOffer(space.index)}
                    >
                      <span className="trade-prop-name">{space.name}</span>
                      <span className="trade-prop-price">
                        {space.price}
                      </span>
                      {selectedOffer.has(space.index) && (
                        <span className="trade-prop-check">✓</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="trade-coins-section">
                <span className="trade-coins-icon">🪙</span>
                <input
                  type="number"
                  className="trade-coins-input"
                  placeholder="0"
                  min="0"
                  max={myPlayer.coins}
                  value={offeredCoins}
                  onChange={(e) => setOfferedCoins(e.target.value)}
                />
                <span className="trade-coins-label">
                  / {myPlayer.coins}
                </span>
              </div>
            </div>

            {/* You Request */}
            <div className="trade-column trade-column-request">
              <div className="trade-column-title">You Request</div>

              <span className="trade-props-label">Properties</span>
              <div className="trade-props-list">
                {targetTradeableProps.length === 0 ? (
                  <span className="trade-no-props">No tradeable properties</span>
                ) : (
                  targetTradeableProps.map((space) => (
                    <div
                      key={space.index}
                      className={`trade-prop-chip ${
                        selectedRequest.has(space.index)
                          ? "trade-prop-chip-selected"
                          : ""
                      }`}
                      style={{
                        borderLeftColor:
                          DISTRICT_COLORS[space.district] || "#555",
                      }}
                      onClick={() => toggleRequest(space.index)}
                    >
                      <span className="trade-prop-name">{space.name}</span>
                      <span className="trade-prop-price">
                        {space.price}
                      </span>
                      {selectedRequest.has(space.index) && (
                        <span className="trade-prop-check">✓</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="trade-coins-section">
                <span className="trade-coins-icon">🪙</span>
                <input
                  type="number"
                  className="trade-coins-input"
                  placeholder="0"
                  min="0"
                  max={targetPlayer.coins}
                  value={requestedCoins}
                  onChange={(e) => setRequestedCoins(e.target.value)}
                />
                <span className="trade-coins-label">
                  / {targetPlayer.coins}
                </span>
              </div>
            </div>
          </div>

          <div className="trade-actions">
            <button className="trade-btn trade-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="trade-btn trade-btn-send"
              disabled={!canSend}
              onClick={handleSend}
            >
              Send Offer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== RESPOND MODE ==========
  if (mode === "respond") {
    const fromPlayer = gameState.players.get(activeTrade.fromSessionId);
    if (!fromPlayer) return null;

    return (
      <div className="trade-overlay">
        <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="trade-header">
            <h2 className="trade-title">
              {fromPlayer.displayName} wants to trade
            </h2>
          </div>

          <TradeSummary
            gameState={gameState}
            trade={activeTrade}
            perspective="recipient"
          />

          <div className="trade-actions">
            <button
              className="trade-btn trade-btn-decline"
              onClick={onRejectTrade}
            >
              Decline
            </button>
            <button
              className="trade-btn trade-btn-accept"
              onClick={onAcceptTrade}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== WAITING MODE ==========
  return (
    <div className="trade-overlay">
      <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trade-header">
          <h2 className="trade-title">
            Trade with {targetPlayer.displayName}
          </h2>
        </div>

        <TradeSummary
          gameState={gameState}
          trade={activeTrade}
          perspective="proposer"
        />

        <div className="trade-waiting">
          <p className="trade-waiting-text">
            Waiting for {targetPlayer.displayName} to respond
            <span className="trade-waiting-dots">
              <span />
              <span />
              <span />
            </span>
          </p>
        </div>

        <div className="trade-actions">
          <button
            className="trade-btn trade-btn-cancel"
            onClick={onCancelTrade}
          >
            Cancel Offer
          </button>
        </div>
      </div>
    </div>
  );
};

/** Renders a read-only summary of a trade offer */
const TradeSummary: React.FC<{
  gameState: GameStateSnapshot;
  trade: TradeOfferState;
  perspective: "proposer" | "recipient";
}> = ({ gameState, trade, perspective }) => {
  const fromPlayer = gameState.players.get(trade.fromSessionId);
  const toPlayer = gameState.players.get(trade.toSessionId);

  // From proposer's perspective: "gives" = offeredProperties, "wants" = requestedProperties
  // From recipient's perspective: "gives" = requestedProperties (what they give), "wants" = offeredProperties (what they get)
  const givesLabel =
    perspective === "proposer"
      ? `${fromPlayer?.displayName} gives`
      : `You give`;
  const wantsLabel =
    perspective === "proposer"
      ? `${fromPlayer?.displayName} wants`
      : `You receive`;

  const givesProps =
    perspective === "proposer"
      ? trade.offeredProperties
      : trade.requestedProperties;
  const givesCoins =
    perspective === "proposer" ? trade.offeredCoins : trade.requestedCoins;
  const wantsProps =
    perspective === "proposer"
      ? trade.requestedProperties
      : trade.offeredProperties;
  const wantsCoins =
    perspective === "proposer" ? trade.requestedCoins : trade.offeredCoins;

  return (
    <div className="trade-summary">
      <div className="trade-summary-section trade-summary-gives">
        <div className="trade-summary-title">{givesLabel}</div>
        <div className="trade-summary-items">
          {givesProps.map((idx) => {
            const space = gameState.boardSpaces[idx];
            if (!space) return null;
            return (
              <div key={idx} className="trade-summary-item">
                <span
                  className="trade-summary-item-dot"
                  style={{
                    backgroundColor:
                      DISTRICT_COLORS[space.district] || "#555",
                  }}
                />
                {space.name}
              </div>
            );
          })}
          {givesCoins > 0 && (
            <div className="trade-summary-item">
              <span className="trade-summary-coins">🪙 {givesCoins} coins</span>
            </div>
          )}
          {givesProps.length === 0 && givesCoins === 0 && (
            <span className="trade-summary-empty">Nothing</span>
          )}
        </div>
      </div>

      <div className="trade-summary-section trade-summary-wants">
        <div className="trade-summary-title">{wantsLabel}</div>
        <div className="trade-summary-items">
          {wantsProps.map((idx) => {
            const space = gameState.boardSpaces[idx];
            if (!space) return null;
            return (
              <div key={idx} className="trade-summary-item">
                <span
                  className="trade-summary-item-dot"
                  style={{
                    backgroundColor:
                      DISTRICT_COLORS[space.district] || "#555",
                  }}
                />
                {space.name}
              </div>
            );
          })}
          {wantsCoins > 0 && (
            <div className="trade-summary-item">
              <span className="trade-summary-coins">🪙 {wantsCoins} coins</span>
            </div>
          )}
          {wantsProps.length === 0 && wantsCoins === 0 && (
            <span className="trade-summary-empty">Nothing</span>
          )}
        </div>
      </div>
    </div>
  );
};
