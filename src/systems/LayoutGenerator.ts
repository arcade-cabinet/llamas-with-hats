/**
 * Layout Generator
 * ================
 * 
 * Generates stage layouts using archetypes and pattern algorithms.
 * This replaces the simple procedural generation with a more
 * sophisticated system that supports:
 * 
 * - Multiple floor levels with vertical connections
 * - Layout archetypes (apartment, house, dungeon, outdoor)
 * - Pattern-based room placement (linear, branching, hub, grid, etc.)
 * - Anchor rooms for story-critical content
 * - Filler rooms for exploration variety
 * 
 * ## Architecture
 * 
 * ```
 * Stage Definition (JSON)
 *        │
 *        ▼
 * Layout Archetype ─────► Pattern Algorithm
 *        │                      │
 *        ▼                      ▼
 * Anchor Room Placement    Filler Room Calculation
 *        │                      │
 *        └──────────┬───────────┘
 *                   ▼
 *            Room Connections
 *                   │
 *                   ▼
 *            GeneratedLayout
 * ```
 * 
 * @module LayoutGenerator
 */

import { createRNG, hashSeed } from './StageDefinition';

// ============================================
// Types
// ============================================

/**
 * Layout archetype defining the pattern for a stage type.
 */
export interface LayoutArchetype {
  id: string;
  name: string;
  description: string;
  environment: 'interior' | 'exterior' | 'mixed';
  levels: LevelArchetype[];
  connectionRules: {
    defaultType: ConnectionType;
    hallwayType?: ConnectionType;
    buildingEntryType?: ConnectionType;
    secretType?: ConnectionType;
    maxDoorsPerRoom: number;
  };
}

export interface LevelArchetype {
  level: number;
  name: string;
  pattern: LayoutPattern;
  totalRooms: { min: number; max: number };
  anchorPositions: Record<string, { x: number; z: number }>;
  fillerZones: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  verticalConnections: VerticalConnectionDef[];
  gridConfig?: {
    width: number;
    height: number;
    streetWidth?: number;
    buildingChance?: number;
    centerRoom?: boolean;
  };
}

export interface VerticalConnectionDef {
  position: { x: number; z: number };
  direction: 'up' | 'down';
  type: 'stairs' | 'ramp' | 'ladder' | 'elevator';
}

export type LayoutPattern = 
  | 'linear'     // Rooms in sequence
  | 'branching'  // Main path with side branches
  | 'hub'        // Central room with spokes
  | 'grid'       // Rectangular grid
  | 'square'     // 4 corners + center
  | 'l_shape'    // L-shaped layout
  | 'open';      // No walls (outdoor)

export type ConnectionType = 
  | 'wall_door'
  | 'wall_archway'
  | 'open'
  | 'stairs'
  | 'ramp'
  | 'loading';

/**
 * Stage definition with layout configuration.
 */
export interface StageLayoutDefinition {
  id: string;
  name: string;
  layoutArchetype: string;
  levels: LevelDefinition[];
  connectionRules: {
    type: LayoutPattern;
    defaultConnectionType: ConnectionType;
    hallwayConnectionType?: ConnectionType;
    maxDeadEnds?: number;
    loopsAllowed?: boolean;
    maxDistanceFromEntry?: number;
  };
  entryScene: {
    roomId: string;
    spawnPoint: { x: number; z: number };
    facing?: string;
  };
  exitScene: {
    roomId: string;
    transitionTo?: string;
  };
}

export interface LevelDefinition {
  level: number;
  name: string;
  yOffset: number;
  pattern: LayoutPattern;
  totalRooms: number;
  alignment: string;
  palette?: string;
  anchorRooms: AnchorRoomDef[];
  fillerRooms: {
    count: { min: number; max: number };
    templates: string[];
    spawnZone: { minX: number; maxX: number; minZ: number; maxZ: number };
    mustConnectToAnchor?: boolean;
  };
  verticalConnections: LevelVerticalConnection[];
}

export interface AnchorRoomDef {
  id: string;
  purpose: 'entry' | 'exit' | 'connector' | 'story_critical' | 'exploration';
  templateId: string;
  gridPosition: { x: number; z: number };
  storyBeats?: string[];
  required: boolean;
  connections: string[];
  questItems?: string[];
  props?: {
    required: string[];
    optional: string[];
  };
  atmosphere?: {
    override?: string;
    fogDensity?: number;
    bloodSplatter?: boolean;
  };
  locked?: boolean;
  lockId?: string;
}

