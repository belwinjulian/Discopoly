import React, { useEffect, useState } from "react";
import { AchievementNotification, GoalNotification } from "../hooks/useGameState";
import { ACHIEVEMENTS_MAP } from "../data/achievements";
import "../styles/achievements.css";

interface AchievementToastProps {
  achievementNotifications: AchievementNotification[];
  goalNotifications: GoalNotification[];
  onDismissAchievement: (index: number) => void;
  onDismissGoal: (index: number) => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievementNotifications,
  goalNotifications,
  onDismissAchievement,
  onDismissGoal,
}) => {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (achievementNotifications.length > 0) {
      const timer = setTimeout(() => onDismissAchievement(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [achievementNotifications.length, onDismissAchievement]);

  useEffect(() => {
    if (goalNotifications.length > 0) {
      const timer = setTimeout(() => onDismissGoal(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [goalNotifications.length, onDismissGoal]);

  const currentAch = achievementNotifications[0];
  const currentGoal = goalNotifications[0];

  if (!currentAch && !currentGoal) return null;

  return (
    <div className="toast-container">
      {currentAch && (
        <div className="toast toast-achievement" onClick={() => onDismissAchievement(0)}>
          <span className="toast-icon">
            {ACHIEVEMENTS_MAP.get(currentAch.achievementId)?.icon || "\u{1F3C6}"}
          </span>
          <div className="toast-content">
            <span className="toast-label">Achievement Unlocked!</span>
            <span className="toast-name">{currentAch.name}</span>
            <span className="toast-reward">{"\u{1F48E}"} +{currentAch.gems}</span>
          </div>
        </div>
      )}
      {currentGoal && (
        <div className="toast toast-goal" onClick={() => onDismissGoal(0)}>
          <span className="toast-icon">{"\u{2705}"}</span>
          <div className="toast-content">
            <span className="toast-label">Goal Complete!</span>
            <span className="toast-name">{currentGoal.description}</span>
            <span className="toast-reward">{"\u{1F48E}"} +{currentGoal.gems}</span>
          </div>
        </div>
      )}
    </div>
  );
};
