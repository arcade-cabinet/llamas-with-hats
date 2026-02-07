/**
 * Game Initializer
 * ================
 *
 * Ties together all the systems to initialize a game from JSON definitions.
 * This is the bridge between our DDL schemas and the runtime game.
 *
 * Stage definitions are loaded dynamically via the data module — this file
 * has ZERO knowledge of which stages exist. Stage identity flows from
 * game.json's stageProgression linked list through the state layer.
 *
 * Usage:
 * ```ts
 * const game = await initializeGame('stage1_apartment', 'carl', worldSeed);
 * // game.currentScene is ready to render
 * // game.stage has all generated content
 * ```
 */

import {
  StageDefinition,
  SceneTemplate,
  MaterialPalette,
  CompositionModule
} from './StageDefinition';
import { generateStage, GeneratedStage } from './StageGenerator';
import { SceneDefinition } from './SceneDefinition';
import { CharacterType, WorldSeed, RoomConfig, RoomExit, PropConfig } from '../types/game';
import {
  generateLayout,
  GeneratedLayout,
  StageLayoutDefinition,
  LayoutPattern,
  ConnectionType,
} from './LayoutGenerator';

import {
  loadStageDefinition,
  getLayoutArchetype,
} from '../data';
import {
  LevelDefinition,
  AnchorRoomDef,
  LevelVerticalConnection
} from './LayoutGenerator';
import templatesData from '../data/global/templates/rooms.json';

// ============================================
// Types
// ============================================

export interface GameInstance {
  /** The stage this game is running */
  stageId: string;

  /** The character player chose */
  playerCharacter: CharacterType;

  /** The opponent character (AI controlled) */
  opponentCharacter: CharacterType;

  /** World seed used for generation */
  worldSeed: WorldSeed;

  /** The full generated stage */
  stage: GeneratedStage;

  /** Current scene the player is in */
  currentSceneId: string;

  /** Generated multi-room layout for seamless rendering */
  layout: GeneratedLayout | null;

  /** Pre-computed RoomConfigs for all scenes (keyed by scene ID) */
  allRoomConfigs: Map<string, RoomConfig>;

  /** Get the current scene definition */
  getCurrentScene: () => SceneDefinition;

  /** Convert scene to RoomConfig for renderer */
  getCurrentRoom: () => RoomConfig;

  /** Get scene by ID */
  getScene: (id: string) => SceneDefinition | undefined;

