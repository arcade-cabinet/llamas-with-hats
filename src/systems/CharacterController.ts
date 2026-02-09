/**
 * CharacterController — Unified Human/AI Character Interface
 * ===========================================================
 *
 * Provides a single interface for both human-controlled and AI-controlled
 * characters. Both use the same objective system, the same triggers, the
 * same navigation. The only difference is input source.
 *
 * ## Why This Exists
 *
 * Before this, human players had their position managed by GameBridge +
 * Babylon input, while AI used a completely separate LlamaAI system.
 * CharacterController normalizes this so the game loop treats both
 * identically.
 *
 * ## Usage
 *
 * ```ts
 * const carl = createCharacterController({
 *   character: 'carl',
 *   controlType: 'ai',
 *   objectiveAI: carlAI,
 *   navigator: carlNav,
 * });
 *
 * const paul = createCharacterController({
 *   character: 'paul',
 *   controlType: 'human',
 * });
 *
 * // Same update loop for both:
 * carl.update(deltaTime);
 * paul.update(deltaTime);
 * ```
 */

import type { ObjectiveAI, ObjectiveAIState } from './ObjectiveAI';
import type { CharacterNavigator } from './CharacterNavigator';

// ============================================
// Types
// ============================================

export type ControlType = 'human' | 'ai';

export interface CharacterControllerConfig {
  character: 'carl' | 'paul';
  controlType: ControlType;
  /** Required for AI control */
  objectiveAI?: ObjectiveAI;
  /** Required for AI control */
  navigator?: CharacterNavigator;
  /** Initial position */
  startPosition?: { x: number; z: number };
  /** Called when position updates */
  onPositionUpdate?: (x: number, y: number, z: number, rotation: number) => void;
  /** Called on room transition */
  onRoomTransition?: (roomId: string) => void;
}

export interface CharacterController {
  /** Which character this controls */
  readonly character: 'carl' | 'paul';

  /** Whether human or AI controlled */
  readonly controlType: ControlType;

  /** Call every frame */
  update(deltaTime: number): void;

  /** Get current world position */
  getPosition(): { x: number; z: number };

  /** Get current room ID (AI tracks this; human relies on external tracking) */
  getCurrentRoom(): string | null;

  /** Get AI state (null for human controllers) */
  getAIState(): ObjectiveAIState | null;

  /** Get current goal description (null for human controllers) */
  getCurrentGoalDescription(): string | null;

  /** Notify of external position update (for human controllers) */
  setPosition(x: number, z: number): void;

  /** Notify of external room change (for human controllers) */
  setCurrentRoom(roomId: string): void;

  /** Update the other character's position (for AI to track) */
  updateOtherPosition(x: number, z: number): void;

  /** Cleanup */
  dispose(): void;
}

// ============================================
// Implementation
// ============================================

export function createCharacterController(
  config: CharacterControllerConfig
): CharacterController {
  const { character, controlType, objectiveAI, navigator } = config;

  let posX = config.startPosition?.x ?? 0;
  let posZ = config.startPosition?.z ?? 0;
  let currentRoom: string | null = null;

  if (controlType === 'ai' && !objectiveAI) {
    console.warn(`[CharacterController] AI controller for ${character} created without ObjectiveAI`);
  }

  return {
    character,
    controlType,

    update(deltaTime: number) {
      if (controlType === 'ai' && objectiveAI) {
        objectiveAI.update(deltaTime);

        // Sync position from navigator
        if (navigator) {
          const navPos = navigator.getPosition();
          posX = navPos.x;
          posZ = navPos.z;
          config.onPositionUpdate?.(navPos.x, 0, navPos.z, navPos.rotation);
        }
      }
      // Human controllers get their position set externally via setPosition()
    },

    getPosition() {
      return { x: posX, z: posZ };
    },

    getCurrentRoom() {
      if (controlType === 'ai' && objectiveAI) {
        return objectiveAI.getCurrentRoom();
      }
      return currentRoom;
    },

    getAIState() {
      if (controlType === 'ai' && objectiveAI) {
        return objectiveAI.getState();
      }
      return null;
    },

    getCurrentGoalDescription() {
      if (controlType === 'ai' && objectiveAI) {
        return objectiveAI.getCurrentGoal()?.def.description ?? null;
      }
      return null;
    },

    setPosition(x: number, z: number) {
      posX = x;
      posZ = z;
    },

    setCurrentRoom(roomId: string) {
      currentRoom = roomId;
    },

    updateOtherPosition(x: number, z: number) {
      if (objectiveAI) {
        objectiveAI.updatePlayerPosition(x, z);
      }
    },

    dispose() {
      if (objectiveAI) {
        objectiveAI.dispose();
      }
    },
  };
}
