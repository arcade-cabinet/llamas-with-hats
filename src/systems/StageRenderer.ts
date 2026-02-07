/**
 * Stage Renderer
 * ==============
 * 
 * Renders an ENTIRE STAGE at once - all rooms positioned in 3D space.
 * No more room-by-room transitions. The whole apartment is visible.
 * 
 * ## Key Concepts
 * 
 * - Rooms have world positions (x, z) and floor levels (y)
 * - Connections (doors, archways, stairs, ramps) are physical geometry
 * - Camera can see multiple rooms at once
 * - Player moves freely between connected areas
 * 
 * ## Vertical Transitions (Stairs & Ramps)
 * 
 * The renderer supports vertical connections between floors via stairs and ramps.
 * These are created using `createVerticalTransition()` which:
 * 
 * 1. **Automatically calculates geometry** from height difference and type
 *    - Stairs: ~1.8:1 run:rise ratio (comfortable climb)
 *    - Ramps: ~3:1 run:rise ratio (gentler slope)
 * 
 * 2. **Provides ground height tracking** via `getGroundY(x, z)`
 *    - Returns the Y position at any point on the transition
 *    - Enables smooth character movement up/down
 * 
 * 3. **Supports visual customization**
 *    - Materials: wood, stone, metal
 *    - Optional handrails
 * 
 * ## Navigation Without Jumping
 * 
 * Characters navigate vertical transitions by walking TOWARD them:
 * - Walk toward bottom of stairs → character rises as they ascend
 * - Walk toward top of stairs → character descends
 * - No jump button needed - movement is purely directional
 * 
 * The `getGroundY(x, z)` function handles all height interpolation:
 * 
 * ```ts
 * // In game loop
 * const groundY = renderedStage.getGroundY(playerX, playerZ);
 * player.position.y = groundY;
 * ```
 * 
 * ## Procedural Generation Integration
 * 
 * When the procedural generator needs to connect floors:
 * 
 * 1. Calculate height difference between source and target floors
 * 2. Choose transition type based on available space and style
 * 3. Use `calculateTransitionLength()` to determine required space
 * 4. Create transition with `createVerticalTransition()`
 * 5. Store `getGroundY` function in the connection for runtime use
 * 
 * @see createVerticalTransition - Creates stairs/ramps between floors
 * @see VerticalTransition - Type definition in StageDefinition.ts
 * @module StageRenderer
 */

import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  TransformNode,
  ShadowGenerator,
  DirectionalLight,
  HemisphericLight,
  AbstractMesh
} from '@babylonjs/core';

// ============================================
// Stage Layout Types
// ============================================

export interface StageLayout {
  id: string;
  name: string;
  floors: FloorDefinition[];
}

export interface FloorDefinition {
  level: number;           // -1 = basement, 0 = ground, 1 = upstairs
  name: string;
  yOffset: number;         // World Y position
  rooms: RoomDefinition[];
}

export interface RoomDefinition {
  id: string;
  anchor: boolean;         // Story-critical room
  purpose: string;         // entry, exit, exploration, connector
  template: string;        // Template ID for size/props
  position: { x: number; z: number };  // World position on this floor
  size?: { width: number; height: number };  // Override template size
  connections: ConnectionDefinition[];
  props?: PropPlacement[];
  storyBeats?: string[];
  questItems?: string[];
}

export interface ConnectionDefinition {
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  targetRoom: string;
  type: 'door' | 'archway' | 'stairs' | 'ramp' | 'open';
  locked?: boolean;
  lockId?: string;
  /** For stairs/ramp: height difference to target (auto-calculated if not set) */
  heightDifference?: number;
  /** For stairs/ramp: width of the transition */
  transitionWidth?: number;
}

export interface PropPlacement {
  type: string;
  position: { x: number; z: number };
  rotation: number;
  scale?: number;
}

// ============================================
// Rendered Stage
// ============================================

export interface RenderedStage {
  root: TransformNode;
  rooms: Map<string, RenderedRoom>;
  connections: RenderedConnection[];
  
  // Get room at world position
  getRoomAt: (x: number, y: number, z: number) => RenderedRoom | null;
  
  // Get walkable bounds for a floor
  getFloorBounds: (level: number) => { minX: number; maxX: number; minZ: number; maxZ: number };
  
  // Check if position is walkable
  isWalkable: (x: number, y: number, z: number) => boolean;
  
