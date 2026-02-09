import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import type { RoomConfig } from '../../../types/game';

interface RadarMinimapProps {
  currentRoom: RoomConfig;
  playerPosition?: { x: number; z: number };
  opponentPosition?: { x: number; z: number };
  rooms?: Map<string, { id: string; visited: boolean; locked: boolean; worldX: number; worldZ: number }>;
  size?: number;
  isCompact?: boolean;
  className?: string;
}

/**
 * Animated radar-style minimap for the HUD.
 *
 * Renders a circular display with a rotating conic-gradient sweep line,
 * concentric range rings, exit markers, prop dots, and player/opponent blips.
 * The player is always centered; all other elements are positioned relative
 * to the player within the room bounds.
 */
export const RadarMinimap: React.FC<RadarMinimapProps> = ({
  currentRoom,
  playerPosition,
  opponentPosition,
  size = 80,
  isCompact: _isCompact = false,
  className,
}) => {
  const radius = size / 2;

  // Normalize a world-space position relative to the room into radar-space
  // coordinates (pixels from the center of the radar circle). The player is
  // always at center so we offset by their position first.
  const toRadar = useMemo(() => {
    const roomW = currentRoom.width || 1;
    const roomH = currentRoom.height || 1;
    const px = playerPosition?.x ?? 0;
    const pz = playerPosition?.z ?? 0;

    return (worldX: number, worldZ: number): { cx: number; cy: number } => {
      // Delta from player, normalised to [-1, 1] range across room extents
      const nx = (worldX - px) / roomW;
      const nz = (worldZ - pz) / roomH;

      // Scale to radar pixels and clamp within the circle
      const usable = radius - 4; // leave a small padding
      const rawX = nx * usable * 2;
      const rawY = nz * usable * 2;
      const dist = Math.sqrt(rawX * rawX + rawY * rawY);
      const maxDist = usable;

      if (dist > maxDist && dist > 0) {
        const scale = maxDist / dist;
        return { cx: radius + rawX * scale, cy: radius + rawY * scale };
      }

      return { cx: radius + rawX, cy: radius + rawY };
    };
  }, [currentRoom.width, currentRoom.height, playerPosition, radius]);

  // Pre-compute exit positions on the circle edge
  const exitMarkers = useMemo(() => {
    return currentRoom.exits.map((exit, i) => {
      const edgePad = 4;
      let cx = radius;
      let cy = radius;

      switch (exit.direction) {
        case 'north':
          cy = edgePad;
          break;
        case 'south':
          cy = size - edgePad;
          break;
        case 'east':
          cx = size - edgePad;
          break;
        case 'west':
          cx = edgePad;
          break;
      }

      return {
        key: `${exit.direction}-${exit.targetRoom ?? i}`,
        cx,
        cy,
        locked: !!exit.locked,
      };
    });
  }, [currentRoom.exits, radius, size]);

  // Pre-compute prop dot positions (limit to 12 to avoid clutter)
  const propDots = useMemo(() => {
    return currentRoom.props.slice(0, 12).map((prop) => {
      return toRadar(prop.position.x, prop.position.z);
    });
  }, [currentRoom.props, toRadar]);

  // Opponent blip position
  const opponentBlip = useMemo(() => {
    if (!opponentPosition) return null;
    return toRadar(opponentPosition.x, opponentPosition.z);
  }, [opponentPosition, toRadar]);

  const ringStroke = 'rgba(0, 188, 212, 0.12)';

  return (
    <div
      className={clsx('relative', className)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(10, 10, 12, 0.85)',
        border: '1px solid rgba(0, 188, 212, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* SVG layer: rings, exits, props, blips */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      >
        {/* Inner range ring (33% radius) */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.33}
          fill="none"
          stroke={ringStroke}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Outer range ring (66% radius) */}
        <circle
          cx={radius}
          cy={radius}
          r={radius * 0.66}
          fill="none"
          stroke={ringStroke}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Props — dim wood-colored dots */}
        {propDots.map((dot, i) => (
          <circle
            key={`prop-${i}`}
            cx={dot.cx}
            cy={dot.cy}
            r={1}
            fill="rgba(139, 69, 19, 0.4)"
          />
        ))}

        {/* Exits — small squares at the circle edge */}
        {exitMarkers.map((exit) => (
          <rect
            key={exit.key}
            x={exit.cx - 2}
            y={exit.cy - 2}
            width={4}
            height={4}
            rx={0.5}
            fill={exit.locked ? 'rgba(244, 63, 94, 0.6)' : 'rgba(0, 188, 212, 0.6)'}
          />
        ))}

        {/* Opponent blip — pumpkin dot */}
        {opponentBlip && (
          <circle
            cx={opponentBlip.cx}
            cy={opponentBlip.cy}
            r={2}
            fill="#f5810c"
          />
        )}

        {/* Player blip — white pulsing dot at center */}
        <circle
          cx={radius}
          cy={radius}
          r={2.5}
          fill="white"
          style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}
        />
      </svg>

      {/* Radar sweep — rotating conic-gradient wedge */}
      <div
        className="radar-sweep"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(32, 178, 170, 0.3) 15deg, transparent 30deg)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
