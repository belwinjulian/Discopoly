import React, { useState, useEffect, useRef } from "react";
import { LogEntryState } from "../hooks/useGameState";
import "../styles/gamelog.css";

const LOG_ICONS: Record<string, string> = {
  roll: "\u{1F3B2}",      // dice
  buy: "\u{1F6CD}",       // shopping bag
  rent: "\u{1FA99}",      // coin
  tax: "\u26A0\uFE0F",    // warning
  payday: "\u2B50",       // star
  bankrupt: "\u{1F480}",  // skull
  build: "\u{1F528}",     // hammer
  trade: "\u{1F501}",     // arrows
  card: "\u{1F0CF}",      // playing card
  jail: "\u{1F512}",      // lock
  auction: "\u{1F4E3}",   // megaphone
  turn: "\u27A1\uFE0F",   // arrow
  info: "\u{2139}\uFE0F", // info
};

interface GameLogProps {
  gameLog: LogEntryState[];
}

export const GameLog: React.FC<GameLogProps> = ({ gameLog }) => {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll when new entries arrive and panel is open
  useEffect(() => {
    if (open && gameLog.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLengthRef.current = gameLog.length;
  }, [gameLog.length, open]);

  return (
    <>
      <button
        className="gamelog-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Game Log"
      >
        {"\u{1F4DC}"} {/* scroll emoji */}
      </button>

      {open && (
        <div className="gamelog-overlay" onClick={() => setOpen(false)}>
          <div className="gamelog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="gamelog-header">
              <span className="gamelog-title">Game Log</span>
              <button className="gamelog-close" onClick={() => setOpen(false)}>
                &times;
              </button>
            </div>
            <div className="gamelog-list" ref={listRef}>
              {gameLog.length === 0 ? (
                <div className="gamelog-empty">No events yet.</div>
              ) : (
                gameLog.map((entry, i) => (
                  <div key={i} className={`gamelog-entry gamelog-type-${entry.type}`}>
                    <span className="gamelog-icon">
                      {LOG_ICONS[entry.type] || LOG_ICONS.info}
                    </span>
                    <span className="gamelog-message">{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
