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
  loadStageDefinition,
  getStartingStage
} from '../data';
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

  console.log(`Generated stage [${stageId}]:`, stage.id);
  console.log('Scenes:', stage.scenes.map(s => s.id));
  console.log('Entry:', stage.entrySceneId);

  // Create scene lookup map
  const sceneMap = new Map<string, SceneDefinition>();
  for (const scene of stage.scenes) {
    sceneMap.set(scene.id, scene);
  }

  let currentSceneId = stage.entrySceneId;

  const instance: GameInstance = {
    stageId,
    playerCharacter,
    opponentCharacter: playerCharacter === 'carl' ? 'paul' : 'carl',
    worldSeed,
    stage,
    currentSceneId,

    getCurrentScene() {
      return sceneMap.get(currentSceneId)!;
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

/**
 * Create a default room for the menu background.
 * Loads the starting stage from game.json's progression and generates
 * a preview scene from it.
 */
export async function createMenuRoom(): Promise<RoomConfig> {
  const startingStageId = getStartingStage();

  try {
    const rawStageDef = await loadStageDefinition(startingStageId);
    if (!rawStageDef) throw new Error('No stage def');

    const stageDef = rawStageDef as unknown as StageDefinition;
    const templates = templatesData.templates as unknown as SceneTemplate[];
    const palettes = templatesData.palettes as unknown as MaterialPalette[];

    // Generate a preview stage with a fixed seed
    const stage = generateStage(stageDef, templates, palettes, [], 'menu-preview');

    const entryScene = stage.scenes.find(s => s.id === stage.entrySceneId);
    if (entryScene) {
      return sceneToRoomConfig(entryScene);
    }
  } catch (e) {
    console.warn('Failed to generate menu room from stage definition:', e);
  }

  // Fallback if generation fails
  return {
    id: 'menu_room',
    name: 'The Apartment',
    width: 10,
    height: 10,
    exits: [],
    props: [
      { type: 'table', position: { x: 0, z: -1 }, rotation: 0, scale: 1, interactive: false },
      { type: 'chair', position: { x: -1.5, z: -1 }, rotation: Math.PI / 4, scale: 1, interactive: false },
      { type: 'chair', position: { x: 1.5, z: -1 }, rotation: -Math.PI / 4, scale: 1, interactive: false },
      { type: 'bookshelf', position: { x: -4, z: 0 }, rotation: Math.PI / 2, scale: 1, interactive: false },
      { type: 'lamp', position: { x: 3, z: 2 }, rotation: 0, scale: 1, interactive: false },
    ],
    enemies: []
  };
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
function sceneToRoomConfig(scene: SceneDefinition): RoomConfig {
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
