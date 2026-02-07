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
import { getStoryManager } from './StoryManager';

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

export const STORY_DIALOGUES: StoryDialogue[] = [
  // Stage 1: Apartment - Discovery
  {
    beatId: 'bloody_note_examine',
    prop: 'bloody_note',
    carl: [
      "A note... covered in something red.",
      "'Dear Carl, I made you breakfast. Love, Paul.'",
      "Why is there a smiley face drawn in... no. No no no."
    ],
    paul: [
      "My breakfast invitation!",
      "I worked really hard on the presentation."
    ],
    effects: [{ type: 'horror_increase', params: { amount: 1 } }]
  },
  {
    beatId: 'basement_key_examine',
    prop: 'basement_key',
    carl: [
      "A key... tagged 'BASEMENT'.",
      "Do I even want to know what's down there?",
      "...Yes. Unfortunately, I need to know."
    ],
    paul: [
      "Oh! My art supply room key!",
      "I've been working on a very special project."
    ]
  },
  {
    beatId: 'kitchen_blood',
    room: 'kitchen',
    carl: [
      "PAUL! Why is there blood on the ceiling?!",
      "And the walls. And the... is that a handprint?"
    ],
    paul: [
      "Oh, the kitchen! I was doing some... redecorating.",
      "Do you like the new color scheme?"
    ],
    effects: [
      { type: 'horror_increase', params: { amount: 2 } },
      { type: 'unlock', params: { lockId: 'basement_door' } }
    ]
  }
];

export interface InteractionCallbacks {
  onDialogue: (lines: string[], speaker: 'carl' | 'paul') => void;
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

      // Get dialogue from data module (handles fallback to default)
      const dialogue = getPropDialogue(propType);
      const lines = character === 'carl' ? dialogue.carl : dialogue.paul;

      // Dialogue variations are now handled by atmosphere system
      // Props can trigger atmosphere changes via their interaction actions
      callbacks.onDialogue(lines, character);

      // If the prop drops an item, fire item_pickup story trigger
      if (itemDrop) {
        callbacks.onItemPickup?.(itemDrop);
        getStoryManager().checkTrigger('item_pickup', { itemId: itemDrop });
      }

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
