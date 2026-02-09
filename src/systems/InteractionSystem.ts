/**
 * Interaction System
 * ==================
 * 
 * Handles player interactions with props and triggers dialogue.
 * 
 * ## Interaction Model
 * 
 * Interactions are triggered by:
 * - **Desktop/Mobile**: Click or tap directly on interactive objects (via raycasting)
 * - **Keyboard fallback**: Press 'E' when near an interactable (proximity-based)
 * 
 * The click/tap model is the primary interaction method:
 * 1. Player clicks/taps on a prop in the 3D scene
 * 2. GameRenderer raycasts to find the clicked mesh
 * 3. If mesh has interactive metadata, calls `interactWithProp(propType, character)`
 * 4. System triggers appropriate dialogue based on prop type and character
 * 
 * ## Dialogue System
 * 
 * Prop dialogues are loaded from JSON data files (`src/data/dialogues/prop-dialogues.json`).
 * Each prop type can have:
 * - **carl**: Lines Carl says when examining
 * - **paul**: Lines Paul says when examining  
 * - **horror**: Additional creepy lines at high horror levels
 * - **prompt**: The interaction prompt text
 * 
 * Story-specific dialogue overrides are handled separately for narrative beats.
 * 
 * ## Usage
 * 
 * ```ts
 * const interaction = createInteractionSystem();
 * 
 * // Set up callbacks
 * interaction.setCallbacks({
 *   onDialogue: (lines, speaker) => showDialogueBox(lines, speaker),
 *   onHorrorIncrease: (amount) => increaseHorror(amount)
 * });
 * 
 * // Direct interaction (click/tap) - preferred method
 * interaction.interactWithProp('couch', 'carl', horrorLevel);
 * 
 * // Proximity interaction (E key fallback)
 * interaction.update(playerX, playerZ);  // Call each frame
 * interaction.interact('carl', horrorLevel);  // When E pressed
 * ```
 * 
 * @see GameRenderer - Handles raycasting and calls interactWithProp
 * @see src/data/dialogues/prop-dialogues.json - Dialogue definitions
 */

import { CollisionSystem, PropCollider } from './CollisionSystem';
import { getPropDialogue, getInteractPrompt } from '../data';
import { getStoryManager, NpcDialogueTree } from './StoryManager';
import { getAchievementSystem } from './AchievementSystem';
import storyDialoguesData from '../data/dialogues/story-dialogues.json';

// Note: Prop dialogues are now loaded from src/data/dialogues/prop-dialogues.json
// Use getPropDialogue(propType) to get dialogue for a prop

// Story-specific dialogue overrides
export interface StoryDialogue {
  beatId: string;
  prop?: string;  // If specific to a prop
  room?: string;  // If specific to a room
  carl: string[];
  paul: string[];
  effects?: { type: string; params?: Record<string, unknown> }[];
}

// Story dialogues loaded from src/data/dialogues/story-dialogues.json
export const STORY_DIALOGUES: StoryDialogue[] = storyDialoguesData;

export interface InteractionCallbacks {
  onDialogue: (lines: string[], speaker: 'carl' | 'paul') => void;
  onDialogueTree?: (tree: NpcDialogueTree) => void;
  onItemPickup?: (itemId: string) => void;
  onHorrorIncrease?: (amount: number) => void;
  onUnlock?: (lockId: string) => void;
  onQuestProgress?: (questId: string, progress: number) => void;
}

export interface InteractionState {
  nearbyInteractable: PropCollider | null;
  canInteract: boolean;
  interactPrompt: string | null;
}

export interface InteractionSystem {
  /** Update player position to check for nearby interactables */
  update(playerX: number, playerZ: number): InteractionState;
  
  /** Perform interaction with nearest prop (keyboard E fallback) */
  interact(character: 'carl' | 'paul'): boolean;
  
  /**
   * Interact with a specific prop by type/id (for click/tap interactions).
   * Pass itemDrop to trigger item_pickup story beats.
   * Returns true if interaction was handled.
   */
  interactWithProp(propType: string, character: 'carl' | 'paul', itemDrop?: string): boolean;
  
  /** Check for triggered story beats */
  checkStoryTrigger(beatId: string, character: 'carl' | 'paul'): void;
  
  /** Set the collision system to query */
  setCollisionSystem(system: CollisionSystem): void;
  
  /** Register callbacks */
  setCallbacks(callbacks: InteractionCallbacks): void;
  
  /** Get current state */
  getState(): InteractionState;
}

