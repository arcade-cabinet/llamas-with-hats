/**
 * DevAIOverlay - Debug HUD for dual-AI testing mode
 * ==================================================
 *
 * Activated via `?dev=ai` URL parameter. Shows real-time AI state
 * for both llamas during autonomous testing.
 */
import React from 'react';
import { AIState } from '../../systems/AIController';

interface DevAIOverlayProps {
  playerAIState: AIState;
  opponentAIState: AIState;
  playerPosition: { x: number; z: number };
  opponentPosition: { x: number; z: number };
  currentRoomName: string;
}

const stateColor: Record<AIState, string> = {
  idle: 'text-gray-400',
  wander: 'text-green-400',
  follow: 'text-yellow-400',
  flee: 'text-red-400',
  interact: 'text-cyan-400',
};

export const DevAIOverlay: React.FC<DevAIOverlayProps> = ({
  playerAIState,
  opponentAIState,
  playerPosition,
  opponentPosition,
  currentRoomName,
}) => (
  <div className="absolute top-14 right-3 z-50 pointer-events-none select-none">
    <div className="bg-black/80 border border-cyan-500/60 rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed min-w-[180px]">
      <div className="text-cyan-400 font-bold mb-1 tracking-wider">DEV AI MODE</div>
      <div className="text-gray-500 text-[9px] mb-2">?dev=ai</div>

      <div className="border-t border-gray-700 pt-1 mb-1">
        <span className="text-gray-500">Room:</span>{' '}
        <span className="text-gray-300">{currentRoomName}</span>
      </div>

      <div className="border-t border-gray-700 pt-1 mb-1">
        <span className="text-carl font-bold">Player</span>
        <div className="ml-2">
          <span className="text-gray-500">state:</span>{' '}
          <span className={stateColor[playerAIState] ?? 'text-gray-400'}>
            {playerAIState}
          </span>
        </div>
        <div className="ml-2 text-gray-500">
          pos: {playerPosition.x.toFixed(1)}, {playerPosition.z.toFixed(1)}
        </div>
      </div>

      <div className="border-t border-gray-700 pt-1">
        <span className="text-paul font-bold">Opponent</span>
        <div className="ml-2">
          <span className="text-gray-500">state:</span>{' '}
          <span className={stateColor[opponentAIState] ?? 'text-gray-400'}>
            {opponentAIState}
          </span>
        </div>
        <div className="ml-2 text-gray-500">
          pos: {opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)}
        </div>
      </div>
    </div>
  </div>
);

export default DevAIOverlay;
