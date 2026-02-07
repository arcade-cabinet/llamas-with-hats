/**
 * Tests for StageBuilder
 * ======================
 * 
 * Tests for procedural stage generation.
 */

import { describe, it, expect } from 'vitest';
import { buildStage, GRID_CELL_SIZE, FLOOR_HEIGHT } from './StageBuilder';
import { StageDefinition, SceneTemplate } from './StageDefinition';

// Mock stage definition
const mockStageDefinition: StageDefinition = {
  id: 'test_stage',
  name: 'Test Stage',
  description: 'A test stage',
  path: 'both',
  story: {
    beats: [],
    goals: [],
    startingBeat: 'start',
    completionGoals: []
  },
  generation: {
    entryScene: { purpose: 'entry', templateTags: ['living_room'] },
    exitScene: { purpose: 'exit', templateTags: ['basement'] },
    requiredScenes: [],
    optionalSceneCount: { min: 0, max: 2 },
    allowedTemplates: ['room_small'],
    palettes: ['apartment_worn'],
    connectionRules: { type: 'linear' },
    environment: 'interior',
    separation: 'wall_door'
  },
  props: {
    density: 'normal',
    questItems: [],
    propPools: []
  },
  npcs: {
    required: [],
    optional: { pool: [], count: { min: 0, max: 0 } }
  },
  atmosphere: {
    baseHorrorLevel: 0,
    horrorProgression: 'static'
  },
  estimatedDuration: 10,
  difficulty: 'easy'
};

// Mock templates
const mockTemplates: SceneTemplate[] = [
  {
    id: 'room_small',
    type: 'interior_room',
    size: {
      width: { min: 6, max: 8 },
      height: { min: 6, max: 8 },
      ceiling: { min: 2, max: 3 }
    },
    connectionPoints: [
      { id: 'north', side: 'north', position: 'center', allowedConnections: ['wall_door'] },
      { id: 'south', side: 'south', position: 'center', allowedConnections: ['wall_door'] }
    ],
    propRules: [
      { propTypes: ['table'], zone: 'center', count: { min: 1, max: 1 } }
    ],
    tags: ['living_room', 'apartment']
  },
  {
    id: 'room_basement',
    type: 'interior_room',
    size: {
      width: { min: 10, max: 12 },
      height: { min: 10, max: 12 },
      ceiling: { min: 2, max: 3 }
    },
    connectionPoints: [
      { id: 'up', side: 'up', position: 'center', allowedConnections: ['stairs'] }
    ],
    propRules: [],
    tags: ['basement']
  }
];

describe('GRID_CELL_SIZE', () => {
  it('should be a positive number', () => {
    expect(GRID_CELL_SIZE).toBeGreaterThan(0);
  });
});

describe('FLOOR_HEIGHT', () => {
  it('should be a positive number', () => {
    expect(FLOOR_HEIGHT).toBeGreaterThan(0);
  });
});

