/**
 * Story Manager
 * =============
 *
 * Manages story progression, beat triggers, and narrative consequences.
 *
 * ## Horror Model (Scene-Based)
 *
 * Horror level = sceneBaseHorror + storyModifier
 *
 * - **sceneBaseHorror**: Set from the stage definition's `atmosphere.perRoomOverrides`
 *   when the player enters a room. Falls back to `atmosphere.baseHorrorLevel`.
 * - **storyModifier**: Temporary boost from story beat consequences. Resets to 0
 *   whenever the player enters a new room (via `setSceneHorrorLevel`).
 *
 * This means the basement (horror 7) FEELS scary the moment you enter,
 * and walking back to the bedroom (horror 1) provides immediate relief.
 * Story beats can still spike horror above the room's base.
 *
 * ## Usage
 *
 * ```ts
 * const story = createStoryManager();
 *
 * // On room change — sets base horror from atmosphere data
 * story.setSceneHorrorLevel(7); // basement atmosphere
 *
 * // Story beat fires — temporary boost on top of scene base
 * // discover_horror consequence: horrorLevelChange: +2 → effective horror = 9
 *
 * // Player walks to bedroom
 * story.setSceneHorrorLevel(1); // modifier resets, horror drops to 1
 * ```
 */

import { StoryBeat, CharacterPath } from './StageDefinition';

// Trigger types that can activate story beats
// Must match StoryBeat.trigger.type from StageDefinition.ts
export type TriggerType =
  | 'scene_enter'
  | 'scene_exit'
  | 'item_pickup'
  | 'npc_interact'
  | 'interact'
  | 'time_elapsed'
  | 'kills_reached'
  | 'reach_exit';

export interface TriggerParams {
  sceneId?: string;
  itemId?: string;
  npcId?: string;
  targetId?: string;
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

export interface EffectsCallbacks {
  onScreenShake?: (intensity: number, duration: number) => void;
  onHorrorPulse?: (intensity: number) => void;
  onMusicChange?: (trackId: string) => void;
  onDramaticZoom?: (fov: number, duration: number) => void;
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
  onStageComplete?: () => void;
}

export interface StoryManager {
  // Setup
  setCallbacks(callbacks: StoryCallbacks): void;
  setEffectsCallbacks(callbacks: EffectsCallbacks): void;
  setCharacterPath(path: CharacterPath): void;

  // Loading
  loadBeats(beats: StoryBeat[]): void;
  loadStage(stageId: string): Promise<void>;

  // Trigger checking
  /** Check triggers. Optional triggeredBy selects the character path variant. */
  checkTrigger(type: TriggerType, params: TriggerParams, triggeredBy?: 'carl' | 'paul'): void;

  // Manual beat activation (for testing/debugging)
  activateBeat(beatId: string, triggeredBy?: 'carl' | 'paul'): void;

  // Scene-based horror
  /** Set the base horror level for the current scene (from atmosphere data).
   *  Resets the story modifier to 0. Fires onHorrorChange. */
  setSceneHorrorLevel(level: number): void;

  // NPC dialogue trees
  /** Get a branching dialogue tree for an NPC by character ID (e.g. 'paul') */
  getNpcDialogueTree(characterId: string): NpcDialogueTree | null;

