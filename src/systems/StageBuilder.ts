/**
 * Stage Builder
 * =============
 * 
 * Builds a complete stage from a stage definition JSON.
 * This is the core procedural generation system.
 * 
 * ## Process
 * 
 * 1. **Parse Definition**: Load stage JSON, extract requirements
 * 2. **Place Anchors**: Position story-critical rooms first
 * 3. **Generate Fillers**: Create connecting rooms between anchors
 * 4. **Create Boundaries**: Define walls/transitions between adjacent rooms
 * 5. **Build Navigation**: Create graph for pathfinding & ground height
 * 
 * ## Room Placement Strategy
 * 
 * Rooms are placed on a 2D grid (per floor) with:
 * - Anchors placed first at strategic positions
 * - Fillers grown organically to connect anchors
 * - Vertical transitions (stairs/ramps) connecting floors
 * 
 * ## Output
 * 
 * A `BuiltStage` contains everything needed to render and navigate:
 * - Room instances with world positions
 * - Boundary definitions with transition types
 * - Navigation graph with edges and costs
 * - Floor height map for vertical movement
 * 
 * @module StageBuilder
 */

import { 
  StageDefinition, 
  SceneTemplate, 
  RequiredScene,
  ConnectionType,
  createRNG,
  hashSeed
} from './StageDefinition';

// ============================================
// Types
// ============================================

/**
 * A room instance placed in the stage.
 */
export interface PlacedRoom {
  /** Unique ID for this room instance */
  id: string;
  
  /** Template used to generate this room */
  templateId: string;
  
  /** Purpose of this room (entry, exit, kitchen, filler, etc.) */
  purpose: string;
  
  /** Whether this is a story-critical anchor room */
  isAnchor: boolean;
  
  /** Floor level (0 = ground, -1 = basement, 1 = upstairs) */
  floor: number;
  
  /** Grid position on this floor */
  gridPosition: { x: number; z: number };
  
  /** World position (calculated from grid) */
  worldPosition: { x: number; y: number; z: number };
  
  /** Room dimensions */
  size: { width: number; height: number; ceilingHeight: number };
  
  /** Story beats that trigger in this room */
  storyBeats: string[];
  
  /** Quest items that spawn in this room */
  questItems: string[];
  
  /** Props to place in this room */
  props: PlacedProp[];
  
  /** Connections to other rooms */
  connections: RoomConnection[];
}

/**
 * A prop placed in a room.
 */
export interface PlacedProp {
  type: string;
  position: { x: number; z: number };
  rotation: number;
  interactive: boolean;
}

/**
 * A connection between two rooms.
 */
export interface RoomConnection {
  /** Direction from this room's perspective */
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  
  /** ID of the connected room */
  targetRoomId: string;
  
  /** Type of connection/transition */
  type: ConnectionType;
  
  /** Position of the connection point in local room coords */
  position: { x: number; z: number };
  
  /** Whether this connection is locked */
  locked: boolean;
  
  /** Lock ID if locked */
  lockId?: string;
}

/**
 * A boundary between two rooms.
 */
export interface Boundary {
  /** Unique ID */
  id: string;
  
  /** First room */
  roomA: string;
  
  /** Second room */
  roomB: string;
  
  /** Type of transition */
  transitionType: ConnectionType;
  
  /** World position of boundary center */
  worldPosition: { x: number; y: number; z: number };
  
  /** Direction from room A to room B */
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  
  /** Width of the opening/transition */
  width: number;
  
  /** For vertical transitions: height difference */
  heightDifference?: number;
  
  /** Whether this boundary is locked */
  locked: boolean;
  
  /** Lock ID if locked */
  lockId?: string;
}

/**
 * The complete built stage.
 */
export interface BuiltStage {
  /** Stage definition this was built from */
  definition: StageDefinition;
  
  /** Seed used for generation */
  seed: string;
  
  /** All placed rooms */
  rooms: Map<string, PlacedRoom>;
  
  /** All boundaries between rooms */
  boundaries: Boundary[];
  
  /** Entry room ID */
  entryRoomId: string;
  
  /** Exit room ID */
  exitRoomId: string;
  
  /** Floor definitions */
  floors: FloorDefinition[];
  
  /** Get room by ID */
  getRoom(id: string): PlacedRoom | undefined;
  
  /** Get all rooms on a floor */
  getRoomsOnFloor(floor: number): PlacedRoom[];
  
  /** Get boundaries for a room */
  getBoundariesForRoom(roomId: string): Boundary[];
  