  /** Transition to another scene */
  transitionTo: (sceneId: string) => void;
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize a new game from JSON definitions.
 *
 * Loads the stage definition dynamically by stageId, generates the world
 * procedurally, and returns a game instance ready to play.
 */
export async function initializeGame(
  stageId: string,
  playerCharacter: CharacterType,
  worldSeed: WorldSeed
): Promise<GameInstance> {
  // Load stage definition dynamically from the data module
  const rawStageDef = await loadStageDefinition(stageId);
  if (!rawStageDef) {
    throw new Error(`Failed to load stage definition: ${stageId}`);
  }

  const stageDef = rawStageDef as unknown as StageDefinition;
  const templates = templatesData.templates as unknown as SceneTemplate[];
  const palettes = templatesData.palettes as unknown as MaterialPalette[];
  const modules: CompositionModule[] = [];

  // Generate the stage
  const stage = generateStage(
    stageDef,
    templates,
    palettes,
    modules,
    worldSeed.seedString
  );

  // Create scene lookup map
  const sceneMap = new Map<string, SceneDefinition>();
  for (const scene of stage.scenes) {
    sceneMap.set(scene.id, scene);
  }

  // Pre-compute all RoomConfigs
  const allRoomConfigs = new Map<string, RoomConfig>();
  for (const scene of stage.scenes) {
    allRoomConfigs.set(scene.id, sceneToRoomConfig(scene));
  }

  // Generate multi-room layout from stage definition's layout block
  let layout: GeneratedLayout | null = null;
  const rawLayout = (rawStageDef as Record<string, unknown>).layout as Record<string, unknown> | undefined;
  if (rawLayout) {
    const layoutDef = buildStageLayoutDef(rawStageDef as Record<string, unknown>);
    if (layoutDef) {
      layout = generateLayout(layoutDef, worldSeed.seedString);
    }
  }

  let currentSceneId = stage.entrySceneId;

  const instance: GameInstance = {
    stageId,
    playerCharacter,
    opponentCharacter: playerCharacter === 'carl' ? 'paul' : 'carl',
    worldSeed,
    stage,
    currentSceneId,
    layout,
    allRoomConfigs,

    getCurrentScene() {
      const scene = sceneMap.get(currentSceneId);
      if (!scene) {
        throw new Error(`Scene not found: "${currentSceneId}". Available scenes: ${Array.from(sceneMap.keys()).join(', ')}`);
      }
      return scene;
    },

    getCurrentRoom() {
      return sceneToRoomConfig(this.getCurrentScene());
    },

    getScene(id: string) {
      return sceneMap.get(id);
    },

    transitionTo(sceneId: string) {
      if (sceneMap.has(sceneId)) {
        currentSceneId = sceneId;
        instance.currentSceneId = sceneId;
      }
    }
  };

  return instance;
}

// ============================================
// Conversion Helpers
// ============================================

/**
 * Convert a SceneDefinition to RoomConfig for the renderer.
 *
 * The renderer expects RoomConfig, but our generation produces SceneDefinition.
 * This bridges the gap.
 */
export function sceneToRoomConfig(scene: SceneDefinition): RoomConfig {
  // Convert exits (filter out vertical exits which RoomConfig doesn't support)
  const exits: RoomExit[] = scene.exits
    .filter(exit => ['north', 'south', 'east', 'west'].includes(exit.direction))
    .map(exit => {
      // Extract requiredItem from lockCondition if present
      let requiredItem: string | undefined;
      if (exit.lockCondition?.type === 'hasItem') {
        requiredItem = exit.lockCondition.params.itemId as string;
      }

      return {
        id: exit.id,
        direction: exit.direction as 'north' | 'south' | 'east' | 'west',
        targetRoom: exit.targetScene,
        position: {
          x: exit.position[0],
          z: exit.position[2]
        },
        locked: exit.locked,
        requiredItem
      };
    });

  // Convert props
  const props: PropConfig[] = scene.props.map(prop => {
    // Extract item drop from pickup interaction
    let itemDrop: string | undefined;
    if (prop.interaction?.type === 'pickup' && prop.interaction.action.type === 'sequence') {
      const params = prop.interaction.action.params as { actions?: Array<{ type: string; params?: { entityId?: string } }> };
      const despawnAction = params.actions?.find(a => a.type === 'despawn');
      if (despawnAction?.params?.entityId) {
        itemDrop = despawnAction.params.entityId;
      }
    }

    return {
      type: prop.type,
      position: {
        x: prop.transform.position[0],
        z: prop.transform.position[2]
      },
      rotation: prop.transform.rotation?.[1] ?? 0,
      scale: typeof prop.transform.scale === 'number' ? prop.transform.scale : 1,
      interactive: prop.interactable ?? false,
      itemDrop
    };
  });

  // Convert hostile NPCs to enemies
  const enemies = scene.npcs
    .filter(npc => {
      const hostileBehaviors = ['hostile', 'chase', 'attack'];
      return hostileBehaviors.includes(npc.behavior) ||
             npc.tags?.includes('hostile') ||
             npc.tags?.includes('enemy');
    })
    .map(npc => ({
      id: npc.id,
      character: npc.character,
      position: {
        x: npc.transform.position[0],
        z: npc.transform.position[2]
      },
      behavior: npc.behavior
    }));

  return {
    id: scene.id,
    name: scene.name,
    width: scene.bounds.width,
    height: scene.bounds.height,
    exits,
    props,
    enemies
  };
}

/**
 * Build a StageLayoutDefinition from a raw stage definition JSON.
 *
 * The stage JSON has two relevant blocks:
 * - `layout`: { archetypeId, levelOverrides } — declares which archetype to use
 *   and per-level customizations (extra anchors, quest items, story beats)
 * - `generation`: { entryScene, exitScene, connectionRules, ... } — scene generation
 *   params used by StageGenerator (not LayoutGenerator)
 *
 * This function loads the archetype by ID, merges levelOverrides onto it,
 * and converts the result into the StageLayoutDefinition format that
 * generateLayout() expects.
 */
function buildStageLayoutDef(raw: Record<string, unknown>): StageLayoutDefinition | null {
  const layoutBlock = raw.layout as { archetypeId?: string; levelOverrides?: Record<string, unknown> } | undefined;
  if (!layoutBlock?.archetypeId) return null;

  const archetype = getLayoutArchetype(layoutBlock.archetypeId);
  if (!archetype) {
    console.error(`Layout archetype not found: "${layoutBlock.archetypeId}"`);
    return null;
  }

  const overrides = layoutBlock.levelOverrides || {};
  const genBlock = raw.generation as Record<string, unknown> | undefined;

  // Convert archetype levels → LevelDefinition[], merging overrides
  const FLOOR_HEIGHT = 4;
  const levels: LevelDefinition[] = (archetype.levels as ArchetypeLevelConfig[]).map(archetypeLevel => {
    const levelOverride = overrides[String(archetypeLevel.level)] as Record<string, unknown> | undefined;

    // Merge anchor rooms: archetype provides defaults, overrides can replace/extend
    const baseAnchors = archetypeLevel.anchorRooms || [];
    const overrideAnchors = (levelOverride?.anchorRooms as ArchetypeAnchorRoom[] | undefined) || [];

    // Build a map of anchors by purpose, override wins
    const anchorMap = new Map<string, ArchetypeAnchorRoom>();
    for (const a of baseAnchors) anchorMap.set(a.purpose, a);
    for (const a of overrideAnchors) anchorMap.set(a.purpose, a);

    // Convert to AnchorRoomDef format
    const anchorRooms: AnchorRoomDef[] = Array.from(anchorMap.values()).map((a, i) => ({
      id: `anchor_${archetypeLevel.level}_${i}`,
      purpose: mapPurpose(a.purpose),
      templateId: a.templateId || findTemplateByTags(a.templateTags || []),
      gridPosition: a.gridPosition,
      storyBeats: a.storyBeats,
      required: true,
      connections: [],
      questItems: a.questItems,
    }));

    // Filler rooms from archetype fillerRules
    const fillerRules = archetypeLevel.fillerRules as { allowedTemplates?: string[] } | undefined;
    const totalRoomsSpec = (levelOverride?.totalRooms || archetypeLevel.totalRooms) as { min: number; max: number } | number | undefined;
    const totalRoomsNum = typeof totalRoomsSpec === 'number'
      ? totalRoomsSpec
      : (totalRoomsSpec ? totalRoomsSpec.max : anchorRooms.length + 2);
    const fillerCount = Math.max(0, totalRoomsNum - anchorRooms.length);

    // Vertical connections
    const vertConns = (archetypeLevel.verticalConnections || []) as ArchetypeVerticalConn[];
    const verticalConnections: LevelVerticalConnection[] = vertConns.map((vc, i) => ({
      id: `vert_${archetypeLevel.level}_${i}`,
      type: (vc.type || 'stairs') as 'stairs' | 'ramp' | 'ladder' | 'elevator',
      fromRoom: '',  // resolved by generateLayout
      position: { x: vc.gridPosition.x * 12, z: vc.gridPosition.z * 12 },
      direction: vc.direction,
      targetLevel: vc.targetLevel,
      targetRoom: '',  // resolved by generateLayout
      locked: vc.locked,
      lockId: vc.lockId,
    }));

    return {
      level: archetypeLevel.level,
      name: archetypeLevel.name,
      yOffset: archetypeLevel.level * FLOOR_HEIGHT,
      pattern: (archetypeLevel.pattern || 'branching') as LevelDefinition['pattern'],
      totalRooms: totalRoomsNum,
      alignment: 'center',
      palette: archetypeLevel.palette as string | undefined,
      anchorRooms,
      fillerRooms: {
        count: { min: Math.max(0, fillerCount - 1), max: fillerCount },
        templates: fillerRules?.allowedTemplates || ['room_small', 'hallway_short', 'closet'],
        spawnZone: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 },
        mustConnectToAnchor: true,
      },
      verticalConnections,
    };
  });

