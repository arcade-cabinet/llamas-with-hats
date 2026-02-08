/**
 * GameView - Main Game Interface Component
 * ========================================
 * 
 * Combines the 3D game scene with responsive HUD overlay.
 * Handles all player-facing UI during gameplay.
 * 
 * ## Features
 * 
 * - **3D Rendering**: Wraps GameRenderer for Babylon.js scene
 * - **Responsive HUD**: Adapts layout for phone/tablet/desktop
 * - **Input Handling**: Unified keyboard/touch/gamepad via useInputController
 * - **Dialogue System**: Character dialogue display with advancement
 * 
 * ## Interaction Model
 * 
 * Interactions work via direct click/tap - no dedicated buttons needed:
 * 
 * - **Desktop**: Click on interactive objects with mouse
 * - **Mobile**: Tap on interactive objects  
 * - **Keyboard fallback**: Press E when near an object (shows prompt)
 * 
 * The GameRenderer handles raycasting to detect clicked objects.
 * 
 * ## Touch Controls (Mobile)
 * 
 * Uses gesture-based movement instead of a fixed joystick:
 * - Drag anywhere on the game area to move
 * - Tap on objects to interact (no button needed)
 * - Direction indicator shows current movement direction while dragging
 * 
 * ## Visual Feedback
 * 
 * - **Movement indicator**: Shows direction arrow when dragging (touch mode)
 * - **Interaction prompt**: Shows "Press E" hint only in keyboard mode
 * - **Dialogue box**: Full-width overlay for character dialogue
 * 
 * @see useInputController - Input handling hook (gesture controls)
 * @see GameRenderer - 3D scene rendering (raycasting for interactions)
 * @see InteractionSystem - Dialogue and interaction logic
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { CharacterType, RoomConfig } from '../../types/game';
import type { GeneratedLayout } from '../../systems/LayoutGenerator';
import type { StageAtmosphere, StageGoal } from '../../systems/GameInitializer';
import { getStoryManager, NpcDialogueTree } from '../../systems/StoryManager';
import { DeviceType } from '../../hooks/useDeviceInfo';
import { GameRenderer } from './GameRenderer';
import { useInputController } from '../../hooks/useInputController';
import { InteractionState } from '../../systems/InteractionSystem';
import { GameBridge } from '../../utils/gameBridge';

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
  cameraZoom?: number; // Deprecated - camera now responsive
  showMinimap: boolean;
  isPaused: boolean;
  deviceType: DeviceType;
  isTouchDevice: boolean;
  onPlayerMove: (x: number, y: number, z: number, rotation: number) => void;
  onRoomTransition: (roomId: string, direction: 'north' | 'south' | 'east' | 'west') => void;
  onPause: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  hideHUD?: boolean; // Hide all HUD elements (for menu overlay)
  // Item/door callbacks
  onItemPickup?: (itemId: string) => void;
  onUnlockExit?: (lockId: string) => void;
  // Visual effect triggers (optional - effects can also be triggered via story system)
  screenShake?: boolean;
  bloodSplatter?: boolean;
  dramaticZoom?: boolean;
  // Stage completion callback
  onStageComplete?: () => void;
  // Dev AI mode — both llamas controlled by AI
  devAIEnabled?: boolean;
  // Layout-based rendering props (required — layout must always exist)
  layout: GeneratedLayout;
  allRoomConfigs: Map<string, RoomConfig>;
  seed?: string;
  onRoomChange?: (roomId: string) => void;
  stageAtmosphere?: StageAtmosphere;
  stageGoals?: StageGoal[];
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
  cameraZoom: _cameraZoom, // Deprecated
  showMinimap,
  isPaused,
  deviceType,
  isTouchDevice: _, // Handled by useInputController
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
  stageGoals = []
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  const isCompact = deviceType === 'phone' || deviceType === 'foldable-folded';
  const healthPercent = (playerHealth / playerMaxHealth) * 100;
  
  // Interaction state
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  
  // Dialogue state
  const [dialogueLines, setDialogueLines] = useState<string[]>([]);
  const [dialogueSpeaker, setDialogueSpeaker] = useState<'carl' | 'paul'>('carl');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);
  
  // Dialogue tree state (branching NPC conversations)
  const [dialogueTree, setDialogueTree] = useState<NpcDialogueTree | null>(null);
  const [treeNodeId, setTreeNodeId] = useState<string>('initial');
  const [treeLineIndex, setTreeLineIndex] = useState(0);
  const [showTreeOptions, setShowTreeOptions] = useState(false);
  const [showDialogueTree, setShowDialogueTree] = useState(false);

  // Handle NPC dialogue tree
  const handleDialogueTree = useCallback((tree: NpcDialogueTree) => {
    setDialogueTree(tree);
    setTreeNodeId('initial');
    setTreeLineIndex(0);
    setShowTreeOptions(false);
    setShowDialogueTree(true);
  }, []);

  // Advance dialogue tree lines
  const advanceTreeLine = useCallback(() => {
    if (!dialogueTree) return;
    const node = dialogueTree.tree[treeNodeId];
    if (!node) return;

    if (treeLineIndex < node.lines.length - 1) {
      setTreeLineIndex(prev => prev + 1);
    } else {
      // All lines shown — show options or close
      if (node.options.length > 0) {
        setShowTreeOptions(true);
      } else {
        // No options = end of conversation
        setShowDialogueTree(false);
        setDialogueTree(null);
      }
    }
  }, [dialogueTree, treeNodeId, treeLineIndex]);

  // Select a dialogue tree option
  const selectTreeOption = useCallback((nextNodeId: string) => {
    if (!dialogueTree) return;
    const nextNode = dialogueTree.tree[nextNodeId];
    if (!nextNode) {
      setShowDialogueTree(false);
      setDialogueTree(null);
      return;
    }
    setTreeNodeId(nextNodeId);
    setTreeLineIndex(0);
    setShowTreeOptions(false);
  }, [dialogueTree]);

  // Handle dialogue from interaction system
  const handleDialogue = useCallback((lines: string[], speaker: 'carl' | 'paul') => {
    setDialogueLines(lines);
    setDialogueSpeaker(speaker);
    setCurrentLineIndex(0);
    setShowDialogue(true);
  }, []);
  
  // Advance dialogue
  const advanceDialogue = useCallback(() => {
    if (currentLineIndex < dialogueLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    } else {
      setShowDialogue(false);
      setDialogueLines([]);
      setCurrentLineIndex(0);
    }
  }, [currentLineIndex, dialogueLines.length]);
  
  // Unified input controller with fixed joystick
  const { getInput, inputMode, showTouchControls, joystickState, setJoystickCenter } = useInputController({
    enabled: !isPaused,
    onPause,
    onAction: () => {
      if (showDialogueTree && !showTreeOptions) {
        advanceTreeLine();
      } else if (showDialogue) {
        advanceDialogue();
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
    // Re-measure after a short delay for layout settling
    const timeout = setTimeout(updateCenter, 100);
    return () => {
      window.removeEventListener('resize', updateCenter);
      clearTimeout(timeout);
    };
  }, [setJoystickCenter, showTouchControls]);
  
  // Expose getInput to GameRenderer
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
        isPaused={isPaused || showDialogue || showDialogueTree}
        onDialogue={handleDialogue}
        onDialogueTree={handleDialogueTree}
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
      />
      
      {/* HUD Overlay - hidden when menu is showing */}
      {!hideHUD && (
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className={clsx(
          'absolute top-0 left-0 right-0 flex items-center justify-between',
          'bg-gradient-to-b from-shadow/90 to-transparent pointer-events-auto',
          isCompact ? 'px-3 py-2' : 'px-4 py-3'
        )}>
          {/* Location */}
          <div>
            <p className={clsx(
              'text-wood font-serif italic',
              isCompact ? 'text-xs' : 'text-sm'
            )}>
              {worldName}
            </p>
            <p className="text-gray-500 text-xs">
              {currentRoom.name}
            </p>
          </div>
          
          {/* Character badge */}
          <div className={clsx(
            'px-3 py-1 bg-shadow-light/80 rounded-full border border-wood-dark/50',
            isCompact ? 'text-xs' : 'text-sm'
          )}>
            <span className={playerCharacter === 'carl' ? 'text-carl' : 'text-paul'}>
              {playerCharacter === 'carl' ? 'Carl' : 'Paul'}
            </span>
          </div>
          
          {/* Menu button */}
          <button
            onClick={onPause}
            className="p-2 bg-shadow-light/80 rounded-lg border border-wood-dark/50 hover:border-wood"
          >
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
        
        {/* Left Side - Health & Stats */}
        <div className={clsx(
          'absolute left-0 flex flex-col gap-3 pointer-events-auto',
          isCompact ? 'top-14 left-2' : 'top-16 left-4'
        )}>
          {/* Health */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Health</p>
            <div className={clsx(
              'bg-shadow-light/80 rounded-full overflow-hidden border border-wood-dark/30',
              isCompact ? 'w-20 h-2' : 'w-28 h-3'
            )}>
              <div 
                className={clsx(
                  'h-full rounded-full transition-all duration-300',
                  healthPercent > 50 ? 'bg-carl' : healthPercent > 25 ? 'bg-yellow-600' : 'bg-blood'
                )}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>
          
          {/* Inventory — shows abbreviated item names */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Items</p>
            <div className="grid grid-cols-2 gap-1">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={clsx(
                    'bg-shadow-light/80 rounded border border-wood-dark/30 flex items-center justify-center',
                    isCompact ? 'w-7 h-7' : 'w-9 h-9',
                    playerInventory[i] && 'border-wood/50'
                  )}
                  title={playerInventory[i]?.replace(/_/g, ' ')}
                >
                  {playerInventory[i] && (
                    <span className={clsx(
                      'text-wood font-bold leading-none',
                      isCompact ? 'text-[8px]' : 'text-[9px]'
                    )}>
                      {getItemIcon(playerInventory[i])}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Side - Minimap & Quest Tracker */}
        <div className={clsx(
          'absolute pointer-events-auto flex flex-col gap-3',
          isCompact ? 'top-14 right-2' : 'top-16 right-4'
        )}>
          {showMinimap && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Map</p>
              <Minimap room={currentRoom} isCompact={isCompact} />
            </div>
          )}
          {stageGoals.length > 0 && (
            <QuestTracker goals={stageGoals} isCompact={isCompact} />
          )}
        </div>
        
        {/* Interaction Prompt - only shown on keyboard mode when near interactable */}
        {inputMode === 'keyboard' && interactionState?.canInteract && !showDialogue && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-shadow-light/90 border border-wood/50 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-wood font-bold text-sm border border-wood/50 rounded px-2 py-0.5">
                E
              </span>
              <span className="text-gray-300 text-sm">
                {interactionState.interactPrompt}
              </span>
            </div>
          </div>
        )}
        
        {/* Bottom - Controls */}
        <div className={clsx(
          'absolute bottom-0 left-0 right-0',
          'bg-gradient-to-t from-shadow/80 to-transparent',
          isCompact ? 'h-24' : 'h-32'
        )}>
          {/* Controls hint (keyboard mode) */}
          {inputMode === 'keyboard' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 text-gray-600 text-xs">
              <span>WASD to move</span>
              <span>Click to interact</span>
              <span>ESC to pause</span>
            </div>
          )}
          
          {/* Fixed branded joystick — always visible on touch devices */}
          {showTouchControls && (
            <div
              ref={joystickElRef}
              className="absolute bottom-8 left-8 pointer-events-auto"
              style={{ width: 120, height: 120 }}
            >
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-wood-dark/50 bg-shadow/40 backdrop-blur-sm">
                {/* Dead zone indicator — subtle inner circle at 30% radius */}
                <div
                  className="absolute rounded-full border border-dashed border-wood-dark/20"
                  style={{
                    width: '36%', height: '36%',
                    top: '32%', left: '32%',
                  }}
                />
              </div>
              {/* Inner knob — follows finger within outer ring */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 50, height: 50,
                  background: joystickState.active
                    ? 'linear-gradient(135deg, #8B6914 0%, #7A1B1B 100%)'
                    : 'linear-gradient(135deg, #8B691480 0%, #7A1B1B80 100%)',
                  border: '2px solid rgba(139, 105, 20, 0.6)',
                  left: 60 + joystickState.knobX * 35 - 25,
                  top: 60 + joystickState.knobY * 35 - 25,
                  transition: joystickState.active ? 'none' : 'left 0.15s, top 0.15s',
                }}
              />
            </div>
          )}
          
          {/* Gamepad hint */}
          {inputMode === 'gamepad' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 text-gray-600 text-xs">
              <span>Left stick to move</span>
              <span>A to interact</span>
              <span>Start to pause</span>
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Dialogue Box */}
      {showDialogue && (
        <DialogueBox
          speaker={dialogueSpeaker}
          text={dialogueLines[currentLineIndex]}
          isLast={currentLineIndex === dialogueLines.length - 1}
          onAdvance={advanceDialogue}
          isCompact={isCompact}
        />
      )}

      {/* Dialogue Tree Box (branching NPC conversations) */}
      {showDialogueTree && dialogueTree && (
        <DialogueTreeBox
          tree={dialogueTree}
          nodeId={treeNodeId}
          lineIndex={treeLineIndex}
          showOptions={showTreeOptions}
          onAdvanceLine={advanceTreeLine}
          onSelectOption={selectTreeOption}
          isCompact={isCompact}
        />
      )}
      
      {/* Pause Menu */}
      {isPaused && !hideHUD && !showDialogue && (
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

// Dialogue Box Component
const DialogueBox: React.FC<{
  speaker: 'carl' | 'paul';
  text: string;
  isLast: boolean;
  onAdvance: () => void;
  isCompact: boolean;
}> = ({ speaker, text, isLast, onAdvance, isCompact }) => (
  <div 
    className="absolute inset-x-0 bottom-0 pointer-events-auto z-40"
    onClick={onAdvance}
  >
    {/* Darkened background above dialogue */}
    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-black/60" />
    
    {/* Dialogue container */}
    <div className={clsx(
      'relative bg-shadow-light border-t-2',
      speaker === 'carl' ? 'border-carl' : 'border-paul',
      isCompact ? 'p-4' : 'p-6'
    )}>
      {/* Speaker name */}
      <div className={clsx(
        'absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold',
        speaker === 'carl' 
          ? 'bg-carl text-shadow' 
          : 'bg-paul text-shadow'
      )}>
        {speaker === 'carl' ? 'Carl' : 'Paul'}
      </div>
      
      {/* Dialogue text */}
      <p className={clsx(
        'text-gray-200 leading-relaxed mt-2',
        isCompact ? 'text-sm' : 'text-base'
      )}>
        {text}
      </p>
      
      {/* Continue prompt */}
      <div className="absolute bottom-2 right-4 text-gray-500 text-xs animate-pulse">
        {isLast ? 'Click to close' : 'Click to continue'}
      </div>
    </div>
  </div>
);

// Dialogue Tree Box — branching NPC conversation UI
const DialogueTreeBox: React.FC<{
  tree: NpcDialogueTree;
  nodeId: string;
  lineIndex: number;
  showOptions: boolean;
  onAdvanceLine: () => void;
  onSelectOption: (nextNodeId: string) => void;
  isCompact: boolean;
}> = ({ tree, nodeId, lineIndex, showOptions, onAdvanceLine, onSelectOption, isCompact }) => {
  const node = tree.tree[nodeId];
  if (!node) return null;

  const line = node.lines[lineIndex];
  if (!line && !showOptions) return null;

  const speakerColor = line?.speaker === 'carl' ? 'border-carl' : 'border-paul';
  const speakerBg = line?.speaker === 'carl' ? 'bg-carl' : 'bg-paul';
  const speakerName = line?.speaker === 'narrator'
    ? null
    : line?.speaker === 'carl' ? 'Carl' : 'Paul';

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-auto z-40">
      {/* Darkened background above dialogue */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-black/60" />

      {/* Dialogue container */}
      <div className={clsx(
        'relative bg-shadow-light border-t-2',
        speakerColor,
        isCompact ? 'p-4' : 'p-6'
      )}>
        {/* Speaker name */}
        {speakerName && (
          <div className={clsx(
            'absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold',
            speakerBg, 'text-shadow'
          )}>
            {speakerName}
          </div>
        )}

        {/* Show current line text, or options */}
        {!showOptions && line && (
          <div onClick={onAdvanceLine} className="cursor-pointer">
            <p className={clsx(
              'text-gray-200 leading-relaxed mt-2',
              isCompact ? 'text-sm' : 'text-base'
            )}>
              {line.text}
            </p>
            <div className="absolute bottom-2 right-4 text-gray-500 text-xs animate-pulse">
              Click to continue
            </div>
          </div>
        )}

        {/* Options — shown after all lines in a node have been read */}
        {showOptions && node.options.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.options.map((option, i) => (
              <button
                key={i}
                onClick={() => onSelectOption(option.next)}
                className={clsx(
                  'w-full text-left px-4 py-2 rounded-lg border transition-colors',
                  'border-wood-dark/50 bg-shadow hover:bg-wood/20 hover:border-wood',
                  'text-gray-300 hover:text-white',
                  isCompact ? 'text-sm' : 'text-base'
                )}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Map item IDs to short icon-like labels for the inventory grid */
function getItemIcon(itemId: string): string {
  const map: Record<string, string> = {
    basement_key: 'KEY',
    bloody_note: 'NOTE',
    carl_journal: 'BOOK',
    broken_phone: 'PHONE',
    missing_flyer: 'FLYR',
    pet_collar: 'COLR',
    paul_recipe: 'RCPE',
    dirty_shovel: 'SHVL',
    police_badge: 'BDGE',
    police_radio: 'RDIO',
    newspaper: 'NEWS',
    dropped_keys: 'KEYS',
    marked_map: 'MAP',
  };
  return map[itemId] ?? itemId.slice(0, 3).toUpperCase();
}

// Quest Tracker — shows visible goals from the stage definition
const QuestTracker: React.FC<{
  goals: StageGoal[];
  isCompact: boolean;
}> = ({ goals, isCompact }) => {
  const storyManager = getStoryManager();
  const completedBeats = storyManager.getCompletedBeats();

  // Filter to visible goals (hiddenUntil beat must be completed, or no hiddenUntil)
  const visibleGoals = goals.filter(g =>
    !g.hiddenUntil || completedBeats.includes(g.hiddenUntil)
  );

  if (visibleGoals.length === 0) return null;

  return (
    <div className={clsx('max-w-[140px]', isCompact && 'max-w-[120px]')}>
      <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Objectives</p>
      <div className="bg-shadow-light/80 rounded-lg border border-wood-dark/30 p-2 space-y-1">
        {visibleGoals.map(goal => {
          // Check if goal is completed based on its type
          const isComplete = checkGoalComplete(goal, storyManager, completedBeats);
          return (
            <div key={goal.id} className="flex items-start gap-1.5">
              <span className={clsx(
                'text-[10px] mt-0.5 flex-shrink-0',
                isComplete ? 'text-carl' : 'text-gray-600'
              )}>
                {isComplete ? '\u2713' : '\u25CB'}
              </span>
              <span className={clsx(
                'text-[10px] leading-tight',
                isComplete ? 'text-gray-500 line-through' : 'text-gray-300'
              )}>
                {goal.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Check if a goal is complete based on its type and story state */
function checkGoalComplete(
  goal: StageGoal,
  storyManager: ReturnType<typeof getStoryManager>,
  completedBeats: string[]
): boolean {
  switch (goal.type) {
    case 'reach_scene':
    case 'reach_exit': {
      // Goal is complete if there's a beat with the scene's ID that's been completed
      const sceneId = goal.params.sceneId as string | undefined;
      if (!sceneId) return false;
      // Check if any beat triggered by entering this scene has completed
      return completedBeats.some(b => b.includes(sceneId) || b === goal.id);
    }
    case 'collect_items': {
      const items = goal.params.items as string[] | undefined;
      if (!items) return false;
      // We can't easily check inventory from here, so just check if the goal's beat completed
      return completedBeats.includes(goal.id);
    }
    case 'interact': {
      const targetId = goal.params.targetId as string | undefined;
      if (!targetId) return false;
      return completedBeats.some(b => b.includes(targetId) || b === goal.id);
    }
    default:
      return storyManager.isCompleted(goal.id);
  }
}

// Minimap
const Minimap: React.FC<{ room: RoomConfig; isCompact: boolean }> = ({ room, isCompact }) => {
  const size = isCompact ? 60 : 80;
  
  return (
    <div 
      className="relative bg-shadow-light/80 rounded-lg border border-wood-dark/30 p-2"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-2 border border-wood-dark/50 rounded" />
      
      {/* Exits */}
      {room.exits.map((exit, i) => (
        <div
          key={`${exit.direction}-${exit.targetRoom ?? i}`}
          className={clsx(
            'absolute w-2 h-2 bg-carl rounded-sm',
            exit.direction === 'north' && 'top-0 left-1/2 -translate-x-1/2',
            exit.direction === 'south' && 'bottom-0 left-1/2 -translate-x-1/2',
            exit.direction === 'east' && 'right-0 top-1/2 -translate-y-1/2',
            exit.direction === 'west' && 'left-0 top-1/2 -translate-y-1/2'
          )}
        />
      ))}
      
      {/* Props as small dots */}
      {room.props.slice(0, 8).map((prop, i) => {
        // Normalize position to minimap
        const x = (prop.position.x / room.width + 0.5) * 100;
        const z = (prop.position.z / room.height + 0.5) * 100;
        return (
          <div 
            key={i}
            className="absolute w-1.5 h-1.5 bg-wood-dark/60 rounded-sm"
            style={{ left: `${x}%`, top: `${z}%`, transform: 'translate(-50%, -50%)' }}
          />
        );
      })}
      
      {/* Player */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-wood rounded-full shadow-lg shadow-wood/50" />
    </div>
  );
};

// Pause Menu
const PauseMenu: React.FC<{
  onResume: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  isCompact: boolean;
}> = ({ onResume, onSave, onMainMenu, isCompact }) => (
  <div className="absolute inset-0 bg-black/85 flex items-center justify-center pointer-events-auto z-50">
    <div className={clsx(
      'bg-gradient-to-br from-shadow-light to-shadow border-2 border-wood-dark/50 rounded-xl',
      isCompact ? 'p-4 w-64' : 'p-6 w-80'
    )}>
      <h2 className="text-wood font-serif text-2xl text-center mb-6">Paused</h2>
      
      <div className="space-y-3">
        <button
          onClick={onResume}
          className="w-full py-3 bg-shadow border border-wood-dark/50 rounded-lg text-gray-300 hover:text-white hover:border-wood transition-colors"
        >
          Resume
        </button>
        <button
          onClick={onSave}
          className="w-full py-3 bg-shadow border border-wood-dark/50 rounded-lg text-gray-300 hover:text-white hover:border-wood transition-colors"
        >
          Save Game
        </button>
        <button
          onClick={onMainMenu}
          className="w-full py-3 bg-blood/30 border border-blood/50 rounded-lg text-gray-300 hover:text-white hover:border-blood transition-colors"
        >
          Main Menu
        </button>
      </div>
    </div>
  </div>
);

export default GameView;
