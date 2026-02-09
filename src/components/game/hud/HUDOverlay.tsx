import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { getAudioManager, SoundEffects } from '../../../systems/AudioManager';
import type { CharacterType, RoomConfig } from '../../../types/game';
import type { StageGoal } from '../../../systems/GameInitializer';
import type { InteractionState } from '../../../systems/InteractionSystem';
import type { InputMode, JoystickState } from '../../../hooks/useInputController';
import { RadialHealthGauge } from './RadialHealthGauge';
import { RadarMinimap } from './RadarMinimap';
import { GlowInventory } from './GlowInventory';
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
  playerPosition?: { x: number; z: number };
  opponentPosition?: { x: number; z: number };
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  worldName, currentRoom, playerCharacter, playerHealth, playerMaxHealth,
  playerInventory, isCompact, showMinimap, inputMode, interactionState,
  showDialogue, showTouchControls, joystickState, joystickElRef,
  stageGoals, onPause, playerPosition, opponentPosition,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <div className={clsx(
        'absolute top-0 left-0 right-0 flex items-center justify-between',
        'pointer-events-auto',
        isCompact ? 'px-3 py-2' : 'px-4 py-3'
      )} style={{
        background: 'linear-gradient(to bottom, rgba(10,10,12,0.9), transparent)',
      }}>
        {/* Location */}
        <div>
          <p className={clsx(
            'font-serif italic',
            isCompact ? 'text-xs' : 'text-sm'
          )} style={{ color: 'var(--color-pumpkin)' }}>
            {worldName}
          </p>
          <p style={{ fontSize: 10, color: 'var(--color-hud-muted)' }}>
            {currentRoom.name}
          </p>
        </div>

        {/* Character badge */}
        <div className={clsx(
          'px-3 py-1 rounded-full border',
          isCompact ? 'text-xs' : 'text-sm'
        )} style={{
          background: 'var(--color-hud-bg)',
          borderColor: 'var(--color-hud-border)',
        }}>
          <span style={{ color: playerCharacter === 'carl' ? 'var(--color-carl)' : 'var(--color-paul)' }}>
            {playerCharacter === 'carl' ? 'Carl' : 'Paul'}
          </span>
        </div>

        {/* Menu button */}
        <button
          onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onPause(); }}
          aria-label="Pause menu"
          className="p-2 rounded-lg border transition-colors"
          style={{
            background: 'var(--color-hud-bg)',
            borderColor: 'var(--color-hud-border)',
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--color-hud-muted)' }}>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Left Side - Health Gauge & Inventory */}
      <div className={clsx(
        'absolute left-0 flex flex-col gap-3 pointer-events-auto items-start',
        isCompact ? 'top-14 left-2' : 'top-16 left-4'
      )}>
        {/* Radial Health Gauge */}
        <RadialHealthGauge
          health={playerHealth}
          maxHealth={playerMaxHealth}
          label={playerCharacter === 'carl' ? 'CARL' : 'PAUL'}
          size={isCompact ? 56 : 72}
        />

        {/* Glowing Inventory Grid */}
        <GlowInventory
          items={playerInventory}
          maxSlots={4}
          isCompact={isCompact}
        />
      </div>

      {/* Right Side - Minimap & Quest Tracker */}
      <div className={clsx(
        'absolute pointer-events-auto flex flex-col gap-3 items-end',
        isCompact ? 'top-14 right-2' : 'top-16 right-4'
      )}>
        {showMinimap && (
          <RadarMinimap
            currentRoom={currentRoom}
            playerPosition={playerPosition}
            opponentPosition={opponentPosition}
            size={isCompact ? 64 : 80}
            isCompact={isCompact}
          />
        )}
        {stageGoals.length > 0 && (
          <QuestTracker goals={stageGoals} isCompact={isCompact} playerCharacter={playerCharacter} />
        )}
      </div>

      {/* Interaction Prompt — keyboard mode with text-reveal animation */}
      {inputMode === 'keyboard' && interactionState?.canInteract && !showDialogue && (
        <InteractionPrompt prompt={interactionState.interactPrompt ?? 'Interact'} />
      )}

      {/* Bottom - Controls */}
      <div className={clsx(
        'absolute bottom-0 left-0 right-0',
        isCompact ? 'h-24' : 'h-32'
      )} style={{
        background: 'linear-gradient(to top, rgba(10,10,12,0.8), transparent)',
      }}>
        {/* Controls hint (keyboard mode) */}
        {inputMode === 'keyboard' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 text-xs" style={{ color: 'var(--color-hud-muted)' }}>
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
            <div
              className="absolute inset-0 rounded-full backdrop-blur-sm"
              style={{
                border: '2px solid rgba(245, 129, 12, 0.25)',
                background: 'rgba(10, 10, 12, 0.4)',
              }}
            >
              {/* Dead zone indicator */}
              <div
                className="absolute rounded-full"
                style={{
                  width: '36%', height: '36%',
                  top: '32%', left: '32%',
                  border: '1px dashed rgba(245, 129, 12, 0.12)',
                }}
              />
            </div>
            {/* Inner knob */}
            <div
              className="absolute rounded-full"
              style={{
                width: 50, height: 50,
                background: joystickState.active
                  ? 'linear-gradient(135deg, #f5810c 0%, #8B0000 100%)'
                  : 'linear-gradient(135deg, rgba(245,129,12,0.5) 0%, rgba(139,0,0,0.5) 100%)',
                border: '2px solid rgba(245, 129, 12, 0.6)',
                left: 60 + joystickState.knobX * 35 - 25,
                top: 60 + joystickState.knobY * 35 - 25,
                transition: joystickState.active ? 'none' : 'left 0.15s, top 0.15s',
              }}
            />
          </div>
        )}

        {/* Gamepad hint */}
        {inputMode === 'gamepad' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 text-xs" style={{ color: 'var(--color-hud-muted)' }}>
            <span>Left stick to move</span>
            <span>A to interact</span>
            <span>Start to pause</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// InteractionPrompt — letter-by-letter blur-to-sharp reveal
// ---------------------------------------------------------------------------

const InteractionPrompt: React.FC<{ prompt: string }> = ({ prompt }) => {
  // Memoize character array so animation keys stay stable for the same text
  const chars = useMemo(() => prompt.split(''), [prompt]);

  return (
    <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-none">
      <div
        className="rounded-lg px-4 py-2 flex items-center gap-3 backdrop-blur-sm"
        style={{
          background: 'rgba(10, 10, 12, 0.85)',
          border: '1px solid rgba(245, 129, 12, 0.3)',
          animation: 'count-up 0.3s ease-out both',
        }}
      >
        <span
          className="font-bold text-sm rounded px-2 py-0.5"
          style={{
            color: 'var(--color-pumpkin)',
            border: '1px solid rgba(245, 129, 12, 0.4)',
            animation: 'glow-pulse 2s ease-in-out infinite',
          }}
        >
          E
        </span>
        <span style={{ fontSize: 13 }}>
          {chars.map((char, i) => (
            <span
              key={`${prompt}-${i}`}
              style={{
                color: 'var(--color-hud-text)',
                display: 'inline-block',
                animation: `prompt-char-reveal 0.15s ease-out ${0.025 * i}s both`,
                // Preserve whitespace width
                minWidth: char === ' ' ? '0.25em' : undefined,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};
