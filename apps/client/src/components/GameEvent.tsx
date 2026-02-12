import React, { useEffect, useState } from "react";
import "../styles/animations.css";

interface GameEventProps {
  message: string;
  type: "info" | "buy" | "rent" | "tax" | "payday" | "bankrupt" | "build" | "trade" | "card";
}

const EVENT_ICONS: Record<string, string> = {
  info: "📋",
  buy: "🏠",
  rent: "💸",
  tax: "🏛️",
  payday: "💰",
  bankrupt: "💀",
  build: "🏗️",
  trade: "🤝",
  card: "🃏",
};

export const GameEvent: React.FC<GameEventProps> = ({ message, type }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!show || !message) return null;

  return (
    <div className={`game-event game-event-${type}`}>
      <span className="game-event-icon">{EVENT_ICONS[type] || "📋"}</span>
      <span className="game-event-text">{message}</span>
    </div>
  );
};