  // Determine entry and exit rooms from anchor rooms
  let entryRoomId = 'living_room';
  let exitRoomId = 'exit';
  for (const level of levels) {
    for (const anchor of level.anchorRooms) {
      // Check the original archetype data for isEntry/isExit flags
      const archetypeLevel = (archetype.levels as ArchetypeLevelConfig[]).find(l => l.level === level.level);
      const archetypeAnchor = archetypeLevel?.anchorRooms.find(a => a.purpose === reverseMapPurpose(anchor.purpose));
      if (archetypeAnchor?.isEntry) entryRoomId = anchor.id;
      if (archetypeAnchor?.isExit) exitRoomId = anchor.id;
    }
  }

  // Connection rules from generation block or archetype
  const genConnectionRules = genBlock?.connectionRules as Record<string, unknown> | undefined;
  const archetypeConnRules = archetype.connectionRules as { defaultType?: string; maxDoorsPerRoom?: number } | undefined;

  return {
    id: (raw.id as string) || 'unknown',
    name: (raw.name as string) || 'Unknown Stage',
    layoutArchetype: layoutBlock.archetypeId,
    levels,
    connectionRules: {
      type: ((genConnectionRules?.type as string) || 'branching') as LayoutPattern,
      defaultConnectionType: (archetypeConnRules?.defaultType || (genConnectionRules?.separation as string) || 'wall_door') as ConnectionType,
      maxDeadEnds: (genConnectionRules?.maxDeadEnds as number) || 2,
      loopsAllowed: (genConnectionRules?.loopsAllowed as boolean) || false,
      maxDistanceFromEntry: (genConnectionRules?.maxDistanceFromEntry as number) || 5,
    },
    entryScene: {
      roomId: entryRoomId,
      spawnPoint: { x: 0, z: 2 },
    },
    exitScene: {
      roomId: exitRoomId,
    },
  };
}

