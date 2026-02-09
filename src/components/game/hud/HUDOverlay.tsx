import React from 'react';
import { clsx } from 'clsx';
import type { CharacterType, RoomConfig } from '../../../types/game';
import type { StageGoal } from '../../../systems/GameInitializer';
import type { InteractionState } from '../../../systems/InteractionSystem';
import type { InputMode, JoystickState } from '../../../hooks/useInputController';
import { getItemIcon } from '../../../utils/itemIcons';
import { Minimap } from './Minimap';
import { QuestTracker } from './QuestTracker';

interface HUDOverlayProps {
  worldName: string;
  currentRoom: RoomConfig;
  playerCharacter: CharacterType;
  playerHealth: number;
  playerMaxHealth: number;
  playerInventory: string[];
  isCompact: boolean;
  showMinimap: boolean;
  inputMode: InputMode;
  interactionState: InteractionState | null;
  showDialogue: boolean;
  showTouchControls: boolean;
  joystickState: JoystickState;
  joystickElRef: React.RefObject<HTMLDivElement>;
  stageGoals: StageGoal[];
  onPause: () => void;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  worldName, currentRoom, playerCharacter, playerHealth, playerMaxHealth,
  playerInventory, isCompact, showMinimap, inputMode, interactionState,
  showDialogue, showTouchControls, joystickState, joystickElRef,
  stageGoals, onPause,
}) => {
  const healthPercent = (playerHealth / playerMaxHealth) * 100;

  return (
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
          <QuestTracker goals={stageGoals} isCompact={isCompact} playerCharacter={playerCharacter} />
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
  );
};
