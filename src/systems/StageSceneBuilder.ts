/**
 * Stage Scene Builder
 * ===================
 * 
 * Converts a BuiltStage into renderable Babylon.js geometry.
 * This is the bridge between procedural generation and rendering.
 * 
 * ## Responsibilities
 * 
 * - Create floor/wall meshes for each room
 * - Create prop meshes using PropFactory
 * - Create transition geometry (doors, archways, stairs, ramps)
 * - Set up collision boundaries
 * - Configure lighting per room
 * 
 * ## Usage
 * 
 * ```ts
 * const builtStage = buildStage(definition, templates, seed);
 * const renderedStage = renderBuiltStage(scene, builtStage, shadowGenerator);
 * ```
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  ShadowGenerator,
  AbstractMesh
} from '@babylonjs/core';
import { BuiltStage, PlacedRoom, Boundary, FLOOR_HEIGHT } from './StageBuilder';
import { createPropMesh } from './PropFactory';
import { createVerticalTransition } from './StageRenderer';

// ============================================
// Types
// ============================================

export interface RenderedBuiltStage {
  /** Root node containing all stage geometry */
  root: TransformNode;
  
  /** Rendered rooms by ID */
  rooms: Map<string, RenderedRoom>;
  
  /** Rendered boundaries */
  boundaries: RenderedBoundary[];
  
  /** Get ground Y at world position */
  getGroundY: (x: number, z: number) => number;
  
  /** Check if position is walkable */
  isWalkable: (x: number, z: number) => boolean;
  
  /** Dispose all geometry */
  dispose: () => void;
}

export interface RenderedRoom {
  id: string;
  root: TransformNode;
  floor: AbstractMesh;
  walls: TransformNode;
  props: AbstractMesh[];
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
}

export interface RenderedBoundary {
  id: string;
  mesh: AbstractMesh | null;
  type: string;
  getGroundY?: (x: number, z: number) => number;
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// ============================================
// Materials
// ============================================

function createMaterials(scene: Scene) {
  const floor = new StandardMaterial('floorMat', scene);
  floor.diffuseColor = new Color3(0.35, 0.28, 0.2);
  floor.specularColor = new Color3(0.05, 0.05, 0.05);
  
  const wall = new StandardMaterial('wallMat', scene);
  wall.diffuseColor = new Color3(0.55, 0.48, 0.42);
  wall.specularColor = new Color3(0.1, 0.1, 0.1);
  
  const basementFloor = new StandardMaterial('basementFloorMat', scene);
  basementFloor.diffuseColor = new Color3(0.25, 0.22, 0.2);
  
  const basementWall = new StandardMaterial('basementWallMat', scene);
  basementWall.diffuseColor = new Color3(0.35, 0.32, 0.3);
  
  return { floor, wall, basementFloor, basementWall };
}

// ============================================
// Main Render Function
// ============================================

/**
 * Render a BuiltStage into Babylon.js geometry.
 */
export function renderBuiltStage(
  scene: Scene,
  stage: BuiltStage,
  shadowGenerator?: ShadowGenerator
): RenderedBuiltStage {
  const root = new TransformNode('stage_root', scene);
  const materials = createMaterials(scene);
  const renderedRooms = new Map<string, RenderedRoom>();
  const renderedBoundaries: RenderedBoundary[] = [];
  
  // ─────────────────────────────────────────
  // Render each room
  // ─────────────────────────────────────────
  for (const [roomId, room] of stage.rooms) {
    const renderedRoom = renderRoom(scene, room, materials, shadowGenerator);
    renderedRoom.root.parent = root;
    renderedRooms.set(roomId, renderedRoom);
  }
  
  // ─────────────────────────────────────────
  // Render boundaries (doors, archways, transitions)
  // ─────────────────────────────────────────
  for (const boundary of stage.boundaries) {
    const rendered = renderBoundary(scene, boundary, stage, materials, shadowGenerator);
    if (rendered.mesh) {
      (rendered.mesh as TransformNode).parent = root;
    }
    renderedBoundaries.push(rendered);
  }
  
  // ─────────────────────────────────────────
  // Build navigation helpers
  // ─────────────────────────────────────────
  const getGroundY = (x: number, z: number): number => {
    // Check boundaries first (for stairs/ramps)
    for (const boundary of renderedBoundaries) {
      if (boundary.getGroundY && boundary.bounds) {
        if (x >= boundary.bounds.minX && x <= boundary.bounds.maxX &&
            z >= boundary.bounds.minZ && z <= boundary.bounds.maxZ) {
          return boundary.getGroundY(x, z);
        }
      }
    }
    
    // Check rooms
    for (const room of renderedRooms.values()) {
      const b = room.bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return b.minY;
      }
    }
    
    return 0;
  };
  
