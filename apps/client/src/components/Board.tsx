import React, { useMemo } from "react";
import { BoardSpaceState, PlayerState } from "../hooks/useGameState";
import { BoardSpaceComponent } from "./BoardSpace";
import { AnimatedPiece } from "./AnimatedPiece";
import { getBoardLayout } from "../data/boardSpaces";
import "../styles/board.css";

interface BoardProps {
  boardSpaces: BoardSpaceState[];
  players: PlayerState[];
  lastAction: string;
  /** Ref to the .board div for position calculations */
  boardRef?: React.RefObject<HTMLDivElement | null>;
  /** Session ID of the player whose token should be hidden (being animated) */
  hideTokenForSession?: string | null;
  /** Whether the board animation is active (applies blur) */
  isAnimating?: boolean;
  /** Pixel position of the animated piece */
  animPosition?: { x: number; y: number } | null;
  /** Piece ID for the animated piece */
  animPieceId?: string;
  /** Player index for the animated piece (for color) */
  animPlayerIndex?: number;
  /** Whether the animation is on its final step */
  isAnimFinal?: boolean;
  /** Callback when a property space is clicked */
  onSpaceClick?: (spaceIndex: number) => void;
}

export const Board: React.FC<BoardProps> = ({
  boardSpaces,
  players,
  lastAction,
  boardRef,
  hideTokenForSession,
  isAnimating = false,
  animPosition,
  animPieceId,
  animPlayerIndex,
  isAnimFinal = false,
  onSpaceClick,
}) => {
  const layout = getBoardLayout();

  // Build a Map<string, PlayerState> from the players array for rent preview
  const playersMap = useMemo(() => {
    const map = new Map<string, PlayerState>();
    for (const p of players) {
      map.set(p.sessionId, p);
    }
    return map;
  }, [players]);

  if (boardSpaces.length === 0) return null;

  // Bottom row: indices 0-6, displayed right to left
  const bottomSpaces = [...layout.bottom].reverse();
  // Left column: indices 7-13, displayed bottom to top
  const leftSpaces = [...layout.left];
  // Top row: indices 14-20, displayed left to right
  const topSpaces = layout.top;
  // Right column: indices 21-27, displayed top to bottom
  const rightSpaces = layout.right;

  const corners = [0, 7, 14, 21];

  const hideSession = hideTokenForSession || undefined;

  return (
    <div className="board-container">
      <div
        className={`board ${isAnimating ? "board-animating" : ""}`}
        ref={(el) => {
          if (boardRef) {
            (boardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
      >
        {/* Top row */}
        <div className="board-row board-row-top">
          {topSpaces.map((idx) => (
            <BoardSpaceComponent
              key={idx}
              space={boardSpaces[idx]}
              players={players}
              allBoardSpaces={boardSpaces}
              allPlayers={playersMap}
              isCorner={corners.includes(idx)}
              side="top"
              hideTokenForSession={hideSession}
              onClick={onSpaceClick}
            />
          ))}
        </div>

        {/* Middle section: left column, center area, right column */}
        <div className="board-middle">
          {/* Left column */}
          <div className="board-col board-col-left">
            {[...leftSpaces].reverse().map((idx) => (
              <BoardSpaceComponent
                key={idx}
                space={boardSpaces[idx]}
                players={players}
                allBoardSpaces={boardSpaces}
                allPlayers={playersMap}
                isCorner={corners.includes(idx)}
                side="left"
                hideTokenForSession={hideSession}
                onClick={onSpaceClick}
              />
            ))}
          </div>

          {/* Center area */}
          <div className="board-center">
            <div className="board-center-content">
              <h2 className="board-center-title">Discopoly</h2>
              <p className="board-center-subtitle">City Builder</p>
              {lastAction && (
                <div className="board-center-action">
                  <p>{lastAction}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="board-col board-col-right">
            {rightSpaces.map((idx) => (
              <BoardSpaceComponent
                key={idx}
                space={boardSpaces[idx]}
                players={players}
                allBoardSpaces={boardSpaces}
                allPlayers={playersMap}
                isCorner={corners.includes(idx)}
                side="right"
                hideTokenForSession={hideSession}
                onClick={onSpaceClick}
              />
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="board-row board-row-bottom">
          {bottomSpaces.map((idx) => (
            <BoardSpaceComponent
              key={idx}
              space={boardSpaces[idx]}
              players={players}
              allBoardSpaces={boardSpaces}
              allPlayers={playersMap}
              isCorner={corners.includes(idx)}
              side="bottom"
              hideTokenForSession={hideSession}
              onClick={onSpaceClick}
            />
          ))}
        </div>

        {/* Animated piece overlay */}
        {isAnimating && animPosition && animPieceId && animPlayerIndex !== undefined && (
          <AnimatedPiece
            x={animPosition.x}
            y={animPosition.y}
            pieceId={animPieceId}
            playerIndex={animPlayerIndex}
            isFinalStep={isAnimFinal}
          />
        )}
      </div>
    </div>
  );
};
