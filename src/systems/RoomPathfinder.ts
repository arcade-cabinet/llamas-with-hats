/**
 * Room Pathfinder — Graph-Based Multi-Room Navigation
 * ====================================================
 *
 * BFS pathfinding over the room connection graph from GeneratedLayout.
 * Produces waypoint sequences that guide a character through doorways
 * and stairs from any room to any other room.
 *
 * ## How It Works
 *
 * 1. Build an adjacency graph from `room.connections[]` (horizontal)
 *    and `layout.verticalConnections[]` (stairs/ramps)
 * 2. BFS from source room to target room, respecting locked connections
 * 3. Convert room sequence into world-space waypoints at doorway positions
 * 4. The AI follows waypoints sequentially via CharacterNavigator.moveTo()
 *
 * ## Doorway Position Calculation
 *
 * Each RoomConnection has a `position` relative to the `fromRoom`.
 * World-space doorway position = fromRoom.worldPosition + connection.position
 *
 * For vertical connections, we use the room's world position as the waypoint.
 */

import type {
  GeneratedLayout,
  RoomConnection,
  GeneratedVerticalConnection,
} from './LayoutGenerator';

// ============================================
// Types
// ============================================

export interface Waypoint {
  x: number;
  z: number;
  y: number;
  roomId: string;
  type: 'doorway' | 'destination' | 'stairs_entry' | 'stairs_exit';
}

export interface RoomPath {
  /** Ordered sequence of room IDs from source to target */
  roomSequence: string[];
  /** World-space waypoints to follow */
  waypoints: Waypoint[];
  /** Total estimated distance */
  estimatedDistance: number;
}

export interface RoomPathfinder {
  /** Find shortest path between two rooms */
  findPath(
    fromRoomId: string,
    toRoomId: string,
    fromPos: { x: number; z: number }
  ): RoomPath | null;

  /** Find path to a specific world position in a target room */
  findPathToPosition(
    fromRoomId: string,
    fromPos: { x: number; z: number },
    targetPos: { x: number; z: number },
    targetRoomId: string
  ): RoomPath | null;

  /** Get the world-space doorway position between two adjacent rooms */
  getDoorwayPosition(
    fromRoomId: string,
    toRoomId: string
  ): { x: number; z: number; y: number } | null;

  /** Check if a connection between two rooms is locked */
  isConnectionLocked(fromRoomId: string, toRoomId: string): boolean;

  /** Unlock a connection by lock ID */
  unlockConnection(lockId: string): void;

  /** Get the room ID that contains a given world position */
  getRoomAtPosition(x: number, z: number): string | null;

  /** Get room center in world coordinates */
  getRoomCenter(roomId: string): { x: number; z: number; y: number } | null;
}

// ============================================
// Implementation
// ============================================

