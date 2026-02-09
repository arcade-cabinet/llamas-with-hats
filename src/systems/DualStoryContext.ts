/**
 * DualStoryContext — Two-Character Story Progression
 * ===================================================
 *
 * Wraps StoryManager to support both Carl and Paul triggering beats
 * simultaneously, each getting their own dialogue variants.
 *
 * ## Why This Exists
 *
 * StoryManager is a singleton with one `characterPath`. When only the
 * player triggers beats this is fine — the path is set once at game start.
 * But with two AI characters independently reaching rooms and interacting,
 * we need to:
 *
 * 1. Track which character triggered each beat first
 * 2. Temporarily swap `characterPath` to get the correct dialogue variant
 * 3. Maintain per-character completed beat sets
 * 4. Sync beat completions with GoalTracker
 *
 * ## Integration
 *
 * DualStoryContext sits between the game loop and StoryManager:
 *
 * ```
 * ObjectiveAI → DualStoryContext.characterTrigger() → StoryManager.checkTrigger(triggeredBy)
 *                                                   → GoalTracker.refreshVisibility()
 * ```
 *
 * Existing code that calls StoryManager directly still works — the
 * `triggeredBy` parameter is optional and defaults to the global
 * `characterPath`.
 */

import type { StoryManager, TriggerType, TriggerParams } from './StoryManager';
import type { GoalTracker } from './GoalTracker';

export interface BeatTriggerRecord {
  beatId: string;
  triggeredBy: 'carl' | 'paul';
  timestamp: number;
}

export interface DualStoryContext {
  /** Trigger a story event on behalf of a specific character */
  characterTrigger(
    character: 'carl' | 'paul',
    type: TriggerType,
    params: TriggerParams
  ): void;

  /** Get which character triggered a specific beat first */
  getBeatTriggerer(beatId: string): 'carl' | 'paul' | null;

  /** Get all beats triggered by a specific character */
  getCharacterBeats(character: 'carl' | 'paul'): string[];

  /** Get the full trigger log for replay/debugging */
  getTriggerLog(): ReadonlyArray<BeatTriggerRecord>;

  /** Get completed beats for a specific character */
  getCompletedBeats(character: 'carl' | 'paul'): string[];

  /** Reset all tracking state */
  reset(): void;
}

export function createDualStoryContext(
  storyManager: StoryManager,
  goalTracker?: GoalTracker
): DualStoryContext {
  // Track which character triggered each beat
  const beatTriggerers = new Map<string, 'carl' | 'paul'>();

  // Per-character completed beat sets
  const carlBeats = new Set<string>();
  const paulBeats = new Set<string>();

  // Full trigger log for debugging/replay
  const triggerLog: BeatTriggerRecord[] = [];

  // Snapshot of completed beats for detecting new completions
  let lastCompletedBeats = new Set(storyManager.getCompletedBeats());

  /**
   * Detect newly completed beats by comparing before/after sets.
   */
  function detectNewBeats(): string[] {
    const nowCompleted = new Set(storyManager.getCompletedBeats());
    const newBeats: string[] = [];
    for (const beatId of nowCompleted) {
      if (!lastCompletedBeats.has(beatId)) {
        newBeats.push(beatId);
      }
    }
    lastCompletedBeats = nowCompleted;
    return newBeats;
  }

  return {
    characterTrigger(
      character: 'carl' | 'paul',
      type: TriggerType,
      params: TriggerParams
    ) {
      // Call StoryManager with the triggeredBy parameter
      storyManager.checkTrigger(type, params, character);

      // Detect which beats were newly completed
      const newBeats = detectNewBeats();
      for (const beatId of newBeats) {
        // Record the first triggerer
        if (!beatTriggerers.has(beatId)) {
          beatTriggerers.set(beatId, character);
        }

        // Add to character's beat set
        if (character === 'carl') {
          carlBeats.add(beatId);
        } else {
          paulBeats.add(beatId);
        }

        // Log for debugging
        triggerLog.push({
          beatId,
          triggeredBy: character,
          timestamp: Date.now(),
        });
      }

      // Sync beat completions with GoalTracker
      if (goalTracker && newBeats.length > 0) {
        const allCompleted = storyManager.getCompletedBeats();
        goalTracker.refreshVisibility(allCompleted);
      }
    },

    getBeatTriggerer(beatId: string): 'carl' | 'paul' | null {
      return beatTriggerers.get(beatId) ?? null;
    },

    getCharacterBeats(character: 'carl' | 'paul'): string[] {
      const set = character === 'carl' ? carlBeats : paulBeats;
      return Array.from(set);
    },

    getTriggerLog(): ReadonlyArray<BeatTriggerRecord> {
      return triggerLog;
    },

    getCompletedBeats(character: 'carl' | 'paul'): string[] {
      const set = character === 'carl' ? carlBeats : paulBeats;
      return Array.from(set);
    },

    reset() {
      beatTriggerers.clear();
      carlBeats.clear();
      paulBeats.clear();
      triggerLog.length = 0;
      lastCompletedBeats.clear();
    },
  };
}

// Singleton
let dualStoryContextInstance: DualStoryContext | null = null;

export function getDualStoryContext(): DualStoryContext | null {
  return dualStoryContextInstance;
}

export function setDualStoryContext(ctx: DualStoryContext | null): void {
  dualStoryContextInstance = ctx;
}

export function resetDualStoryContext(): void {
  if (dualStoryContextInstance) {
    dualStoryContextInstance.reset();
    dualStoryContextInstance = null;
  }
}