  // Room-based narrative content
  /** Get a random ambient dialogue line for a room (from story.json ambientDialogues) */
  getAmbientDialogue(roomPurpose: string, character: 'carl' | 'paul'): string | null;
  /** Get a random re-entry dialogue line for a room (from story.json reEntryDialogues) */
  getReEntryDialogue(roomPurpose: string, character: 'carl' | 'paul'): string | null;
  /** Get cross-stage reference lines (e.g. Stage 2 referencing Stage 1 events) */
  getCrossStageReferences(fromStageKey: string, character: 'carl' | 'paul'): string[];
  /** Get all cross-stage reference lines for the current stage (collects from all from_stageN keys) */
  getAllCrossStageReferences(character: 'carl' | 'paul'): string[];
  /** Get prop override data for examining a prop */
  getPropOverride(propName: string): PropOverrideData | null;

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

/** Dialogue entry from story.json's storyDialogues */
interface DialogueEntry {
  id: string;
  type?: string;
  lines: Array<{ speaker: string; text: string; delay?: number }>;
  nextBeat?: string;
  effects?: Array<{ type: string; intensity?: number; duration?: number }>;
}

/** Node within an NPC dialogue tree */
export interface DialogueTreeNode {
  lines: Array<{ speaker: string; text: string; delay?: number }>;
  options: Array<{ text: string; next: string }>;
}

/** Full NPC dialogue tree loaded from story.json's npcDialogues */
export interface NpcDialogueTree {
  id: string;
  character: string;
  tree: Record<string, DialogueTreeNode>;
}

/** Character-keyed ambient/re-entry dialogue data */
interface CharacterDialogueMap {
  carl?: string[];
  paul?: string[];
}

/** Prop override data from story.json */
export interface PropOverrideData {
  prompt?: string;
  carl?: string[];
  paul?: string[];
  horror?: string[];
  examine?: Array<{ speaker: string; text: string }>;
}

export function createStoryManager(): StoryManager {
  let beats: Map<string, StoryBeatRuntime> = new Map();
  let callbacks: StoryCallbacks = {};
  let effectsCallbacks: EffectsCallbacks = {};
  let characterPath: CharacterPath = 'chaos'; // Default to Carl's path
  let currentBeat: string | null = null;

  // Scene-based horror: base comes from atmosphere data, modifier from story beats
  let sceneBaseHorror = 0;
  let storyHorrorModifier = 0;

  // Cached dialogue data loaded from stage story.json
  const dialogueCache = new Map<string, DialogueEntry>();

  // Cached NPC dialogue trees, keyed by character ID (e.g. 'paul')
  const npcDialogueCache = new Map<string, NpcDialogueTree>();

  // Cached room-based narrative content from story.json
  const ambientDialogueCache = new Map<string, CharacterDialogueMap>();
  const reEntryDialogueCache = new Map<string, CharacterDialogueMap>();
  const crossStageRefCache = new Map<string, CharacterDialogueMap>();
  const propOverrideCache = new Map<string, PropOverrideData>();

  // Track which ambient/re-entry lines have been used to avoid immediate repetition
  const usedAmbientIndices = new Map<string, number>();
  const usedReEntryIndices = new Map<string, number>();

  /**
   * Effective horror level = scene base + story modifier, clamped to 0-10
   */
  function effectiveHorror(): number {
    return Math.max(0, Math.min(10, sceneBaseHorror + storyHorrorModifier));
  }

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

      case 'scene_exit':
        return triggerParams.sceneId === params.sceneId;

      case 'item_pickup':
        return triggerParams.itemId === params.itemId;

      case 'npc_interact':
        return triggerParams.npcId === params.npcId;

      case 'time_elapsed':
        return (params.timeSeconds ?? 0) >= (triggerParams.seconds as number ?? 0);

      case 'interact':
        return triggerParams.targetId === params.targetId;

      case 'reach_exit':
        // reach_exit triggers match any exit interaction
        return true;

      case 'kills_reached':
        return (params.killCount ?? 0) >= (triggerParams.count as number ?? 0);

      default:
        return false;
    }
  }

