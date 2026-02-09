/**
 * Character Navigator - Unified Yuka-based Navigation
 * ====================================================
 * 
 * A single navigation system used by both:
 * - AI characters (Paul wandering, following, fleeing)
 * - Player tap-to-move (one-shot pathfinding to a destination, navigates then stops)
 * 
 * ## Why Unified?
 * 
 * Previously AI had its own Yuka setup in AIController.ts. Now we have ONE
 * navigation system that handles all steering behaviors consistently.
 * 
 * ## Usage:
 * 
 * ```ts
 * // Create navigator for any character
 * const nav = createCharacterNavigator({
 *   startX: 0, startZ: 0,
 *   bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
 *   maxSpeed: 4,
 *   obstacles: collisionSystem.getAllColliders()
 * });
 * 
 * // AI mode: wander around
 * nav.wander();
 * 
 * // Or: move to specific point (player tap-to-move)
 * nav.moveTo(targetX, targetZ);
 * 
 * // Or: follow another entity
 * nav.follow(playerX, playerZ);
 * 
 * // Each frame:
 * nav.update(deltaTime);
 * const { x, z, rotation } = nav.getPosition();
 * ```
 */

import {
  Vehicle,
  GameEntity,
  EntityManager,
  ArriveBehavior,
  WanderBehavior,
  FleeBehavior,
  ObstacleAvoidanceBehavior
} from 'yuka';
import { CollisionBounds, PropCollider } from './CollisionSystem';

export type NavigatorMode = 
  | 'idle'      // Standing still
  | 'moveTo'    // Moving to specific point (tap-to-move)
  | 'wander'    // Random wandering (AI)
  | 'follow'    // Following a target (AI)
  | 'flee';     // Running away (AI)

export interface NavigatorConfig {
  startX: number;
  startZ: number;
  bounds: CollisionBounds;
  maxSpeed?: number;
  maxForce?: number;
  obstacles?: PropCollider[];
  /** Optional walkable check — returns true if (x, z) is walkable terrain.
   *  Used by ObjectiveAI for full-layout navigation instead of rectangular bounds. */
  walkableCheck?: (x: number, z: number) => boolean;
  /** Optional ground height function — returns Y at (x, z) for multi-floor nav. */
  getGroundY?: (x: number, z: number) => number;
}

export interface NavigatorState {
  mode: NavigatorMode;
  x: number;
  z: number;
  rotation: number;
  targetX?: number;
  targetZ?: number;
  arrived: boolean;
}

export interface CharacterNavigator {
  // Mode setters
  idle(): void;
  moveTo(x: number, z: number): void;
  wander(): void;
  follow(targetX: number, targetZ: number): void;
  flee(targetX: number, targetZ: number): void;
  
  // Position management
  setPosition(x: number, z: number, y?: number): void;
  getPosition(): { x: number; z: number; rotation: number };
  
  // For follow/flee modes - update the target position
  updateTarget(x: number, z: number): void;
  
  // Update obstacles from collision system
  syncObstacles(colliders: PropCollider[]): void;
  
  // Update bounds (room change)
  updateBounds(bounds: CollisionBounds): void;
  
  // Main update - call each frame
  update(deltaTime: number): NavigatorState;
  
  // Get current state
  getState(): NavigatorState;
  
  // Check if arrived at moveTo destination
  hasArrived(): boolean;
  
  // Get current mode
  getMode(): NavigatorMode;
  
  // Adjust max speed at runtime
  setMaxSpeed(speed: number): void;

  // Set walkable check callback
  setWalkableCheck(fn: ((x: number, z: number) => boolean) | null): void;

  // Set ground Y callback
  setGetGroundY(fn: ((x: number, z: number) => number) | null): void;

  // Get current Y position
  getY(): number;

  // Cleanup
  dispose(): void;
}

/**
 * Convert collision system props to Yuka obstacles
 */
function createYukaObstacles(colliders: PropCollider[]): GameEntity[] {
  return colliders
    .filter(c => c.solid)
    .map(collider => {
      const entity = new GameEntity();
      const centerX = (collider.bounds.minX + collider.bounds.maxX) / 2;
      const centerZ = (collider.bounds.minZ + collider.bounds.maxZ) / 2;
      entity.position.set(centerX, 0, centerZ);
      
      // Bounding radius from bounds
      const width = collider.bounds.maxX - collider.bounds.minX;
      const depth = collider.bounds.maxZ - collider.bounds.minZ;
      entity.boundingRadius = Math.sqrt(width * width + depth * depth) / 2 + 0.3;
      
      return entity;
    });
}

/**
 * Create a character navigator
 */
