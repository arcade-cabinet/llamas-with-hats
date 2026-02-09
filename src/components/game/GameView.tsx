/**
 * GameView - Main Game Interface Component
 * ========================================
 *
 * Composes the 3D game scene with responsive HUD overlay.
 * Handles all player-facing UI during gameplay.
 *
 * Delegates to:
 * - GameRenderer — 3D Babylon.js scene
 * - HUDOverlay — health, inventory, minimap, quest tracker, controls
 * - DialogueBox / DialogueTreeBox — character dialogue display
 * - PauseMenu — pause screen
 * - useDialogueState — dialogue state machine
 * - useInputController — unified keyboard/touch/gamepad input
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { CharacterType, RoomConfig } from '../../types/game';
import type { GeneratedLayout } from '../../systems/LayoutGenerator';
import type { StageAtmosphere, StageGoal } from '../../systems/GameInitializer';
import { GameRenderer, CameraTelemetry } from './GameRenderer';
import { useInputController } from '../../hooks/useInputController';
import { useDialogueState } from '../../hooks/useDialogueState';
import { InteractionState } from '../../systems/InteractionSystem';
import { GameBridge } from '../../utils/gameBridge';
import { HUDOverlay } from './hud/HUDOverlay';
import { DialogueBox } from './hud/DialogueBox';
import { DialogueTreeBox } from './hud/DialogueTreeBox';
import { PauseMenu } from './hud/PauseMenu';
import { DeviceType } from '../../hooks/useDeviceInfo';

interface GameViewProps {
  playerCharacter: CharacterType;
  currentRoom: RoomConfig;
  worldName: string;
  playerPosition: { x: number; y?: number; z: number };
  playerRotation: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerInventory: string[];
  opponentPosition: { x: number; y?: number; z: number };
  opponentRotation: number;
  cameraZoom?: number;
  showMinimap: boolean;
  isPaused: boolean;
  deviceType: DeviceType;
  isTouchDevice: boolean;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  onRoomTransition: (roomId: string, direction: 'north' | 'south' | 'east' | 'west') => void;
  onPause: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  hideHUD?: boolean;
  onItemPickup?: (itemId: string) => void;
  onUnlockExit?: (lockId: string) => void;
  screenShake?: boolean;
  bloodSplatter?: boolean;
  dramaticZoom?: boolean;
  onStageComplete?: () => void;
  devAIEnabled?: boolean;
  layout: GeneratedLayout;
  allRoomConfigs: Map<string, RoomConfig>;
  seed?: string;
  onRoomChange?: (roomId: string) => void;
  stageAtmosphere?: StageAtmosphere;
  stageGoals?: StageGoal[];
  cameraTelemetryRef?: React.MutableRefObject<CameraTelemetry | null>;
}

export const GameView: React.FC<GameViewProps> = ({
  playerCharacter,
  currentRoom,
  worldName,
  playerPosition,
  playerRotation,
  playerHealth,
  playerMaxHealth,
  playerInventory,
  opponentPosition,
  opponentRotation,
  cameraZoom: _cameraZoom,
  showMinimap,
  isPaused,
  deviceType,
  isTouchDevice: _,
  onPlayerMove,
  onRoomTransition,
  onPause,
  onSave,
  onMainMenu,
  hideHUD = false,
  onItemPickup,
  onUnlockExit,
  screenShake = false,
  bloodSplatter = false,
  dramaticZoom = false,
  onStageComplete,
  devAIEnabled = false,
  layout,
  allRoomConfigs,
  seed,
  onRoomChange,
  stageAtmosphere,
  stageGoals = [],
  cameraTelemetryRef,
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const isCompact = deviceType === 'phone' || deviceType === 'foldable-folded';

  // Interaction state
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);

  // Dialogue state machine (simple + tree-based)
  const dialogue = useDialogueState();

  // Unified input controller with fixed joystick
  const { getInput, inputMode, showTouchControls, joystickState, setJoystickCenter } = useInputController({
    enabled: !isPaused,
    onPause,
    onAction: () => {
      if (dialogue.showDialogueTree && !dialogue.showTreeOptions) {
        dialogue.advanceTreeLine();
      } else if (dialogue.showDialogue) {
        dialogue.advanceDialogue();
      } else {
        GameBridge.triggerInteraction();
      }
    },
    gameContainerRef: gameContainerRef as React.RefObject<HTMLElement>
  });

  // Joystick DOM ref — measure center position for touch input
  const joystickElRef = useRef<HTMLDivElement>(null);

  // Register joystick center position on mount and resize
  useEffect(() => {
    const updateCenter = () => {
      if (joystickElRef.current) {
        const rect = joystickElRef.current.getBoundingClientRect();
        setJoystickCenter(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    };
    updateCenter();
    window.addEventListener('resize', updateCenter);
    const timeout = setTimeout(updateCenter, 100);
    return () => {
      window.removeEventListener('resize', updateCenter);
      clearTimeout(timeout);
    };
  }, [setJoystickCenter, showTouchControls]);

  // Expose getInput to GameRenderer via GameBridge
  const getInputCallback = useCallback(() => {
    const input = getInput();
    return { x: input.x, z: input.z };
  }, [getInput]);

  useEffect(() => {
    GameBridge.setInputProvider(getInputCallback);
    return () => { GameBridge.clearInputProvider(); };
  }, [getInputCallback]);

  // Handle interaction state changes
  const handleInteractionStateChange = useCallback((state: InteractionState) => {
    setInteractionState(state);
  }, []);

  return (
    <div ref={gameContainerRef} className="fixed inset-0 overflow-hidden">
      {/* 3D Scene */}
      <GameRenderer
        playerCharacter={playerCharacter}
        currentRoom={currentRoom}
        playerPosition={playerPosition}
        playerRotation={playerRotation}
        opponentPosition={opponentPosition}
        opponentRotation={opponentRotation}
        onPlayerMove={onPlayerMove}
        onRoomTransition={onRoomTransition}
        isPaused={isPaused || dialogue.isInDialogue}
        onDialogue={dialogue.handleDialogue}
        onDialogueTree={dialogue.handleDialogueTree}
        onInteractionStateChange={handleInteractionStateChange}
        onItemPickup={onItemPickup}
        onUnlockExit={onUnlockExit}
        playerInventory={playerInventory}
        screenShake={screenShake}
        bloodSplatter={bloodSplatter}
        dramaticZoom={dramaticZoom}
        onStageComplete={onStageComplete}
        devAIEnabled={devAIEnabled}
        layout={layout}
        allRoomConfigs={allRoomConfigs}
        seed={seed}
        onRoomChange={onRoomChange}
        stageAtmosphere={stageAtmosphere}
        cameraTelemetryRef={cameraTelemetryRef}
      />

      {/* HUD Overlay - hidden when menu is showing */}
      {!hideHUD && (
        <HUDOverlay
          worldName={worldName}
          currentRoom={currentRoom}
          playerCharacter={playerCharacter}
          playerHealth={playerHealth}
          playerMaxHealth={playerMaxHealth}
          playerInventory={playerInventory}
          isCompact={isCompact}
          showMinimap={showMinimap}
          inputMode={inputMode}
          interactionState={interactionState}
          showDialogue={dialogue.showDialogue}
          showTouchControls={showTouchControls}
          joystickState={joystickState}
          joystickElRef={joystickElRef}
          stageGoals={stageGoals}
          onPause={onPause}
        />
      )}

      {/* Dialogue Box */}
      {dialogue.showDialogue && (
        <DialogueBox
          speaker={dialogue.dialogueSpeaker}
          text={dialogue.dialogueLines[dialogue.currentLineIndex]}
          isLast={dialogue.currentLineIndex === dialogue.dialogueLines.length - 1}
          onAdvance={dialogue.advanceDialogue}
          isCompact={isCompact}
        />
      )}

      {/* Dialogue Tree Box (branching NPC conversations) */}
      {dialogue.showDialogueTree && dialogue.dialogueTree && (
        <DialogueTreeBox
          tree={dialogue.dialogueTree}
          nodeId={dialogue.treeNodeId}
          lineIndex={dialogue.treeLineIndex}
          showOptions={dialogue.showTreeOptions}
          onAdvanceLine={dialogue.advanceTreeLine}
          onSelectOption={dialogue.selectTreeOption}
          isCompact={isCompact}
        />
      )}

      {/* Pause Menu */}
      {isPaused && !hideHUD && !dialogue.isInDialogue && (
        <PauseMenu
          onResume={onPause}
          onSave={onSave}
          onMainMenu={onMainMenu}
          isCompact={isCompact}
        />
      )}
    </div>
  );
};

export default GameView;