  // Get Y position for walking at (x, z) - handles stairs
  getGroundY: (x: number, z: number) => number;
  
  // Cleanup
  dispose: () => void;
}

export interface RenderedRoom {
  id: string;
  definition: RoomDefinition;
  floor: TransformNode;
  walls: TransformNode;
  props: AbstractMesh[];
  worldBounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
}

export interface RenderedConnection {
  fromRoom: string;
  toRoom: string;
  type: ConnectionDefinition['type'];
  mesh: AbstractMesh | null;
  /** For stairs/ramps: Y at bottom of transition */
  startY?: number;
  /** For stairs/ramps: Y at top of transition */
  endY?: number;
  /** Walkable area of the connection */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** For stairs/ramps: get ground Y at any point on the transition */
  getGroundY?: (x: number, z: number) => number;
}

// ============================================
// Stage Rendering
// ============================================

/**
 * Render an entire stage from a layout definition.
 */
export function renderStage(
  scene: Scene,
  layout: StageLayout,
  shadowGenerator?: ShadowGenerator
): RenderedStage {
  const root = new TransformNode('stage_root', scene);
  const rooms = new Map<string, RenderedRoom>();
  const connections: RenderedConnection[] = [];
  
  // Room sizes by template (simplified)
  const templateSizes: Record<string, { width: number; height: number }> = {
    'room_small': { width: 6, height: 6 },
    'room_medium': { width: 10, height: 8 },
    'room_kitchen': { width: 8, height: 6 },
    'room_bedroom': { width: 10, height: 8 },
    'room_bathroom': { width: 5, height: 5 },
    'room_basement': { width: 14, height: 12 },
    'hallway_short': { width: 3, height: 8 },
  };
  
  // Create materials
  const floorMat = new StandardMaterial('floor', scene);
  floorMat.diffuseColor = new Color3(0.35, 0.28, 0.2);
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05);
  
  const wallMat = new StandardMaterial('wall', scene);
  wallMat.diffuseColor = new Color3(0.55, 0.48, 0.42);
  wallMat.specularColor = new Color3(0.1, 0.1, 0.1);
  
  const basementFloorMat = new StandardMaterial('basementFloor', scene);
  basementFloorMat.diffuseColor = new Color3(0.25, 0.22, 0.2);
  
  const basementWallMat = new StandardMaterial('basementWall', scene);
  basementWallMat.diffuseColor = new Color3(0.35, 0.32, 0.3);
  
  // Render each floor
  for (const floor of layout.floors) {
    const floorRoot = new TransformNode(`floor_${floor.level}`, scene);
    floorRoot.position.y = floor.yOffset;
    floorRoot.parent = root;
    
    const isBasement = floor.level < 0;
    const currentFloorMat = isBasement ? basementFloorMat : floorMat;
    const currentWallMat = isBasement ? basementWallMat : wallMat;
    
    // Render each room on this floor
    for (const roomDef of floor.rooms) {
      const size = roomDef.size || templateSizes[roomDef.template] || { width: 8, height: 8 };
      const roomRoot = new TransformNode(`room_${roomDef.id}`, scene);
      roomRoot.position.set(roomDef.position.x, 0, roomDef.position.z);
      roomRoot.parent = floorRoot;
      
      // Floor
      const floorMesh = MeshBuilder.CreateGround(`${roomDef.id}_floor`, {
        width: size.width,
        height: size.height
      }, scene);
      floorMesh.material = currentFloorMat;
      floorMesh.receiveShadows = true;
      floorMesh.parent = roomRoot;
      
      // Walls container
      const wallsRoot = new TransformNode(`${roomDef.id}_walls`, scene);
      wallsRoot.parent = roomRoot;
      
      // Get connection directions for this room
      const connectionDirs = new Set(roomDef.connections.map(c => c.direction));
      
      // Create walls (skip where there are connections)
      const wallHeight = 2.5;
      const wallThickness = 0.2;
      
      // North wall
      if (!connectionDirs.has('north')) {
        const wall = MeshBuilder.CreateBox(`${roomDef.id}_wall_north`, {
          width: size.width, height: wallHeight, depth: wallThickness
        }, scene);
        wall.material = currentWallMat;
        wall.position.set(0, wallHeight / 2, -size.height / 2);
        wall.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
      } else {
        // Create wall segments with opening
        createWallWithOpening(scene, wallsRoot, roomDef.id, 'north', 
          size.width, size.height, wallHeight, wallThickness, currentWallMat,
          roomDef.connections.find(c => c.direction === 'north')!, shadowGenerator);
      }
      
      // South wall
      if (!connectionDirs.has('south')) {
        const wall = MeshBuilder.CreateBox(`${roomDef.id}_wall_south`, {
          width: size.width, height: wallHeight, depth: wallThickness
        }, scene);
        wall.material = currentWallMat;
        wall.position.set(0, wallHeight / 2, size.height / 2);
        wall.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
      } else {
        createWallWithOpening(scene, wallsRoot, roomDef.id, 'south',
          size.width, size.height, wallHeight, wallThickness, currentWallMat,
          roomDef.connections.find(c => c.direction === 'south')!, shadowGenerator);
      }
      
      // East wall
      if (!connectionDirs.has('east')) {
        const wall = MeshBuilder.CreateBox(`${roomDef.id}_wall_east`, {
          width: wallThickness, height: wallHeight, depth: size.height
        }, scene);
        wall.material = currentWallMat;
        wall.position.set(size.width / 2, wallHeight / 2, 0);
        wall.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
      } else {
        createWallWithOpening(scene, wallsRoot, roomDef.id, 'east',
          size.width, size.height, wallHeight, wallThickness, currentWallMat,
          roomDef.connections.find(c => c.direction === 'east')!, shadowGenerator);
      }
      
      // West wall
      if (!connectionDirs.has('west')) {
        const wall = MeshBuilder.CreateBox(`${roomDef.id}_wall_west`, {
          width: wallThickness, height: wallHeight, depth: size.height
        }, scene);
        wall.material = currentWallMat;
        wall.position.set(-size.width / 2, wallHeight / 2, 0);
        wall.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
      } else {
        createWallWithOpening(scene, wallsRoot, roomDef.id, 'west',
          size.width, size.height, wallHeight, wallThickness, currentWallMat,
          roomDef.connections.find(c => c.direction === 'west')!, shadowGenerator);
      }
      
      // Create props
      const propMeshes: AbstractMesh[] = [];
      if (roomDef.props) {
        for (const prop of roomDef.props) {
          const mesh = createProp(scene, prop.type, shadowGenerator);
          if (mesh) {
            mesh.position.set(prop.position.x, 0, prop.position.z);
            mesh.rotation.y = prop.rotation;
            if (prop.scale) mesh.scaling.setAll(prop.scale);
            mesh.parent = roomRoot;
            propMeshes.push(mesh);
          }
        }
      }
      
      // Handle stairs (up/down connections)
      const stairsDown = roomDef.connections.find(c => c.direction === 'down');
      if (stairsDown) {
        const stairsMesh = createStairs(scene, 'down', size, floor.yOffset, shadowGenerator);
        if (stairsMesh) {
          stairsMesh.parent = roomRoot;
          connections.push({
            fromRoom: roomDef.id,
            toRoom: stairsDown.targetRoom,
            type: 'stairs',
            mesh: stairsMesh,
            startY: floor.yOffset,
            endY: floor.yOffset - 4,  // Basement is 4 units down
            bounds: {
              minX: roomDef.position.x - 2,
              maxX: roomDef.position.x + 2,
              minZ: roomDef.position.z - size.height / 2,
              maxZ: roomDef.position.z - size.height / 2 + 3
            }
          });
        }
      }
      
      // Calculate world bounds
      const worldBounds = {
        minX: roomDef.position.x - size.width / 2,
        maxX: roomDef.position.x + size.width / 2,
        minY: floor.yOffset,
        maxY: floor.yOffset + wallHeight,
        minZ: roomDef.position.z - size.height / 2,
        maxZ: roomDef.position.z + size.height / 2
      };
      
      rooms.set(roomDef.id, {
        id: roomDef.id,
        definition: roomDef,
        floor: floorMesh as any,
        walls: wallsRoot,
        props: propMeshes,
        worldBounds
      });
    }
  }
  
  // Create rendered stage object
  const renderedStage: RenderedStage = {
    root,
    rooms,
    connections,
    
    getRoomAt(x: number, y: number, z: number) {
      for (const room of rooms.values()) {
        const b = room.worldBounds;
        if (x >= b.minX && x <= b.maxX &&
            y >= b.minY && y <= b.maxY + 0.5 &&
            z >= b.minZ && z <= b.maxZ) {
          return room;
        }
      }
      return null;
    },
    
    getFloorBounds(level: number) {
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
      for (const room of rooms.values()) {
        // Find floor level from yOffset
        const roomLevel = Math.round(room.worldBounds.minY / 4);
        if (roomLevel === level) {
          minX = Math.min(minX, room.worldBounds.minX);
          maxX = Math.max(maxX, room.worldBounds.maxX);
          minZ = Math.min(minZ, room.worldBounds.minZ);
          maxZ = Math.max(maxZ, room.worldBounds.maxZ);
        }
      }
      
      return { minX, maxX, minZ, maxZ };
    },
    
    isWalkable(x: number, y: number, z: number) {
      // Check if in any room
      if (this.getRoomAt(x, y, z)) return true;
      
      // Check if on stairs
      for (const conn of connections) {
        if (conn.type === 'stairs' && conn.bounds) {
          if (x >= conn.bounds.minX && x <= conn.bounds.maxX &&
              z >= conn.bounds.minZ && z <= conn.bounds.maxZ) {
            return true;
          }
        }
      }
      
      return false;
    },
    
    getGroundY(x: number, z: number) {
      // Check vertical transitions (stairs, ramps) first
      for (const conn of connections) {
        if ((conn.type === 'stairs' || conn.type === 'ramp') && conn.bounds) {
          if (x >= conn.bounds.minX && x <= conn.bounds.maxX &&
              z >= conn.bounds.minZ && z <= conn.bounds.maxZ) {
            // Use the transition's getGroundY if available
            if (conn.getGroundY) {
              return conn.getGroundY(x, z);
            }
            // Fallback: linear interpolation based on Z position
            if (conn.startY !== undefined && conn.endY !== undefined) {
              const t = (z - conn.bounds.minZ) / (conn.bounds.maxZ - conn.bounds.minZ);
              return conn.startY + (conn.endY - conn.startY) * t;
            }
          }
        }
      }
      
      // Find room at this position
      for (const room of rooms.values()) {
        const b = room.worldBounds;
        if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
          return b.minY;
        }
      }
      
      return 0;
    },
    
    dispose() {
      root.dispose();
    }
  };
  
  return renderedStage;
}

