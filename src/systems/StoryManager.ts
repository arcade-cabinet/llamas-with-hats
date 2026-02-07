/**
 * Story Manager
 * =============
 * 
 * Manages story progression, beat triggers, and narrative consequences.
 * 
 * ## Architecture
 * 
 * The story system uses a beat-based progression model:
 * 
 * 1. **Story Beats**: Discrete narrative moments (e.g., "discover_blood")
 * 2. **Triggers**: Events that activate beats (enter room, pickup item, etc.)
 * 3. **Consequences**: Results of beats (unlock doors, spawn items, horror changes)
 * 
 * ## Usage
 * 
 * ```ts
 * const story = createStoryManager();
 * 
 * // Set callbacks
 * story.setCallbacks({
 *   onDialogue: (lines, speaker) => showDialogue(lines, speaker),
 *   onHorrorChange: (level) => updateHorrorLevel(level),
 *   onUnlock: (lockId) => unlockDoor(lockId),
 *   onSpawn: (entityId) => spawnEntity(entityId),
 * });
 * 
 * // Load stage beats
 * await story.loadStage('stage_1_apartment');
 * 
 * // Check triggers each frame
 * story.checkTrigger('scene_enter', { sceneId: 'kitchen' });
 * story.checkTrigger('item_pickup', { itemId: 'basement_key' });
 * 
 * // Query state
 * const completed = story.getCompletedBeats();
 * const current = story.getCurrentBeat();
 * ```
 */

import { StoryBeat, CharacterPath } from './StageDefinition';

// Trigger types that can activate story beats
// Must match StoryBeat.trigger.type from StageDefinition.ts
export type TriggerType = 
  | 'scene_enter'
  | 'item_pickup'
  | 'npc_interact'
  | 'time_elapsed'
  | 'kills_reached';

export interface TriggerParams {
  sceneId?: string;
  itemId?: string;
  npcId?: string;
  timeSeconds?: number;
  killCount?: number;
}

export interface BeatConsequence {
  type: 'unlock' | 'lock' | 'spawn' | 'despawn' | 'horror_change' | 'dialogue' | 'sound' | 'effect';
  params: Record<string, unknown>;
}

export interface StoryBeatRuntime extends StoryBeat {
  completed: boolean;
  triggered: boolean;
}

export interface StoryCallbacks {
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
  onHorrorChange?: (newLevel: number, delta: number) => void;
  onUnlock?: (lockId: string) => void;
  onLock?: (lockId: string) => void;
  onSpawn?: (entityId: string, position?: { x: number; z: number }) => void;
  onDespawn?: (entityId: string) => void;
  onSound?: (soundId: string) => void;
  onEffect?: (effectType: string, params?: Record<string, unknown>) => void;
  onBeatComplete?: (beatId: string) => void;
}

export interface StoryManager {
  // Setup
  setCallbacks(callbacks: StoryCallbacks): void;
  setCharacterPath(path: CharacterPath): void;
  
  // Loading
  loadBeats(beats: StoryBeat[]): void;
  loadStage(stageId: string): Promise<void>;
  
  // Trigger checking
  checkTrigger(type: TriggerType, params: TriggerParams): void;
  
  // Manual beat activation (for testing/debugging)
  activateBeat(beatId: string): void;
  
  // State queries
  getCurrentBeat(): string | null;
  getCompletedBeats(): string[];
  isCompleted(beatId: string): boolean;
  getHorrorLevel(): number;
  
  // Save/Load
  getState(): StoryState;
  loadState(state: StoryState): void;
  
  // Reset
  reset(): void;
}

export interface StoryState {
  completedBeats: string[];
  currentBeat: string | null;
  horrorLevel: number;
  characterPath: CharacterPath;
}

/**
 * Create story manager instance
 */
