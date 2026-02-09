/**
 * Shared types for GameRenderer subsystems.
 */
import type { CharacterType, RoomConfig } from '../../../types/game';
import type { NpcDialogueTree } from '../../../systems/StoryManager';
import type { InteractionState } from '../../../systems/InteractionSystem';
import type { StageAtmosphere } from '../../../systems/GameInitializer';

/** Telemetry data exposed to React for overlay display. */
export interface CameraTelemetry {
  qualityScore: number;
  occlusionPct: number;
  screenCoverage: number;
  isHealing: boolean;
  healReason: string;
  fovObjectCount: number;
  fps: number;
  playerAIAction: string;
  playerAIReason: string;
  playerAINext: string;
  opponentAIAction: string;
  opponentAIReason: string;
  opponentAINext: string;
}

/**
 * Snapshot of React props, kept in a ref so the imperative render loop
 * always reads the latest values without stale closure captures.
 */
export interface PropsSnapshot {
  isPaused: boolean;
  opponentPosition: { x: number; y?: number; z: number };
  opponentRotation: number;
  playerInventory: string[];
  playerCharacter: CharacterType;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  onDialogue?: (lines: string[], speaker: 'carl' | 'paul') => void;
  onDialogueTree?: (tree: NpcDialogueTree) => void;
  onUnlockExit?: (lockId: string) => void;
  onLockedDoor?: (exit: import('../../../types/game').RoomExit) => void;
  onItemPickup?: (itemId: string) => void;
  onInteractionStateChange?: (state: InteractionState) => void;
  currentRoom: RoomConfig;
  onStageComplete?: () => void;
  devAIEnabled: boolean;
  playerPosition: { x: number; y?: number; z: number };
  playerRotation: number;
  onRoomChange?: (roomId: string) => void;
  stageAtmosphere?: StageAtmosphere;
}