export interface LevelVerticalConnection {
  id: string;
  type: 'stairs' | 'ramp' | 'ladder' | 'elevator';
  fromRoom: string;
  position: { x: number; z: number };
  direction: 'up' | 'down';
  targetLevel: number;
  targetRoom: string;
  locked?: boolean;
  lockId?: string;
  unlockItem?: string;
}

// ============================================
// Generated Output
// ============================================

export interface GeneratedLayout {
  id: string;
  seed: string;
  levels: GeneratedLevel[];
  rooms: Map<string, GeneratedRoom>;
  connections: RoomConnection[];
  verticalConnections: GeneratedVerticalConnection[];
  entryRoomId: string;
  exitRoomId: string;
}

export interface GeneratedLevel {
  level: number;
  name: string;
  yOffset: number;
  roomIds: string[];
  bounds: {
    minX: number; maxX: number;
    minZ: number; maxZ: number;
  };
}

export interface GeneratedRoom {
  id: string;
  templateId: string;
  purpose: string;
  isAnchor: boolean;
  level: number;
  gridPosition: { x: number; z: number };
  worldPosition: { x: number; y: number; z: number };
  size: { width: number; height: number; ceilingHeight: number };
  storyBeats: string[];
  questItems: string[];
  props: GeneratedProp[];
  connections: string[];
  atmosphere?: {
    preset?: string;
    fogDensity?: number;
    bloodSplatter?: boolean;
  };
  locked?: boolean;
  lockId?: string;
}

export interface GeneratedProp {
  id: string;
  type: string;
  position: { x: number; z: number };
  rotation: number;
  required: boolean;
}

export interface RoomConnection {
  id: string;
  fromRoom: string;
  toRoom: string;
  type: ConnectionType;
  direction: 'north' | 'south' | 'east' | 'west';
  position: { x: number; z: number };
  locked?: boolean;
  lockId?: string;
}

export interface GeneratedVerticalConnection {
  id: string;
  type: 'stairs' | 'ramp' | 'ladder' | 'elevator';
  upperRoom: string;
  lowerRoom: string;
  upperLevel: number;
  lowerLevel: number;
  position: { x: number; z: number };
  heightDifference: number;
  locked?: boolean;
  lockId?: string;
}

// ============================================
// Constants
// ============================================

const GRID_CELL_SIZE = 12;
const FLOOR_HEIGHT = 4;

const DIRECTION_OFFSETS: Record<string, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 }
};

const OPPOSITE_DIRECTION: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
};

// ============================================
// Template Definitions (inline for now)
// ============================================

interface RoomTemplate {
  id: string;
  size: { 
    width: { min: number; max: number }; 
    height: { min: number; max: number }; 
    ceiling?: { min: number; max: number };
  };
  propRules: Array<{
    propTypes: string[];
    zone: string;
    count: { min: number; max: number };
    faceWall?: boolean;
    faceCenter?: boolean;
  }>;
}

