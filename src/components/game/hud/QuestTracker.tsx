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
  // Both tracks exist in GoalTracker, but the HUD shows only the player's.
  const visibleGoals = goals.filter(g => {
    // Must be for this character or shared
    if (g.character && g.character !== playerCharacter) return false;
    // hiddenUntil beat must be completed
    return !g.hiddenUntil || completedBeats.includes(g.hiddenUntil);
  });

  if (visibleGoals.length === 0) return null;

  return (
    <div className={clsx('max-w-[140px]', isCompact && 'max-w-[120px]')}>
      <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Objectives</p>
      <div className="bg-shadow-light/80 rounded-lg border border-wood-dark/30 p-2 space-y-1">
        {visibleGoals.map(goal => {
          const isComplete = checkGoalComplete(goal.id);
          return (
            <div key={goal.id} className="flex items-start gap-1.5">
              <span className={clsx(
                'text-[10px] mt-0.5 flex-shrink-0',
                isComplete ? 'text-carl' : 'text-gray-600'
              )}>
                {isComplete ? '\u2713' : '\u25CB'}
              </span>
              <span className={clsx(
                'text-[10px] leading-tight',
                isComplete ? 'text-gray-500 line-through' : 'text-gray-300'
              )}>
                {goal.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
