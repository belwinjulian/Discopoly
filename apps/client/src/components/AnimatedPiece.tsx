import React from "react";
import { PLAYER_COLORS } from "../data/boardSpaces";
import { getPieceEmoji } from "../data/pieces";
import "../styles/animations.css";

interface AnimatedPieceProps {
  x: number;
  y: number;
  pieceId: string;
  playerIndex: number;
  isFinalStep: boolean;
}

export const AnimatedPiece: React.FC<AnimatedPieceProps> = ({
  x,
  y,
  pieceId,
  playerIndex,
  isFinalStep,
}) => {
  const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

  return (
    <div
      className={`anim-piece ${isFinalStep ? "anim-piece-land" : "anim-piece-hop"}`}
      style={{
        left: x,
        top: y,
        backgroundColor: color,
        boxShadow: `0 8px 24px ${color}66, 0 4px 12px rgba(0,0,0,0.5)`,
      }}
    >
      <span className="anim-piece-emoji">{getPieceEmoji(pieceId)}</span>
    </div>
  );
};