const DEFAULT_TEMPLATES: Record<string, RoomTemplate> = {
  room_small: {
    id: 'room_small',
    size: { width: { min: 6, max: 8 }, height: { min: 6, max: 8 }, ceiling: { min: 2, max: 3 } },
    propRules: [
      { propTypes: ['chair', 'stool'], zone: 'corner', count: { min: 0, max: 2 }, faceCenter: true },
      { propTypes: ['crate', 'barrel'], zone: 'edge', count: { min: 0, max: 2 } }
    ]
  },
  room_medium: {
    id: 'room_medium',
    size: { width: { min: 8, max: 12 }, height: { min: 8, max: 10 }, ceiling: { min: 2, max: 3 } },
    propRules: [
      { propTypes: ['table'], zone: 'center', count: { min: 0, max: 1 } },
      { propTypes: ['chair'], zone: 'center', count: { min: 0, max: 4 }, faceCenter: true },
      { propTypes: ['bookshelf'], zone: 'wall', count: { min: 0, max: 2 }, faceWall: true }
    ]
  },
  room_kitchen: {
    id: 'room_kitchen',
    size: { width: { min: 6, max: 10 }, height: { min: 6, max: 8 }, ceiling: { min: 2, max: 3 } },
    propRules: [
      { propTypes: ['counter'], zone: 'wall', count: { min: 2, max: 3 }, faceWall: true },
      { propTypes: ['barrel', 'crate'], zone: 'corner', count: { min: 1, max: 2 } }
    ]
  },
  room_bedroom: {
    id: 'room_bedroom',
    size: { width: { min: 8, max: 12 }, height: { min: 8, max: 10 }, ceiling: { min: 2, max: 3 } },
    propRules: [
      { propTypes: ['bed'], zone: 'wall', count: { min: 1, max: 1 }, faceCenter: true },
      { propTypes: ['dresser', 'chest'], zone: 'corner', count: { min: 1, max: 2 } }
    ]
  },
  room_bathroom: {
    id: 'room_bathroom',
    size: { width: { min: 4, max: 6 }, height: { min: 4, max: 6 }, ceiling: { min: 2, max: 2 } },
    propRules: [
      { propTypes: ['tub', 'sink'], zone: 'wall', count: { min: 1, max: 2 }, faceWall: true }
    ]
  },
  hallway_short: {
    id: 'hallway_short',
    size: { width: { min: 3, max: 4 }, height: { min: 6, max: 10 }, ceiling: { min: 2, max: 3 } },
    propRules: [
      { propTypes: ['lamp'], zone: 'wall', count: { min: 0, max: 2 } }
    ]
  },
  room_basement: {
    id: 'room_basement',
    size: { width: { min: 10, max: 16 }, height: { min: 10, max: 14 }, ceiling: { min: 2, max: 2 } },
    propRules: [
      { propTypes: ['barrel', 'crate'], zone: 'edge', count: { min: 3, max: 8 } },
      { propTypes: ['pillar'], zone: 'center', count: { min: 0, max: 4 } }
    ]
  },
  closet: {
    id: 'closet',
    size: { width: { min: 2, max: 4 }, height: { min: 2, max: 4 }, ceiling: { min: 2, max: 2 } },
    propRules: [
      { propTypes: ['crate', 'chest'], zone: 'random', count: { min: 1, max: 3 } }
    ]
  }
};

// ============================================
// Main Generator
// ============================================

/**
 * Generate a complete layout from a stage definition.
 */