export function createCharacterNavigator(config: NavigatorConfig): CharacterNavigator {
  const {
    startX,
    startZ,
    bounds,
    maxSpeed = 4,
    maxForce = 10,
    obstacles = [],
    walkableCheck,
    getGroundY,
  } = config;
  let currentWalkableCheck = walkableCheck;
  let currentGetGroundY = getGroundY;
  
  // Yuka setup
  const entityManager = new EntityManager();
  const vehicle = new Vehicle();
  const target = new GameEntity();
  
  vehicle.position.set(startX, 0, startZ);
  vehicle.maxSpeed = maxSpeed;
  vehicle.maxForce = maxForce;
  vehicle.mass = 1;
  
  entityManager.add(vehicle);
  entityManager.add(target);
  
  // Behaviors (created once, reused)
  const arriveBehavior = new ArriveBehavior(target.position, 2, 0.1);
  const wanderBehavior = new WanderBehavior(3, 2, 0.5);
  const fleeBehavior = new FleeBehavior(target.position, 8);
  const obstacleAvoidance = new ObstacleAvoidanceBehavior(createYukaObstacles(obstacles));
  obstacleAvoidance.weight = 3;
  obstacleAvoidance.dBoxMinLength = 1.5;
  
  // State
  let mode: NavigatorMode = 'idle';
  let currentBounds = { ...bounds };
  let lastRotation = 0;
  let arrived = false;
  let targetX = 0;
  let targetZ = 0;
  
  const ARRIVAL_THRESHOLD = 0.4;
  
  function clearBehaviors() {
    vehicle.steering.clear();
    vehicle.velocity.set(0, 0, 0);
  }
  
  function addObstacleAvoidance() {
    // Always add obstacle avoidance when moving
    vehicle.steering.add(obstacleAvoidance);
  }
  
  return {
    idle() {
      clearBehaviors();
      mode = 'idle';
      arrived = false;
    },
    
    moveTo(x: number, z: number) {
      clearBehaviors();
      targetX = x;
      targetZ = z;
      target.position.set(x, 0, z);
      arriveBehavior.target = target.position;
      vehicle.steering.add(arriveBehavior);
      addObstacleAvoidance();
      mode = 'moveTo';
      arrived = false;
    },
    
    wander() {
      clearBehaviors();
      vehicle.steering.add(wanderBehavior);
      addObstacleAvoidance();
      mode = 'wander';
      arrived = false;
    },
    
    follow(x: number, z: number) {
      clearBehaviors();
      targetX = x;
      targetZ = z;
      target.position.set(x, 0, z);
      arriveBehavior.target = target.position;
      vehicle.steering.add(arriveBehavior);
      addObstacleAvoidance();
      mode = 'follow';
      arrived = false;
    },
    
    flee(x: number, z: number) {
      clearBehaviors();
      targetX = x;
      targetZ = z;
      target.position.set(x, 0, z);
      fleeBehavior.target = target.position;
      vehicle.steering.add(fleeBehavior);
      addObstacleAvoidance();
      mode = 'flee';
      arrived = false;
    },
    
    setPosition(x: number, z: number, y?: number) {
      vehicle.position.set(x, y ?? 0, z);
    },
    
    getPosition() {
      const vel = vehicle.velocity;
      if (vel.squaredLength() > 0.01) {
        lastRotation = Math.atan2(vel.x, vel.z);
      }
      return {
        x: vehicle.position.x,
        z: vehicle.position.z,
        rotation: lastRotation
      };
    },
    
    updateTarget(x: number, z: number) {
      targetX = x;
      targetZ = z;
      target.position.set(x, 0, z);
    },
    
    syncObstacles(colliders: PropCollider[]) {
      obstacleAvoidance.obstacles = createYukaObstacles(colliders);
    },
    
    updateBounds(bounds: CollisionBounds) {
      currentBounds = { ...bounds };
    },

    setMaxSpeed(speed: number) {
      vehicle.maxSpeed = speed;
    },

    setWalkableCheck(fn: ((x: number, z: number) => boolean) | null) {
      currentWalkableCheck = fn ?? undefined;
    },

    setGetGroundY(fn: ((x: number, z: number) => number) | null) {
      currentGetGroundY = fn ?? undefined;
    },

    getY() {
      return vehicle.position.y;
    },

    update(deltaTime: number): NavigatorState {
      // Check arrival for moveTo mode
      if (mode === 'moveTo' && !arrived) {
        const dx = targetX - vehicle.position.x;
        const dz = targetZ - vehicle.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < ARRIVAL_THRESHOLD) {
          arrived = true;
          clearBehaviors();
          mode = 'idle';
        }
      }
      
      // Snapshot position before Yuka physics so we can revert if needed
      const prevX = vehicle.position.x;
      const prevZ = vehicle.position.z;

      // Update Yuka
      entityManager.update(deltaTime);

      // Clamp to bounds first
      vehicle.position.x = Math.max(
        currentBounds.minX + 0.5,
        Math.min(currentBounds.maxX - 0.5, vehicle.position.x)
      );
      vehicle.position.z = Math.max(
        currentBounds.minZ + 0.5,
        Math.min(currentBounds.maxZ - 0.5, vehicle.position.z)
      );

      // If walkableCheck is provided and the new position is outside all rooms,
      // revert to the last valid position and kill velocity
      if (currentWalkableCheck && !currentWalkableCheck(vehicle.position.x, vehicle.position.z)) {
        vehicle.position.x = prevX;
        vehicle.position.z = prevZ;
        vehicle.velocity.set(0, 0, 0);
      }

      // Apply ground Y for multi-floor positioning
      if (currentGetGroundY) {
        vehicle.position.y = currentGetGroundY(vehicle.position.x, vehicle.position.z);
      }
      
      // Update rotation
      const vel = vehicle.velocity;
      if (vel.squaredLength() > 0.01) {
        lastRotation = Math.atan2(vel.x, vel.z);
      }
      
      return this.getState();
    },
    
    getState(): NavigatorState {
      return {
        mode,
        x: vehicle.position.x,
        z: vehicle.position.z,
        rotation: lastRotation,
        targetX: mode === 'moveTo' || mode === 'follow' || mode === 'flee' ? targetX : undefined,
        targetZ: mode === 'moveTo' || mode === 'follow' || mode === 'flee' ? targetZ : undefined,
        arrived
      };
    },
    
    hasArrived() {
      return arrived;
    },
    
    getMode() {
      return mode;
    },
    
    dispose() {
      entityManager.clear();
    }
  };
}