// ============================================
// Helper Functions
// ============================================

function createWallWithOpening(
  scene: Scene,
  parent: TransformNode,
  roomId: string,
  direction: string,
  roomWidth: number,
  roomHeight: number,
  wallHeight: number,
  wallThickness: number,
  material: StandardMaterial,
  connection: ConnectionDefinition,
  shadowGenerator?: ShadowGenerator
) {
  const openingWidth = connection.type === 'archway' ? 3 : 2;
  const openingHeight = connection.type === 'archway' ? wallHeight : wallHeight * 0.8;
  
  const isHorizontal = direction === 'north' || direction === 'south';
  const wallLength = isHorizontal ? roomWidth : roomHeight;
  const segmentLength = (wallLength - openingWidth) / 2;
  
  // Left/front segment
  const seg1 = MeshBuilder.CreateBox(`${roomId}_wall_${direction}_1`, {
    width: isHorizontal ? segmentLength : wallThickness,
    height: wallHeight,
    depth: isHorizontal ? wallThickness : segmentLength
  }, scene);
  seg1.material = material;
  
  // Right/back segment
  const seg2 = MeshBuilder.CreateBox(`${roomId}_wall_${direction}_2`, {
    width: isHorizontal ? segmentLength : wallThickness,
    height: wallHeight,
    depth: isHorizontal ? wallThickness : segmentLength
  }, scene);
  seg2.material = material;
  
  // Header above opening (if door)
  if (connection.type === 'door') {
    const header = MeshBuilder.CreateBox(`${roomId}_wall_${direction}_header`, {
      width: isHorizontal ? openingWidth : wallThickness,
      height: wallHeight - openingHeight,
      depth: isHorizontal ? wallThickness : openingWidth
    }, scene);
    header.material = material;
    header.parent = parent;
    if (shadowGenerator) shadowGenerator.addShadowCaster(header);
    
    // Position header
    switch (direction) {
      case 'north':
        header.position.set(0, wallHeight - (wallHeight - openingHeight) / 2, -roomHeight / 2);
        break;
      case 'south':
        header.position.set(0, wallHeight - (wallHeight - openingHeight) / 2, roomHeight / 2);
        break;
      case 'east':
        header.position.set(roomWidth / 2, wallHeight - (wallHeight - openingHeight) / 2, 0);
        break;
      case 'west':
        header.position.set(-roomWidth / 2, wallHeight - (wallHeight - openingHeight) / 2, 0);
        break;
    }
  }
  
  // Position segments
  switch (direction) {
    case 'north':
      seg1.position.set(-(wallLength - segmentLength) / 2, wallHeight / 2, -roomHeight / 2);
      seg2.position.set((wallLength - segmentLength) / 2, wallHeight / 2, -roomHeight / 2);
      break;
    case 'south':
      seg1.position.set(-(wallLength - segmentLength) / 2, wallHeight / 2, roomHeight / 2);
      seg2.position.set((wallLength - segmentLength) / 2, wallHeight / 2, roomHeight / 2);
      break;
    case 'east':
      seg1.position.set(roomWidth / 2, wallHeight / 2, -(wallLength - segmentLength) / 2);
      seg2.position.set(roomWidth / 2, wallHeight / 2, (wallLength - segmentLength) / 2);
      break;
    case 'west':
      seg1.position.set(-roomWidth / 2, wallHeight / 2, -(wallLength - segmentLength) / 2);
      seg2.position.set(-roomWidth / 2, wallHeight / 2, (wallLength - segmentLength) / 2);
      break;
  }
  
  seg1.parent = parent;
  seg2.parent = parent;
  
  if (shadowGenerator) {
    shadowGenerator.addShadowCaster(seg1);
    shadowGenerator.addShadowCaster(seg2);
  }
}

