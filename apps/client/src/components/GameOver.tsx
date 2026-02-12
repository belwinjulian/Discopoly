import React from "react";
import { GameStateSnapshot } from "../hooks/useGameState";
import { PLAYER_COLORS } from "../data/boardSpaces";

interface GameOverProps {
  gameState: GameStateSnapshot;
  mySessionId: string;
}

export const GameOver: React.FC<GameOverProps> = ({ gameState, mySessionId }) => {
  const winner = Array.from(gameState.players.values()).find(
    (p) => p.sessionId === gameState.winnerId
  );

  const isWinner = gameState.winnerId === mySessionId;

  // Sort players by wealth for final standings
  const standings = Array.from(gameState.players.values())
    .map((p) => {
      let wealth = p.coins;
      for (const propIdx of p.ownedProperties) {
        const space = gameState.boardSpaces[propIdx];
        if (space) wealth += space.price;
      }
      return { ...p, wealth };
    })
    .sort((a, b) => b.wealth - a.wealth);

  return (
    <div className="gameover">
      <div className="gameover-header">
        <h1 className="gameover-title">
          {isWinner ? "You Win!" : "Game Over"}
        </h1>
        {winner && (
          <div className="gameover-winner">
            <div
              className="gameover-winner-avatar"
              style={{
                backgroundColor:
                  PLAYER_COLORS[winner.playerIndex % PLAYER_COLORS.length],
              }}
            >
              {winner.displayName.charAt(0)}
            </div>
            <p className="gameover-winner-name">
              {winner.displayName} is the winner!
            </p>
          </div>
        )}
      </div>

      <div className="gameover-standings">
        <h2>Final Standings</h2>
        <div className="gameover-standings-list">
          {standings.map((player, idx) => (
            <div
              key={player.sessionId}
              className={`gameover-standing-row ${
                player.sessionId === mySessionId ? "gameover-standing-me" : ""
              }`}
            >
              <span className="gameover-rank">#{idx + 1}</span>
              <div
                className="gameover-standing-token"
                style={{
                  backgroundColor:
                    PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length],
                }}
              >
                {player.displayName.charAt(0)}
              </div>
              <span className="gameover-standing-name">{player.displayName}</span>
              <span className="gameover-standing-wealth">{player.wealth} coins</span>
            </div>
          ))}
        </div>
      </div>

      <p className="gameover-last-action">{gameState.lastAction}</p>
    </div>
  );
};