  /** Get the ground Y at a world position */
  getGroundY(x: number, z: number): number;
  
  /** Check if a world position is walkable */
  isWalkable(x: number, z: number): boolean;
}

/**
 * A floor in the stage.
 */
export interface FloorDefinition {
  level: number;
  name: string;
  yOffset: number;
  roomIds: string[];
}

// ============================================
// Grid Constants
// ============================================

/** Size of a grid cell in world units */
const GRID_CELL_SIZE = 12;

/** Standard room height in world units */
const FLOOR_HEIGHT = 4;

/** Directions and their grid offsets */
const DIRECTION_OFFSETS: Record<string, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 }
};

/** Opposite directions */
const OPPOSITE_DIRECTION: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up'
};

// ============================================
// Stage Builder
// ============================================

/**
 * Build a complete stage from a definition.
 * 
 * @param definition - Stage definition JSON
 * @param templates - Available room templates
 * @param seed - Random seed for procedural generation
 * @returns Built stage ready for rendering
 */
export function buildStage(
  definition: StageDefinition,
  templates: SceneTemplate[],
  seed: string
): BuiltStage {
  const rng = createRNG(hashSeed(seed));
  
  // Create template lookup
  const templateMap = new Map<string, SceneTemplate>();
  templates.forEach(t => templateMap.set(t.id, t));
  
  // Track placed rooms
  const rooms = new Map<string, PlacedRoom>();
  const grid = new Map<string, string>(); // "floor,x,z" -> roomId
  const boundaries: Boundary[] = [];
  
  // ─────────────────────────────────────────
  // STEP 1: Determine floors needed
  // ─────────────────────────────────────────
  const floors: FloorDefinition[] = [];
  const needsBasement = definition.generation.requiredScenes.some(
    s => s.templateTags?.includes('basement')
  ) || definition.generation.exitScene.templateTags?.includes('basement');
  
  // Always have ground floor
  floors.push({ level: 0, name: 'Ground Floor', yOffset: 0, roomIds: [] });
  
  if (needsBasement) {
    floors.push({ level: -1, name: 'Basement', yOffset: -FLOOR_HEIGHT, roomIds: [] });
  }
  
  // ─────────────────────────────────────────
  // STEP 2: Place anchor rooms
  // ─────────────────────────────────────────
  
  // Entry room at grid origin
  const entryTemplate = findTemplate(definition.generation.entryScene, templates, rng);
  const entryRoom = placeRoom({
    template: entryTemplate,
    purpose: 'entry',
    isAnchor: true,
    floor: 0,
    gridPosition: { x: 0, z: 0 },
    storyBeats: [definition.story.startingBeat],
    questItems: [],
    rng
  });
  rooms.set(entryRoom.id, entryRoom);
  grid.set(`0,0,0`, entryRoom.id);
  floors[0].roomIds.push(entryRoom.id);
  
  // Required scenes (anchors)
  const anchorPositions = calculateAnchorPositions(
    definition.generation.requiredScenes.length,
    definition.generation.connectionRules,
    rng
  );
  
  definition.generation.requiredScenes.forEach((required, i) => {
    const template = findTemplate(required, templates, rng);
    const isBasement = required.templateTags?.includes('basement');
    const floor = isBasement ? -1 : 0;
    const pos = anchorPositions[i] || { x: i + 1, z: 0 };
    
    const room = placeRoom({
      template,
      purpose: required.purpose,
      isAnchor: true,
      floor,
      gridPosition: pos,
      storyBeats: [],
      questItems: required.mustContain?.questItems || [],
      rng
    });
    
    rooms.set(room.id, room);
    grid.set(`${floor},${pos.x},${pos.z}`, room.id);
    
    const floorDef = floors.find(f => f.level === floor);
    if (floorDef) floorDef.roomIds.push(room.id);
  });
  
  // Exit room
  const exitTemplate = findTemplate(definition.generation.exitScene, templates, rng);
  const exitIsBasement = definition.generation.exitScene.templateTags?.includes('basement');
  const exitFloor = exitIsBasement ? -1 : 0;
  const exitPos = findExitPosition(grid, exitFloor, definition.generation.connectionRules, rng);
  
  const exitRoom = placeRoom({
    template: exitTemplate,
    purpose: 'exit',
    isAnchor: true,
    floor: exitFloor,
    gridPosition: exitPos,
    storyBeats: [],
    questItems: [],
    rng
  });
  rooms.set(exitRoom.id, exitRoom);
  grid.set(`${exitFloor},${exitPos.x},${exitPos.z}`, exitRoom.id);
  
  const exitFloorDef = floors.find(f => f.level === exitFloor);
  if (exitFloorDef) exitFloorDef.roomIds.push(exitRoom.id);
  
  // ─────────────────────────────────────────
  // STEP 3: Generate filler rooms
  // ─────────────────────────────────────────
  const fillerCount = rng.nextInt(
    definition.generation.optionalSceneCount.min,
    definition.generation.optionalSceneCount.max
  );
  
  const fillerTemplates = templates.filter(t => 
    definition.generation.allowedTemplates.includes(t.id)
  );
  
  for (let i = 0; i < fillerCount; i++) {
    const position = findFillerPosition(grid, 0, rooms, rng);
    if (!position) break; // No valid positions left
    
    const template = rng.pick(fillerTemplates);
    const room = placeRoom({
      template,
      purpose: 'filler',
      isAnchor: false,
      floor: 0,
      gridPosition: position,
      storyBeats: [],
      questItems: [],
      rng
    });
    
    rooms.set(room.id, room);
    grid.set(`0,${position.x},${position.z}`, room.id);
    floors[0].roomIds.push(room.id);
  }
  
  // ─────────────────────────────────────────
  // STEP 4: Create connections & boundaries
  // ─────────────────────────────────────────
  
  // Connect adjacent rooms on each floor
  for (const floor of floors) {
    const floorRooms = floor.roomIds.map(id => rooms.get(id)!);
    
    for (const room of floorRooms) {
      for (const [dir, offset] of Object.entries(DIRECTION_OFFSETS)) {
        const neighborKey = `${floor.level},${room.gridPosition.x + offset.x},${room.gridPosition.z + offset.z}`;
        const neighborId = grid.get(neighborKey);
        
        if (neighborId && !room.connections.find(c => c.targetRoomId === neighborId)) {
          const neighbor = rooms.get(neighborId)!;
          const connectionType = determineConnectionType(room, neighbor, definition, rng);
          
          // Add connection to both rooms
          const connectionPos = getConnectionPosition(room, dir as any);
          room.connections.push({
            direction: dir as any,
            targetRoomId: neighborId,
            type: connectionType,
            position: connectionPos,
            locked: false
          });
          
          neighbor.connections.push({
            direction: OPPOSITE_DIRECTION[dir] as any,
            targetRoomId: room.id,
            type: connectionType,
            position: getConnectionPosition(neighbor, OPPOSITE_DIRECTION[dir] as any),
            locked: false
          });
          
          // Create boundary
          boundaries.push({
            id: `boundary_${room.id}_${neighborId}`,
            roomA: room.id,
            roomB: neighborId,
            transitionType: connectionType,
            worldPosition: calculateBoundaryPosition(room, neighbor, dir as any),
            direction: dir as any,
            width: 2,
            locked: false
          });
        }
      }
    }
  }
  
  // Connect floors with stairs/ramps
  if (floors.length > 1) {
    const verticalBoundary = createVerticalConnection(
      rooms, grid, floors, definition, rng
    );
    if (verticalBoundary) {
      boundaries.push(verticalBoundary);
    }
  }
  
  // ─────────────────────────────────────────
  // STEP 5: Build navigation helpers
  // ─────────────────────────────────────────
  
  const builtStage: BuiltStage = {
    definition,
    seed,
    rooms,
    boundaries,
    entryRoomId: entryRoom.id,
    exitRoomId: exitRoom.id,
    floors,
    
    getRoom(id: string) {
      return rooms.get(id);
    },
    
    getRoomsOnFloor(floor: number) {
      return Array.from(rooms.values()).filter(r => r.floor === floor);
    },
    
    getBoundariesForRoom(roomId: string) {
      return boundaries.filter(b => b.roomA === roomId || b.roomB === roomId);
    },
    
    getGroundY(x: number, z: number) {
      // Find which room contains this position
      for (const room of rooms.values()) {
        const wx = room.worldPosition.x;
        const wz = room.worldPosition.z;
        const hw = room.size.width / 2;
        const hh = room.size.height / 2;
        
        if (x >= wx - hw && x <= wx + hw && z >= wz - hh && z <= wz + hh) {
          return room.worldPosition.y;
        }
      }
      
      // Check boundaries for stairs/ramps
      for (const boundary of boundaries) {
        if (boundary.transitionType === 'stairs' || boundary.transitionType === 'ramp') {
          const bw = boundary.width;
          const transitionLength = (boundary.heightDifference || FLOOR_HEIGHT) * 
            (boundary.transitionType === 'stairs' ? 1.8 : 3.0);
          
          // Calculate bounds based on direction
          let bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
          const pos = boundary.worldPosition;
          
          switch (boundary.direction) {
            case 'north':
            case 'south':
              bounds = {
                minX: pos.x - bw / 2,
                maxX: pos.x + bw / 2,
                minZ: pos.z - transitionLength / 2,
                maxZ: pos.z + transitionLength / 2,
              };
              break;
            case 'east':
            case 'west':
            default:
              bounds = {
                minX: pos.x - transitionLength / 2,
                maxX: pos.x + transitionLength / 2,
                minZ: pos.z - bw / 2,
                maxZ: pos.z + bw / 2,
              };
              break;
          }
          
          // Check if position is within transition bounds
          if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
            const heightDiff = boundary.heightDifference || FLOOR_HEIGHT;
            const roomA = rooms.get(boundary.roomA);
            const bottomY = roomA ? roomA.worldPosition.y : 0;
            
            // Calculate progress along transition (0 = start, 1 = end)
            let progress: number;
            switch (boundary.direction) {
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
            
            // Clamp and interpolate
            progress = Math.max(0, Math.min(1, progress));
            return bottomY + progress * Math.abs(heightDiff);
          }
        }
      }
      
      return 0;
    },
    
    isWalkable(x: number, z: number) {
      for (const room of rooms.values()) {
        const wx = room.worldPosition.x;
        const wz = room.worldPosition.z;
        const hw = room.size.width / 2;
        const hh = room.size.height / 2;
        
        if (x >= wx - hw && x <= wx + hw && z >= wz - hh && z <= wz + hh) {
          return true;
        }
      }
      return false;
    }
  };
  
  return builtStage;
}

