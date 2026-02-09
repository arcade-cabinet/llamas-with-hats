import React from 'react';
import { clsx } from 'clsx';
import type { RoomConfig } from '../../../types/game';

interface MinimapProps {
  room: RoomConfig;
  isCompact: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({ room, isCompact }) => {
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