// ── Archetype JSON shape helpers ──

interface ArchetypeAnchorRoom {
  purpose: string;
  gridPosition: { x: number; z: number };
  templateId?: string;
  templateTags?: string[];
  isEntry?: boolean;
  isExit?: boolean;
  storyBeats?: string[];
  questItems?: string[];
}

interface ArchetypeLevelConfig {
  level: number;
  name: string;
  pattern?: string;
  totalRooms?: { min: number; max: number } | number;
  anchorRooms: ArchetypeAnchorRoom[];
  fillerRules?: { allowedTemplates?: string[]; growthStrategy?: string; palette?: string };
  verticalConnections?: ArchetypeVerticalConn[];
  palette?: string;
}

interface ArchetypeVerticalConn {
  gridPosition: { x: number; z: number };
  direction: 'up' | 'down';
  targetLevel: number;
  type?: string;
  locked?: boolean;
  lockId?: string;
}

/** Map archetype purpose strings to AnchorRoomDef purpose enum. */
function mapPurpose(purpose: string): AnchorRoomDef['purpose'] {
  switch (purpose) {
    case 'entry': return 'entry';
    case 'exit':
    case 'basement_main': return 'exit';
    default: return 'story_critical';
  }
}

function reverseMapPurpose(purpose: AnchorRoomDef['purpose']): string {
  return purpose;
}

/** Find a template ID from template tags (best effort). */
function findTemplateByTags(tags: string[]): string {
  // Map common tags to known template IDs
  const tagToTemplate: Record<string, string> = {
    living_room: 'room_medium',
    kitchen: 'room_kitchen',
    bedroom: 'room_bedroom',
    bathroom: 'room_bathroom',
    basement: 'room_basement',
    hallway: 'hallway_short',
    storage: 'room_small',
    closet: 'closet',
  };
  for (const tag of tags) {
    if (tagToTemplate[tag]) return tagToTemplate[tag];
  }
  return 'room_medium';
}

/**
 * Get spawn position for entering a scene from a direction.
 */
export function getSpawnPosition(
  scene: SceneDefinition,
  fromDirection: 'north' | 'south' | 'east' | 'west'
): { x: number; z: number } {
  // Find the matching spawn point
  const spawnId = `spawn_${fromDirection}`;
  const spawn = scene.spawnPoints.find(sp => sp.id === spawnId);

  if (spawn) {
    return {
      x: spawn.transform.position[0],
      z: spawn.transform.position[2]
    };
  }

  // Default spawn based on direction
  const hw = scene.bounds.width / 2 - 2;
  const hh = scene.bounds.height / 2 - 2;

  switch (fromDirection) {
    case 'north': return { x: 0, z: -hh };
    case 'south': return { x: 0, z: hh };
    case 'east': return { x: hw, z: 0 };
    case 'west': return { x: -hw, z: 0 };
  }
}
