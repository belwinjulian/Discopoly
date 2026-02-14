import React, { useState, useMemo } from "react";
import {
  GameStateSnapshot,
  PlayerState,
  BoardSpaceState,
  TradeOfferState,
} from "../hooks/useGameState";
import { DISTRICT_COLORS } from "../data/boardSpaces";
import "../styles/trade.css";

const MAX_COUNTER_OFFERS = 5;

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
  onCounterOffer: (data: {
    offeredProperties: number[];
    requestedProperties: number[];
    offeredCoins: number;
    requestedCoins: number;
  }) => void;
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

type TradeMode = "propose" | "respond" | "counter" | "waiting";

export const TradeModal: React.FC<TradeModalProps> = ({
  gameState,
  mySessionId,
  tradeTargetSessionId,
  onProposeTrade,
  onAcceptTrade,
  onRejectTrade,
  onCancelTrade,
  onCounterOffer,
  onClose,
}) => {
  const [selectedOffer, setSelectedOffer] = useState<Set<number>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<Set<number>>(new Set());
  const [offeredCoins, setOfferedCoins] = useState<string>("");
  const [requestedCoins, setRequestedCoins] = useState<string>("");
  const [isCounterMode, setIsCounterMode] = useState(false);

  const activeTrade = gameState.activeTrade;

  // Determine the mode
  const mode: TradeMode = useMemo(() => {
    if (activeTrade.status === "pending") {
      if (activeTrade.toSessionId === mySessionId) {
        return isCounterMode ? "counter" : "respond";
      }
      if (activeTrade.fromSessionId === mySessionId) return "waiting";
    }
    return "propose";
  }, [activeTrade, mySessionId, isCounterMode]);

  // Get the target player for propose mode
  const targetSessionId =
    mode === "propose"
      ? tradeTargetSessionId
      : mode === "respond" || mode === "counter"
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

  // Enter counter-offer mode: pre-fill with the inverse of the current trade
  // (from the respondent's perspective, swap offered/requested)
  const enterCounterMode = () => {
    // The current trade is from someone else's perspective.
    // Their "offeredProperties" are what they give us, their "requestedProperties" are what they want from us.
    // When we counter, WE become the proposer. So:
    //   - Our "offered" = what we give (was their "requested" - what they wanted from us)
    //   - Our "requested" = what we want (was their "offered" - what they were giving us)
    setSelectedOffer(new Set(activeTrade.requestedProperties));
    setSelectedRequest(new Set(activeTrade.offeredProperties));
    setOfferedCoins(activeTrade.requestedCoins > 0 ? String(activeTrade.requestedCoins) : "");
    setRequestedCoins(activeTrade.offeredCoins > 0 ? String(activeTrade.offeredCoins) : "");
    setIsCounterMode(true);
  };

  const exitCounterMode = () => {
    setIsCounterMode(false);
    setSelectedOffer(new Set());
    setSelectedRequest(new Set());
    setOfferedCoins("");
    setRequestedCoins("");
  };

  const handleSendCounterOffer = () => {
    const offCoins = Math.max(0, Math.floor(Number(offeredCoins) || 0));
    const reqCoins = Math.max(0, Math.floor(Number(requestedCoins) || 0));

    onCounterOffer({
      offeredProperties: Array.from(selectedOffer),
      requestedProperties: Array.from(selectedRequest),
      offeredCoins: offCoins,
      requestedCoins: reqCoins,
    });
    setIsCounterMode(false);
  };

  const canSend =
    selectedOffer.size > 0 ||
    selectedRequest.size > 0 ||
    Number(offeredCoins) > 0 ||
    Number(requestedCoins) > 0;

  const canCounter = activeTrade.counterOfferCount < MAX_COUNTER_OFFERS;

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

          <TradeEditor
            myPlayer={myPlayer}
            targetPlayer={targetPlayer}
            myTradeableProps={myTradeableProps}
            targetTradeableProps={targetTradeableProps}
            selectedOffer={selectedOffer}
            selectedRequest={selectedRequest}
            offeredCoins={offeredCoins}
            requestedCoins={requestedCoins}
            onToggleOffer={toggleOffer}
            onToggleRequest={toggleRequest}
            onSetOfferedCoins={setOfferedCoins}
            onSetRequestedCoins={setRequestedCoins}
          />

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

  // ========== COUNTER-OFFER EDITING MODE ==========
  if (mode === "counter") {
    const fromPlayer = gameState.players.get(activeTrade.fromSessionId);
    if (!fromPlayer) return null;

    return (
      <div className="trade-overlay">
        <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="trade-header">
            <h2 className="trade-title">
              Counter-Offer to {fromPlayer.displayName}
            </h2>
            {activeTrade.counterOfferCount > 0 && (
              <span className="trade-counter-badge">
                {activeTrade.counterOfferCount + 1}/{MAX_COUNTER_OFFERS}
              </span>
            )}
          </div>

          {/* Show what changed from previous offer */}
          {activeTrade.isCounterOffer && (
            <div className="trade-prev-offer-note">
              Editing counter-offer. Modify the terms below.
            </div>
          )}

          <TradeEditor
            myPlayer={myPlayer}
            targetPlayer={fromPlayer}
            myTradeableProps={myTradeableProps}
            targetTradeableProps={targetTradeableProps}
            selectedOffer={selectedOffer}
            selectedRequest={selectedRequest}
            offeredCoins={offeredCoins}
            requestedCoins={requestedCoins}
            onToggleOffer={toggleOffer}
            onToggleRequest={toggleRequest}
            onSetOfferedCoins={setOfferedCoins}
            onSetRequestedCoins={setRequestedCoins}
          />

          <div className="trade-actions">
            <button className="trade-btn trade-btn-cancel" onClick={exitCounterMode}>
              Back
            </button>
            <button
              className="trade-btn trade-btn-counter-send"
              disabled={!canSend}
              onClick={handleSendCounterOffer}
            >
              Send Counter-Offer
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
              {activeTrade.isCounterOffer
                ? `Counter-Offer from ${fromPlayer.displayName}`
                : `${fromPlayer.displayName} wants to trade`}
            </h2>
            {activeTrade.counterOfferCount > 0 && (
              <span className="trade-counter-badge">
                {activeTrade.counterOfferCount}/{MAX_COUNTER_OFFERS}
              </span>
            )}
          </div>

          <TradeSummary
            gameState={gameState}
            trade={activeTrade}
            perspective="recipient"
          />

          {/* Show diff from previous offer if this is a counter-offer */}
          {activeTrade.isCounterOffer && (
            <TradeDiff
              gameState={gameState}
              trade={activeTrade}
            />
          )}

          <div className="trade-actions">
            <button
              className="trade-btn trade-btn-decline"
              onClick={onRejectTrade}
            >
              Decline
            </button>
            {canCounter && (
              <button
                className="trade-btn trade-btn-counter"
                onClick={enterCounterMode}
              >
                Counter
              </button>
            )}
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
            {activeTrade.isCounterOffer
              ? `Counter-Offer to ${targetPlayer.displayName}`
              : `Trade with ${targetPlayer.displayName}`}
          </h2>
          {activeTrade.counterOfferCount > 0 && (
            <span className="trade-counter-badge">
              {activeTrade.counterOfferCount}/{MAX_COUNTER_OFFERS}
            </span>
          )}
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

/** Reusable trade editor (used in both propose and counter-offer modes) */
const TradeEditor: React.FC<{
  myPlayer: PlayerState;
  targetPlayer: PlayerState;
  myTradeableProps: BoardSpaceState[];
  targetTradeableProps: BoardSpaceState[];
  selectedOffer: Set<number>;
  selectedRequest: Set<number>;
  offeredCoins: string;
  requestedCoins: string;
  onToggleOffer: (idx: number) => void;
  onToggleRequest: (idx: number) => void;
  onSetOfferedCoins: (val: string) => void;
  onSetRequestedCoins: (val: string) => void;
}> = ({
  myPlayer,
  targetPlayer,
  myTradeableProps,
  targetTradeableProps,
  selectedOffer,
  selectedRequest,
  offeredCoins,
  requestedCoins,
  onToggleOffer,
  onToggleRequest,
  onSetOfferedCoins,
  onSetRequestedCoins,
}) => {
  return (
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
                onClick={() => onToggleOffer(space.index)}
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
            onChange={(e) => onSetOfferedCoins(e.target.value)}
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
                onClick={() => onToggleRequest(space.index)}
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
            onChange={(e) => onSetRequestedCoins(e.target.value)}
          />
          <span className="trade-coins-label">
            / {targetPlayer.coins}
          </span>
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

/** Shows what changed between the previous offer and the current counter-offer */
const TradeDiff: React.FC<{
  gameState: GameStateSnapshot;
  trade: TradeOfferState;
}> = ({ gameState, trade }) => {
  // The previous offer was from a DIFFERENT player's perspective (the old "from").
  // Current offer is from the counter-offerer's perspective (new "from" = current fromSessionId).
  // After the swap:
  //   - trade.fromSessionId is the counter-offerer (was the old "to")
  //   - trade.toSessionId is the original proposer (was the old "from")
  //
  // Previous terms (stored from OLD from's perspective):
  //   prevOffered = what old-from was giving (= what current-from was receiving)
  //   prevRequested = what old-from wanted (= what current-from was giving)
  //
  // Current terms (from NEW from's perspective = counter-offerer):
  //   offered = what counter-offerer gives
  //   requested = what counter-offerer wants
  //
  // So to compare from the recipient's (current toSessionId = old from) viewpoint:
  //   Previous: they gave prevOffered, they got prevRequested
  //   Current:  they give trade.requested, they get trade.offered
  //
  // Changes to highlight:
  //   - Properties/coins added or removed from each side

  const changes: string[] = [];

  // Compare what the current toSessionId (original proposer) gives now vs before
  // Before: prevOfferedProperties (old from = current to gave these)
  // Now: trade.requestedProperties (current from requests these from current to)
  const prevToGives = new Set(trade.prevOfferedProperties);
  const nowToGives = new Set(trade.requestedProperties);

  for (const idx of nowToGives) {
    if (!prevToGives.has(idx)) {
      const space = gameState.boardSpaces[idx];
      if (space) changes.push(`+ Added ${space.name} to your side`);
    }
  }
  for (const idx of prevToGives) {
    if (!nowToGives.has(idx)) {
      const space = gameState.boardSpaces[idx];
      if (space) changes.push(`- Removed ${space.name} from your side`);
    }
  }

  // Compare what current toSessionId receives now vs before
  // Before: prevRequestedProperties (old from requested these = old to gave these... wait)
  // Actually: prevRequested = what old-from wanted from old-to
  // old-to = current-from (counter-offerer)
  // So prevRequested = what counter-offerer WAS being asked to give
  // Now: trade.offeredProperties = what counter-offerer IS giving
  const prevFromGives = new Set(trade.prevRequestedProperties);
  const nowFromGives = new Set(trade.offeredProperties);

  for (const idx of nowFromGives) {
    if (!prevFromGives.has(idx)) {
      const space = gameState.boardSpaces[idx];
      if (space) changes.push(`+ Added ${space.name} to their side`);
    }
  }
  for (const idx of prevFromGives) {
    if (!nowFromGives.has(idx)) {
      const space = gameState.boardSpaces[idx];
      if (space) changes.push(`- Removed ${space.name} from their side`);
    }
  }

  // Compare coins
  // What current to gives in coins:
  // Before: prevOfferedCoins (old from offered these coins)
  // Now: trade.requestedCoins (counter-offerer requests these from current to)
  if (trade.requestedCoins !== trade.prevOfferedCoins) {
    const diff = trade.requestedCoins - trade.prevOfferedCoins;
    if (diff > 0) {
      changes.push(`+ You give ${diff} more coins`);
    } else {
      changes.push(`- You give ${Math.abs(diff)} fewer coins`);
    }
  }

  // What current to receives in coins:
  // Before: prevRequestedCoins
  // Now: trade.offeredCoins
  if (trade.offeredCoins !== trade.prevRequestedCoins) {
    const diff = trade.offeredCoins - trade.prevRequestedCoins;
    if (diff > 0) {
      changes.push(`+ You receive ${diff} more coins`);
    } else {
      changes.push(`- You receive ${Math.abs(diff)} fewer coins`);
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className="trade-diff">
      <div className="trade-diff-title">Changes from previous offer:</div>
      <div className="trade-diff-items">
        {changes.map((change, i) => (
          <div
            key={i}
            className={`trade-diff-item ${
              change.startsWith("+") ? "trade-diff-added" : "trade-diff-removed"
            }`}
          >
            {change}
          </div>
        ))}
      </div>
    </div>
  );
};