export function createInteractionSystem(): InteractionSystem {
  let collisionSystem: CollisionSystem | null = null;
  let callbacks: InteractionCallbacks | null = null;
  let currentState: InteractionState = {
    nearbyInteractable: null,
    canInteract: false,
    interactPrompt: null
  };
  // Track player position for future use (e.g., proximity triggers)
  let lastPlayerPos = { x: 0, z: 0 };
  
  const INTERACTION_RANGE = 1.5;
  
  return {
    setCollisionSystem(system: CollisionSystem) {
      collisionSystem = system;
    },
    
    setCallbacks(cb: InteractionCallbacks) {
      callbacks = cb;
    },
    
    update(playerX: number, playerZ: number): InteractionState {
      lastPlayerPos = { x: playerX, z: playerZ };
      void lastPlayerPos; // Used for proximity triggers in future
      
      if (!collisionSystem) {
        currentState = {
          nearbyInteractable: null,
          canInteract: false,
          interactPrompt: null
        };
        return currentState;
      }
      
      const nearest = collisionSystem.findNearestInteractable(
        playerX, playerZ, INTERACTION_RANGE
      );
      
      if (nearest) {
        currentState = {
          nearbyInteractable: nearest,
          canInteract: true,
          interactPrompt: getInteractPrompt(nearest.type)
        };
      } else {
        currentState = {
          nearbyInteractable: null,
          canInteract: false,
          interactPrompt: null
        };
      }
      
      return currentState;
    },
    
    interact(character: 'carl' | 'paul'): boolean {
      if (!currentState.nearbyInteractable || !callbacks) {
        return false;
      }

      const prop = currentState.nearbyInteractable;
      return this.interactWithProp(prop.type, character, prop.itemDrop);
    },
    
    interactWithProp(propType: string, character: 'carl' | 'paul', itemDrop?: string): boolean {
      if (!callbacks) {
        return false;
      }

      // Check for NPC dialogue tree — if this prop is an NPC with a tree, use it
      if (propType === 'carl' || propType === 'paul') {
        const tree = getStoryManager().getNpcDialogueTree(propType);
        if (tree && callbacks.onDialogueTree) {
          callbacks.onDialogueTree(tree);
          getAchievementSystem().trackNpcInteraction();
          // Still fire triggers below
          getStoryManager().checkTrigger('interact', { targetId: propType });
          getStoryManager().checkTrigger('npc_interact', { npcId: propType });
          return true;
        }
      }

      // Check StoryManager for stage-specific prop overrides (rich multi-variant dialogue)
      const storyOverride = getStoryManager().getPropOverride(propType);
      let lines: string[];
      if (storyOverride) {
        const charLines = character === 'carl' ? storyOverride.carl : storyOverride.paul;
        const horrorLines = storyOverride.horror ?? [];
        const horrorLevel = getStoryManager().getHorrorLevel();
        // Use horror lines at high horror, character lines otherwise
        if (horrorLines.length > 0 && horrorLevel >= 6) {
          lines = horrorLines;
        } else if (charLines && charLines.length > 0) {
          lines = charLines;
        } else {
          // Fallback to standard prop dialogue
          const dialogue = getPropDialogue(propType);
          lines = character === 'carl' ? dialogue.carl : dialogue.paul;
        }
      } else {
        // Fallback to standard prop dialogue
        const dialogue = getPropDialogue(propType);
        lines = character === 'carl' ? dialogue.carl : dialogue.paul;
      }

      callbacks.onDialogue(lines, character);

      // Track prop examination for achievements
      getAchievementSystem().trackPropExamined(propType);

      // If the prop drops an item, fire item_pickup story trigger
      if (itemDrop) {
        callbacks.onItemPickup?.(itemDrop);
        getStoryManager().checkTrigger('item_pickup', { itemId: itemDrop });
      }

      // Fire generic interact trigger for all props — matches story beats
      // with trigger type "interact" and params.targetId
      getStoryManager().checkTrigger('interact', { targetId: propType });

      // Also fire npc_interact if this prop type matches an NPC id
      // (NPCs are interactable props with their characterId as propType)
      if (propType === 'carl' || propType === 'paul') {
        getStoryManager().checkTrigger('npc_interact', { npcId: propType });
      }

      return true;
    },
    
    checkStoryTrigger(beatId: string, character: 'carl' | 'paul') {
      if (!callbacks) return;
      
      const storyDialogue = STORY_DIALOGUES.find(d => d.beatId === beatId);
      if (storyDialogue) {
        const lines = character === 'carl' ? storyDialogue.carl : storyDialogue.paul;
        callbacks.onDialogue(lines, character);
        
        // Execute effects
        if (storyDialogue.effects) {
          for (const effect of storyDialogue.effects) {
            switch (effect.type) {
              case 'horror_increase':
                callbacks.onHorrorIncrease?.((effect.params?.amount as number) || 1);
                break;
              case 'unlock':
                callbacks.onUnlock?.(effect.params?.lockId as string);
                break;
            }
          }
        }
      }
    },
    
    getState(): InteractionState {
      return { ...currentState };
    }
  };
}