// ============================================
// Vertical Transition Rendering
// ============================================

/**
 * Configuration for creating a vertical transition.
 * 
 * @example
 * ```ts
 * const config: TransitionConfig = {
 *   type: 'stairs',
 *   heightDifference: 3.0,  // 3 units up
 *   width: 1.5,
 *   direction: 'north',
 *   position: { x: 0, z: -4 },
 *   style: { handrails: true, material: 'wood' }
 * };
 * ```
 */
export interface TransitionConfig {
  /** 
   * Type of vertical transition.
   * - 'stairs': Stepped surface, more compact horizontally
   * - 'ramp': Smooth slope, requires more horizontal space
   */
  type: 'stairs' | 'ramp';
  
  /** 
   * Total height change in world units.
   * Positive = going up from bottom to top.
   * Standard room height is ~3.0 units.
   */
  heightDifference: number;
  
  /** Width of the transition (perpendicular to travel direction) */
  width: number;
  
  /** 
   * Optional: override the automatically calculated length.
   * If not set, length is calculated based on type:
   * - Stairs: heightDifference * 1.8
   * - Ramps: heightDifference * 3.0
   */
  length?: number;
  
  /** 
   * Direction the transition faces (from bottom looking toward top).
   * Determines orientation and which axis is used for height interpolation.
   */
  direction: 'north' | 'south' | 'east' | 'west';
  