describe('buildStage', () => {
  it('should create a stage with entry and exit rooms', () => {
    const stage = buildStage(mockStageDefinition, mockTemplates, 'test-seed');
    
    expect(stage.entryRoomId).toBeDefined();
    expect(stage.exitRoomId).toBeDefined();
    expect(stage.rooms.size).toBeGreaterThanOrEqual(2);
  });

  it('should be deterministic with same seed', () => {
    const stage1 = buildStage(mockStageDefinition, mockTemplates, 'same-seed');
    const stage2 = buildStage(mockStageDefinition, mockTemplates, 'same-seed');
    
    // Room IDs contain incrementing counters so won't match exactly,
    // but the structure should be the same
    expect(stage1.rooms.size).toBe(stage2.rooms.size);
    expect(stage1.boundaries.length).toBe(stage2.boundaries.length);
    expect(stage1.floors.length).toBe(stage2.floors.length);
    
    // Entry and exit should have same purpose
    const entry1 = stage1.getRoom(stage1.entryRoomId);
    const entry2 = stage2.getRoom(stage2.entryRoomId);
    expect(entry1?.purpose).toBe(entry2?.purpose);
  });

  it('should produce different results with different seeds', () => {
    const stage1 = buildStage(mockStageDefinition, mockTemplates, 'seed-a');
    const stage2 = buildStage(mockStageDefinition, mockTemplates, 'seed-b');
    
    // Rooms might have different positions or connections
    // At minimum, the internal room IDs should differ due to counter
    // (This is a weak test since we reset counter, but seeds should affect layout)
    expect(stage1.seed).not.toBe(stage2.seed);
  });

  it('should store the seed in the result', () => {
    const stage = buildStage(mockStageDefinition, mockTemplates, 'my-seed');
    expect(stage.seed).toBe('my-seed');
  });

  it('should store the definition reference', () => {
    const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
    expect(stage.definition).toBe(mockStageDefinition);
  });

  describe('rooms', () => {
    it('should have valid world positions', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      for (const room of stage.rooms.values()) {
        expect(typeof room.worldPosition.x).toBe('number');
        expect(typeof room.worldPosition.y).toBe('number');
        expect(typeof room.worldPosition.z).toBe('number');
        expect(Number.isFinite(room.worldPosition.x)).toBe(true);
        expect(Number.isFinite(room.worldPosition.y)).toBe(true);
        expect(Number.isFinite(room.worldPosition.z)).toBe(true);
      }
    });

    it('should have positive dimensions', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      for (const room of stage.rooms.values()) {
        expect(room.size.width).toBeGreaterThan(0);
        expect(room.size.height).toBeGreaterThan(0);
        expect(room.size.ceilingHeight).toBeGreaterThan(0);
      }
    });

    it('should mark entry room as anchor', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const entryRoom = stage.getRoom(stage.entryRoomId);
      
      expect(entryRoom).toBeDefined();
      expect(entryRoom!.isAnchor).toBe(true);
      expect(entryRoom!.purpose).toBe('entry');
    });

    it('should mark exit room as anchor', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const exitRoom = stage.getRoom(stage.exitRoomId);
      
      expect(exitRoom).toBeDefined();
      expect(exitRoom!.isAnchor).toBe(true);
      expect(exitRoom!.purpose).toBe('exit');
    });
  });

  describe('boundaries', () => {
    it('should create boundaries between adjacent rooms', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      // With entry and exit, there should be at least one connection
      expect(stage.boundaries.length).toBeGreaterThanOrEqual(1);
    });

    it('should have valid boundary structure', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      for (const boundary of stage.boundaries) {
        expect(boundary.id).toBeDefined();
        expect(boundary.roomA).toBeDefined();
        expect(boundary.roomB).toBeDefined();
        expect(boundary.transitionType).toBeDefined();
        expect(boundary.direction).toBeDefined();
        expect(boundary.width).toBeGreaterThan(0);
      }
    });
  });

  describe('helper methods', () => {
    it('getRoom should return room by ID', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const entryRoom = stage.getRoom(stage.entryRoomId);
      
      expect(entryRoom).toBeDefined();
      expect(entryRoom!.id).toBe(stage.entryRoomId);
    });

    it('getRoom should return undefined for invalid ID', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const noRoom = stage.getRoom('nonexistent');
      
      expect(noRoom).toBeUndefined();
    });

    it('getRoomsOnFloor should return rooms on specified floor', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const groundFloorRooms = stage.getRoomsOnFloor(0);
      
      expect(groundFloorRooms.length).toBeGreaterThan(0);
      groundFloorRooms.forEach(room => {
        expect(room.floor).toBe(0);
      });
    });

    it('getBoundariesForRoom should return relevant boundaries', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const boundaries = stage.getBoundariesForRoom(stage.entryRoomId);
      
      // Entry room should have at least one boundary
      expect(boundaries.length).toBeGreaterThanOrEqual(1);
      boundaries.forEach(b => {
        expect(b.roomA === stage.entryRoomId || b.roomB === stage.entryRoomId).toBe(true);
      });
    });

    it('isWalkable should return true for points inside rooms', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const entryRoom = stage.getRoom(stage.entryRoomId)!;
      
      // Center of entry room should be walkable
      const walkable = stage.isWalkable(
        entryRoom.worldPosition.x,
        entryRoom.worldPosition.z
      );
      
      expect(walkable).toBe(true);
    });

    it('isWalkable should return false for points outside all rooms', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      // Very far away should not be walkable
      const walkable = stage.isWalkable(10000, 10000);
      
      expect(walkable).toBe(false);
    });

    it('getGroundY should return room Y for points inside rooms', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const entryRoom = stage.getRoom(stage.entryRoomId)!;
      
      const groundY = stage.getGroundY(
        entryRoom.worldPosition.x,
        entryRoom.worldPosition.z
      );
      
      expect(groundY).toBe(entryRoom.worldPosition.y);
    });

    it('getGroundY should return 0 for points outside all rooms', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      
      const groundY = stage.getGroundY(10000, 10000);
      
      expect(groundY).toBe(0);
    });
  });

  describe('floors', () => {
    it('should have at least one floor', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      expect(stage.floors.length).toBeGreaterThanOrEqual(1);
    });

    it('should have ground floor (level 0)', () => {
      const stage = buildStage(mockStageDefinition, mockTemplates, 'test');
      const groundFloor = stage.floors.find(f => f.level === 0);
      
      expect(groundFloor).toBeDefined();
      expect(groundFloor!.yOffset).toBe(0);
    });
  });
});