  const isWalkable = (x: number, z: number): boolean => {
    for (const room of renderedRooms.values()) {
      const b = room.bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return true;
      }
    }
    
    // Check boundary areas (transitions are walkable)
    for (const boundary of renderedBoundaries) {
      if (boundary.bounds) {
        if (x >= boundary.bounds.minX && x <= boundary.bounds.maxX &&
            z >= boundary.bounds.minZ && z <= boundary.bounds.maxZ) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  return {
    root,
    rooms: renderedRooms,
    boundaries: renderedBoundaries,
    getGroundY,
    isWalkable,
    dispose() {
      root.dispose();
    }
  };
}

// ============================================
// Room Rendering
// ============================================

function renderRoom(
  scene: Scene,
  room: PlacedRoom,
  materials: ReturnType<typeof createMaterials>,
  shadowGenerator?: ShadowGenerator
): RenderedRoom {
  const roomRoot = new TransformNode(`room_${room.id}`, scene);
  roomRoot.position.set(
    room.worldPosition.x,
    room.worldPosition.y,
    room.worldPosition.z
  );
  
  const isBasement = room.floor < 0;
  const floorMat = isBasement ? materials.basementFloor : materials.floor;
  const wallMat = isBasement ? materials.basementWall : materials.wall;
  
  // Floor
  const floor = MeshBuilder.CreateGround(`${room.id}_floor`, {
    width: room.size.width,
    height: room.size.height
  }, scene);
  floor.material = floorMat;
  floor.receiveShadows = true;
  floor.parent = roomRoot;
  
  // Walls
  const wallsRoot = new TransformNode(`${room.id}_walls`, scene);
  wallsRoot.parent = roomRoot;
  
  const wallHeight = room.size.ceilingHeight;
  const wallThickness = 0.2;
  
  // Get directions that have connections (no wall there)
  const connectionDirs = new Set(room.connections.map(c => c.direction));
  
  // Create walls, leaving openings for connections
  const wallDirs: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
  
  for (const dir of wallDirs) {
    const hasConnection = connectionDirs.has(dir);
    const isHoriz = dir === 'north' || dir === 'south';
    const length = isHoriz ? room.size.width : room.size.height;
    
    if (hasConnection) {
      // Create wall with opening
      const openingWidth = 2;
      const segmentLength = (length - openingWidth) / 2;
      
      [-1, 1].forEach(side => {
        const seg = MeshBuilder.CreateBox(`${room.id}_wall_${dir}_${side}`, {
          width: isHoriz ? segmentLength : wallThickness,
          height: wallHeight,
          depth: isHoriz ? wallThickness : segmentLength
        }, scene);
        seg.material = wallMat;
        
        const offset = side * (segmentLength / 2 + openingWidth / 2);
        
        switch (dir) {
          case 'north':
            seg.position.set(offset, wallHeight / 2, -room.size.height / 2);
            break;
          case 'south':
            seg.position.set(offset, wallHeight / 2, room.size.height / 2);
            break;
          case 'east':
            seg.position.set(room.size.width / 2, wallHeight / 2, offset);
            break;
          case 'west':
            seg.position.set(-room.size.width / 2, wallHeight / 2, offset);
            break;
        }
        
        seg.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(seg);
      });
    } else {
      // Full wall
      const wall = MeshBuilder.CreateBox(`${room.id}_wall_${dir}`, {
        width: isHoriz ? length : wallThickness,
        height: wallHeight,
        depth: isHoriz ? wallThickness : length
      }, scene);
      wall.material = wallMat;
      
      switch (dir) {
        case 'north':
          wall.position.set(0, wallHeight / 2, -room.size.height / 2);
          break;
        case 'south':
          wall.position.set(0, wallHeight / 2, room.size.height / 2);
          break;
        case 'east':
          wall.position.set(room.size.width / 2, wallHeight / 2, 0);
          break;
        case 'west':
          wall.position.set(-room.size.width / 2, wallHeight / 2, 0);
          break;
      }
      
      wall.parent = wallsRoot;
      if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
    }
  }
  
  // Props
  const props: AbstractMesh[] = [];
  for (const prop of room.props) {
    const mesh = createPropMesh(scene, prop.type, prop.interactive);
    if (mesh) {
      mesh.position.set(prop.position.x, 0, prop.position.z);
      mesh.rotation.y = prop.rotation;
      mesh.parent = roomRoot;
      if (shadowGenerator) shadowGenerator.addShadowCaster(mesh);
      props.push(mesh);
    }
  }
  
  // Calculate world bounds
  const bounds = {
    minX: room.worldPosition.x - room.size.width / 2,
    maxX: room.worldPosition.x + room.size.width / 2,
    minY: room.worldPosition.y,
    maxY: room.worldPosition.y + wallHeight,
    minZ: room.worldPosition.z - room.size.height / 2,
    maxZ: room.worldPosition.z + room.size.height / 2
  };
  
  return {
    id: room.id,
    root: roomRoot,
    floor,
    walls: wallsRoot,
    props,
    bounds
  };
}

// ============================================
// Boundary Rendering
// ============================================

function renderBoundary(
  scene: Scene,
  boundary: Boundary,
  stage: BuiltStage,
  _materials: ReturnType<typeof createMaterials>,
  shadowGenerator?: ShadowGenerator
): RenderedBoundary {
  const roomA = stage.getRoom(boundary.roomA);
  const roomB = stage.getRoom(boundary.roomB);
  
  if (!roomA || !roomB) {
    return { id: boundary.id, mesh: null, type: boundary.transitionType };
  }
  
  switch (boundary.transitionType) {
    case 'stairs':
    case 'ramp': {
      const transition = createVerticalTransition(scene, {
        type: boundary.transitionType === 'stairs' ? 'stairs' : 'ramp',
        heightDifference: boundary.heightDifference || FLOOR_HEIGHT,
        width: boundary.width,
        direction: boundary.direction as any,
        position: { 
          x: boundary.worldPosition.x, 
          z: boundary.worldPosition.z 
        },
        style: { handrails: true, material: 'wood' }
      }, shadowGenerator);
      
      return {
        id: boundary.id,
        mesh: transition.mesh,
        type: boundary.transitionType,
        getGroundY: transition.getGroundY,
        bounds: transition.bounds
      };
    }
    
    case 'wall_door': {
      // Door frame
      const doorMat = new StandardMaterial('doorMat', scene);
      doorMat.diffuseColor = new Color3(0.3, 0.2, 0.15);
      
      const doorFrame = MeshBuilder.CreateBox(`${boundary.id}_frame`, {
        width: boundary.width + 0.2,
        height: 2.2,
        depth: 0.3
      }, scene);
      doorFrame.material = doorMat;
      doorFrame.position.set(
        boundary.worldPosition.x,
        1.1,
        boundary.worldPosition.z
      );
      
      // Rotate based on direction
      if (boundary.direction === 'east' || boundary.direction === 'west') {
        doorFrame.rotation.y = Math.PI / 2;
      }
      
      if (shadowGenerator) shadowGenerator.addShadowCaster(doorFrame);
      
      return { id: boundary.id, mesh: doorFrame, type: 'wall_door' };
    }
    
    case 'wall_archway': {
      // Archway is just an opening - no mesh needed
      return { id: boundary.id, mesh: null, type: 'wall_archway' };
    }
    
    case 'open':
    default:
      return { id: boundary.id, mesh: null, type: boundary.transitionType };
  }
}
