/**
 * Goal Tracker — Dual-Character Objective System
 * ===============================================
 *
 * Tracks objectives for both Carl and Paul simultaneously.
 * Replaces the single-character goal filter with a system that:
 *
 * - Loads ALL goals from stage definition (both characters + shared)
 * - Manages goal visibility based on story beat completion
 * - Provides event-based completion instead of heuristic string matching
 * - Supports goal coupling for cross-character interference
 *
 * The AI reads `getCurrentObjective(character)` every planning cycle
 * to decide what to do next.
 */

import type { StageGoal } from './StageDefinition';

// ============================================
// Types
// ============================================

export type GoalStatus = 'hidden' | 'active' | 'completed' | 'failed';

export interface GoalState {
  /** Original goal definition */
  def: StageGoal;
  /** Current status */
  status: GoalStatus;
  /** Effective priority (lower = higher priority) */
  priority: number;
}

/**
 * Events that can complete goals. Explicit and typed — no heuristic matching.
 */
export interface GoalEvent {
  type: 'scene_enter' | 'item_pickup' | 'interact' | 'reach_exit' | 'npc_interact' | 'visit_scenes_progress';
  character: 'carl' | 'paul';
  params: Record<string, unknown>;
}

export interface GoalTrackerCallbacks {
  onGoalCompleted?: (goalId: string, character: 'carl' | 'paul' | null) => void;
  onGoalFailed?: (goalId: string, character: 'carl' | 'paul' | null) => void;
  onGoalActivated?: (goalId: string) => void;
  onBlockGoals?: (goalIds: string[]) => void;
  onEnableGoals?: (goalIds: string[]) => void;
  onRelocateItem?: (itemId: string, toRoom: string) => void;
  onLockExit?: (exitId: string) => void;
  onFireBeat?: (beatId: string, character?: 'carl' | 'paul' | null) => void;
}

export interface GoalTracker {
  /** Load goals from stage definition. Call once at stage init. */
  loadGoals(goals: StageGoal[]): void;

  /** Set callbacks for goal events */
  setCallbacks(callbacks: GoalTrackerCallbacks): void;

  /** Get all active goals for a character (includes shared goals with no character) */
  getActiveGoals(character: 'carl' | 'paul'): GoalState[];

  /** Get the highest-priority active goal for a character */
  getCurrentObjective(character: 'carl' | 'paul'): GoalState | null;

  /** Process a goal event and return any newly completed goals */
  checkGoalCompletion(event: GoalEvent): GoalState[];

  /** Refresh goal visibility based on completed story beats */
  refreshVisibility(completedBeats: string[]): void;

  /** Check if a specific goal is complete */
  isComplete(goalId: string): boolean;

  /** Get goal state by ID */
  getGoal(goalId: string): GoalState | null;

  /** Get all goals (for debug overlay) */
  getAllGoals(): GoalState[];

  /** Get all goals for a specific character (all statuses) */
  getGoalsForCharacter(character: 'carl' | 'paul'): GoalState[];

  /** Track a scene visit for visit_scenes goals */
  trackSceneVisit(character: 'carl' | 'paul', sceneId: string): void;

  /** Get the set of visited scene IDs for a character */
  getVisitedScenes(character: 'carl' | 'paul'): ReadonlySet<string>;

  /** Reset all goals */
  reset(): void;
}

// ============================================
// Implementation
// ============================================

