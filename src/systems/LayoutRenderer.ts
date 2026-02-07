/**
 * Layout Renderer
 * ===============
 * 
 * Renders a GeneratedLayout into Babylon.js geometry.
 * Creates floors, walls, props, and connections for each room.
 * 
 * @module LayoutRenderer
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  TransformNode,
  ShadowGenerator,
  AbstractMesh,
  Vector3,
  HemisphericLight,
  DirectionalLight
} from '@babylonjs/core';

import {
  GeneratedLayout,
  GeneratedRoom,
  RoomConnection,
  GRID_CELL_SIZE
} from './LayoutGenerator';
import { createVerticalTransition } from './StageRenderer';
import { createPropMeshAsync } from './PropFactory';

// ============================================
// Types
// ============================================

export interface RenderedLayout {
  root: TransformNode;
  rooms: Map<string, RenderedRoom>;
  connections: RenderedConnection[];
  verticalTransitions: RenderedVerticalTransition[];
  
  getGroundY: (x: number, z: number) => number;
  isWalkable: (x: number, z: number) => boolean;
  getRoomAt: (x: number, z: number) => RenderedRoom | null;
  
  dispose: () => void;
}

export interface RenderedRoom {
  id: string;
  root: TransformNode;
  floor: AbstractMesh;
  walls: TransformNode;
  ceiling?: AbstractMesh;
  props: AbstractMesh[];
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  groundY: number;
}

export interface RenderedConnection {
  id: string;
  mesh: AbstractMesh | null;
  type: string;
}

export interface RenderedVerticalTransition {
  id: string;
  mesh: AbstractMesh;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  getGroundY: (x: number, z: number) => number;
  bottomY: number;
  topY: number;
}

// ============================================
// Materials
// ============================================

interface MaterialSet {
  floor: StandardMaterial;
  wall: StandardMaterial;
  ceiling: StandardMaterial;
  door: StandardMaterial;
}

function createMaterialSet(scene: Scene, palette: 'normal' | 'basement' | 'horror'): MaterialSet {
  const colors = {
    normal: {
      floor: new Color3(0.35, 0.28, 0.2),
      wall: new Color3(0.55, 0.48, 0.42),
      ceiling: new Color3(0.65, 0.6, 0.55)
    },
    basement: {
      floor: new Color3(0.25, 0.22, 0.2),
      wall: new Color3(0.35, 0.32, 0.3),
      ceiling: new Color3(0.3, 0.28, 0.26)
    },
    horror: {
      floor: new Color3(0.2, 0.15, 0.12),
      wall: new Color3(0.3, 0.25, 0.22),
      ceiling: new Color3(0.25, 0.2, 0.18)
    }
  };
  
  const c = colors[palette];
  
  const floor = new StandardMaterial(`${palette}Floor`, scene);
  floor.diffuseColor = c.floor;
  floor.specularColor = new Color3(0.05, 0.05, 0.05);
  
  const wall = new StandardMaterial(`${palette}Wall`, scene);
  wall.diffuseColor = c.wall;
  wall.specularColor = new Color3(0.1, 0.1, 0.1);
  
  const ceiling = new StandardMaterial(`${palette}Ceiling`, scene);
  ceiling.diffuseColor = c.ceiling;
  ceiling.specularColor = new Color3(0.05, 0.05, 0.05);
  
  const door = new StandardMaterial(`${palette}Door`, scene);
  door.diffuseColor = new Color3(0.3, 0.2, 0.15);
  door.specularColor = new Color3(0.15, 0.1, 0.08);
  
  return { floor, wall, ceiling, door };
}

// ============================================
// Main Render Function
// ============================================

/**
 * Render a GeneratedLayout into Babylon.js scene.
 */
export interface RenderLayoutOptions {
  skipProps?: boolean;
}

