import React, { useRef, useEffect, useState } from 'react';
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

// ---------------------------------------------------------------------------
// GoalRow — individual goal with animated entrance, completion glow, and
// strikethrough effect.
// ---------------------------------------------------------------------------

const GoalRow: React.FC<{
  goal: StageGoal;
  index: number;
  isComplete: boolean;
}> = ({ goal, index, isComplete }) => {
  const [wasComplete, setWasComplete] = useState(isComplete);
  const [showGlow, setShowGlow] = useState(false);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect transition from incomplete → complete
  useEffect(() => {
    if (isComplete && !wasComplete) {
      setShowGlow(true);
      glowTimerRef.current = setTimeout(() => setShowGlow(false), 800);
      setWasComplete(true);
    }
    return () => {
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    };
  }, [isComplete, wasComplete]);

  return (
    <div
      className="flex items-start gap-1.5 rounded px-1 py-0.5 relative"
      style={{
        animation: `quest-goal-in 0.35s ease-out ${0.08 * index}s both`,
        opacity: isComplete ? 0.5 : 1,
        transition: 'opacity 0.4s ease',
        ...(showGlow ? { animation: `quest-goal-in 0.35s ease-out both, quest-complete-glow 0.8s ease-out both` } : {}),
      }}
    >
      {/* Status icon */}
      <span
        className="flex-shrink-0 mt-0.5"
        style={{
          fontSize: 10,
          color: isComplete ? 'var(--color-teal)' : 'var(--color-hud-muted)',
          transition: 'color 0.3s ease, transform 0.3s ease',
          transform: isComplete ? 'scale(1.2)' : 'scale(1)',
        }}
      >
        {isComplete ? '\u2713' : '\u25CB'}
      </span>

      {/* Goal text with animated strikethrough */}
      <span
        className="relative"
        style={{
          fontSize: 10,
          lineHeight: 1.3,
          color: isComplete ? 'var(--color-hud-muted)' : 'var(--color-hud-text)',
          transition: 'color 0.4s ease',
        }}
      >
        {goal.description}
        {/* Animated strikethrough line */}
        {isComplete && (
          <span
            className="absolute left-0 top-1/2 h-[1px]"
            style={{
              background: 'var(--color-teal)',
              opacity: 0.5,
              animation: 'quest-strikethrough 0.4s ease-out both',
            }}
          />
        )}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// QuestTracker
// ---------------------------------------------------------------------------

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
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={clsx('max-w-[160px]', isCompact && 'max-w-[130px]')} role="region" aria-label="Quest objectives">
      <p className="hud-label mb-1">Objectives</p>

      <div
        className="rounded-lg border p-2 space-y-1"
        style={{
          background: 'var(--color-hud-bg)',
          borderColor: 'var(--color-hud-border)',
        }}
      >
        {/* Summary progress bar */}
        <div className="mb-1">
          <div
            className="h-1 rounded-full overflow-hidden"
            role="progressbar"
            aria-label={`${completed} of ${total} objectives complete`}
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: pct === 100
                  ? 'linear-gradient(90deg, var(--color-teal), var(--color-gold))'
                  : 'var(--color-teal)',
                transition: 'width 0.5s ease-out, background 0.5s ease',
                boxShadow: pct > 0 ? '0 0 4px rgba(0,188,212,0.4)' : 'none',
              }}
            />
          </div>
          <p
            className="text-right mt-0.5"
            style={{
              fontSize: 8,
              color: pct === 100 ? 'var(--color-teal)' : 'var(--color-hud-muted)',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.3s ease',
            }}
          >
            {completed}/{total}
          </p>
        </div>

        {visibleGoals.map((goal, i) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            index={i}
            isComplete={checkGoalComplete(goal.id)}
          />
        ))}
      </div>
    </div>
  );
};
