import React, { useEffect, useState } from "react";
import "../styles/animations.css";

interface TurnSplashProps {
  visible: boolean;
  playerName: string;
  isMyTurn: boolean;
}

export const TurnSplash: React.FC<TurnSplashProps> = ({
  visible,
  playerName,
  isMyTurn,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div className="turn-splash-overlay">
      <div className="turn-splash">
        {isMyTurn ? (
          <>
            <div className="turn-splash-emoji">🎲</div>
            <h1 className="turn-splash-title">YOUR TURN</h1>
            <p className="turn-splash-sub">Roll the dice!</p>
          </>
        ) : (
          <>
            <div className="turn-splash-emoji">⏳</div>
            <h1 className="turn-splash-title turn-splash-other">{playerName}'s Turn</h1>
          </>
        )}
      </div>
    </div>
  );
};