export async function renderLayout(
  scene: Scene,
  layout: GeneratedLayout,
  shadowGenerator?: ShadowGenerator,
  options?: RenderLayoutOptions
): Promise<RenderedLayout> {
  const root = new TransformNode('layout_root', scene);
  const renderedRooms = new Map<string, RenderedRoom>();
  const renderedConnections: RenderedConnection[] = [];
  const verticalTransitions: RenderedVerticalTransition[] = [];
  
  // Create material sets
  const normalMats = createMaterialSet(scene, 'normal');
  const basementMats = createMaterialSet(scene, 'basement');
  const horrorMats = createMaterialSet(scene, 'horror');
  
  // Get connected rooms for each room (to know where to create openings)
  const roomConnections = new Map<string, Set<string>>();
  for (const room of layout.rooms.values()) {
    roomConnections.set(room.id, new Set(room.connections));
  }
  
  // Also add connections from explicit connection list
  for (const conn of layout.connections) {
    roomConnections.get(conn.fromRoom)?.add(conn.toRoom);
    roomConnections.get(conn.toRoom)?.add(conn.fromRoom);
  }
  
  // Render each room
  for (const [roomId, room] of layout.rooms) {
    // Choose materials based on level and atmosphere
    let mats = normalMats;
    if (room.level < 0) {
      mats = basementMats;
    }
    if (room.atmosphere?.preset === 'horror' || room.atmosphere?.bloodSplatter) {
      mats = horrorMats;
    }
    
    // Get connection directions for wall openings
    const connectionDirections = getConnectionDirections(room, layout, roomConnections.get(roomId) || new Set());
    
    const rendered = await renderRoom(scene, room, mats, connectionDirections, shadowGenerator, options?.skipProps);
    rendered.root.parent = root;
    renderedRooms.set(roomId, rendered);
  }
  
  // Render horizontal connections (doors, archways)
  for (const conn of layout.connections) {
    const rendered = renderConnection(scene, conn, layout, normalMats.door, shadowGenerator);
    if (rendered.mesh) {
      rendered.mesh.parent = root;
    }
    renderedConnections.push(rendered);
  }
  
  // Render vertical transitions (stairs, ramps)
  for (const vc of layout.verticalConnections) {
    const upperRoom = layout.rooms.get(vc.upperRoom);
    const lowerRoom = layout.rooms.get(vc.lowerRoom);
    
    if (!upperRoom || !lowerRoom) continue;
    
    const transition = createVerticalTransition(scene, {
      type: vc.type === 'stairs' ? 'stairs' : 'ramp',
      heightDifference: vc.heightDifference,
      width: 3,
      direction: 'north',
      position: {
        x: vc.position.x * GRID_CELL_SIZE,
        z: vc.position.z * GRID_CELL_SIZE
      },
      style: {
        handrails: true,
        material: 'wood'
      }
    }, shadowGenerator);
    
    transition.mesh.parent = root;
    
    verticalTransitions.push({
      id: vc.id,
      mesh: transition.mesh,
      bounds: transition.bounds,
      getGroundY: transition.getGroundY,
      bottomY: transition.bottomY,
      topY: transition.topY
    });
  }
  
  // Build navigation helpers
  const getGroundY = (x: number, z: number): number => {
    // Check vertical transitions first
    for (const vt of verticalTransitions) {
      if (x >= vt.bounds.minX && x <= vt.bounds.maxX &&
          z >= vt.bounds.minZ && z <= vt.bounds.maxZ) {
        return vt.getGroundY(x, z);
      }
    }
    
    // Check rooms
    for (const room of renderedRooms.values()) {
      if (x >= room.bounds.minX && x <= room.bounds.maxX &&
          z >= room.bounds.minZ && z <= room.bounds.maxZ) {
        return room.groundY;
      }
    }
    
    return 0;
  };
  
  const isWalkable = (x: number, z: number): boolean => {
    // Check rooms
    for (const room of renderedRooms.values()) {
      if (x >= room.bounds.minX && x <= room.bounds.maxX &&
          z >= room.bounds.minZ && z <= room.bounds.maxZ) {
        return true;
      }
    }
    
    // Check vertical transitions
    for (const vt of verticalTransitions) {
      if (x >= vt.bounds.minX && x <= vt.bounds.maxX &&
          z >= vt.bounds.minZ && z <= vt.bounds.maxZ) {
        return true;
      }
    }
    
    return false;
  };
  
  const getRoomAt = (x: number, z: number): RenderedRoom | null => {
    for (const room of renderedRooms.values()) {
      if (x >= room.bounds.minX && x <= room.bounds.maxX &&
          z >= room.bounds.minZ && z <= room.bounds.maxZ) {
        return room;
      }
    }
    return null;
  };
  
  return {
    root,
    rooms: renderedRooms,
    connections: renderedConnections,
    verticalTransitions,
    getGroundY,
    isWalkable,
    getRoomAt,
    dispose() {
      root.dispose();
    }
  };
}