  /** Position of the transition center in local room coordinates */
  position: { x: number; z: number };
  
  /** Visual style options */
  style?: {
    /** Add handrails on both sides */
    handrails?: boolean;
    /** Material appearance: wood (warm brown), stone (gray), metal (silver) */
    material?: 'wood' | 'stone' | 'metal';
  };
}

/**
 * Creates a vertical transition (stairs or ramp) between floors.
 * 
 * This is the core function for connecting floors in a multi-level building.
 * It handles both the visual rendering and the physics/navigation logic.
 * 
 * ## Navigation Model
 * 
 * Characters navigate transitions by walking TOWARD them - no jump button needed:
 * - Walk toward bottom of stairs → character rises as they ascend
 * - Walk toward top of stairs → character descends
 * - The `getGroundY(x, z)` function provides smooth height interpolation
 * 
 * ## Automatic Geometry
 * 
 * If `length` is not specified in config, it's calculated automatically:
 * - **Stairs**: length = height × 1.8 (comfortable 30° angle)
 * - **Ramps**: length = height × 3.0 (gentle 18° angle)
 * 
 * For stairs, step count is calculated as: height / 0.2 (~20cm per step)
 * 
 * ## Usage in Procedural Generation
 * 
 * ```ts
 * // When connecting basement (y=0) to ground floor (y=3)
 * const transition = createVerticalTransition(scene, {
 *   type: 'stairs',
 *   heightDifference: 3.0,
 *   width: 1.5,
 *   direction: 'north',
 *   position: { x: 0, z: -roomDepth/2 + 2 },
 *   style: { handrails: true, material: 'wood' }
 * }, shadowGenerator);
 * 
 * // Store in connection for runtime use
 * connections.push({
 *   fromRoom: 'basement',
 *   toRoom: 'hallway',
 *   type: 'stairs',
 *   mesh: transition.mesh,
 *   bounds: transition.bounds,
 *   getGroundY: transition.getGroundY,
 *   startY: transition.bottomY,
 *   endY: transition.topY
 * });
 * ```
 * 
 * ## Integration with Movement System
 * 
 * In the game loop, use `getGroundY` to position characters:
 * 
 * ```ts
 * // Check all transitions for ground height
 * for (const conn of connections) {
 *   if (conn.getGroundY && isInBounds(playerX, playerZ, conn.bounds)) {
 *     playerY = conn.getGroundY(playerX, playerZ);
 *     break;
 *   }
 * }
 * ```
 * 
 * @param scene - Babylon.js scene to add meshes to
 * @param config - Transition configuration
 * @param shadowGenerator - Optional shadow generator for shadow casting
 * @returns Object with mesh, bounds, getGroundY function, and Y extents
 */
