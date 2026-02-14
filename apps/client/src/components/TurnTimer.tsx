import React, { useState, useEffect, useRef } from "react";
import "../styles/turntimer.css";

interface TurnTimerProps {
  turnStartTime: number;
  turnTimeLimit: number;
  turnTimerActive: boolean;
  turnExtensionUsed: boolean;
  currentPlayerName: string;
  isMyTurn: boolean;
  onRequestExtension: () => void;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({
  turnStartTime,
  turnTimeLimit,
  turnTimerActive,
  turnExtensionUsed,
  currentPlayerName,
  isMyTurn,
  onRequestExtension,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(turnTimeLimit);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!turnTimerActive || turnStartTime === 0) {
      setSecondsRemaining(turnTimeLimit);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const updateTimer = () => {
      const elapsed = (Date.now() - turnStartTime) / 1000;
      const remaining = Math.max(0, turnTimeLimit - elapsed);
      setSecondsRemaining(Math.ceil(remaining));
    };

    // Update immediately
    updateTimer();

    // Then update every 100ms for smooth countdown
    intervalRef.current = setInterval(updateTimer, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [turnStartTime, turnTimeLimit, turnTimerActive]);

  if (!turnTimerActive) return null;

  const percentage = (secondsRemaining / turnTimeLimit) * 100;

  // Urgency levels
  const isWarning = secondsRemaining <= 15;
  const isCritical = secondsRemaining <= 5;

  let urgencyClass = "timer-normal";
  if (isCritical) {
    urgencyClass = "timer-critical";
  } else if (isWarning) {
    urgencyClass = "timer-warning";
  }

  return (
    <div className={`turn-timer ${urgencyClass}`}>
      <div className="turn-timer-bar-bg">
        <div
          className="turn-timer-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="turn-timer-info">
        <span className="turn-timer-seconds">{secondsRemaining}s</span>
        <span className="turn-timer-player">
          {isMyTurn ? "Your turn" : `${currentPlayerName}'s turn`}
        </span>
        {isMyTurn && !turnExtensionUsed && secondsRemaining <= 15 && (
          <button
            className="turn-timer-extend-btn"
            onClick={onRequestExtension}
          >
            +30s
          </button>
        )}
      </div>
    </div>
  );
};
