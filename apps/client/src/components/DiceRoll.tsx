import React, { useEffect, useState, useRef, useCallback } from "react";
import "../styles/game.css";
import "../styles/dice3d.css";

interface DiceRollProps {
  dice1: number;
  dice2: number;
  visible: boolean;
  onRollStart?: () => void;
  onRollComplete?: () => void;
}

// 3x3 grid dot patterns for each die face value
// Each array has 9 booleans for the 3x3 grid (row-major)
const DOT_PATTERNS: Record<number, boolean[]> = {
  1: [
    false, false, false,
    false, true,  false,
    false, false, false,
  ],
  2: [
    false, false, true,
    false, false, false,
    true,  false, false,
  ],
  3: [
    false, false, true,
    false, true,  false,
    true,  false, false,
  ],
  4: [
    true,  false, true,
    false, false, false,
    true,  false, true,
  ],
  5: [
    true,  false, true,
    false, true,  false,
    true,  false, true,
  ],
  6: [
    true,  false, true,
    true,  false, true,
    true,  false, true,
  ],
};

/** Renders one face of a die with dots in a 3x3 grid */
const DieFace: React.FC<{ value: number }> = ({ value }) => {
  const pattern = DOT_PATTERNS[value] || DOT_PATTERNS[1];
  return (
    <>
      {pattern.map((hasDot, i) =>
        hasDot ? (
          <span key={i} className="die-3d-dot" />
        ) : (
          <span key={i} className="die-3d-dot-empty" />
        )
      )}
    </>
  );
};

// Rotation needed to show each face value on front
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0 },
  2: { x: 0,   y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90,  y: 0 },
  5: { x: 0,   y: 90 },
  6: { x: 0,   y: 180 },
};

interface Dice3DProps {
  value: number;
  rolling: boolean;
  onRollEnd: () => void;
}

/** A single 3D die that tumbles to the target value */
const Dice3D: React.FC<Dice3DProps> = ({ value, rolling, onRollEnd }) => {
  const cubeRef = useRef<HTMLDivElement>(null);
  const accumulatedRef = useRef({ x: 0, y: 0 });
  const [instant, setInstant] = useState(true);
  const hasRolledOnce = useRef(false);
  const rollingRef = useRef(false);

  // On mount, position cube to show value 1 without transition
  useEffect(() => {
    // Remove instant class after first frame
    const timer = requestAnimationFrame(() => {
      setInstant(false);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    if (rolling && !rollingRef.current) {
      rollingRef.current = true;
      hasRolledOnce.current = true;

      const face = FACE_ROTATIONS[value] || FACE_ROTATIONS[1];

      // Add 2-3 full spins (720-1080 degrees)
      const extraSpinsX = (Math.floor(Math.random() * 2) + 2) * 360;
      const extraSpinsY = (Math.floor(Math.random() * 2) + 2) * 360;

      // Calculate how much more we need to rotate to land on the target face
      // from the current accumulated rotation
      const targetX = accumulatedRef.current.x + extraSpinsX + face.x - (accumulatedRef.current.x % 360);
      const targetY = accumulatedRef.current.y + extraSpinsY + face.y - (accumulatedRef.current.y % 360);

      accumulatedRef.current = { x: targetX, y: targetY };

      if (cubeRef.current) {
        cubeRef.current.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg)`;
      }
    } else if (!rolling) {
      rollingRef.current = false;
    }
  }, [rolling, value]);

  // Listen for transitionend to signal roll completion
  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;

    const handler = (e: TransitionEvent) => {
      if (e.propertyName === "transform" && rollingRef.current === false && hasRolledOnce.current) {
        onRollEnd();
      }
    };

    cube.addEventListener("transitionend", handler);
    return () => cube.removeEventListener("transitionend", handler);
  }, [onRollEnd]);

  return (
    <div className="die-3d-viewport">
      <div
        ref={cubeRef}
        className={`die-3d-cube${instant ? " die-3d-cube-instant" : ""}`}
        style={{ transform: `rotateX(0deg) rotateY(0deg)` }}
      >
        {[1, 2, 3, 4, 5, 6].map((faceValue) => (
          <div key={faceValue} className={`die-3d-face die-3d-face-${faceValue}`}>
            <DieFace value={faceValue} />
          </div>
        ))}
      </div>
    </div>
  );
};

type Phase = "idle" | "rolling-die-1" | "pause" | "rolling-die-2" | "done";

export const DiceRoll: React.FC<DiceRollProps> = ({
  dice1,
  dice2,
  visible,
  onRollStart,
  onRollComplete,
}) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const prevDice = useRef({ d1: 0, d2: 0 });
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRollStartRef = useRef(onRollStart);
  const onRollCompleteRef = useRef(onRollComplete);

  // Keep callback refs current
  onRollStartRef.current = onRollStart;
  onRollCompleteRef.current = onRollComplete;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  // Detect new dice values → start sequential roll
  useEffect(() => {
    if (
      visible &&
      dice1 > 0 &&
      dice2 > 0 &&
      (dice1 !== prevDice.current.d1 || dice2 !== prevDice.current.d2)
    ) {
      prevDice.current = { d1: dice1, d2: dice2 };
      onRollStartRef.current?.();
      setPhase("rolling-die-1");
    }
  }, [dice1, dice2, visible]);

  // Reset when dice become hidden (turn change)
  useEffect(() => {
    if (!visible) {
      setPhase("idle");
      prevDice.current = { d1: 0, d2: 0 };
    }
  }, [visible]);

  const handleDie1End = useCallback(() => {
    // Pause 300ms between dice
    pauseTimerRef.current = setTimeout(() => {
      setPhase("rolling-die-2");
    }, 300);
  }, []);

  const handleDie2End = useCallback(() => {
    setPhase("done");
    onRollCompleteRef.current?.();
  }, []);

  if (!visible || (dice1 === 0 && dice2 === 0)) return null;

  return (
    <div className="dice-container">
      <Dice3D
        value={dice1}
        rolling={phase === "rolling-die-1"}
        onRollEnd={handleDie1End}
      />
      <Dice3D
        value={dice2}
        rolling={phase === "rolling-die-2"}
        onRollEnd={handleDie2End}
      />
      {phase === "done" && (
        <div className="dice-3d-total">{dice1 + dice2}</div>
      )}
    </div>
  );
};