// ============================================
// Helper Functions
// ============================================

function findTemplate(
  required: RequiredScene,
  templates: SceneTemplate[],
  rng: ReturnType<typeof createRNG>
): SceneTemplate {
  // Try specific template ID first
  if (required.templateId) {
    const exact = templates.find(t => t.id === required.templateId);
    if (exact) return exact;
  }
  
  // Filter by tags
  if (required.templateTags && required.templateTags.length > 0) {
    const matching = templates.filter(t => 
      required.templateTags!.some(tag => t.tags.includes(tag))
    );
    if (matching.length > 0) {
      return rng.pick(matching);
    }
  }
  
  // Fallback to any template
  return rng.pick(templates);
}

function calculateAnchorPositions(
  count: number,
  rules: StageDefinition['generation']['connectionRules'],
  rng: ReturnType<typeof createRNG>
): { x: number; z: number }[] {
  const positions: { x: number; z: number }[] = [];
  
  switch (rules.type) {
    case 'linear':
      // Place anchors in a line
      for (let i = 0; i < count; i++) {
        positions.push({ x: 0, z: -(i + 1) });
      }
      break;
      
    case 'branching':
      // Place anchors in a tree-like pattern
      positions.push({ x: 0, z: -1 }); // First anchor north
      if (count > 1) positions.push({ x: 1, z: 0 }); // Second east
      if (count > 2) positions.push({ x: -1, z: 0 }); // Third west
      if (count > 3) positions.push({ x: 0, z: -2 }); // Fourth further north
      break;
      
    case 'hub':
      // Place anchors around a central point
      const angles = [0, Math.PI/2, Math.PI, -Math.PI/2];
      for (let i = 0; i < Math.min(count, 4); i++) {
        positions.push({
          x: Math.round(Math.cos(angles[i])),
          z: Math.round(Math.sin(angles[i]))
        });
      }
      break;
      
    default:
      // Random placement
      for (let i = 0; i < count; i++) {
        positions.push({
          x: rng.nextInt(-2, 2),
          z: rng.nextInt(-2, 2)
        });
      }
  }
  
  return positions;
}

