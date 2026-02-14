import React, { useState } from "react";
import { GameStateSnapshot, PlayerState } from "../hooks/useGameState";
import { DISTRICT_COLORS } from "../data/boardSpaces";
import "../styles/auction.css";

interface AuctionModalProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
  onPlaceBid: (amount: number) => void;
  onPass: () => void;
  isSpectator?: boolean;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  gameState,
  mySessionId,
  onPlaceBid,
  onPass,
  isSpectator,
}) => {
  const auction = gameState.activeAuction;
  const [bidAmount, setBidAmount] = useState<number>(auction.currentBid + 1);

  if (auction.status !== "active") {
    return null;
  }

  const property = gameState.boardSpaces[auction.propertyIndex];
  if (!property) return null;

  const districtColor = property.district ? DISTRICT_COLORS[property.district] : "#555";
  const myPlayer = gameState.players.get(mySessionId);
  const highestBidder = auction.highestBidderId
    ? gameState.players.get(auction.highestBidderId)
    : null;

  // Get all active players
  const activePlayers = Array.from(gameState.players.values())
    .filter((p) => p.isActive && !p.isBankrupt)
    .sort((a, b) => a.playerIndex - b.playerIndex);

  // Check if current player has passed
  const hasPassed = auction.passedPlayers.includes(mySessionId);
  // Check if current player is the highest bidder
  const isHighestBidder = auction.highestBidderId === mySessionId;
  // Minimum bid is current bid + 1, or 1 if no bids yet
  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : 1;
  // Check if player can afford to bid
  const canAffordBid = myPlayer ? myPlayer.coins >= minBid : false;

  const handleBidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setBidAmount(value);
    }
  };

  const handleQuickBid = (increment: number) => {
    const newBid = Math.max(minBid, auction.currentBid + increment);
    setBidAmount(newBid);
  };

  const handleSubmitBid = () => {
    if (bidAmount >= minBid && myPlayer && bidAmount <= myPlayer.coins) {
      onPlaceBid(bidAmount);
      setBidAmount(bidAmount + 1); // Increment for next potential bid
    }
  };

  const getPlayerStatus = (player: PlayerState): string => {
    if (player.sessionId === auction.highestBidderId) {
      return "leading";
    }
    if (auction.passedPlayers.includes(player.sessionId)) {
      return "passed";
    }
    return "bidding";
  };

  return (
    <div className="auction-overlay">
      <div className="auction-modal">
        {/* Header */}
        <div className="auction-header" style={{ background: districtColor }}>
          AUCTION
        </div>

        {/* Property info */}
        <div className="auction-property">
          <h3 className="auction-property-name">{property.name}</h3>
          <div className="auction-property-details">
            <span className="auction-property-district">{property.district}</span>
            <span className="auction-property-price">List Price: {property.price}</span>
          </div>
        </div>

        {/* Current bid */}
        <div className="auction-bid-display">
          <div className="auction-bid-label">Current Bid</div>
          <div className="auction-bid-amount">
            {auction.currentBid > 0 ? `${auction.currentBid} coins` : "No bids yet"}
          </div>
          {highestBidder && (
            <div className="auction-bid-leader">
              by {highestBidder.displayName}
              {isHighestBidder && " (You!)"}
            </div>
          )}
        </div>

        {/* Player list */}
        <div className="auction-players">
          <div className="auction-players-title">Participants</div>
          <div className="auction-players-list">
            {activePlayers.map((player) => {
              const status = getPlayerStatus(player);
              const isMe = player.sessionId === mySessionId;
              return (
                <div
                  key={player.sessionId}
                  className={`auction-player ${status} ${isMe ? "me" : ""}`}
                >
                  <span className="auction-player-name">
                    {player.displayName}
                    {isMe && " (You)"}
                  </span>
                  <span className={`auction-player-status ${status}`}>
                    {status === "leading" && "Leading"}
                    {status === "passed" && "Passed"}
                    {status === "bidding" && "Bidding"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bidding controls */}
        {myPlayer && !hasPassed && !isSpectator && (
          <div className="auction-controls">
            <div className="auction-your-coins">
              Your coins: <strong>{myPlayer.coins}</strong>
            </div>

            {!isHighestBidder && (
              <>
                <div className="auction-bid-input-row">
                  <input
                    type="number"
                    className="auction-bid-input"
                    value={bidAmount}
                    onChange={handleBidChange}
                    min={minBid}
                    max={myPlayer.coins}
                  />
                  <span className="auction-bid-min">Min: {minBid}</span>
                </div>

                <div className="auction-quick-bids">
                  <button
                    className="auction-quick-btn"
                    onClick={() => handleQuickBid(1)}
                    disabled={!canAffordBid}
                  >
                    +1
                  </button>
                  <button
                    className="auction-quick-btn"
                    onClick={() => handleQuickBid(10)}
                    disabled={myPlayer.coins < auction.currentBid + 10}
                  >
                    +10
                  </button>
                  <button
                    className="auction-quick-btn"
                    onClick={() => handleQuickBid(50)}
                    disabled={myPlayer.coins < auction.currentBid + 50}
                  >
                    +50
                  </button>
                  <button
                    className="auction-quick-btn"
                    onClick={() => handleQuickBid(100)}
                    disabled={myPlayer.coins < auction.currentBid + 100}
                  >
                    +100
                  </button>
                </div>

                <div className="auction-action-buttons">
                  <button
                    className="auction-btn auction-btn-bid"
                    onClick={handleSubmitBid}
                    disabled={bidAmount < minBid || bidAmount > myPlayer.coins}
                  >
                    Place Bid
                  </button>
                  <button
                    className="auction-btn auction-btn-pass"
                    onClick={onPass}
                  >
                    Pass
                  </button>
                </div>
              </>
            )}

            {isHighestBidder && (
              <div className="auction-leading-message">
                You are the highest bidder! Wait for others to bid or pass.
              </div>
            )}
          </div>
        )}

        {/* Already passed message */}
        {hasPassed && !isSpectator && (
          <div className="auction-passed-message">
            You have passed. Waiting for auction to end...
          </div>
        )}

        {/* Can't afford message */}
        {myPlayer && !canAffordBid && !hasPassed && !isHighestBidder && !isSpectator && (
          <div className="auction-cant-afford">
            You don't have enough coins to place a bid.
            <button
              className="auction-btn auction-btn-pass"
              onClick={onPass}
            >
              Pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
