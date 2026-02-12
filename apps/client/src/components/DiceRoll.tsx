import React, { useEffect, useState, useRef } from "react";
import "../styles/game.css";
import "../styles/animations.css";

interface DiceRollProps {
  dice1: number;
  dice2: number;
  visible: boolean;
}

const DICE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

export const DiceRoll: React.FC<DiceRollProps> = ({ dice1, dice2, visible }) => {
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState({ d1: 0, d2: 0 });
  const prevDice = useRef({ d1: 0, d2: 0 });

  useEffect(() => {
    if (visible && (dice1 !== prevDice.current.d1 || dice2 !== prevDice.current.d2)) {
      // New roll detected - animate!
      setRolling(true);

      // Show random faces while rolling
      let count = 0;
      const interval = setInterval(() => {
        setDisplayDice({
          d1: Math.floor(Math.random() * 6) + 1,
          d2: Math.floor(Math.random() * 6) + 1,
        });
        count++;
        if (count >= 8) {
          clearInterval(interval);
          setDisplayDice({ d1: dice1, d2: dice2 });
          setRolling(false);
        }
      }, 80);

      prevDice.current = { d1: dice1, d2: dice2 };
      return () => clearInterval(interval);
    }
  }, [dice1, dice2, visible]);

  if (!visible || (dice1 === 0 && dice2 === 0)) return null;

  const d1 = rolling ? displayDice.d1 : dice1;
  const d2 = rolling ? displayDice.d2 : dice2;

  return (
    <div className="dice-container">
      <div className={`dice ${rolling ? "dice-rolling" : "dice-result"}`}>
        {DICE_FACES[d1] || "⚀"}
      </div>
      <div className={`dice ${rolling ? "dice-rolling" : "dice-result"}`}>
        {DICE_FACES[d2] || "⚀"}
      </div>
      {!rolling && (
        <div className="dice-total">{dice1 + dice2}</div>
      )}
    </div>
  );
};