// ============================================
// Room Rendering
// ============================================

function getConnectionDirections(
  room: GeneratedRoom,
  layout: GeneratedLayout,
  connectedRooms: Set<string>
): Set<'north' | 'south' | 'east' | 'west' | 'up' | 'down'> {
  const directions = new Set<'north' | 'south' | 'east' | 'west' | 'up' | 'down'>();
  
  // Check for horizontal connections
  for (const connectedId of connectedRooms) {
    const connected = layout.rooms.get(connectedId);
    if (!connected || connected.level !== room.level) continue;
    
    const dx = connected.gridPosition.x - room.gridPosition.x;
    const dz = connected.gridPosition.z - room.gridPosition.z;
    
    if (dx === 1 && dz === 0) directions.add('east');
    if (dx === -1 && dz === 0) directions.add('west');
    if (dx === 0 && dz === 1) directions.add('south');
    if (dx === 0 && dz === -1) directions.add('north');
  }
  
  // Check for vertical connections
  for (const vc of layout.verticalConnections) {
    if (vc.upperRoom === room.id) directions.add('down');
    if (vc.lowerRoom === room.id) directions.add('up');
  }
  
  return directions;
}

async function renderRoom(
  scene: Scene,
  room: GeneratedRoom,
  mats: MaterialSet,
  connectionDirections: Set<'north' | 'south' | 'east' | 'west' | 'up' | 'down'>,
  shadowGenerator?: ShadowGenerator,
  skipProps?: boolean
): Promise<RenderedRoom> {
  const roomRoot = new TransformNode(`room_${room.id}`, scene);
  roomRoot.position.set(
    room.worldPosition.x,
    room.worldPosition.y,
    room.worldPosition.z
  );
  
  const { width, height, ceilingHeight } = room.size;
  const wallThickness = 0.2;
  
  // Floor
  const floor = MeshBuilder.CreateGround(`${room.id}_floor`, {
    width,
    height
  }, scene);
  floor.material = mats.floor;
  floor.receiveShadows = true;
  floor.parent = roomRoot;
  
  // Walls
  const wallsRoot = new TransformNode(`${room.id}_walls`, scene);
  wallsRoot.parent = roomRoot;
  
  const wallDirs: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
  
  for (const dir of wallDirs) {
    const hasOpening = connectionDirections.has(dir);
    const isHoriz = dir === 'north' || dir === 'south';
    const length = isHoriz ? width : height;
    
    if (hasOpening) {
      // Create wall with opening
      const openingWidth = 2;
      const segmentLength = (length - openingWidth) / 2;
      
      if (segmentLength > 0) {
        [-1, 1].forEach(side => {
          const seg = MeshBuilder.CreateBox(`${room.id}_wall_${dir}_${side}`, {
            width: isHoriz ? segmentLength : wallThickness,
            height: ceilingHeight,
            depth: isHoriz ? wallThickness : segmentLength
          }, scene);
          seg.material = mats.wall;
          
          const offset = side * (segmentLength / 2 + openingWidth / 2);
          
          switch (dir) {
            case 'north':
              seg.position.set(offset, ceilingHeight / 2, -height / 2);
              break;
            case 'south':
              seg.position.set(offset, ceilingHeight / 2, height / 2);
              break;
            case 'east':
              seg.position.set(width / 2, ceilingHeight / 2, offset);
              break;
            case 'west':
              seg.position.set(-width / 2, ceilingHeight / 2, offset);
              break;
          }
          
          seg.parent = wallsRoot;
          if (shadowGenerator) shadowGenerator.addShadowCaster(seg);
        });
      }
    } else {
      // Full wall
      const wall = MeshBuilder.CreateBox(`${room.id}_wall_${dir}`, {
        width: isHoriz ? length : wallThickness,
        height: ceilingHeight,
        depth: isHoriz ? wallThickness : length
      }, scene);
      wall.material = mats.wall;
      
      switch (dir) {
        case 'north':
          wall.position.set(0, ceilingHeight / 2, -height / 2);
          break;
        case 'south':
          wall.position.set(0, ceilingHeight / 2, height / 2);
          break;
        case 'east':
          wall.position.set(width / 2, ceilingHeight / 2, 0);
          break;
        case 'west':
          wall.position.set(-width / 2, ceilingHeight / 2, 0);
          break;
      }
      
      wall.parent = wallsRoot;
      if (shadowGenerator) shadowGenerator.addShadowCaster(wall);
    }
  }
  
  // Props (skipped when GameRenderer creates its own interactive props)
  const props: AbstractMesh[] = [];
  if (!skipProps) {
    for (const prop of room.props) {
      const mesh = await createPropMeshAsync(scene, prop.type, true);
      mesh.position.set(prop.position.x, 0, prop.position.z);
      mesh.rotation.y = prop.rotation;
      mesh.parent = roomRoot;
      if (shadowGenerator) shadowGenerator.addShadowCaster(mesh);
      props.push(mesh);
    }
  }
  
  // Blood splatter effect
  if (room.atmosphere?.bloodSplatter) {
    const bloodMat = new StandardMaterial('blood', scene);
    bloodMat.diffuseColor = new Color3(0.4, 0.05, 0.05);
    bloodMat.specularColor = new Color3(0.2, 0.02, 0.02);
    
    // Add blood splatters on floor
    for (let i = 0; i < 3; i++) {
      const splatter = MeshBuilder.CreateDisc(`blood_${i}`, {
        radius: 0.3 + Math.random() * 0.5
      }, scene);
      splatter.material = bloodMat;
      splatter.rotation.x = Math.PI / 2;
      splatter.position.set(
        (Math.random() - 0.5) * width * 0.6,
        0.01,
        (Math.random() - 0.5) * height * 0.6
      );
      splatter.parent = roomRoot;
    }
  }
  
  // Calculate bounds
  const bounds = {
    minX: room.worldPosition.x - width / 2,
    maxX: room.worldPosition.x + width / 2,
    minY: room.worldPosition.y,
    maxY: room.worldPosition.y + ceilingHeight,
    minZ: room.worldPosition.z - height / 2,
    maxZ: room.worldPosition.z + height / 2
  };
  
  return {
    id: room.id,
    root: roomRoot,
    floor,
    walls: wallsRoot,
    props,
    bounds,
    groundY: room.worldPosition.y
  };
}

