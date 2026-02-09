import React from 'react';
import { clsx } from 'clsx';
import type { CharacterType } from '../../../types/game';
import type { StageGoal } from '../../../systems/GameInitializer';
import { getStoryManager } from '../../../systems/StoryManager';
import { getGoalTracker } from '../../../systems/GoalTracker';

interface QuestTrackerProps {
  goals: StageGoal[];
  isCompact: boolean;
  playerCharacter: CharacterType;
}

/** Check if a goal is complete — delegates to GoalTracker for consistent tracking */
function checkGoalComplete(goalId: string): boolean {
  return getGoalTracker().isComplete(goalId);
}

export const QuestTracker: React.FC<QuestTrackerProps> = ({ goals, isCompact, playerCharacter }) => {
  const storyManager = getStoryManager();
  const completedBeats = storyManager.getCompletedBeats();

  // Filter to visible goals for the PLAYER character only (display).
  const visibleGoals = goals.filter(g => {
    if (g.character && g.character !== playerCharacter) return false;
    return !g.hiddenUntil || completedBeats.includes(g.hiddenUntil);
  });

  if (visibleGoals.length === 0) return null;

  const completed = visibleGoals.filter(g => checkGoalComplete(g.id)).length;
  const total = visibleGoals.length;

  return (
    <div className={clsx('max-w-[160px]', isCompact && 'max-w-[130px]')}>
      <p className="hud-label mb-1">Objectives</p>

      <div
        className="rounded-lg border p-2 space-y-1.5"
        style={{
          background: 'var(--color-hud-bg)',
          borderColor: 'var(--color-hud-border)',
        }}
      >
        {/* Summary progress bar */}
        <div className="mb-1">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                background: '#00bcd4',
                transition: 'width 0.5s ease-out',
                animation: completed > 0 ? 'progress-fill 0.6s ease-out' : undefined,
              }}
            />
          </div>
          <p
            className="text-right mt-0.5"
            style={{
              fontSize: 8,
              color: 'var(--color-hud-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {completed}/{total}
          </p>
        </div>

        {visibleGoals.map(goal => {
          const isComplete = checkGoalComplete(goal.id);
          return (
            <div
              key={goal.id}
              className="flex items-start gap-1.5"
              style={{
                opacity: isComplete ? 0.5 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {/* Status icon */}
              <span
                className="flex-shrink-0 mt-0.5"
                style={{
                  fontSize: 10,
                  color: isComplete ? '#00bcd4' : 'var(--color-hud-muted)',
                  transition: 'color 0.3s ease',
                }}
              >
                {isComplete ? '\u2713' : '\u25CB'}
              </span>

              {/* Goal text */}
              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1.3,
                  color: isComplete ? 'var(--color-hud-muted)' : 'var(--color-hud-text)',
                  textDecoration: isComplete ? 'line-through' : 'none',
                  transition: 'color 0.3s ease',
                }}
              >
                {goal.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