export function generateLayout(
  stageDef: StageLayoutDefinition,
  seed: string
): GeneratedLayout {
  const rng = createRNG(hashSeed(seed + stageDef.id));
  
  const layout: GeneratedLayout = {
    id: `${stageDef.id}_${seed}`,
    seed,
    levels: [],
    rooms: new Map(),
    connections: [],
    verticalConnections: [],
    entryRoomId: stageDef.entryScene.roomId,
    exitRoomId: stageDef.exitScene.roomId
  };
  
  let roomIdCounter = 0;
  let propIdCounter = 0;
  
  // Generate each level
  for (const levelDef of stageDef.levels) {
    const generatedLevel: GeneratedLevel = {
      level: levelDef.level,
      name: levelDef.name,
      yOffset: levelDef.yOffset,
      roomIds: [],
      bounds: { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    };
    
    // Place anchor rooms first
    for (const anchorDef of levelDef.anchorRooms) {
      const template = DEFAULT_TEMPLATES[anchorDef.templateId] || DEFAULT_TEMPLATES.room_medium;
      
      const width = rng.nextInt(template.size.width.min, template.size.width.max);
      const height = rng.nextInt(template.size.height.min, template.size.height.max);
      const ceilingHeight = template.size.ceiling 
        ? rng.nextInt(template.size.ceiling.min, template.size.ceiling.max)
        : 3;
      
      const worldPos = {
        x: anchorDef.gridPosition.x * GRID_CELL_SIZE,
        y: levelDef.yOffset,
        z: anchorDef.gridPosition.z * GRID_CELL_SIZE
      };
      
      // Generate props
      const props: GeneratedProp[] = [];
      
      // Add required props
      if (anchorDef.props?.required) {
        for (const propType of anchorDef.props.required) {
          const pos = getPositionForZone('wall', width, height, rng);
          props.push({
            id: `prop_${++propIdCounter}`,
            type: propType,
            position: pos,
            rotation: rng.next() * Math.PI * 2,
            required: true
          });
        }
      }
      
      // Add optional props from template rules
      for (const rule of template.propRules) {
        const count = rng.nextInt(rule.count.min, rule.count.max);
        for (let i = 0; i < count; i++) {
          const propType = rng.pick(rule.propTypes);
          const pos = getPositionForZone(rule.zone, width, height, rng);
          let rotation = rng.next() * Math.PI * 2;
          
          if (rule.faceWall) {
            rotation = getWallFacingRotation(pos, width, height);
          } else if (rule.faceCenter) {
            rotation = Math.atan2(-pos.z, -pos.x);
          }
          
          props.push({
            id: `prop_${++propIdCounter}`,
            type: propType,
            position: pos,
            rotation,
            required: false
          });
        }
      }
      
      const room: GeneratedRoom = {
        id: anchorDef.id,
        templateId: anchorDef.templateId,
        purpose: anchorDef.purpose,
        isAnchor: true,
        level: levelDef.level,
        gridPosition: anchorDef.gridPosition,
        worldPosition: worldPos,
        size: { width, height, ceilingHeight },
        storyBeats: anchorDef.storyBeats || [],
        questItems: anchorDef.questItems || [],
        props,
        connections: [...anchorDef.connections],
        atmosphere: anchorDef.atmosphere,
        locked: anchorDef.locked,
        lockId: anchorDef.lockId
      };
      
      layout.rooms.set(room.id, room);
      generatedLevel.roomIds.push(room.id);
      
      // Update bounds
      generatedLevel.bounds.minX = Math.min(generatedLevel.bounds.minX, worldPos.x - width/2);
      generatedLevel.bounds.maxX = Math.max(generatedLevel.bounds.maxX, worldPos.x + width/2);
      generatedLevel.bounds.minZ = Math.min(generatedLevel.bounds.minZ, worldPos.z - height/2);
      generatedLevel.bounds.maxZ = Math.max(generatedLevel.bounds.maxZ, worldPos.z + height/2);
    }
    
    // Generate filler rooms based on pattern
    const fillerCount = rng.nextInt(levelDef.fillerRooms.count.min, levelDef.fillerRooms.count.max);
    const usedPositions = new Set<string>();
    
    // Mark anchor positions as used
    for (const anchor of levelDef.anchorRooms) {
      usedPositions.add(`${anchor.gridPosition.x},${anchor.gridPosition.z}`);
    }
    
    for (let i = 0; i < fillerCount; i++) {
      const position = findFillerPosition(
        levelDef.pattern,
        levelDef.fillerRooms.spawnZone,
        usedPositions,
        layout.rooms,
        levelDef.level,
        levelDef.fillerRooms.mustConnectToAnchor || false,
        rng
      );
      
      if (!position) break;
      
      usedPositions.add(`${position.x},${position.z}`);
      
      const templateId = rng.pick(levelDef.fillerRooms.templates);
      const template = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES.room_small;
      
      const width = rng.nextInt(template.size.width.min, template.size.width.max);
      const height = rng.nextInt(template.size.height.min, template.size.height.max);
      const ceilingHeight = template.size.ceiling 
        ? rng.nextInt(template.size.ceiling.min, template.size.ceiling.max)
        : 3;
      
      const worldPos = {
        x: position.x * GRID_CELL_SIZE,
        y: levelDef.yOffset,
        z: position.z * GRID_CELL_SIZE
      };
      
      // Generate props from template
      const props: GeneratedProp[] = [];
      for (const rule of template.propRules) {
        const count = rng.nextInt(rule.count.min, rule.count.max);
        for (let j = 0; j < count; j++) {
          const propType = rng.pick(rule.propTypes);
          const pos = getPositionForZone(rule.zone, width, height, rng);
          props.push({
            id: `prop_${++propIdCounter}`,
            type: propType,
            position: pos,
            rotation: rng.next() * Math.PI * 2,
            required: false
          });
        }
      }
      
      const roomId = `filler_${++roomIdCounter}`;
      const room: GeneratedRoom = {
        id: roomId,
        templateId,
        purpose: 'filler',
        isAnchor: false,
        level: levelDef.level,
        gridPosition: position,
        worldPosition: worldPos,
        size: { width, height, ceilingHeight },
        storyBeats: [],
        questItems: [],
        props,
        connections: []
      };
      
      layout.rooms.set(roomId, room);
      generatedLevel.roomIds.push(roomId);
      
      // Update bounds
      generatedLevel.bounds.minX = Math.min(generatedLevel.bounds.minX, worldPos.x - width/2);
      generatedLevel.bounds.maxX = Math.max(generatedLevel.bounds.maxX, worldPos.x + width/2);
      generatedLevel.bounds.minZ = Math.min(generatedLevel.bounds.minZ, worldPos.z - height/2);
      generatedLevel.bounds.maxZ = Math.max(generatedLevel.bounds.maxZ, worldPos.z + height/2);
    }
    
    layout.levels.push(generatedLevel);
    
    // Generate vertical connections for this level
    for (const vc of levelDef.verticalConnections) {
      if (vc.direction === 'down') {
        layout.verticalConnections.push({
          id: vc.id,
          type: vc.type,
          upperRoom: vc.fromRoom,
          lowerRoom: vc.targetRoom,
          upperLevel: levelDef.level,
          lowerLevel: vc.targetLevel,
          position: vc.position,
          heightDifference: FLOOR_HEIGHT,
          locked: vc.locked,
          lockId: vc.lockId
        });
      }
    }
  }
  
  // Generate horizontal connections based on pattern
  generateConnections(layout, stageDef.connectionRules, rng);
  
  return layout;
}

// ============================================
// Pattern-Based Room Placement
// ============================================

function findFillerPosition(
  pattern: LayoutPattern,
  zone: { minX: number; maxX: number; minZ: number; maxZ: number },
  usedPositions: Set<string>,
  rooms: Map<string, GeneratedRoom>,
  level: number,
  mustConnectToAnchor: boolean,
  rng: ReturnType<typeof createRNG>
): { x: number; z: number } | null {
  
  const candidates: Array<{ x: number; z: number }> = [];
  
  // Get existing room positions on this level for adjacency check
  const levelRooms = Array.from(rooms.values()).filter(r => r.level === level);
  
  for (let x = zone.minX; x <= zone.maxX; x++) {
    for (let z = zone.minZ; z <= zone.maxZ; z++) {
      const key = `${x},${z}`;
      if (usedPositions.has(key)) continue;
      
      // Check if adjacent to existing room
      const isAdjacent = levelRooms.some(room => {
        const dx = Math.abs(room.gridPosition.x - x);
        const dz = Math.abs(room.gridPosition.z - z);
        return (dx === 1 && dz === 0) || (dx === 0 && dz === 1);
      });
      
      if (mustConnectToAnchor && !isAdjacent) continue;
      
      // Pattern-specific filtering
      switch (pattern) {
        case 'linear':
          // Only allow positions along the primary axis
          if (x !== 0) continue;
          break;
        case 'branching':
          // Allow some spread but prefer adjacency
          if (!isAdjacent) continue;
          break;
        case 'hub':
          // Must be adjacent to hub (assumed at 0,0)
          if (Math.abs(x) + Math.abs(z) > 2) continue;
          break;
        case 'l_shape':
          // Must be on one of the L arms
          if (x > 0 && z < 0) continue;
          break;
      }
      
      candidates.push({ x, z });
    }
  }
  
  if (candidates.length === 0) return null;
  
  return rng.pick(candidates);
}

// ============================================
// Connection Generation
// ============================================

function generateConnections(
  layout: GeneratedLayout,
  rules: StageLayoutDefinition['connectionRules'],
  rng: ReturnType<typeof createRNG>
): void {
  const connectionId = { current: 0 };
  
  // Group rooms by level
  const roomsByLevel = new Map<number, GeneratedRoom[]>();
  for (const room of layout.rooms.values()) {
    const levelRooms = roomsByLevel.get(room.level) || [];
    levelRooms.push(room);
    roomsByLevel.set(room.level, levelRooms);
  }
  
  // Generate connections for each level
  for (const [_level, rooms] of roomsByLevel) {
    // Connect adjacent rooms
    for (const room of rooms) {
      for (const [dir, offset] of Object.entries(DIRECTION_OFFSETS)) {
        const neighborPos = {
          x: room.gridPosition.x + offset.x,
          z: room.gridPosition.z + offset.z
        };
        
        const neighbor = rooms.find(r => 
          r.gridPosition.x === neighborPos.x && 
          r.gridPosition.z === neighborPos.z
        );
        
        if (!neighbor) continue;
        
        // Check if connection already exists
        const existingConnection = layout.connections.find(c =>
          (c.fromRoom === room.id && c.toRoom === neighbor.id) ||
          (c.fromRoom === neighbor.id && c.toRoom === room.id)
        );
        
        if (existingConnection) continue;
        
        // Check if rooms should connect (based on their connection lists)
        const shouldConnect = 
          room.connections.includes(neighbor.id) ||
          neighbor.connections.includes(room.id) ||
          (!room.isAnchor || !neighbor.isAnchor); // Always connect if one is filler
        
        if (!shouldConnect) continue;
        
        // Determine connection type
        let connectionType = rules.defaultConnectionType;
        if (room.templateId.includes('hallway') || neighbor.templateId.includes('hallway')) {
          connectionType = rules.hallwayConnectionType || 'wall_archway';
        }
        
        // Random chance for archway vs door
        if (connectionType === 'wall_door' && rng.next() > 0.7) {
          connectionType = 'wall_archway';
        }
        
        // Get connection position
        const pos = getConnectionPosition(room, dir as keyof typeof DIRECTION_OFFSETS);
        
        layout.connections.push({
          id: `connection_${++connectionId.current}`,
          fromRoom: room.id,
          toRoom: neighbor.id,
          type: connectionType,
          direction: dir as 'north' | 'south' | 'east' | 'west',
          position: pos
        });
        
        // Update room connections
        if (!room.connections.includes(neighbor.id)) {
          room.connections.push(neighbor.id);
        }
        if (!neighbor.connections.includes(room.id)) {
          neighbor.connections.push(room.id);
        }
      }
    }
  }
}

function getConnectionPosition(
  room: GeneratedRoom,
  direction: string
): { x: number; z: number } {
  const hw = room.size.width / 2;
  const hh = room.size.height / 2;
  
  switch (direction) {
    case 'north': return { x: 0, z: -hh };
    case 'south': return { x: 0, z: hh };
    case 'east': return { x: hw, z: 0 };
    case 'west': return { x: -hw, z: 0 };
    default: return { x: 0, z: 0 };
  }
}

// ============================================
// Prop Placement Helpers
// ============================================

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
        x: (rng.next() - 0.5) * hw * 0.5,
        z: (rng.next() - 0.5) * hh * 0.5
      };
    case 'edge':
    case 'wall': {
      const side = rng.nextInt(0, 3);
      switch (side) {
        case 0: return { x: (rng.next() - 0.5) * hw * 2, z: -hh };
        case 1: return { x: (rng.next() - 0.5) * hw * 2, z: hh };
        case 2: return { x: -hw, z: (rng.next() - 0.5) * hh * 2 };
        default: return { x: hw, z: (rng.next() - 0.5) * hh * 2 };
      }
    }
    case 'corner': {
      const cx = rng.next() > 0.5 ? hw : -hw;
      const cz = rng.next() > 0.5 ? hh : -hh;
      return { x: cx * 0.8, z: cz * 0.8 };
    }
    default: // random
      return {
        x: (rng.next() - 0.5) * hw * 2,
        z: (rng.next() - 0.5) * hh * 2
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

// ============================================
// Layout Validation
// ============================================

/**
 * Validate a generated layout for connectivity and required elements.
 */
export function validateLayout(layout: GeneratedLayout): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check entry room exists
  if (!layout.rooms.has(layout.entryRoomId)) {
    errors.push(`Entry room '${layout.entryRoomId}' not found`);
  }
  
  // Check exit room exists
  if (!layout.rooms.has(layout.exitRoomId)) {
    errors.push(`Exit room '${layout.exitRoomId}' not found`);
  }
  
  // Check all rooms are reachable from entry
  const reachable = new Set<string>();
  const queue = [layout.entryRoomId];
  
  while (queue.length > 0) {
    const roomId = queue.shift()!;
    if (reachable.has(roomId)) continue;
    reachable.add(roomId);
    
    const room = layout.rooms.get(roomId);
    if (room) {
      for (const connectedId of room.connections) {
        if (!reachable.has(connectedId)) {
          queue.push(connectedId);
        }
      }
    }
    
    // Check vertical connections
    for (const vc of layout.verticalConnections) {
      if (vc.upperRoom === roomId && !reachable.has(vc.lowerRoom)) {
        queue.push(vc.lowerRoom);
      }
      if (vc.lowerRoom === roomId && !reachable.has(vc.upperRoom)) {
        queue.push(vc.upperRoom);
      }
    }
  }
  
  // Check for unreachable rooms
  for (const roomId of layout.rooms.keys()) {
    if (!reachable.has(roomId)) {
      errors.push(`Room '${roomId}' is not reachable from entry`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// Export Constants
// ============================================

export { GRID_CELL_SIZE, FLOOR_HEIGHT, DIRECTION_OFFSETS, OPPOSITE_DIRECTION };