export function createGoalTracker(): GoalTracker {
  const goals = new Map<string, GoalState>();
  let callbacks: GoalTrackerCallbacks = {};

  // Track scene visits per character for visit_scenes goals
  const sceneVisits = new Map<string, Set<string>>(); // character -> set of scene IDs

  function getCharacterVisits(character: string): Set<string> {
    let visits = sceneVisits.get(character);
    if (!visits) {
      visits = new Set();
      sceneVisits.set(character, visits);
    }
    return visits;
  }

  /**
   * Check if a goal event satisfies a goal's completion condition.
   */
  function matchesGoal(goal: GoalState, event: GoalEvent): boolean {
    const def = goal.def;
    const params = def.params;

    // Character check: goal must be for this character or shared (null)
    if (def.character && def.character !== event.character) return false;

    switch (def.type) {
      case 'reach_scene': {
        if (event.type !== 'scene_enter') return false;
        return event.params.sceneId === params.sceneId;
      }
      case 'collect_items': {
        if (event.type !== 'item_pickup') return false;
        const items = params.items as string[] | undefined;
        if (!items) return false;
        return items.includes(event.params.itemId as string);
      }
      case 'interact': {
        if (event.type !== 'interact') return false;
        return event.params.targetId === params.targetId;
      }
      case 'interact_npc': {
        if (event.type !== 'npc_interact') return false;
        return event.params.npcId === params.npcId;
      }
      case 'reach_exit': {
        return event.type === 'reach_exit';
      }
      case 'visit_scenes': {
        if (event.type !== 'scene_enter') return false;
        const scenes = params.scenes as string[] | undefined;
        if (!scenes) return false;
        // Check if all required scenes have been visited
        const visits = getCharacterVisits(event.character);
        return scenes.every(s => visits.has(s));
      }
      default:
        return false;
    }
  }

  /**
   * Process onComplete consequences for a completed goal.
   */
  function processConsequences(goal: GoalState): void {
    const onComplete = goal.def.onComplete;
    if (!onComplete) return;

    const triggerChar = goal.def.character ?? null;

    if (onComplete.blockGoals) {
      for (const goalId of onComplete.blockGoals) {
        const blocked = goals.get(goalId);
        if (blocked && blocked.status !== 'completed') {
          blocked.status = 'failed';
          callbacks.onGoalFailed?.(goalId, blocked.def.character ?? null);

          // Process onFailed for the blocked goal
          const onFailed = blocked.def.onFailed;
          if (onFailed?.fireBeat) {
            callbacks.onFireBeat?.(onFailed.fireBeat, blocked.def.character ?? null);
          }
        }
      }
      callbacks.onBlockGoals?.(onComplete.blockGoals);
    }

    if (onComplete.enableGoals) {
      for (const goalId of onComplete.enableGoals) {
        const enabled = goals.get(goalId);
        if (enabled && enabled.status === 'hidden') {
          enabled.status = 'active';
          callbacks.onGoalActivated?.(goalId);
        }
      }
      callbacks.onEnableGoals?.(onComplete.enableGoals);
    }

    if (onComplete.relocateItem) {
      callbacks.onRelocateItem?.(
        onComplete.relocateItem.itemId,
        onComplete.relocateItem.toRoom
      );
    }

    if (onComplete.lockExit) {
      callbacks.onLockExit?.(onComplete.lockExit);
    }

    if (onComplete.fireBeat) {
      callbacks.onFireBeat?.(onComplete.fireBeat, triggerChar);
    }
  }

  /**
   * Handle racing interference: when a goal completes, check if its
   * coupled goal should fail.
   */
  function processInterference(completedGoal: GoalState): void {
    if (!completedGoal.def.coupledGoalId) return;

    const coupled = goals.get(completedGoal.def.coupledGoalId);
    if (!coupled || coupled.status === 'completed' || coupled.status === 'failed') return;

    switch (completedGoal.def.interferenceType) {
      case 'racing': {
        // First to complete wins — other fails
        coupled.status = 'failed';
        callbacks.onGoalFailed?.(coupled.def.id, coupled.def.character ?? null);
        const onFailed = coupled.def.onFailed;
        if (onFailed?.substituteGoal) {
          const sub = goals.get(onFailed.substituteGoal);
          if (sub && sub.status === 'hidden') {
            sub.status = 'active';
            callbacks.onGoalActivated?.(onFailed.substituteGoal);
          }
        }
        if (onFailed?.fireBeat) {
          callbacks.onFireBeat?.(onFailed.fireBeat, coupled.def.character ?? null);
        }
        break;
      }
      case 'blocking': {
        // Completing this blocks the coupled goal
        coupled.status = 'failed';
        callbacks.onGoalFailed?.(coupled.def.id, coupled.def.character ?? null);
        break;
      }
      case 'enabling': {
        // Completing this activates the coupled goal
        if (coupled.status === 'hidden') {
          coupled.status = 'active';
          callbacks.onGoalActivated?.(coupled.def.id);
        }
        break;
      }
      case 'sabotaging': {
        // Consequences handled via onComplete (lockExit, relocateItem, etc.)
        break;
      }
    }
  }

  return {
    loadGoals(stageGoals: StageGoal[]) {
      goals.clear();
      sceneVisits.clear();

      for (let i = 0; i < stageGoals.length; i++) {
        const def = stageGoals[i];
        const status: GoalStatus = def.hiddenUntil ? 'hidden' : 'active';
        goals.set(def.id, {
          def,
          status,
          priority: def.priority ?? i,
        });
      }
    },

    setCallbacks(cb: GoalTrackerCallbacks) {
      callbacks = cb;
    },

    getActiveGoals(character: 'carl' | 'paul'): GoalState[] {
      const result: GoalState[] = [];
      for (const goal of goals.values()) {
        if (goal.status !== 'active') continue;
        if (goal.def.character && goal.def.character !== character) continue;
        result.push(goal);
      }
      return result.sort((a, b) => a.priority - b.priority);
    },

    getCurrentObjective(character: 'carl' | 'paul'): GoalState | null {
      const active = this.getActiveGoals(character);
      return active.length > 0 ? active[0] : null;
    },

    checkGoalCompletion(event: GoalEvent): GoalState[] {
      const completed: GoalState[] = [];

      for (const goal of goals.values()) {
        if (goal.status !== 'active') continue;
        if (!matchesGoal(goal, event)) continue;

        goal.status = 'completed';
        completed.push(goal);
        callbacks.onGoalCompleted?.(goal.def.id, goal.def.character ?? null);
        processConsequences(goal);
        processInterference(goal);
      }

      return completed;
    },

    refreshVisibility(completedBeats: string[]) {
      for (const goal of goals.values()) {
        if (goal.status !== 'hidden') continue;
        if (!goal.def.hiddenUntil) continue;
        if (completedBeats.includes(goal.def.hiddenUntil)) {
          goal.status = 'active';
          callbacks.onGoalActivated?.(goal.def.id);
        }
      }
    },

    isComplete(goalId: string): boolean {
      return goals.get(goalId)?.status === 'completed';
    },

    getGoal(goalId: string): GoalState | null {
      return goals.get(goalId) ?? null;
    },

    getAllGoals(): GoalState[] {
      return Array.from(goals.values());
    },

    getGoalsForCharacter(character: 'carl' | 'paul'): GoalState[] {
      const result: GoalState[] = [];
      for (const goal of goals.values()) {
        if (!goal.def.character || goal.def.character === character) {
          result.push(goal);
        }
      }
      return result.sort((a, b) => a.priority - b.priority);
    },

    trackSceneVisit(character: 'carl' | 'paul', sceneId: string) {
      getCharacterVisits(character).add(sceneId);
    },

    getVisitedScenes(character: 'carl' | 'paul'): ReadonlySet<string> {
      return getCharacterVisits(character);
    },

    reset() {
      goals.clear();
      sceneVisits.clear();
    },
  };
}

// ============================================
// Singleton
// ============================================

let goalTrackerInstance: GoalTracker | null = null;

export function getGoalTracker(): GoalTracker {
  if (!goalTrackerInstance) {
    goalTrackerInstance = createGoalTracker();
  }
  return goalTrackerInstance;
}

export function resetGoalTracker(): void {
  if (goalTrackerInstance) {
    goalTrackerInstance.reset();
    goalTrackerInstance = null;
  }
}
