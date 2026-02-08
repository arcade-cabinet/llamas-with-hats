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
  DirectionalLight,
  PointLight
} from '@babylonjs/core';

import {
  GeneratedLayout,
  GeneratedRoom,
  RoomConnection,
} from './LayoutGenerator';
import { createVerticalTransition } from './StageRenderer';
import { createPropMeshAsync } from './PropFactory';
import {
  getTexturesForRoom,
  createFloorMaterial,
  createWallMaterial,
} from './TextureLoader';

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
  /** Enable only current room + adjacent rooms, disable all others */
  updateRoomVisibility: (currentRoomId: string) => void;

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
  mesh: AbstractMesh | TransformNode | null;
  type: string;
  /** Walkable corridor bounds between rooms (world coords) */
  corridorBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Room IDs this corridor connects — used by getRoomAt to resolve which room the player is entering */
  connectedRooms?: { from: string; to: string };
  groundY?: number;
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
    const rendered = renderConnection(scene, conn, layout, normalMats.floor, normalMats.wall, normalMats.ceiling, shadowGenerator);
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
        x: vc.position.x,
        z: vc.position.z
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
  
  // Build navigation helpers — check rooms, corridors, and vertical transitions

  const pointInBounds = (x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
    x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

  const getGroundY = (x: number, z: number): number => {
    // Check vertical transitions first
    for (const vt of verticalTransitions) {
      if (pointInBounds(x, z, vt.bounds)) return vt.getGroundY(x, z);
    }
    // Check rooms
    for (const room of renderedRooms.values()) {
      if (pointInBounds(x, z, room.bounds)) return room.groundY;
    }
    // Check corridors
    for (const conn of renderedConnections) {
      if (conn.corridorBounds && pointInBounds(x, z, conn.corridorBounds)) {
        return conn.groundY ?? 0;
      }
    }
    return 0;
  };

  const isWalkable = (x: number, z: number): boolean => {
    // Check rooms
    for (const room of renderedRooms.values()) {
      if (pointInBounds(x, z, room.bounds)) return true;
    }
    // Check corridors between rooms
    for (const conn of renderedConnections) {
      if (conn.corridorBounds && pointInBounds(x, z, conn.corridorBounds)) return true;
    }
    // Check vertical transitions
    for (const vt of verticalTransitions) {
      if (pointInBounds(x, z, vt.bounds)) return true;
    }
    return false;
  };

  const getRoomAt = (x: number, z: number): RenderedRoom | null => {
    // Check rooms first (exact match)
    for (const room of renderedRooms.values()) {
      if (pointInBounds(x, z, room.bounds)) return room;
    }
    // Check corridors — return the room the player is closer to
    for (const conn of renderedConnections) {
      if (conn.corridorBounds && conn.connectedRooms && pointInBounds(x, z, conn.corridorBounds)) {
        const fromRoom = renderedRooms.get(conn.connectedRooms.from);
        const toRoom = renderedRooms.get(conn.connectedRooms.to);
        if (!fromRoom && !toRoom) return null;
        if (!fromRoom) return toRoom!;
        if (!toRoom) return fromRoom;
        // Return whichever room center is closer
        const distFrom = Math.abs(x - (fromRoom.bounds.minX + fromRoom.bounds.maxX) / 2) +
                          Math.abs(z - (fromRoom.bounds.minZ + fromRoom.bounds.maxZ) / 2);
        const distTo = Math.abs(x - (toRoom.bounds.minX + toRoom.bounds.maxX) / 2) +
                        Math.abs(z - (toRoom.bounds.minZ + toRoom.bounds.maxZ) / 2);
        return distTo < distFrom ? toRoom : fromRoom;
      }
    }
    return null;
  };
  
  // Build adjacency map from connections for room visibility culling
  const adjacencyMap = new Map<string, Set<string>>();
  for (const conn of renderedConnections) {
    if (!conn.connectedRooms) continue;
    const { from, to } = conn.connectedRooms;
    if (!adjacencyMap.has(from)) adjacencyMap.set(from, new Set());
    if (!adjacencyMap.has(to)) adjacencyMap.set(to, new Set());
    adjacencyMap.get(from)!.add(to);
    adjacencyMap.get(to)!.add(from);
  }

  // Track which connections link which rooms (for corridor visibility)
  const connectionRoomPairs = renderedConnections
    .filter(c => c.connectedRooms)
    .map(c => ({ conn: c, from: c.connectedRooms!.from, to: c.connectedRooms!.to }));

  const updateRoomVisibility = (currentRoomId: string): void => {
    // Determine visible room IDs: current + adjacent
    const visibleRooms = new Set<string>([currentRoomId]);
    const adjacent = adjacencyMap.get(currentRoomId);
    if (adjacent) {
      for (const id of adjacent) visibleRooms.add(id);
    }

    // Enable/disable room roots
    for (const [roomId, room] of renderedRooms) {
      room.root.setEnabled(visibleRooms.has(roomId));
    }

    // Enable corridors between visible rooms, disable others
    for (const { conn, from, to } of connectionRoomPairs) {
      const visible = visibleRooms.has(from) && visibleRooms.has(to);
      if (conn.mesh) conn.mesh.setEnabled(visible);
    }
  };

  return {
    root,
    rooms: renderedRooms,
    connections: renderedConnections,
    verticalTransitions,
    getGroundY,
    isWalkable,
    getRoomAt,
    updateRoomVisibility,
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
  const DOOR_HEIGHT = 2.2;
  const FRAME_TRIM = 0.08;

  // Resolve PBR textures for this room type (falls back to flat material if unavailable)
  const texMapping = getTexturesForRoom(room.id, room.templateId);
  const pbrFloor = createFloorMaterial(scene, texMapping.floor, width, height);
  const pbrWall = createWallMaterial(scene, texMapping.wall, width, ceilingHeight);
  const floorMat = pbrFloor ?? mats.floor;
  const wallMat = pbrWall ?? mats.wall;

  // Floor
  const floor = MeshBuilder.CreateGround(`${room.id}_floor`, {
    width,
    height
  }, scene);
  floor.material = floorMat;
  floor.receiveShadows = true;
  floor.parent = roomRoot;

  // Ceiling
  const ceiling = MeshBuilder.CreateGround(`${room.id}_ceiling`, {
    width,
    height
  }, scene);
  ceiling.position.y = ceilingHeight;
  ceiling.rotation.x = Math.PI; // flip normals downward so ceiling is visible from below
  ceiling.material = mats.ceiling;
  ceiling.parent = roomRoot;

  // Walls
  const wallsRoot = new TransformNode(`${room.id}_walls`, scene);
  wallsRoot.parent = roomRoot;

  // Per-room point light for spatial differentiation
  const roomLight = createRoomPointLight(scene, room, ceilingHeight);
  if (roomLight) {
    roomLight.parent = roomRoot;
  }

  const wallDirs: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];

  for (const dir of wallDirs) {
    const hasOpening = connectionDirections.has(dir);
    const isHoriz = dir === 'north' || dir === 'south';
    const length = isHoriz ? width : height;

    if (hasOpening) {
      // Create wall with door-height opening: two side segments + lintel above + door frame trim
      const openingWidth = 3;
      const segmentLength = (length - openingWidth) / 2;

      // Wall position along the wall's normal axis
      const wallPos = dir === 'north' ? -height / 2
        : dir === 'south' ? height / 2
        : dir === 'east' ? width / 2
        : -width / 2;

      // 1. Two side segments (full ceiling height, flanking the opening)
      if (segmentLength > 0) {
        [-1, 1].forEach(side => {
          const seg = MeshBuilder.CreateBox(`${room.id}_wall_${dir}_${side}`, {
            width: isHoriz ? segmentLength : wallThickness,
            height: ceilingHeight,
            depth: isHoriz ? wallThickness : segmentLength
          }, scene);
          seg.material = wallMat;

          const offset = side * (segmentLength / 2 + openingWidth / 2);

          if (isHoriz) {
            seg.position.set(offset, ceilingHeight / 2, wallPos);
          } else {
            seg.position.set(wallPos, ceilingHeight / 2, offset);
          }

          seg.parent = wallsRoot;
          if (shadowGenerator) shadowGenerator.addShadowCaster(seg);
        });
      }

      // 2. Lintel above the opening (spans openingWidth, from DOOR_HEIGHT to ceilingHeight)
      const lintelHeight = ceilingHeight - DOOR_HEIGHT;
      if (lintelHeight > 0.01) {
        const lintel = MeshBuilder.CreateBox(`${room.id}_lintel_${dir}`, {
          width: isHoriz ? openingWidth : wallThickness,
          height: lintelHeight,
          depth: isHoriz ? wallThickness : openingWidth
        }, scene);
        lintel.material = wallMat;

        const lintelY = DOOR_HEIGHT + lintelHeight / 2;
        if (isHoriz) {
          lintel.position.set(0, lintelY, wallPos);
        } else {
          lintel.position.set(wallPos, lintelY, 0);
        }

        lintel.parent = wallsRoot;
        if (shadowGenerator) shadowGenerator.addShadowCaster(lintel);
      }

      // 3. Door frame trim (decorative posts and header at the opening)
      const frameDepth = wallThickness + 0.02;
      // Two vertical posts
      [-1, 1].forEach(side => {
        const post = MeshBuilder.CreateBox(`${room.id}_frame_${dir}_${side}`, {
          width: isHoriz ? FRAME_TRIM : frameDepth,
          height: DOOR_HEIGHT,
          depth: isHoriz ? frameDepth : FRAME_TRIM
        }, scene);
        post.material = mats.door;

        const postOffset = side * openingWidth / 2;
        if (isHoriz) {
          post.position.set(postOffset, DOOR_HEIGHT / 2, wallPos);
        } else {
          post.position.set(wallPos, DOOR_HEIGHT / 2, postOffset);
        }

        post.parent = wallsRoot;
      });
      // Horizontal header
      const header = MeshBuilder.CreateBox(`${room.id}_header_${dir}`, {
        width: isHoriz ? openingWidth : frameDepth,
        height: FRAME_TRIM,
        depth: isHoriz ? frameDepth : openingWidth
      }, scene);
      header.material = mats.door;
      if (isHoriz) {
        header.position.set(0, DOOR_HEIGHT, wallPos);
      } else {
        header.position.set(wallPos, DOOR_HEIGHT, 0);
      }
      header.parent = wallsRoot;
    } else {
      // Full wall
      const wall = MeshBuilder.CreateBox(`${room.id}_wall_${dir}`, {
        width: isHoriz ? length : wallThickness,
        height: ceilingHeight,
        depth: isHoriz ? wallThickness : length
      }, scene);
      wall.material = wallMat;

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
    ceiling,
    walls: wallsRoot,
    props,
    bounds,
    groundY: room.worldPosition.y
  };
}

// ============================================
// Room Lighting
// ============================================

/**
 * Create a point light for a room based on its type and atmosphere.
 * Gives each room a distinct lighting feel:
 * - Bedrooms/living rooms: warm yellow-orange
 * - Kitchens/bathrooms: cool white
 * - Basements/storage: dim blue-gray
 * - Horror rooms: flickering red accent
 * - Outdoor rooms: no point light (rely on sun)
 */
function createRoomPointLight(
  scene: Scene,
  room: GeneratedRoom,
  ceilingHeight: number
): PointLight | null {
  const id = room.id.toLowerCase();
  const template = room.templateId.toLowerCase();
  const isHorror = room.atmosphere?.preset === 'horror' || room.atmosphere?.bloodSplatter;

  // Outdoor rooms use ambient/directional only
  if (template.includes('street') || template.includes('yard') ||
      template.includes('alley') || template.includes('parking') ||
      template.includes('plaza') || template.includes('city')) {
    return null;
  }

  const light = new PointLight(`light_${room.id}`, new Vector3(0, ceilingHeight - 0.3, 0), scene);
  light.range = Math.max(room.size.width, room.size.height) * 1.2;

  if (isHorror) {
    light.diffuse = new Color3(0.8, 0.25, 0.15);
    light.intensity = 0.6;
  } else if (room.level < 0 || id.includes('basement') || id.includes('storage') || template.includes('basement')) {
    light.diffuse = new Color3(0.5, 0.55, 0.65);
    light.intensity = 0.35;
  } else if (id.includes('kitchen') || id.includes('bathroom') || template.includes('kitchen') || template.includes('bathroom')) {
    light.diffuse = new Color3(0.95, 0.95, 1.0);
    light.intensity = 0.5;
  } else if (id.includes('bedroom') || id.includes('living') || id.includes('lounge') || template.includes('bedroom')) {
    light.diffuse = new Color3(1.0, 0.88, 0.7);
    light.intensity = 0.45;
  } else if (id.includes('hallway') || id.includes('corridor') || template.includes('hallway')) {
    light.diffuse = new Color3(0.9, 0.85, 0.75);
    light.intensity = 0.3;
  } else {
    light.diffuse = new Color3(0.95, 0.9, 0.8);
    light.intensity = 0.4;
  }

  return light;
}

// ============================================
// Connection Rendering
// ============================================

function renderConnection(
  scene: Scene,
  conn: RoomConnection,
  layout: GeneratedLayout,
  floorMat: StandardMaterial,
  wallMat: StandardMaterial,
  ceilingMat: StandardMaterial,
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

  // ── Compute corridor bounds (the gap between the two rooms' edges) ──
  const OPENING_WIDTH = 3; // must match wall opening width in renderRoom
  const isEastWest = conn.direction === 'east' || conn.direction === 'west';

  let corridorBounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  if (isEastWest) {
    // Corridor runs along X between the east edge of one room and west edge of the other
    const leftRoom = fromRoom.worldPosition.x < toRoom.worldPosition.x ? fromRoom : toRoom;
    const rightRoom = leftRoom === fromRoom ? toRoom : fromRoom;
    const leftEdge = leftRoom.worldPosition.x + leftRoom.size.width / 2;
    const rightEdge = rightRoom.worldPosition.x - rightRoom.size.width / 2;
    corridorBounds = {
      minX: leftEdge,
      maxX: rightEdge,
      minZ: midZ - OPENING_WIDTH / 2,
      maxZ: midZ + OPENING_WIDTH / 2,
    };
  } else {
    // Corridor runs along Z between north edge of one room and south edge of the other
    const topRoom = fromRoom.worldPosition.z < toRoom.worldPosition.z ? fromRoom : toRoom;
    const bottomRoom = topRoom === fromRoom ? toRoom : fromRoom;
    const topEdge = topRoom.worldPosition.z + topRoom.size.height / 2;
    const bottomEdge = bottomRoom.worldPosition.z - bottomRoom.size.height / 2;
    corridorBounds = {
      minX: midX - OPENING_WIDTH / 2,
      maxX: midX + OPENING_WIDTH / 2,
      minZ: topEdge,
      maxZ: bottomEdge,
    };
  }

  // Normalize (ensure min < max)
  if (corridorBounds.minX > corridorBounds.maxX) {
    [corridorBounds.minX, corridorBounds.maxX] = [corridorBounds.maxX, corridorBounds.minX];
  }
  if (corridorBounds.minZ > corridorBounds.maxZ) {
    [corridorBounds.minZ, corridorBounds.maxZ] = [corridorBounds.maxZ, corridorBounds.minZ];
  }

  // ── Gap-aware corridor rendering ──
  // With tight positioning, the gap is typically ~WALL_GAP (0.2).
  // Door frames are now rendered as room wall trim (Part 4), so we only
  // need to bridge the floor gap and optionally enclose wider corridors.
  const cw = corridorBounds.maxX - corridorBounds.minX;
  const ch = corridorBounds.maxZ - corridorBounds.minZ;
  const gapLength = isEastWest ? cw : ch;
  const corridorCenterX = (corridorBounds.minX + corridorBounds.maxX) / 2;
  const corridorCenterZ = (corridorBounds.minZ + corridorBounds.maxZ) / 2;

  let corridorRoot: TransformNode | null = null;

  if (gapLength > 0.05) {
    corridorRoot = new TransformNode(`${conn.id}_corridor`, scene);

    if (gapLength > 0.5) {
      // Wide gap: full corridor with floor, side walls, and ceiling
      const corridorFloor = MeshBuilder.CreateGround(`${conn.id}_corridor_floor`, {
        width: cw,
        height: ch,
      }, scene);
      corridorFloor.material = floorMat;
      corridorFloor.receiveShadows = true;
      corridorFloor.position.set(corridorCenterX, y, corridorCenterZ);
      corridorFloor.parent = corridorRoot;

      // Corridor ceiling height from adjacent rooms
      const ceilingH = Math.max(fromRoom.size.ceilingHeight, toRoom.size.ceilingHeight);

      // Ceiling
      const corridorCeiling = MeshBuilder.CreateGround(`${conn.id}_corridor_ceiling`, {
        width: cw,
        height: ch,
      }, scene);
      corridorCeiling.position.set(corridorCenterX, y + ceilingH, corridorCenterZ);
      corridorCeiling.rotation.x = Math.PI;
      corridorCeiling.material = ceilingMat;
      corridorCeiling.parent = corridorRoot;

      // Side walls along the corridor
      const wallThick = 0.2;
      if (isEastWest) {
        // Corridor runs along X — side walls on north and south edges
        [-1, 1].forEach(side => {
          const sideWall = MeshBuilder.CreateBox(`${conn.id}_side_${side}`, {
            width: cw,
            height: ceilingH,
            depth: wallThick,
          }, scene);
          sideWall.material = wallMat;
          sideWall.position.set(corridorCenterX, y + ceilingH / 2, corridorCenterZ + side * OPENING_WIDTH / 2);
          sideWall.parent = corridorRoot;
          if (shadowGenerator) shadowGenerator.addShadowCaster(sideWall);
        });
      } else {
        // Corridor runs along Z — side walls on east and west edges
        [-1, 1].forEach(side => {
          const sideWall = MeshBuilder.CreateBox(`${conn.id}_side_${side}`, {
            width: wallThick,
            height: ceilingH,
            depth: ch,
          }, scene);
          sideWall.material = wallMat;
          sideWall.position.set(corridorCenterX + side * OPENING_WIDTH / 2, y + ceilingH / 2, corridorCenterZ);
          sideWall.parent = corridorRoot;
          if (shadowGenerator) shadowGenerator.addShadowCaster(sideWall);
        });
      }
    } else {
      // Narrow gap (0.05-0.5): small floor patch to prevent visual seams
      const patch = MeshBuilder.CreateGround(`${conn.id}_floor_patch`, {
        width: cw,
        height: ch,
      }, scene);
      patch.material = floorMat;
      patch.receiveShadows = true;
      patch.position.set(corridorCenterX, y, corridorCenterZ);
      patch.parent = corridorRoot;
    }
  }
  // If gap < 0.05: rooms practically overlap at the wall, no mesh needed

  return {
    id: conn.id,
    mesh: corridorRoot as AbstractMesh | null,
    type: conn.type,
    corridorBounds,
    connectedRooms: { from: conn.fromRoom, to: conn.toRoom },
    groundY: y,
  };
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