export function createVerticalTransition(
  scene: Scene,
  config: TransitionConfig,
  shadowGenerator?: ShadowGenerator
): {
  mesh: AbstractMesh;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  getGroundY: (x: number, z: number) => number;
  bottomY: number;
  topY: number;
} {
  const { type, heightDifference, width, direction, position, style } = config;
  
  // Calculate length based on type and height
  const absHeight = Math.abs(heightDifference);
  let length = config.length;
  if (!length) {
    // Standard ratios for comfortable traversal
    length = type === 'stairs' ? absHeight * 1.8 : absHeight * 3;
  }
  
  const root = new TransformNode(`transition_${type}`, scene);
  
  // Material based on style
  const mat = new StandardMaterial(`${type}Mat`, scene);
  switch (style?.material) {
    case 'stone':
      mat.diffuseColor = new Color3(0.45, 0.43, 0.4);
      break;
    case 'metal':
      mat.diffuseColor = new Color3(0.5, 0.5, 0.52);
      mat.specularColor = new Color3(0.3, 0.3, 0.3);
      break;
    case 'wood':
    default:
      mat.diffuseColor = new Color3(0.4, 0.32, 0.25);
      break;
  }
  
  const goingUp = heightDifference > 0;
  const bottomY = goingUp ? 0 : -absHeight;
  const topY = goingUp ? absHeight : 0;
  
  if (type === 'stairs') {
    // Create stepped geometry
    const stepCount = Math.ceil(absHeight / 0.2); // ~0.2 units per step
    const stepHeight = absHeight / stepCount;
    const stepDepth = length / stepCount;
    
    for (let i = 0; i < stepCount; i++) {
      const step = MeshBuilder.CreateBox(`step_${i}`, {
        width: width,
        height: stepHeight,
        depth: stepDepth
      }, scene);
      step.material = mat;
      
      // Position based on direction
      let x = 0, z = 0;
      switch (direction) {
        case 'north':
          z = -length / 2 + (i + 0.5) * stepDepth;
          break;
        case 'south':
          z = length / 2 - (i + 0.5) * stepDepth;
          break;
        case 'east':
          x = -length / 2 + (i + 0.5) * stepDepth;
          break;
        case 'west':
          x = length / 2 - (i + 0.5) * stepDepth;
          break;
      }
      
      step.position.set(x, goingUp ? i * stepHeight + stepHeight / 2 : bottomY + i * stepHeight + stepHeight / 2, z);
      step.parent = root;
      
      if (shadowGenerator) shadowGenerator.addShadowCaster(step);
    }
    
    // Add handrails if requested
    if (style?.handrails) {
      const railMat = new StandardMaterial('railMat', scene);
      railMat.diffuseColor = new Color3(0.3, 0.25, 0.2);
      
      [-1, 1].forEach(side => {
        const rail = MeshBuilder.CreateBox(`rail_${side}`, {
          width: 0.05,
          height: 0.8,
          depth: length
        }, scene);
        rail.material = railMat;
        
        const xOffset = side * (width / 2 + 0.025);
        rail.position.set(
          direction === 'east' || direction === 'west' ? 0 : xOffset,
          absHeight / 2 + 0.4,
          direction === 'north' || direction === 'south' ? 0 : xOffset
        );
        rail.rotation.x = Math.atan2(absHeight, length) * (goingUp ? 1 : -1);
        rail.parent = root;
      });
    }
  } else {
    // Ramp - single sloped surface
    // Create ramp using a rotated box
    const ramp = MeshBuilder.CreateBox('ramp', {
      width: width,
      height: 0.15,
      depth: Math.sqrt(length * length + absHeight * absHeight)
    }, scene);
    ramp.material = mat;
    
    // Calculate slope angle
    const angle = Math.atan2(absHeight, length);
    
    switch (direction) {
      case 'north':
        ramp.rotation.x = goingUp ? angle : -angle;
        ramp.position.set(0, absHeight / 2, 0);
        break;
      case 'south':
        ramp.rotation.x = goingUp ? -angle : angle;
        ramp.position.set(0, absHeight / 2, 0);
        break;
      case 'east':
        ramp.rotation.z = goingUp ? -angle : angle;
        ramp.position.set(0, absHeight / 2, 0);
        break;
      case 'west':
        ramp.rotation.z = goingUp ? angle : -angle;
        ramp.position.set(0, absHeight / 2, 0);
        break;
    }
    
    ramp.parent = root;
    if (shadowGenerator) shadowGenerator.addShadowCaster(ramp);
    
    // Add edge rails for ramps
    if (style?.handrails) {
      const railMat = new StandardMaterial('railMat', scene);
      railMat.diffuseColor = new Color3(0.35, 0.3, 0.25);
      
      [-1, 1].forEach(side => {
        const rail = MeshBuilder.CreateBox(`rail_${side}`, {
          width: 0.04,
          height: 0.6,
          depth: Math.sqrt(length * length + absHeight * absHeight)
        }, scene);
        rail.material = railMat;
        rail.rotation = ramp.rotation.clone();
        
        const xOffset = side * (width / 2 + 0.02);
        rail.position.set(
          direction === 'east' || direction === 'west' ? 0 : xOffset,
          absHeight / 2 + 0.3,
          direction === 'north' || direction === 'south' ? 0 : xOffset
        );
        rail.parent = root;
      });
    }
  }
  
  // Position the root
  root.position.set(position.x, 0, position.z);
  
  // Calculate bounds
  let bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  switch (direction) {
    case 'north':
      bounds = {
        minX: position.x - width / 2,
        maxX: position.x + width / 2,
        minZ: position.z - length / 2,
        maxZ: position.z + length / 2
      };
      break;
    case 'south':
      bounds = {
        minX: position.x - width / 2,
        maxX: position.x + width / 2,
        minZ: position.z - length / 2,
        maxZ: position.z + length / 2
      };
      break;
    case 'east':
      bounds = {
        minX: position.x - length / 2,
        maxX: position.x + length / 2,
        minZ: position.z - width / 2,
        maxZ: position.z + width / 2
      };
      break;
    case 'west':
    default:
      bounds = {
        minX: position.x - length / 2,
        maxX: position.x + length / 2,
        minZ: position.z - width / 2,
        maxZ: position.z + width / 2
      };
      break;
  }
  
  // Ground Y calculation function
  const getGroundY = (x: number, z: number): number => {
    // Check if position is within transition bounds
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
      return bottomY; // Outside bounds
    }
    
    // Calculate progress along transition (0 = bottom, 1 = top)
    let progress: number;
    switch (direction) {
      case 'north':
        progress = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
        break;
      case 'south':
        progress = 1 - (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
        break;
      case 'east':
        progress = (x - bounds.minX) / (bounds.maxX - bounds.minX);
        break;
      case 'west':
        progress = 1 - (x - bounds.minX) / (bounds.maxX - bounds.minX);
        break;
      default:
        progress = 0;
    }
    
    // Clamp progress
    progress = Math.max(0, Math.min(1, progress));
    
    // Return interpolated Y
    return bottomY + progress * absHeight;
  };
  
  return {
    mesh: root as unknown as AbstractMesh,
    bounds,
    getGroundY,
    bottomY,
    topY
  };
}

