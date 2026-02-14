import React, { useState, useEffect } from "react";
import "../styles/goals.css";

interface GoalProgress {
  goal: {
    id: string;
    description: string;
    target: number;
    gems: number;
    type: "daily" | "weekly";
  };
  progress: number;
  completed: boolean;
  resetDate: string;
}

interface GoalsPanelProps {
  discordUserId: string;
  onClose: () => void;
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ discordUserId, onClose }) => {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyCountdown, setDailyCountdown] = useState("");
  const [weeklyCountdown, setWeeklyCountdown] = useState("");

  useEffect(() => {
    async function fetchGoals() {
      try {
        const res = await fetch(`/colyseus/player/${discordUserId}/goals`);
        if (res.ok) {
          const data = await res.json();
          setGoals(data);
        }
      } catch (err) {
        console.error("Failed to fetch goals:", err);
      }
      setLoading(false);
    }
    fetchGoals();
  }, [discordUserId]);

  // Countdown timers
  useEffect(() => {
    const update = () => {
      const now = new Date();

      // Daily reset: midnight UTC
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const dailyDiff = tomorrow.getTime() - now.getTime();
      const dH = Math.floor(dailyDiff / 3600000);
      const dM = Math.floor((dailyDiff % 3600000) / 60000);
      setDailyCountdown(`${dH}h ${dM}m`);

      // Weekly reset: next Monday UTC
      const day = now.getUTCDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      const nextMonday = new Date(now);
      nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
      nextMonday.setUTCHours(0, 0, 0, 0);
      const weeklyDiff = nextMonday.getTime() - now.getTime();
      const wD = Math.floor(weeklyDiff / 86400000);
      const wH = Math.floor((weeklyDiff % 86400000) / 3600000);
      setWeeklyCountdown(`${wD}d ${wH}h`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  const dailyGoals = goals.filter((g) => g.goal.type === "daily");
  const weeklyGoals = goals.filter((g) => g.goal.type === "weekly");

  return (
    <div className="goals-overlay" onClick={onClose}>
      <div className="goals-modal" onClick={(e) => e.stopPropagation()}>
        <div className="goals-header">
          <h2 className="goals-title">Goals</h2>
          <button className="goals-close" onClick={onClose}>{"\u2715"}</button>
        </div>

        {loading ? (
          <div className="goals-loading">Loading goals...</div>
        ) : (
          <>
            {/* Daily Goals */}
            <div className="goals-section">
              <div className="goals-section-header">
                <h3 className="goals-section-title">Daily Goals</h3>
                <span className="goals-timer">Resets in {dailyCountdown}</span>
              </div>
              {dailyGoals.length === 0 ? (
                <p className="goals-empty">No daily goals available</p>
              ) : (
                dailyGoals.map((g) => (
                  <GoalRow key={g.goal.id} goal={g} />
                ))
              )}
            </div>

            {/* Weekly Goals */}
            <div className="goals-section">
              <div className="goals-section-header">
                <h3 className="goals-section-title">Weekly Goals</h3>
                <span className="goals-timer">Resets in {weeklyCountdown}</span>
              </div>
              {weeklyGoals.length === 0 ? (
                <p className="goals-empty">No weekly goals available</p>
              ) : (
                weeklyGoals.map((g) => (
                  <GoalRow key={g.goal.id} goal={g} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const GoalRow: React.FC<{ goal: GoalProgress }> = ({ goal: g }) => {
  const progress = Math.min(g.progress, g.goal.target);
  const pct = Math.round((progress / g.goal.target) * 100);

  return (
    <div className={`goal-row ${g.completed ? "goal-completed" : ""}`}>
      <div className="goal-info">
        <span className="goal-desc">{g.goal.description}</span>
        <span className="goal-reward">{"\u{1F48E}"} {g.goal.gems}</span>
      </div>
      <div className="goal-progress-bar">
        <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-progress-text">
        {g.completed ? (
          <span className="goal-claimed">{"\u2705"} Claimed</span>
        ) : (
          <span>{progress} / {g.goal.target}</span>
        )}
      </div>
    </div>
  );
};
