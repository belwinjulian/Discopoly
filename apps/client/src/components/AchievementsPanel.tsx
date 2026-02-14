import React, { useState, useEffect } from "react";
import { ACHIEVEMENTS } from "../data/achievements";
import "../styles/achievements.css";

interface UnlockedAchievement {
  discord_user_id: string;
  achievement_id: string;
  tier: number;
  unlocked_at: string;
}

interface AchievementsPanelProps {
  discordUserId: string;
  onClose: () => void;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({ discordUserId, onClose }) => {
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/colyseus/player/${discordUserId}/achievements`);
        if (res.ok) {
          const data = await res.json();
          setUnlocked(data.unlocked || []);
          setStats(data.stats || {});
        }
      } catch (err) {
        console.error("Failed to fetch achievements:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [discordUserId]);

  const unlockedMap = new Map(unlocked.map((u) => [u.achievement_id, u]));

  // Calculate total gems earned from achievements
  let totalGems = 0;
  for (const ach of ACHIEVEMENTS) {
    const u = unlockedMap.get(ach.id);
    if (!u) continue;
    if (ach.type === "one_time") {
      totalGems += ach.gems || 0;
    } else if (ach.tiers) {
      for (let t = 0; t < u.tier; t++) {
        totalGems += ach.tiers[t].gems;
      }
    }
  }

  return (
    <div className="ach-overlay" onClick={onClose}>
      <div className="ach-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ach-header">
          <h2 className="ach-title">Achievements</h2>
          <div className="ach-total">{"\u{1F48E}"} {totalGems} earned</div>
          <button className="ach-close" onClick={onClose}>{"\u2715"}</button>
        </div>

        {loading ? (
          <div className="ach-loading">Loading achievements...</div>
        ) : (
          <div className="ach-grid">
            {ACHIEVEMENTS.map((ach) => {
              const u = unlockedMap.get(ach.id);
              const isUnlocked = !!u;

              if (ach.type === "one_time") {
                return (
                  <div
                    key={ach.id}
                    className={`ach-card ${isUnlocked ? "ach-card-unlocked" : "ach-card-locked"}`}
                  >
                    <span className="ach-icon">{isUnlocked ? ach.icon : "?"}</span>
                    <div className="ach-card-info">
                      <span className="ach-card-name">{ach.name}</span>
                      <span className="ach-card-desc">{ach.description}</span>
                    </div>
                    <span className="ach-card-gems">{"\u{1F48E}"} {ach.gems}</span>
                  </div>
                );
              }

              // Tiered achievement
              const currentTier = u?.tier || 0;
              const nextTier = ach.tiers && currentTier < ach.tiers.length
                ? ach.tiers[currentTier]
                : null;
              const statField = ach.id === "trades_done" ? "trades_completed"
                : ach.id === "rent_earned" ? "rent_collected_total"
                : ach.id === "bankrupted" ? "bankrupted_opponents"
                : ach.id;
              const statValue = stats[statField] || 0;
              const progressPct = nextTier
                ? Math.min(100, Math.round((statValue / nextTier.threshold) * 100))
                : 100;

              return (
                <div
                  key={ach.id}
                  className={`ach-card ${currentTier > 0 ? "ach-card-unlocked" : "ach-card-locked"}`}
                >
                  <span className="ach-icon">{currentTier > 0 ? ach.icon : "?"}</span>
                  <div className="ach-card-info">
                    <span className="ach-card-name">
                      {ach.name}
                      {currentTier > 0 && (
                        <span className="ach-tier-badge">Tier {currentTier}</span>
                      )}
                    </span>
                    <span className="ach-card-desc">{ach.description}</span>
                    {nextTier && (
                      <div className="ach-tier-progress">
                        <div className="ach-tier-bar">
                          <div className="ach-tier-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="ach-tier-text">
                          {statValue} / {nextTier.threshold} ({"\u{1F48E}"} {nextTier.gems})
                        </span>
                      </div>
                    )}
                    {!nextTier && currentTier > 0 && (
                      <span className="ach-max-tier">MAX TIER</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