function findExitPosition(
  grid: Map<string, string>,
  floor: number,
  rules: StageDefinition['generation']['connectionRules'],
  rng: ReturnType<typeof createRNG>
): { x: number; z: number } {
  const maxDist = rules.maxDistanceFromEntry || 4;
  
  // Find position at appropriate distance from entry
  for (let dist = maxDist; dist >= 2; dist--) {
    const candidates: { x: number; z: number }[] = [];
    
    for (let x = -dist; x <= dist; x++) {
      for (let z = -dist; z <= dist; z++) {
        if (Math.abs(x) + Math.abs(z) === dist) {
          const key = `${floor},${x},${z}`;
          if (!grid.has(key)) {
            candidates.push({ x, z });
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      return rng.pick(candidates);
    }
  }
  
  // Fallback
  return { x: 0, z: -3 };
}

function findFillerPosition(
  grid: Map<string, string>,
  floor: number,
  rooms: Map<string, PlacedRoom>,
  rng: ReturnType<typeof createRNG>
): { x: number; z: number } | null {
  // Find positions adjacent to existing rooms
  const candidates: { x: number; z: number }[] = [];
  
  for (const room of rooms.values()) {
    if (room.floor !== floor) continue;
    
    for (const offset of Object.values(DIRECTION_OFFSETS)) {
      const pos = {
        x: room.gridPosition.x + offset.x,
        z: room.gridPosition.z + offset.z
      };
      const key = `${floor},${pos.x},${pos.z}`;
      
      if (!grid.has(key)) {
        candidates.push(pos);
      }
    }
  }
  
  return candidates.length > 0 ? rng.pick(candidates) : null;
}

let roomIdCounter = 0;

function placeRoom(params: {
  template: SceneTemplate;
  purpose: string;
  isAnchor: boolean;
  floor: number;
  gridPosition: { x: number; z: number };
  storyBeats: string[];
  questItems: string[];
  rng: ReturnType<typeof createRNG>;
}): PlacedRoom {
  const { template, purpose, isAnchor, floor, gridPosition, storyBeats, questItems, rng } = params;
  
  // Randomize size within template bounds
  const width = rng.nextInt(template.size.width.min, template.size.width.max);
  const height = rng.nextInt(template.size.height.min, template.size.height.max);
  const ceilingHeight = template.size.ceiling 
    ? rng.nextInt(template.size.ceiling.min, template.size.ceiling.max)
    : 3;
  
  // Calculate world position from grid
  const worldPosition = {
    x: gridPosition.x * GRID_CELL_SIZE,
    y: floor * FLOOR_HEIGHT,
    z: gridPosition.z * GRID_CELL_SIZE
  };
  
  // Generate props from template rules
  const props = generateProps(template, width, height, rng);
  
  return {
    id: `room_${purpose}_${roomIdCounter++}`,
    templateId: template.id,
    purpose,
    isAnchor,
    floor,
    gridPosition,
    worldPosition,
    size: { width, height, ceilingHeight },
    storyBeats,
    questItems,
    props,
    connections: []
  };
}

function generateProps(
  template: SceneTemplate,
  width: number,
  height: number,
  rng: ReturnType<typeof createRNG>
): PlacedProp[] {
  const props: PlacedProp[] = [];
  
  for (const rule of template.propRules) {
    const count = rng.nextInt(rule.count.min, rule.count.max);
    
    for (let i = 0; i < count; i++) {
      const propType = rng.pick(rule.propTypes);
      const position = getPositionForZone(rule.zone, width, height, rng);
      const rotation = rule.faceCenter 
        ? Math.atan2(-position.z, -position.x)
        : rule.faceWall
          ? getWallFacingRotation(position, width, height)
          : rng.next() * Math.PI * 2;
      
      props.push({
        type: propType,
        position,
        rotation,
        interactive: true // Most props are interactive
      });
    }
  }
  
  return props;
}

function getPositionForZone(
  zone: string,
  width: number,
  height: number,
  rng: ReturnType<typeof createRNG>
): { x: number; z: number } {
  const margin = 1;
  const hw = width / 2 - margin;
  const hh = height / 2 - margin;
  
  switch (zone) {
    case 'center':
      return {
        x: rng.next() * hw * 0.5 - hw * 0.25,
        z: rng.next() * hh * 0.5 - hh * 0.25
      };
    case 'edge':
    case 'wall':
      const side = rng.nextInt(0, 3);
      switch (side) {
        case 0: return { x: rng.next() * hw * 2 - hw, z: -hh };
        case 1: return { x: rng.next() * hw * 2 - hw, z: hh };
        case 2: return { x: -hw, z: rng.next() * hh * 2 - hh };
        default: return { x: hw, z: rng.next() * hh * 2 - hh };
      }
    case 'corner':
      const cx = rng.next() > 0.5 ? hw : -hw;
      const cz = rng.next() > 0.5 ? hh : -hh;
      return { x: cx * 0.8, z: cz * 0.8 };
    default:
      return {
        x: rng.next() * hw * 2 - hw,
        z: rng.next() * hh * 2 - hh
      };
  }
}

function getWallFacingRotation(
  position: { x: number; z: number },
  width: number,
  height: number
): number {
  const hw = width / 2;
  const hh = height / 2;
  
  // Find nearest wall
  const distN = Math.abs(position.z + hh);
  const distS = Math.abs(position.z - hh);
  const distE = Math.abs(position.x - hw);
  const distW = Math.abs(position.x + hw);
  
  const min = Math.min(distN, distS, distE, distW);
  
  if (min === distN) return 0;
  if (min === distS) return Math.PI;
  if (min === distE) return Math.PI / 2;
  return -Math.PI / 2;
}

function determineConnectionType(
  roomA: PlacedRoom,
  roomB: PlacedRoom,
  definition: StageDefinition,
  rng: ReturnType<typeof createRNG>
): ConnectionType {
  // Use stage's default separation
  const defaultType = definition.generation.separation;
  
  // Hallways get archways
  if (roomA.templateId.includes('hallway') || roomB.templateId.includes('hallway')) {
    return 'wall_archway';
  }
  
  // Exterior connections are open
  if (definition.generation.environment === 'exterior') {
    return 'open';
  }
  
  // Random chance for archway vs door
  if (defaultType === 'wall_door' && rng.next() > 0.7) {
    return 'wall_archway';
  }
  
  return defaultType;
}

function getConnectionPosition(
  room: PlacedRoom,
  direction: 'north' | 'south' | 'east' | 'west'
): { x: number; z: number } {
  const hw = room.size.width / 2;
  const hh = room.size.height / 2;
  
  switch (direction) {
    case 'north': return { x: 0, z: -hh };
    case 'south': return { x: 0, z: hh };
    case 'east': return { x: hw, z: 0 };
    case 'west': return { x: -hw, z: 0 };
  }
}

function calculateBoundaryPosition(
  roomA: PlacedRoom,
  roomB: PlacedRoom,
  _direction: 'north' | 'south' | 'east' | 'west'
): { x: number; y: number; z: number } {
  // Boundary is at the midpoint between rooms
  return {
    x: (roomA.worldPosition.x + roomB.worldPosition.x) / 2,
    y: roomA.worldPosition.y,
    z: (roomA.worldPosition.z + roomB.worldPosition.z) / 2
  };
}

function createVerticalConnection(
  rooms: Map<string, PlacedRoom>,
  grid: Map<string, string>,
  floors: FloorDefinition[],
  _definition: StageDefinition,
  _rng: ReturnType<typeof createRNG>
): Boundary | null {
  // Find rooms that should connect vertically
  const groundFloor = floors.find(f => f.level === 0);
  const basement = floors.find(f => f.level === -1);
  
  if (!groundFloor || !basement) return null;
  
  // Find a room with 'down' connection potential
  for (const roomId of groundFloor.roomIds) {
    const room = rooms.get(roomId)!;
    
    // Check if there's a basement room below
    const belowKey = `${-1},${room.gridPosition.x},${room.gridPosition.z}`;
    const belowId = grid.get(belowKey);
    
    if (belowId) {
      const belowRoom = rooms.get(belowId)!;
      
      // Add vertical connections
      room.connections.push({
        direction: 'down',
        targetRoomId: belowId,
        type: 'stairs',
        position: { x: 0, z: -room.size.height / 2 + 2 },
        locked: false
      });
      
      belowRoom.connections.push({
        direction: 'up',
        targetRoomId: roomId,
        type: 'stairs',
        position: { x: 0, z: -belowRoom.size.height / 2 + 2 },
        locked: false
      });
      
      return {
        id: `boundary_vertical_${roomId}_${belowId}`,
        roomA: roomId,
        roomB: belowId,
        transitionType: 'stairs',
        worldPosition: {
          x: room.worldPosition.x,
          y: (room.worldPosition.y + belowRoom.worldPosition.y) / 2,
          z: room.worldPosition.z - room.size.height / 2 + 2
        },
        direction: 'down',
        width: 3,
        heightDifference: FLOOR_HEIGHT,
        locked: false
      };
    }
  }
  
  return null;
}

// ============================================
// Export utilities
// ============================================

export { GRID_CELL_SIZE, FLOOR_HEIGHT };
