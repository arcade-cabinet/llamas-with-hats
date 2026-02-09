/**
 * ObjectiveAI — Goal-Driven Character Controller
 * ================================================
 *
 * Replaces the proximity-based wander/follow/flee AI with a system that:
 *
 * 1. Reads the current objective from GoalTracker
 * 2. Resolves the objective to a target room + position
 * 3. Pathfinds across rooms using RoomPathfinder
 * 4. Navigates through doorways via CharacterNavigator
 * 5. Interacts at the destination
 * 6. Repeats
 *
 * ## State Machine
 *
 * ```
 * planning ──► navigating ──► arriving ──► interacting ──► planning
 *     │                                                        ▲
 *     └── (no goal) ──► wandering ────────────────────────────┘
 *     └── (blocked) ──► waiting ──────────────────────────────┘
 * ```
 *
 * ## Integration
 *
 * Both player and opponent can use ObjectiveAI. In normal mode, the player's
 * input overrides movement; in dev AI mode both are fully autonomous.
 */

import type { GoalState, GoalTracker } from './GoalTracker';
import type { RoomPathfinder, RoomPath } from './RoomPathfinder';
import type { CharacterNavigator } from './CharacterNavigator';
import type { GeneratedLayout } from './LayoutGenerator';
import type { LlamaAI } from './AIController';

// ============================================
// Types
// ============================================

export type ObjectiveAIState =
  | 'planning'
  | 'navigating'
  | 'arriving'
  | 'interacting'
  | 'waiting'
  | 'wandering';

export interface ObjectiveAIConfig {
  character: 'carl' | 'paul';
  navigator: CharacterNavigator;
  goalTracker: GoalTracker;
  pathfinder: RoomPathfinder;
  layout: GeneratedLayout;
  /** Optional LlamaAI for horror behaviors during wandering */
  legacyAI?: LlamaAI;
  /** Planning delay in seconds (higher = slower reaction) */
  planningDelay?: number;
  /** Speed multiplier (1.0 = normal) */
  speedMultiplier?: number;
  /** Callback when character transitions rooms (provides new and previous room IDs) */
  onRoomTransition?: (newRoomId: string, prevRoomId: string) => void;
  /** Callback when character attempts an interaction */
  onInteraction?: (goalState: GoalState) => void;
  /** Callback when state changes */
  onStateChange?: (state: ObjectiveAIState) => void;
  /** Callback when position updates (for syncing to game state/renderer) */
  onPositionUpdate?: (x: number, y: number, z: number, rotation: number) => void;
}

export interface ObjectiveAI {
  /** Call every frame */
  update(deltaTime: number): void;

  /** Notify that a goal was completed (trigger replan) */
  onGoalCompleted(goalId: string): void;

  /** Notify that a door was unlocked (may unblock navigation) */
  onDoorUnlocked(lockId: string): void;

  /** Get current AI state */
  getState(): ObjectiveAIState;

  /** Get the goal currently being pursued */
  getCurrentGoal(): GoalState | null;

  /** Get the room the AI thinks it's in */
  getCurrentRoom(): string;

  /** Get current path being followed */
  getCurrentPath(): RoomPath | null;

  /** Set speed multiplier (for difficulty scaling) */
  setSpeedMultiplier(mult: number): void;

  /** Set planning delay (for difficulty scaling) */
  setPlanningDelay(delay: number): void;

  /** Update the player position (for legacy horror behaviors) */
  updatePlayerPosition(x: number, z: number): void;

  /** Cleanup */
  dispose(): void;
}

// ============================================
// Implementation
// ============================================