  /**
   * Execute beat consequences, applying character path variants if present.
   */
  function executeConsequences(beat: StoryBeatRuntime) {
    const consequences = beat.consequences;
    if (!consequences) return;

    // Check for character path variants and apply overrides
    const variants = (consequences as Record<string, unknown>).characterPathVariants as
      Record<string, { dialogue?: string[]; horrorLevelChange?: number }> | undefined;
    const variant = variants?.[characterPath];

    // If a path variant provides dialogue, emit it
    if (variant?.dialogue && variant.dialogue.length > 0) {
      const speaker = characterPath === 'chaos' ? 'carl' : 'paul';
      callbacks.onDialogue?.(variant.dialogue, speaker);
    }

    // Horror change: adds to the story modifier (on top of scene base)
    const horrorDelta = variant?.horrorLevelChange ?? consequences.horrorLevelChange;
    if (horrorDelta !== undefined) {
      const prevLevel = effectiveHorror();
      storyHorrorModifier = Math.max(-sceneBaseHorror, storyHorrorModifier + horrorDelta);
      const newLevel = effectiveHorror();
      if (newLevel !== prevLevel) {
        callbacks.onHorrorChange?.(newLevel, newLevel - prevLevel);
      }
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

    // Stage completion
    if (consequences.stageComplete) {
      callbacks.onStageComplete?.();
    }
  }

  /**
   * Get dialogue lines for a beat, looking up from cached dialogue data.
   * Falls back to beat description if no dialogue data is found.
   */
  function getDialogueForPath(beat: StoryBeatRuntime): string[] {
    const entry = dialogueCache.get(beat.dialogueId);
    if (entry && entry.lines.length > 0) {
      return entry.lines.map(line => {
        if (line.speaker === 'narrator') {
          return line.text;
        }
        return `${line.speaker}: ${line.text}`;
      });
    }
    // Fallback to description if no dialogue data loaded
    return [beat.description];
  }

  return {
    setCallbacks(cb: StoryCallbacks) {
      callbacks = cb;
    },

    setEffectsCallbacks(cb: EffectsCallbacks) {
      effectsCallbacks = cb;
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

        // Cache dialogue entries from storyDialogues
        dialogueCache.clear();
        const dialogues = stageData.storyDialogues as Record<string, DialogueEntry> | undefined;
        if (dialogues && typeof dialogues === 'object') {
          for (const [key, entry] of Object.entries(dialogues)) {
            if (entry && Array.isArray(entry.lines)) {
              dialogueCache.set(key, entry);
            }
          }
        }

        // Cache NPC dialogue trees from npcDialogues, keyed by character
        npcDialogueCache.clear();
        const npcDialogues = stageData.npcDialogues as Record<string, NpcDialogueTree> | undefined;
        if (npcDialogues && typeof npcDialogues === 'object') {
          for (const [, entry] of Object.entries(npcDialogues)) {
            if (entry && entry.character && entry.tree) {
              npcDialogueCache.set(entry.character, entry);
            }
          }
        }

        // Cache ambient dialogues (room -> { carl: [...], paul: [...] })
        ambientDialogueCache.clear();
        const ambientDialogues = stageData.ambientDialogues as Record<string, CharacterDialogueMap> | undefined;
        if (ambientDialogues && typeof ambientDialogues === 'object') {
          for (const [room, data] of Object.entries(ambientDialogues)) {
            ambientDialogueCache.set(room, data);
          }
        }

        // Cache re-entry dialogues
        reEntryDialogueCache.clear();
        const reEntryDialogues = stageData.reEntryDialogues as Record<string, CharacterDialogueMap> | undefined;
        if (reEntryDialogues && typeof reEntryDialogues === 'object') {
          for (const [room, data] of Object.entries(reEntryDialogues)) {
            reEntryDialogueCache.set(room, data);
          }
        }

        // Cache cross-stage references
        crossStageRefCache.clear();
        const crossRefs = stageData.crossStageReferences as Record<string, CharacterDialogueMap> | undefined;
        if (crossRefs && typeof crossRefs === 'object') {
          for (const [key, data] of Object.entries(crossRefs)) {
            crossStageRefCache.set(key, data);
          }
        }

        // Cache prop overrides
        propOverrideCache.clear();
        const propOverrides = stageData.propOverrides as Record<string, PropOverrideData> | undefined;
        if (propOverrides && typeof propOverrides === 'object') {
          for (const [prop, data] of Object.entries(propOverrides)) {
            propOverrideCache.set(prop, data);
          }
        }

        // Clear used indices on stage load
        usedAmbientIndices.clear();
        usedReEntryIndices.clear();

        // Set starting beat if specified
        if (stageData.startingBeat && typeof stageData.startingBeat === 'string') {
          currentBeat = stageData.startingBeat;
        }
      } catch (error) {
        console.warn(`No story data found for stage: ${stageId}`, error);
      }
    },

    checkTrigger(type: TriggerType, params: TriggerParams, triggeredBy?: 'carl' | 'paul') {
      for (const [beatId, beat] of beats) {
        // Skip already completed beats
        if (beat.completed) continue;

        // Check if trigger matches
        if (matchesTrigger(beat, type, params)) {
          this.activateBeat(beatId, triggeredBy);
        }
      }
    },

    activateBeat(beatId: string, triggeredBy?: 'carl' | 'paul') {
      const beat = beats.get(beatId);
      if (!beat || beat.completed) return;

      // If triggeredBy is set, temporarily override characterPath for variant selection
      const savedPath = characterPath;
      if (triggeredBy) {
        characterPath = triggeredBy === 'carl' ? 'chaos' : 'order';
      }

      // Mark as triggered and completed
      beat.triggered = true;
      beat.completed = true;

      // Trigger dialogue
      const dialogueLines = getDialogueForPath(beat);
      const speaker = characterPath === 'chaos' ? 'carl' : 'paul';
      callbacks.onDialogue?.(dialogueLines, speaker);

      // Execute dialogue effects from cached dialogue entry
      const entry = dialogueCache.get(beat.dialogueId);
      if (entry?.effects) {
        for (const effect of entry.effects) {
          switch (effect.type) {
            case 'screen_shake':
              effectsCallbacks.onScreenShake?.(effect.intensity ?? 0.3, effect.duration ?? 500);
              break;
            case 'horror_pulse':
              effectsCallbacks.onScreenShake?.((effect.intensity ?? 0.5) * 0.3, 400);
              effectsCallbacks.onHorrorPulse?.(effect.intensity ?? 0.5);
              break;
            case 'music_change':
              effectsCallbacks.onMusicChange?.((effect as any).track ?? '');
              break;
            case 'dramatic_zoom':
              effectsCallbacks.onDramaticZoom?.(
                (effect as any).targetFov ?? 0.5,
                effect.duration ?? 1500
              );
              break;
          }
        }
      }

      // Execute consequences
      executeConsequences(beat);

      // Notify completion
      callbacks.onBeatComplete?.(beatId);

      // Update current beat
      if (beat.consequences?.nextBeat) {
        currentBeat = beat.consequences.nextBeat;
      }

      // Restore characterPath if it was temporarily overridden
      if (triggeredBy) {
        characterPath = savedPath;
      }
    },

    getNpcDialogueTree(characterId: string): NpcDialogueTree | null {
      return npcDialogueCache.get(characterId) ?? null;
    },

    getAmbientDialogue(roomPurpose: string, character: 'carl' | 'paul'): string | null {
      const data = ambientDialogueCache.get(roomPurpose);
      const lines = data?.[character];
      if (!lines || lines.length === 0) return null;
      // Cycle through lines to avoid immediate repetition
      const key = `ambient:${roomPurpose}:${character}`;
      const lastIdx = usedAmbientIndices.get(key) ?? -1;
      const nextIdx = (lastIdx + 1) % lines.length;
      usedAmbientIndices.set(key, nextIdx);
      return lines[nextIdx];
    },

    getReEntryDialogue(roomPurpose: string, character: 'carl' | 'paul'): string | null {
      const data = reEntryDialogueCache.get(roomPurpose);
      const lines = data?.[character];
      if (!lines || lines.length === 0) return null;
      const key = `reentry:${roomPurpose}:${character}`;
      const lastIdx = usedReEntryIndices.get(key) ?? -1;
      const nextIdx = (lastIdx + 1) % lines.length;
      usedReEntryIndices.set(key, nextIdx);
      return lines[nextIdx];
    },

    getCrossStageReferences(fromStageKey: string, character: 'carl' | 'paul'): string[] {
      const data = crossStageRefCache.get(fromStageKey);
      return data?.[character] ?? [];
    },

    getAllCrossStageReferences(character: 'carl' | 'paul'): string[] {
      const allLines: string[] = [];
      for (const data of crossStageRefCache.values()) {
        const lines = data[character];
        if (lines) allLines.push(...lines);
      }
      return allLines;
    },

    getPropOverride(propName: string): PropOverrideData | null {
      return propOverrideCache.get(propName) ?? null;
    },

    setSceneHorrorLevel(level: number) {
      const prevLevel = effectiveHorror();
      sceneBaseHorror = Math.max(0, Math.min(10, level));
      storyHorrorModifier = 0; // Reset story modifier on room change
      const newLevel = effectiveHorror();
      if (newLevel !== prevLevel) {
        callbacks.onHorrorChange?.(newLevel, newLevel - prevLevel);
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
      return effectiveHorror();
    },

    getState(): StoryState {
      return {
        completedBeats: this.getCompletedBeats(),
        currentBeat,
        // Store effective horror for save compatibility
        horrorLevel: effectiveHorror(),
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
      // Restore horror as scene base (the modifier will be 0 until beats fire again)
      sceneBaseHorror = state.horrorLevel;
      storyHorrorModifier = 0;
      characterPath = state.characterPath;
    },

    reset() {
      for (const beat of beats.values()) {
        beat.completed = false;
        beat.triggered = false;
      }
      dialogueCache.clear();
      npcDialogueCache.clear();
      ambientDialogueCache.clear();
      reEntryDialogueCache.clear();
      crossStageRefCache.clear();
      propOverrideCache.clear();
      usedAmbientIndices.clear();
      usedReEntryIndices.clear();
      currentBeat = null;
      sceneBaseHorror = 0;
      storyHorrorModifier = 0;
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

/**
 * Reset the story manager singleton. Call during HMR or scene teardown.
 */
export function resetStoryManager(): void {
  if (storyManagerInstance) {
    storyManagerInstance.reset();
    storyManagerInstance = null;
  }
}
