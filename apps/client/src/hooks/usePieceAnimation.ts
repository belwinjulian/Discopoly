import { useState, useEffect, useRef, useCallback } from "react";
import { PlayerState } from "./useGameState";
import { playHop, playLand } from "../utils/sounds";

const TOTAL_SPACES = 28;
const HOP_DURATION_MS = 180;

export interface AnimationState {
  /** Session ID of the player currently being animated */
  animatingSessionId: string | null;
  /** Pixel position of the animated piece relative to the board */
  currentPos: { x: number; y: number } | null;
  /** Whether an animation is currently running */
  isAnimating: boolean;
  /** Whether we're on the final step of the animation */
  isFinalStep: boolean;
  /** The piece ID of the animating player */
  animPieceId: string;
  /** The player index (for color lookup) of the animating player */
  animPlayerIndex: number;
}

export interface AnimationResult extends AnimationState {
  /** Synchronous ref for checking animation status within the same commit phase */
  isAnimatingRef: React.RefObject<boolean>;
}

/**
 * Compute the forward path of space indices from `from` to `to`,
 * wrapping around the board (28 spaces).
 */
function computePath(from: number, to: number): number[] {
  const path: number[] = [];
  let current = from;
  // Always move forward (clockwise)
  while (current !== to) {
    current = (current + 1) % TOTAL_SPACES;
    path.push(current);
  }
  return path;
}

/**
 * Get the center pixel position of a board space element relative to the board container.
 */
function getSpacePosition(
  boardEl: HTMLElement,
  spaceIndex: number
): { x: number; y: number } | null {
  const spaceEl = boardEl.querySelector(
    `[data-space-index="${spaceIndex}"]`
  ) as HTMLElement | null;
  if (!spaceEl) return null;

  const boardRect = boardEl.getBoundingClientRect();
  const spaceRect = spaceEl.getBoundingClientRect();

  return {
    x: spaceRect.left - boardRect.left + spaceRect.width / 2,
    y: spaceRect.top - boardRect.top + spaceRect.height / 2,
  };
}

export function usePieceAnimation(
  players: Map<string, PlayerState>,
  boardRef: React.RefObject<HTMLDivElement | null>
): AnimationResult {
  const prevPositions = useRef<Map<string, number>>(new Map());
  const [animState, setAnimState] = useState<AnimationState>({
    animatingSessionId: null,
    currentPos: null,
    isAnimating: false,
    isFinalStep: false,
    animPieceId: "",
    animPlayerIndex: 0,
  });
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  // Detect position changes and trigger animation
  useEffect(() => {
    // Don't start a new animation while one is running
    if (isAnimatingRef.current) {
      // Still update prev positions for non-animating players
      players.forEach((player, sessionId) => {
        if (sessionId !== animState.animatingSessionId) {
          prevPositions.current.set(sessionId, player.position);
        }
      });
      return;
    }

    let movedPlayer: PlayerState | null = null;
    let oldPos = -1;

    players.forEach((player, sessionId) => {
      const prev = prevPositions.current.get(sessionId);
      if (prev !== undefined && prev !== player.position && player.isActive && !player.isBankrupt) {
        // This player moved
        if (!movedPlayer) {
          movedPlayer = player;
          oldPos = prev;
        }
      }
    });

    // Update all prev positions
    players.forEach((player, sessionId) => {
      prevPositions.current.set(sessionId, player.position);
    });

    if (!movedPlayer || oldPos === -1 || !boardRef.current) return;

    const player = movedPlayer as PlayerState;
    const newPos = player.position;

    // Don't animate if the move is a teleport (e.g., Detour sends to position 7)
    // We still animate it, but we compute the path
    const path = computePath(oldPos, newPos);
    if (path.length === 0) return;

    // Start animation
    isAnimatingRef.current = true;

    // Get initial position (the old space)
    const startPos = getSpacePosition(boardRef.current, oldPos);
    if (!startPos) {
      isAnimatingRef.current = false;
      return;
    }

    setAnimState({
      animatingSessionId: player.sessionId,
      currentPos: startPos,
      isAnimating: true,
      isFinalStep: false,
      animPieceId: player.pieceId,
      animPlayerIndex: player.playerIndex,
    });

    // Animate through each step
    let stepIndex = 0;

    function advanceStep() {
      if (stepIndex >= path.length || !boardRef.current) {
        // Animation complete
        isAnimatingRef.current = false;
        setAnimState((prev) => ({
          ...prev,
          isAnimating: false,
          animatingSessionId: null,
          currentPos: null,
          isFinalStep: false,
        }));
        return;
      }

      const spaceIdx = path[stepIndex];
      const pos = getSpacePosition(boardRef.current!, spaceIdx);
      const isFinal = stepIndex === path.length - 1;

      if (pos) {
        if (isFinal) {
          playLand();
        } else {
          playHop();
        }

        setAnimState((prev) => ({
          ...prev,
          currentPos: pos,
          isFinalStep: isFinal,
        }));
      }

      stepIndex++;

      if (stepIndex <= path.length) {
        // Schedule next step (or the cleanup after the final step)
        const delay = stepIndex <= path.length - 1 ? HOP_DURATION_MS : 350; // longer pause on final
        animTimerRef.current = setTimeout(advanceStep, delay);
      }
    }

    // Start first hop after a brief initial pause
    animTimerRef.current = setTimeout(advanceStep, 50);
  }, [players, boardRef]);

  return { ...animState, isAnimatingRef };
}