export function createObjectiveAI(config: ObjectiveAIConfig): ObjectiveAI {
  const {
    character,
    navigator: nav,
    goalTracker,
    pathfinder,
    layout,
    legacyAI,
    onRoomTransition,
    onInteraction,
    onStateChange,
    onPositionUpdate,
  } = config;

  let state: ObjectiveAIState = 'planning';
  let planningDelay = config.planningDelay ?? 0.5;
  let speedMultiplier = config.speedMultiplier ?? 1.0;

  let currentGoal: GoalState | null = null;
  let currentPath: RoomPath | null = null;
  let waypointIndex = 0;
  let currentRoomId: string = layout.entryRoomId;

  // Timers
  let planTimer = 0;
  let arrivalTimer = 0;
  let interactionTimer = 0;
  let replanTimer = 0;

  // Player position for legacy AI
  let playerX = 0;
  let playerZ = 0;

  const ARRIVAL_PAUSE = 0.3; // seconds to pause on arrival
  const INTERACTION_DURATION = 0.8; // seconds for interaction animation
  const REPLAN_INTERVAL = 3.0; // seconds between forced replans while wandering
  const WAYPOINT_ARRIVAL_THRESHOLD = 1.5; // distance to consider a waypoint reached

  // Pre-compute full layout bounds for navigation across rooms
  let fullMinX = Infinity, fullMaxX = -Infinity;
  let fullMinZ = Infinity, fullMaxZ = -Infinity;
  for (const room of layout.rooms.values()) {
    const hw = room.size.width / 2;
    const hh = room.size.height / 2;
    fullMinX = Math.min(fullMinX, room.worldPosition.x - hw);
    fullMaxX = Math.max(fullMaxX, room.worldPosition.x + hw);
    fullMinZ = Math.min(fullMinZ, room.worldPosition.z - hh);
    fullMaxZ = Math.max(fullMaxZ, room.worldPosition.z + hh);
  }

  /**
   * Constrain navigator bounds to a single room so wander stays in-bounds.
   */
  function constrainToRoom(roomId: string): void {
    const room = layout.rooms.get(roomId);
    if (!room) return;
    const hw = room.size.width / 2;
    const hh = room.size.height / 2;
    nav.updateBounds({
      minX: room.worldPosition.x - hw,
      maxX: room.worldPosition.x + hw,
      minZ: room.worldPosition.z - hh,
      maxZ: room.worldPosition.z + hh,
    });
  }

  /**
   * Restore full layout bounds for cross-room navigation.
   */
  function restoreFullBounds(): void {
    nav.updateBounds({ minX: fullMinX, maxX: fullMaxX, minZ: fullMinZ, maxZ: fullMaxZ });
  }

  function setState(newState: ObjectiveAIState) {
    if (state === newState) return;
    state = newState;
    onStateChange?.(newState);
  }

  /**
   * Determine which room the AI is currently in based on world position.
   */
  function detectCurrentRoom(): string {
    const pos = nav.getPosition();
    const roomId = pathfinder.getRoomAtPosition(pos.x, pos.z);
    return roomId ?? currentRoomId;
  }

  /**
   * Resolve a goal to a target room ID.
   */
  function resolveTargetRoom(goal: GoalState): string | null {
    const params = goal.def.params;

    switch (goal.def.type) {
      case 'reach_scene': {
        const sceneId = params.sceneId as string | undefined;
        if (!sceneId) return null;
        // Find room with matching purpose
        for (const [roomId, room] of layout.rooms) {
          if (room.purpose === sceneId) return roomId;
        }
        return null;
      }
      case 'collect_items': {
        // Find room containing the quest item
        const items = params.items as string[] | undefined;
        if (!items || items.length === 0) return null;
        for (const [roomId, room] of layout.rooms) {
          if (room.questItems.some(qi => items.includes(qi))) return roomId;
        }
        return null;
      }
      case 'interact': {
        // The targetId may correspond to a room's purpose or storyBeat
        const targetId = params.targetId as string | undefined;
        if (!targetId) return null;
        for (const [roomId, room] of layout.rooms) {
          if (room.storyBeats.some(sb => sb.includes(targetId)) || room.purpose.includes(targetId)) {
            return roomId;
          }
        }
        // Fallback: look through quest items
        for (const [roomId, room] of layout.rooms) {
          if (room.questItems.includes(targetId)) return roomId;
        }
        return null;
      }
      case 'interact_npc': {
        // NPCs wander but start in specific rooms — target the entry room
        return layout.entryRoomId;
      }
      case 'reach_exit': {
        return layout.exitRoomId;
      }
      case 'visit_scenes': {
        // Find the first unvisited scene
        const scenes = params.scenes as string[] | undefined;
        if (!scenes) return null;
        const visited = goalTracker.getVisitedScenes(character);
        for (const sceneId of scenes) {
          if (visited.has(sceneId)) continue; // Skip already-visited
          for (const [roomId, room] of layout.rooms) {
            if (room.purpose === sceneId) return roomId;
          }
        }
        // All scenes visited — goal should complete via GoalTracker,
        // but if not yet, just return null to wander
        return null;
      }
      default:
        return null;
    }
  }

  /**
   * Plan: read objective, resolve target, pathfind.
   */
  function plan(): void {
    currentGoal = goalTracker.getCurrentObjective(character);

    if (!currentGoal) {
      constrainToRoom(currentRoomId);
      setState('wandering');
      nav.wander();
      return;
    }

    const targetRoomId = resolveTargetRoom(currentGoal);
    if (!targetRoomId) {
      // Can't resolve target — wander and retry later
      constrainToRoom(currentRoomId);
      setState('wandering');
      nav.wander();
      return;
    }

    // Already in the target room?
    currentRoomId = detectCurrentRoom();
    if (currentRoomId === targetRoomId) {
      // Navigate to room center for interaction
      const center = pathfinder.getRoomCenter(targetRoomId);
      if (center) {
        restoreFullBounds();
        nav.moveTo(center.x, center.z);
        currentPath = {
          roomSequence: [currentRoomId],
          waypoints: [{ x: center.x, z: center.z, y: center.y, roomId: targetRoomId, type: 'destination' }],
          estimatedDistance: 0,
        };
        waypointIndex = 0;
        setState('navigating');
      } else {
        setState('arriving');
        arrivalTimer = ARRIVAL_PAUSE;
      }
      return;
    }

    // Pathfind to target room
    const pos = nav.getPosition();
    currentPath = pathfinder.findPath(currentRoomId, targetRoomId, { x: pos.x, z: pos.z });

    if (!currentPath) {
      // Path blocked (locked doors, etc.)
      constrainToRoom(currentRoomId);
      setState('waiting');
      nav.wander(); // Wander locally while blocked
      return;
    }

    // Start following waypoints
    restoreFullBounds();
    waypointIndex = 0;
    if (currentPath.waypoints.length > 0) {
      const wp = currentPath.waypoints[0];
      nav.moveTo(wp.x, wp.z);
      setState('navigating');
    }
  }

  /**
   * Follow the current waypoint path.
   */
  function navigate(_deltaTime: number): void {
    if (!currentPath || waypointIndex >= currentPath.waypoints.length) {
      setState('arriving');
      arrivalTimer = ARRIVAL_PAUSE;
      return;
    }

    const wp = currentPath.waypoints[waypointIndex];
    const pos = nav.getPosition();
    const dx = wp.x - pos.x;
    const dz = wp.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < WAYPOINT_ARRIVAL_THRESHOLD || nav.hasArrived()) {
      // Reached this waypoint
      waypointIndex++;

      // Detect room transition
      const newRoom = detectCurrentRoom();
      if (newRoom !== currentRoomId) {
        const prevRoom = currentRoomId;
        currentRoomId = newRoom;
        onRoomTransition?.(newRoom, prevRoom);

        // Track scene visit for visit_scenes goals
        goalTracker.trackSceneVisit(character, layout.rooms.get(newRoom)?.purpose ?? newRoom);
      }

      // Move to next waypoint
      if (waypointIndex < currentPath.waypoints.length) {
        const nextWp = currentPath.waypoints[waypointIndex];
        nav.moveTo(nextWp.x, nextWp.z);
      } else {
        // All waypoints reached
        setState('arriving');
        arrivalTimer = ARRIVAL_PAUSE;
      }
    }
  }

  /**
   * Brief pause after arriving at destination.
   */
  function arrive(deltaTime: number): void {
    arrivalTimer -= deltaTime;
    if (arrivalTimer <= 0) {
      // Fire interaction
      if (currentGoal) {
        onInteraction?.(currentGoal);
      }
      setState('interacting');
      interactionTimer = INTERACTION_DURATION;
      nav.idle();
    }
  }

  /**
   * Interaction animation/pause.
   */
  function interact(deltaTime: number): void {
    interactionTimer -= deltaTime;
    if (interactionTimer <= 0) {
      // Done interacting — replan
      setState('planning');
      planTimer = planningDelay;
    }
  }

  /**
   * Waiting for a blocked path to open.
   */
  function wait(deltaTime: number): void {
    replanTimer += deltaTime;
    if (replanTimer >= REPLAN_INTERVAL) {
      replanTimer = 0;
      setState('planning');
      planTimer = 0;
    }
  }

  /**
   * Wandering with no active objective.
   */
  function wander(deltaTime: number): void {
    // If using legacy AI for horror behaviors, delegate
    if (legacyAI) {
      legacyAI.updatePlayerPosition(playerX, playerZ);
      legacyAI.update(deltaTime);
    }

    // Periodically check for new objectives
    replanTimer += deltaTime;
    if (replanTimer >= REPLAN_INTERVAL) {
      replanTimer = 0;
      const newGoal = goalTracker.getCurrentObjective(character);
      if (newGoal) {
        setState('planning');
        planTimer = 0;
      }
    }
  }

  return {
    update(deltaTime: number) {
      // Apply speed multiplier
      nav.setMaxSpeed(4 * speedMultiplier);

      switch (state) {
        case 'planning':
          planTimer -= deltaTime;
          if (planTimer <= 0) {
            plan();
          }
          break;

        case 'navigating':
          navigate(deltaTime);
          break;

        case 'arriving':
          arrive(deltaTime);
          break;

        case 'interacting':
          interact(deltaTime);
          break;

        case 'waiting':
          wait(deltaTime);
          nav.update(deltaTime);
          break;

        case 'wandering':
          wander(deltaTime);
          if (!legacyAI) {
            nav.update(deltaTime);
          }
          break;
      }

      // Update navigator for navigation states
      if (state === 'navigating' || state === 'arriving') {
        nav.update(deltaTime);
      }

      // Sync position back to game state for rendering
      // (In wandering state with legacyAI, the legacyAI handles its own position updates)
      if (onPositionUpdate && !(state === 'wandering' && legacyAI)) {
        const pos = nav.getPosition();
        // Use the current room's Y for correct floor positioning (nav.getY()
        // returns 0 when getGroundY isn't wired into the navigator)
        const room = layout.rooms.get(currentRoomId);
        const y = room?.worldPosition.y ?? nav.getY();
        onPositionUpdate(pos.x, y, pos.z, pos.rotation);
      }
    },

    onGoalCompleted(goalId: string) {
      if (currentGoal?.def.id === goalId) {
        // Current goal completed — replan immediately
        setState('planning');
        planTimer = 0;
      }
    },

    onDoorUnlocked(lockId: string) {
      pathfinder.unlockConnection(lockId);
      if (state === 'waiting') {
        // Retry planning since a door opened
        setState('planning');
        planTimer = 0;
      }
    },

    getState() {
      return state;
    },

    getCurrentGoal() {
      return currentGoal;
    },

    getCurrentRoom() {
      return currentRoomId;
    },

    getCurrentPath() {
      return currentPath;
    },

    setSpeedMultiplier(mult: number) {
      speedMultiplier = mult;
    },

    setPlanningDelay(delay: number) {
      planningDelay = delay;
    },

    updatePlayerPosition(x: number, z: number) {
      playerX = x;
      playerZ = z;
    },

    dispose() {
      nav.dispose();
    },
  };
}