// ============================================
// Connection Rendering
// ============================================

function renderConnection(
  scene: Scene,
  conn: RoomConnection,
  layout: GeneratedLayout,
  doorMat: StandardMaterial,
  shadowGenerator?: ShadowGenerator
): RenderedConnection {
  const fromRoom = layout.rooms.get(conn.fromRoom);
  const toRoom = layout.rooms.get(conn.toRoom);
  
  if (!fromRoom || !toRoom) {
    return { id: conn.id, mesh: null, type: conn.type };
  }
  
  // Calculate midpoint between rooms
  const midX = (fromRoom.worldPosition.x + toRoom.worldPosition.x) / 2;
  const midZ = (fromRoom.worldPosition.z + toRoom.worldPosition.z) / 2;
  const y = fromRoom.worldPosition.y;
  
  if (conn.type === 'wall_door') {
    // Create door frame
    const doorFrame = MeshBuilder.CreateBox(`${conn.id}_frame`, {
      width: 2.2,
      height: 2.2,
      depth: 0.3
    }, scene);
    doorFrame.material = doorMat;
    doorFrame.position.set(midX, y + 1.1, midZ);
    
    // Rotate based on direction
    if (conn.direction === 'east' || conn.direction === 'west') {
      doorFrame.rotation.y = Math.PI / 2;
    }
    
    if (shadowGenerator) shadowGenerator.addShadowCaster(doorFrame);
    
    return { id: conn.id, mesh: doorFrame, type: 'wall_door' };
  }
  
  // Archway and open connections don't need mesh
  return { id: conn.id, mesh: null, type: conn.type };
}

// ============================================
// Lighting Setup
// ============================================

export function setupLayoutLighting(scene: Scene): { shadowGenerator: ShadowGenerator } {
  scene.clearColor = new Color4(0.08, 0.06, 0.05, 1);
  
  // Ambient light
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.5;
  ambient.groundColor = new Color3(0.15, 0.12, 0.1);
  
  // Main directional light
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
