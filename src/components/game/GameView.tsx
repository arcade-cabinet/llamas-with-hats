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
import { DeviceType } from '../../hooks/useDeviceInfo';
import { GameRenderer } from './GameRenderer';
import { useInputController } from '../../hooks/useInputController';
import { InteractionState } from '../../systems/InteractionSystem';

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
  dramaticZoom = false
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
  
  // Track touch input for visual feedback
  const [touchInput, setTouchInput] = useState({ x: 0, z: 0, active: false });
  
  // Unified input controller with gesture support
  const { getInput, inputMode, showTouchControls } = useInputController({
    enabled: !isPaused,
    onPause,
    onAction: () => {
      // If dialogue is showing, advance it
      if (showDialogue) {
        advanceDialogue();
      } else {
        // Trigger interaction
        const interact = (window as any).__lwh_gameInteract;
        if (interact) interact();
      }
    },
    gameContainerRef: gameContainerRef as React.RefObject<HTMLElement>
  });
  
  // Poll input for visual feedback on touch
  useEffect(() => {
    if (!showTouchControls) {
      setTouchInput({ x: 0, z: 0, active: false });
      return;
    }
    
    let animationId: number;
    const poll = () => {
      const input = getInput();
      const isActive = Math.abs(input.x) > 0.1 || Math.abs(input.z) > 0.1;
      setTouchInput({ x: input.x, z: input.z, active: isActive });
      animationId = requestAnimationFrame(poll);
    };
    animationId = requestAnimationFrame(poll);
    
    return () => cancelAnimationFrame(animationId);
  }, [showTouchControls, getInput]);
  
  // Expose getInput to GameRenderer
  const getInputCallback = useCallback(() => {
    const input = getInput();
    return { x: input.x, z: input.z };
  }, [getInput]);
  
  useEffect(() => {
    (window as any).__lwh_gameGetInput = getInputCallback;
    return () => { delete (window as any).__lwh_gameGetInput; };
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
        isPaused={isPaused || showDialogue}
        onDialogue={handleDialogue}
        onInteractionStateChange={handleInteractionStateChange}
        onItemPickup={onItemPickup}
        onUnlockExit={onUnlockExit}
        playerInventory={playerInventory}
        screenShake={screenShake}
        bloodSplatter={bloodSplatter}
        dramaticZoom={dramaticZoom}
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
          
          {/* Inventory */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Items</p>
            <div className="grid grid-cols-2 gap-1">
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i}
                  className={clsx(
                    'bg-shadow-light/80 rounded border border-wood-dark/30 flex items-center justify-center',
                    isCompact ? 'w-7 h-7' : 'w-9 h-9'
                  )}
                >
                  {playerInventory[i] && (
                    <div className="w-4 h-4 bg-wood rounded" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Side - Minimap */}
        {showMinimap && (
          <div className={clsx(
            'absolute pointer-events-auto',
            isCompact ? 'top-14 right-2' : 'top-16 right-4'
          )}>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Map</p>
            <Minimap room={currentRoom} isCompact={isCompact} />
          </div>
        )}
        
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
          
          {/* Touch gesture hint and direction indicator */}
          {showTouchControls && (
            <>
              {/* Direction indicator - shows when actively dragging */}
              {touchInput.active && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-opacity"
                  style={{ bottom: isCompact ? '3rem' : '4rem' }}
                >
                  <div 
                    className="w-10 h-10 rounded-full border-2 border-wood/40 flex items-center justify-center bg-shadow/30 backdrop-blur-sm"
                  >
                    {/* Arrow indicator */}
                    <svg 
                      className="w-5 h-5 text-wood" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                      style={{
                        transform: `rotate(${Math.atan2(touchInput.z, touchInput.x) * 180 / Math.PI + 90}deg)`,
                        opacity: Math.min(1, Math.sqrt(touchInput.x ** 2 + touchInput.z ** 2) * 1.5)
                      }}
                    >
                      <path d="M12 4l-8 8h6v8h4v-8h6z" />
                    </svg>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-500 text-xs">
                <span>Drag to move</span>
                <span>Tap objects to interact</span>
              </div>
            </>
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
      {room.exits.map(exit => (
        <div 
          key={exit.direction}
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