export function createStoryManager(): StoryManager {
  let beats: Map<string, StoryBeatRuntime> = new Map();
  let callbacks: StoryCallbacks = {};
  let characterPath: CharacterPath = 'order'; // Default to Carl's path
  let currentBeat: string | null = null;
  let horrorLevel = 0;
  
  /**
   * Check if trigger matches a beat's trigger definition
   */
  function matchesTrigger(
    beat: StoryBeatRuntime,
    triggerType: TriggerType,
    params: TriggerParams
  ): boolean {
    const trigger = beat.trigger;
    
    // Type must match
    if (trigger.type !== triggerType) return false;
    
    // Check specific params based on trigger type
    const triggerParams = trigger.params as Record<string, unknown>;
    
    switch (triggerType) {
      case 'scene_enter':
        return triggerParams.sceneId === params.sceneId;
        
      case 'item_pickup':
        return triggerParams.itemId === params.itemId;
        
      case 'npc_interact':
        return triggerParams.npcId === params.npcId;
        
      case 'time_elapsed':
        return (params.timeSeconds ?? 0) >= (triggerParams.seconds as number ?? 0);
        
      case 'kills_reached':
        return (params.killCount ?? 0) >= (triggerParams.count as number ?? 0);
        
      default:
        return false;
    }
  }
  
  /**
   * Execute beat consequences
   */
  function executeConsequences(beat: StoryBeatRuntime) {
    const consequences = beat.consequences;
    if (!consequences) return;
    
    // Horror level change
    if (consequences.horrorLevelChange !== undefined) {
      const delta = consequences.horrorLevelChange;
      horrorLevel = Math.max(0, Math.min(10, horrorLevel + delta));
      callbacks.onHorrorChange?.(horrorLevel, delta);
    }
    
    // Unlock exits
    if (consequences.unlockExits) {
      for (const lockId of consequences.unlockExits) {
        callbacks.onUnlock?.(lockId);
      }
    }
    
    // Spawn items
    if (consequences.spawnItems) {
      for (const itemId of consequences.spawnItems) {
        callbacks.onSpawn?.(itemId);
      }
    }
    
    // Despawn items
    if (consequences.despawnItems) {
      for (const itemId of consequences.despawnItems) {
        callbacks.onDespawn?.(itemId);
      }
    }
    
    // Next beat
    if (consequences.nextBeat) {
      currentBeat = consequences.nextBeat;
    }
  }
  
  /**
   * Get dialogue for character path
   */
  function getDialogueForPath(beat: StoryBeatRuntime): string[] {
    // If beat has path-specific dialogue, use it
    // Otherwise fall back to generic dialogue
    // For now, we'll use the dialogueId to look up dialogue
    // This would integrate with the dialogue system
    
    // Placeholder: Return beat description as dialogue
    return [beat.description];
  }
  
  return {
    setCallbacks(cb: StoryCallbacks) {
      callbacks = cb;
    },
    
    setCharacterPath(path: CharacterPath) {
      characterPath = path;
    },
    
    loadBeats(storyBeats: StoryBeat[]) {
      beats.clear();
      for (const beat of storyBeats) {
        beats.set(beat.id, {
          ...beat,
          completed: false,
          triggered: false,
        });
      }
    },
    
    async loadStage(stageId: string) {
      try {
        // Load stage story data through the data module (resolves path via game.json)
        const { loadStageStoryDialogues } = await import('../data');
        const stageData = await loadStageStoryDialogues(stageId);

        if (stageData.beats && Array.isArray(stageData.beats)) {
          this.loadBeats(stageData.beats as any[]);
        }

        // Set starting beat if specified
        if (stageData.startingBeat && typeof stageData.startingBeat === 'string') {
          currentBeat = stageData.startingBeat;
        }
      } catch (error) {
        console.warn(`No story data found for stage: ${stageId}`, error);
      }
    },
    
    checkTrigger(type: TriggerType, params: TriggerParams) {
      for (const [beatId, beat] of beats) {
        // Skip already completed beats
        if (beat.completed) continue;
        
        // Check if trigger matches
        if (matchesTrigger(beat, type, params)) {
          this.activateBeat(beatId);
        }
      }
    },
    
    activateBeat(beatId: string) {
      const beat = beats.get(beatId);
      if (!beat || beat.completed) return;
      
      // Mark as triggered and completed
      beat.triggered = true;
      beat.completed = true;
      
      // Trigger dialogue
      const dialogueLines = getDialogueForPath(beat);
      const speaker = characterPath === 'order' ? 'carl' : 'paul';
      callbacks.onDialogue?.(dialogueLines, speaker);
      
      // Execute consequences
      executeConsequences(beat);
      
      // Notify completion
      callbacks.onBeatComplete?.(beatId);
      
      // Update current beat
      if (beat.consequences?.nextBeat) {
        currentBeat = beat.consequences.nextBeat;
      }
    },
    
    getCurrentBeat() {
      return currentBeat;
    },
    
    getCompletedBeats() {
      return Array.from(beats.entries())
        .filter(([, beat]) => beat.completed)
        .map(([id]) => id);
    },
    
    isCompleted(beatId: string) {
      return beats.get(beatId)?.completed ?? false;
    },
    
    getHorrorLevel() {
      return horrorLevel;
    },
    
    getState(): StoryState {
      return {
        completedBeats: this.getCompletedBeats(),
        currentBeat,
        horrorLevel,
        characterPath,
      };
    },
    
    loadState(state: StoryState) {
      // Mark beats as completed
      for (const beatId of state.completedBeats) {
        const beat = beats.get(beatId);
        if (beat) {
          beat.completed = true;
          beat.triggered = true;
        }
      }
      
      currentBeat = state.currentBeat;
      horrorLevel = state.horrorLevel;
      characterPath = state.characterPath;
    },
    
    reset() {
      for (const beat of beats.values()) {
        beat.completed = false;
        beat.triggered = false;
      }
      currentBeat = null;
      horrorLevel = 0;
    },
  };
}

// Singleton instance
let storyManagerInstance: StoryManager | null = null;

/**
 * Get the global story manager instance
 */
export function getStoryManager(): StoryManager {
  if (!storyManagerInstance) {
    storyManagerInstance = createStoryManager();
  }
  return storyManagerInstance;
}