/**
 * @deprecated Use createVerticalTransition instead
 */
function createStairs(
  scene: Scene,
  direction: 'up' | 'down',
  roomSize: { width: number; height: number },
  _floorY: number,
  shadowGenerator?: ShadowGenerator
): AbstractMesh | null {
  // Use new transition system
  const transition = createVerticalTransition(scene, {
    type: 'stairs',
    heightDifference: direction === 'down' ? -4 : 4,
    width: 3,
    direction: 'north',
    position: { x: 0, z: -roomSize.height / 2 + 2 },
    style: { handrails: true, material: 'wood' }
  }, shadowGenerator);
  
  return transition.mesh;
}

function createProp(
  scene: Scene,
  type: string,
  shadowGenerator?: ShadowGenerator
): AbstractMesh | null {
  const mat = new StandardMaterial(`${type}Mat`, scene);
  let mesh: AbstractMesh | null = null;
  
  switch (type) {
    case 'couch':
      mat.diffuseColor = new Color3(0.4, 0.28, 0.2);
      const couch = MeshBuilder.CreateBox('couch', { width: 2.5, height: 0.6, depth: 0.9 }, scene);
      couch.material = mat;
      couch.position.y = 0.3;
      // Backrest
      const back = MeshBuilder.CreateBox('couch_back', { width: 2.5, height: 0.5, depth: 0.2 }, scene);
      back.material = mat;
      back.position.set(0, 0.55, -0.35);
      back.parent = couch;
      mesh = couch;
      break;
      
    case 'table':
      mat.diffuseColor = new Color3(0.35, 0.25, 0.15);
      const tableTop = MeshBuilder.CreateBox('table', { width: 1.2, height: 0.08, depth: 0.8 }, scene);
      tableTop.material = mat;
      tableTop.position.y = 0.45;
      mesh = tableTop;
      break;
      
    case 'chair':
      mat.diffuseColor = new Color3(0.4, 0.3, 0.2);
      const seat = MeshBuilder.CreateBox('chair', { width: 0.5, height: 0.08, depth: 0.5 }, scene);
      seat.material = mat;
      seat.position.y = 0.4;
      mesh = seat;
      break;
      
    case 'lamp':
      mat.diffuseColor = new Color3(0.3, 0.25, 0.2);
      const lampBase = MeshBuilder.CreateCylinder('lamp', { height: 1.2, diameter: 0.15 }, scene);
      lampBase.material = mat;
      lampBase.position.y = 0.6;
      const shadeMat = new StandardMaterial('shade', scene);
      shadeMat.diffuseColor = new Color3(0.9, 0.85, 0.7);
      shadeMat.emissiveColor = new Color3(0.3, 0.25, 0.15);
      const shade = MeshBuilder.CreateCylinder('shade', { 
        height: 0.3, diameterTop: 0.35, diameterBottom: 0.2 
      }, scene);
      shade.material = shadeMat;
      shade.position.y = 1.35;
      shade.parent = lampBase;
      mesh = lampBase;
      break;
      
    case 'counter':
      mat.diffuseColor = new Color3(0.45, 0.38, 0.3);
      mesh = MeshBuilder.CreateBox('counter', { width: 2, height: 0.9, depth: 0.6 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.45;
      break;
      
    default:
      mat.diffuseColor = new Color3(0.4, 0.35, 0.3);
      mesh = MeshBuilder.CreateBox(type, { size: 0.5 }, scene);
      mesh.material = mat;
      mesh.position.y = 0.25;
  }
  
  if (mesh && shadowGenerator) {
    shadowGenerator.addShadowCaster(mesh);
  }
  
  return mesh;
}

// ============================================
// Lighting Setup
// ============================================

export function setupStageLighting(scene: Scene): { shadowGenerator: ShadowGenerator } {
  // Clear color
  scene.clearColor = new Color4(0.08, 0.06, 0.05, 1);
  
  // Ambient light
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.5;
  ambient.groundColor = new Color3(0.15, 0.12, 0.1);
  
  // Main directional light (sun through windows)
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
  sun.intensity = 0.8;
  sun.position = new Vector3(10, 15, 10);
  
  // Shadow generator
  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 32;
  shadowGenerator.darkness = 0.3;
  
  return { shadowGenerator };
}