export function createRoomPathfinder(layout: GeneratedLayout): RoomPathfinder {
  // Build adjacency list for fast lookups
  // Each entry: roomId -> [{ neighborId, connection, isVertical }]
  interface AdjEntry {
    neighborId: string;
    horizontalConnection?: RoomConnection;
    verticalConnection?: GeneratedVerticalConnection;
  }

  const adjacency = new Map<string, AdjEntry[]>();

  function getAdj(roomId: string): AdjEntry[] {
    let entries = adjacency.get(roomId);
    if (!entries) {
      entries = [];
      adjacency.set(roomId, entries);
    }
    return entries;
  }

  // Build from horizontal connections
  for (const conn of layout.connections) {
    getAdj(conn.fromRoom).push({ neighborId: conn.toRoom, horizontalConnection: conn });
    getAdj(conn.toRoom).push({ neighborId: conn.fromRoom, horizontalConnection: conn });
  }

  // Build from vertical connections
  for (const vc of layout.verticalConnections) {
    getAdj(vc.upperRoom).push({ neighborId: vc.lowerRoom, verticalConnection: vc });
    getAdj(vc.lowerRoom).push({ neighborId: vc.upperRoom, verticalConnection: vc });
  }

  // Track unlocked lock IDs (initially empty — all locked connections start locked)
  const unlockedLocks = new Set<string>();

  /**
   * Check if a connection is traversable (not locked or already unlocked).
   */
  function isTraversable(entry: AdjEntry): boolean {
    if (entry.horizontalConnection) {
      const conn = entry.horizontalConnection;
      if (conn.locked && conn.lockId && !unlockedLocks.has(conn.lockId)) return false;
    }
    if (entry.verticalConnection) {
      const vc = entry.verticalConnection;
      if (vc.locked && vc.lockId && !unlockedLocks.has(vc.lockId)) return false;
    }
    return true;
  }

  /**
   * BFS to find shortest room path.
   */
  function bfs(fromRoomId: string, toRoomId: string): string[] | null {
    if (fromRoomId === toRoomId) return [fromRoomId];
    if (!layout.rooms.has(fromRoomId) || !layout.rooms.has(toRoomId)) return null;

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [fromRoomId];
    visited.add(fromRoomId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      const neighbors = adjacency.get(current) ?? [];
      for (const entry of neighbors) {
        if (visited.has(entry.neighborId)) continue;
        if (!isTraversable(entry)) continue;

        visited.add(entry.neighborId);
        parent.set(entry.neighborId, current);

        if (entry.neighborId === toRoomId) {
          // Reconstruct path
          const path: string[] = [];
          let node: string | undefined = toRoomId;
          while (node !== undefined) {
            path.unshift(node);
            node = parent.get(node);
          }
          return path;
        }

        queue.push(entry.neighborId);
      }
    }

    return null; // No path found
  }

  /**
   * Get the world-space position for a doorway between two rooms.
   * The connection.position is relative to fromRoom.
   */
  function getDoorwayWorldPos(
    fromRoomId: string,
    toRoomId: string
  ): { x: number; z: number; y: number } | null {
    const fromRoom = layout.rooms.get(fromRoomId);
    if (!fromRoom) return null;

    // Check horizontal connections
    for (const conn of layout.connections) {
      if (conn.fromRoom === fromRoomId && conn.toRoom === toRoomId) {
        return {
          x: fromRoom.worldPosition.x + conn.position.x,
          z: fromRoom.worldPosition.z + conn.position.z,
          y: fromRoom.worldPosition.y,
        };
      }
      if (conn.fromRoom === toRoomId && conn.toRoom === fromRoomId) {
        // Reverse direction — use the toRoom's worldPosition + position
        const toRoom = layout.rooms.get(toRoomId);
        if (toRoom) {
          return {
            x: toRoom.worldPosition.x + conn.position.x,
            z: toRoom.worldPosition.z + conn.position.z,
            y: toRoom.worldPosition.y,
          };
        }
      }
    }

    // Check vertical connections — use the room center as waypoint
    for (const vc of layout.verticalConnections) {
      if (
        (vc.upperRoom === fromRoomId && vc.lowerRoom === toRoomId) ||
        (vc.lowerRoom === fromRoomId && vc.upperRoom === toRoomId)
      ) {
        // Use the stairs position (world-space from layout)
        return {
          x: vc.position.x,
          z: vc.position.z,
          y: fromRoom.worldPosition.y,
        };
      }
    }

    return null;
  }

  /**
   * Convert a room sequence into world-space waypoints.
   */
  function buildWaypoints(
    roomSequence: string[],
    _startPos: { x: number; z: number },
    endPos?: { x: number; z: number }
  ): Waypoint[] {
    const waypoints: Waypoint[] = [];

    for (let i = 0; i < roomSequence.length - 1; i++) {
      const currentRoomId = roomSequence[i];
      const nextRoomId = roomSequence[i + 1];

      // Add doorway waypoint between rooms
      const doorway = getDoorwayWorldPos(currentRoomId, nextRoomId);
      if (doorway) {
        // Determine if this is a vertical transition
        const isVertical = layout.verticalConnections.some(
          vc =>
            (vc.upperRoom === currentRoomId && vc.lowerRoom === nextRoomId) ||
            (vc.lowerRoom === currentRoomId && vc.upperRoom === nextRoomId)
        );

        waypoints.push({
          x: doorway.x,
          z: doorway.z,
          y: doorway.y,
          roomId: currentRoomId,
          type: isVertical ? 'stairs_entry' : 'doorway',
        });

        // For vertical transitions, add an exit waypoint in the target room
        if (isVertical) {
          const targetRoom = layout.rooms.get(nextRoomId);
          if (targetRoom) {
            waypoints.push({
              x: targetRoom.worldPosition.x,
              z: targetRoom.worldPosition.z,
              y: targetRoom.worldPosition.y,
              roomId: nextRoomId,
              type: 'stairs_exit',
            });
          }
        }
      }
    }

    // Add final destination waypoint
    const lastRoomId = roomSequence[roomSequence.length - 1];
    const lastRoom = layout.rooms.get(lastRoomId);
    if (lastRoom) {
      const destX = endPos?.x ?? lastRoom.worldPosition.x;
      const destZ = endPos?.z ?? lastRoom.worldPosition.z;
      waypoints.push({
        x: destX,
        z: destZ,
        y: lastRoom.worldPosition.y,
        roomId: lastRoomId,
        type: 'destination',
      });
    }

    return waypoints;
  }

  /**
   * Calculate estimated path distance from waypoints.
   */
  function estimateDistance(
    startPos: { x: number; z: number },
    waypoints: Waypoint[]
  ): number {
    let dist = 0;
    let prevX = startPos.x;
    let prevZ = startPos.z;

    for (const wp of waypoints) {
      const dx = wp.x - prevX;
      const dz = wp.z - prevZ;
      dist += Math.sqrt(dx * dx + dz * dz);
      prevX = wp.x;
      prevZ = wp.z;
    }

    return dist;
  }

  return {
    findPath(fromRoomId, toRoomId, fromPos) {
      const roomSequence = bfs(fromRoomId, toRoomId);
      if (!roomSequence) return null;

      const waypoints = buildWaypoints(roomSequence, fromPos);
      return {
        roomSequence,
        waypoints,
        estimatedDistance: estimateDistance(fromPos, waypoints),
      };
    },

    findPathToPosition(fromRoomId, fromPos, targetPos, targetRoomId) {
      const roomSequence = bfs(fromRoomId, targetRoomId);
      if (!roomSequence) return null;

      const waypoints = buildWaypoints(roomSequence, fromPos, targetPos);
      return {
        roomSequence,
        waypoints,
        estimatedDistance: estimateDistance(fromPos, waypoints),
      };
    },

    getDoorwayPosition(fromRoomId, toRoomId) {
      return getDoorwayWorldPos(fromRoomId, toRoomId);
    },

    isConnectionLocked(fromRoomId, toRoomId) {
      const entries = adjacency.get(fromRoomId) ?? [];
      for (const entry of entries) {
        if (entry.neighborId !== toRoomId) continue;
        return !isTraversable(entry);
      }
      return false; // No connection means not locked (just nonexistent)
    },

    unlockConnection(lockId) {
      unlockedLocks.add(lockId);
    },

    getRoomAtPosition(x, z) {
      for (const [roomId, room] of layout.rooms) {
        const hw = room.size.width / 2;
        const hh = room.size.height / 2;
        if (
          x >= room.worldPosition.x - hw &&
          x <= room.worldPosition.x + hw &&
          z >= room.worldPosition.z - hh &&
          z <= room.worldPosition.z + hh
        ) {
          return roomId;
        }
      }
      return null;
    },

    getRoomCenter(roomId) {
      const room = layout.rooms.get(roomId);
      if (!room) return null;
      return {
        x: room.worldPosition.x,
        z: room.worldPosition.z,
        y: room.worldPosition.y,
      };
    },
  };
}