/**
 * AI behavior wrapper - uses CharacterNavigator with AI state machine
 */
export type AIBehaviorState = 'idle' | 'wander' | 'follow' | 'flee' | 'interact';

export interface AIBehaviorConfig {
  navigator: CharacterNavigator;
  followDistance?: number;
  fleeDistance?: number;
  interactionDistance?: number;
}

export interface AIBehavior {
  update(deltaTime: number, playerX: number, playerZ: number): void;
  getState(): AIBehaviorState;
  setState(state: AIBehaviorState): void;
  dispose(): void;
}

/**
 * Create AI behavior controller that wraps a CharacterNavigator
 */
export function createAIBehavior(config: AIBehaviorConfig): AIBehavior {
  const {
    navigator,
    followDistance = 4,
    fleeDistance = 2,
    interactionDistance = 1.5
  } = config;
  
  let state: AIBehaviorState = 'wander';
  let stateTimer = 0;
  let idleDuration = 0;
  
  navigator.wander();
  
  function getDistanceToPlayer(playerX: number, playerZ: number): number {
    const pos = navigator.getPosition();
    const dx = playerX - pos.x;
    const dz = playerZ - pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  
  return {
    update(deltaTime: number, playerX: number, playerZ: number) {
      const distToPlayer = getDistanceToPlayer(playerX, playerZ);
      
      switch (state) {
        case 'idle':
          stateTimer += deltaTime;
          if (stateTimer >= idleDuration) {
            this.setState('wander');
          }
          break;
          
        case 'wander':
          // Occasionally pause
          if (Math.random() < 0.002) {
            this.setState('idle');
          }
          // React to player proximity
          if (distToPlayer < followDistance) {
            this.setState(Math.random() > 0.5 ? 'follow' : 'flee');
          }
          break;
          
        case 'follow':
          navigator.updateTarget(playerX, playerZ);
          if (distToPlayer < interactionDistance) {
            this.setState('interact');
          } else if (distToPlayer > followDistance * 2) {
            this.setState('wander');
          }
          break;
          
        case 'flee':
          navigator.updateTarget(playerX, playerZ);
          if (distToPlayer > fleeDistance * 3) {
            this.setState('wander');
          }
          break;
          
        case 'interact':
          // Face player (rotation handled by navigator)
          if (Math.random() < 0.01) {
            this.setState('wander');
          }
          break;
      }
      
      navigator.update(deltaTime);
    },
    
    getState() {
      return state;
    },
    
    setState(newState: AIBehaviorState) {
      if (state === newState) return;
      state = newState;
      
      switch (newState) {
        case 'idle':
          navigator.idle();
          idleDuration = 1 + Math.random() * 2;
          stateTimer = 0;
          break;
        case 'wander':
          navigator.wander();
          break;
        case 'follow':
          // Will be updated with player position in update()
          navigator.follow(0, 0);
          break;
        case 'flee':
          navigator.flee(0, 0);
          break;
        case 'interact':
          navigator.idle();
          break;
      }
    },
    
    dispose() {
      navigator.dispose();
    }
  };
}
